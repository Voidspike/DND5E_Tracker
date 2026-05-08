import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../utils/prisma';
import { AuthPayload } from '@dnd/shared';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  campaignId?: string;
}

export function setupSocket(httpServer: HTTPServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: config.corsOrigins,
      credentials: true,
    },
  });

  // Auth middleware for socket connections
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const payload = jwt.verify(token as string, config.jwtSecret) as AuthPayload;
      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as AuthenticatedSocket;
    console.log(`User connected: ${socket.username} (${socket.userId})`);

    // Helper to emit system chat messages
    async function emitSystemMessage(campaignId: string, content: string) {
      try {
        const sysMsg = await prisma.chatMessage.create({
          data: {
            campaignId,
            userId: socket.userId!,
            username: 'System',
            content,
            type: 'system',
          },
        });
        io.to(`campaign:${campaignId}`).emit('chat:message', sysMsg as any);
      } catch (err) {
        console.error('System message error:', err);
      }
    }

    async function appendCombatLog(combatId: string, campaignId: string, type: string, message: string, round: number) {
      try {
        const combat = await prisma.combatTracker.findUnique({ where: { id: combatId }, select: { log: true } });
        if (!combat) return;
        const logs = (combat.log as any[]) || [];
        const entry = { type, message, round, timestamp: new Date().toISOString() };
        logs.push(entry);
        await prisma.combatTracker.update({ where: { id: combatId }, data: { log: logs as any } });
        io.to(`campaign:${campaignId}`).emit('combat:log', entry);
      } catch (err) {
        console.error('Combat log append error:', err);
      }
    }

    // ─── Room Management ───
    socket.on('room:join', (campaignId: string) => {
      socket.campaignId = campaignId;
      socket.join(`campaign:${campaignId}`);
      io.to(`campaign:${campaignId}`).emit('room:players', getOnlinePlayers(io, campaignId));
      emitSystemMessage(campaignId, `${socket.username} joined the room.`);
    });

    socket.on('room:leave', (campaignId: string) => {
      socket.leave(`campaign:${campaignId}`);
      socket.campaignId = undefined;
      io.to(`campaign:${campaignId}`).emit('room:players', getOnlinePlayers(io, campaignId));
      emitSystemMessage(campaignId, `${socket.username} left the room.`);
    });

    // ─── Token Operations ───
    socket.on('token:create', async (data) => {
      try {
        const token = await prisma.token.create({
          data: {
            mapId: data.token.mapId,
            campaignId: data.campaignId,
            type: data.token.type || 'character',
            name: data.token.name,
            x: data.token.x || 0,
            y: data.token.y || 0,
            ownerId: data.token.ownerId || null,
            imageUrl: data.token.imageUrl || null,
            color: data.token.color || '#ffffff',
            hpCurrent: data.token.hpCurrent || null,
            hpMax: data.token.hpMax || null,
            ac: data.token.ac || null,
            darkvision: data.token.darkvision || null,
            speed: data.token.speed || null,
            characterId: data.token.characterId || null,
          },
        });
        io.to(`campaign:${data.campaignId}`).emit('token:create', token as any);
      } catch (err) {
        console.error('Socket token:create error:', err);
      }
    });

    // Token drag: real-time broadcast during drag (no DB write)
    socket.on('token:drag', (data) => {
      if (!socket.campaignId) return;
      socket.to(`campaign:${socket.campaignId}`).emit('token:move', {
        id: data.tokenId,
        x: data.x,
        y: data.y,
      });
    });

    // Token move: final position save + broadcast
    socket.on('token:move', (data) => {
      if (!socket.campaignId) return;
      prisma.token
        .update({ where: { id: data.tokenId }, data: { x: data.x, y: data.y } })
        .catch(console.error);
      io.to(`campaign:${socket.campaignId}`).emit('token:move', {
        id: data.tokenId,
        x: data.x,
        y: data.y,
      });
    });

    socket.on('token:update', async (data) => {
      if (!socket.campaignId) return;
      try {
        const token = await prisma.token.update({
          where: { id: data.tokenId },
          data: data.updates as any,
        });
        io.to(`campaign:${socket.campaignId}`).emit('token:update', token as any);
      } catch (err) {
        console.error('Socket token:update error:', err);
      }
    });

    socket.on('token:delete', async (tokenId: string) => {
      if (!socket.campaignId) return;
      const token = await prisma.token.findUnique({ where: { id: tokenId } });
      if (!token || token.campaignId !== socket.campaignId) return;
      await prisma.token.delete({ where: { id: tokenId } });
      io.to(`campaign:${socket.campaignId}`).emit('token:delete', tokenId);
    });

    socket.on('token:select', (tokenId: string | null) => {
      if (!socket.campaignId) return;
      socket.to(`campaign:${socket.campaignId}`).emit('token:select', tokenId);
    });

    // ─── Map Operations ───
    socket.on('map:fog:update', (data) => {
      if (!socket.campaignId) return;
      prisma.map
        .update({ where: { id: data.mapId }, data: { fogData: data.fogData } })
        .catch(console.error);
      socket.to(`campaign:${data.campaignId}`).emit('map:fog:update', data.fogData);
    });

    socket.on('map:grid:update', (data) => {
      prisma.map
        .update({ where: { id: data.mapId }, data: data.grid })
        .catch(console.error);
      socket.to(`campaign:${data.campaignId}`).emit('map:grid:update', data.grid);
    });

    // ─── Combat Operations ───
    socket.on('combat:start', async (campaignId: string) => {
      if (!socket.campaignId) return;
      const combat = await prisma.combatTracker.create({
        data: { campaignId },
        include: { participants: true },
      });
      io.to(`campaign:${campaignId}`).emit('combat:start', combat as any);
      emitSystemMessage(campaignId, 'Combat has started!');
      appendCombatLog(combat.id, campaignId, 'start', 'Combat started', 1);
    });

    socket.on('combat:end', async (combatId: string) => {
      if (!socket.campaignId) return;
      const combat = await prisma.combatTracker.findUnique({ where: { id: combatId } });
      await prisma.combatTracker.update({ where: { id: combatId }, data: { isActive: false } });
      io.to(`campaign:${socket.campaignId}`).emit('combat:end');
      emitSystemMessage(socket.campaignId!, 'Combat has ended.');
      appendCombatLog(combatId, socket.campaignId!, 'end', 'Combat ended', combat?.round || 1);
    });

    socket.on('combat:next_turn', async (combatId: string) => {
      if (!socket.campaignId) return;
      const combat = await prisma.combatTracker.findUnique({
        where: { id: combatId },
        include: { participants: true },
      });
      if (!combat || combat.participants.length === 0) return;

      // Clear isActiveTurn on all participants
      await prisma.combatParticipant.updateMany({
        where: { combatId },
        data: { isActiveTurn: false },
      });

      const prevIndex = combat.currentTurnIndex;
      const nextIndex = (prevIndex + 1) % combat.participants.length;
      const updated = await prisma.combatTracker.update({
        where: { id: combatId },
        data: {
          currentTurnIndex: nextIndex,
          round: nextIndex === 0 ? combat.round + 1 : combat.round,
        },
        include: { participants: true },
      });
      // Set isActiveTurn on the current participant
      if (updated.participants.length > 0) {
        await prisma.combatParticipant.update({
          where: { id: updated.participants[nextIndex].id },
          data: { isActiveTurn: true },
        });
        updated.participants = updated.participants.map((p, i) => ({
          ...p,
          isActiveTurn: i === nextIndex,
        }));
      }
      const currentParticipant = updated.participants[nextIndex];
      const label = currentParticipant?.label || currentParticipant?.tokenId?.slice(0, 8) || 'Unknown';
      io.to(`campaign:${socket.campaignId}`).emit('combat:next_turn', updated as any);
      appendCombatLog(combatId, socket.campaignId!, 'turn', `Round ${updated.round} — ${label}'s turn`, updated.round);
    });

    socket.on('combat:prev_turn', async (combatId: string) => {
      if (!socket.campaignId) return;
      const combat = await prisma.combatTracker.findUnique({
        where: { id: combatId },
        include: { participants: true },
      });
      if (!combat || combat.participants.length === 0) return;

      await prisma.combatParticipant.updateMany({
        where: { combatId },
        data: { isActiveTurn: false },
      });

      const prevIndex = (combat.currentTurnIndex - 1 + combat.participants.length) % combat.participants.length;
      const updated = await prisma.combatTracker.update({
        where: { id: combatId },
        data: { currentTurnIndex: prevIndex },
        include: { participants: true },
      });
      if (updated.participants.length > 0) {
        await prisma.combatParticipant.update({
          where: { id: updated.participants[prevIndex].id },
          data: { isActiveTurn: true },
        });
        updated.participants = updated.participants.map((p, i) => ({
          ...p,
          isActiveTurn: i === prevIndex,
        }));
      }
      const cp = updated.participants[prevIndex];
      const plabel = cp?.label || cp?.tokenId?.slice(0, 8) || 'Unknown';
      io.to(`campaign:${socket.campaignId}`).emit('combat:prev_turn', updated as any);
      appendCombatLog(combatId, socket.campaignId!, 'turn', `Round ${updated.round} — ${plabel}'s turn`, updated.round);
    });

    socket.on('combat:add', async (data) => {
      if (!socket.campaignId) return;
      const participant = await prisma.combatParticipant.create({
        data: {
          combatId: data.combatId,
          tokenId: data.tokenId,
          initiative: data.initiative,
          label: data.label || null,
        },
      });
      const combat = await prisma.combatTracker.findUnique({ where: { id: data.combatId }, select: { round: true } });
      const pname = data.label || data.tokenId.slice(0, 8);
      io.to(`campaign:${socket.campaignId}`).emit('combat:add', participant as any);
      appendCombatLog(data.combatId, socket.campaignId!, 'add', `${pname} joined combat (Init ${data.initiative})`, combat?.round || 1);
    });

    socket.on('combat:remove', async (data) => {
      if (!socket.campaignId) return;
      const participant = await prisma.combatParticipant.findUnique({ where: { id: data.participantId } });
      await prisma.combatParticipant.delete({ where: { id: data.participantId } });
      const combat = await prisma.combatTracker.findUnique({ where: { id: data.combatId }, select: { round: true } });
      const rname = participant?.label || participant?.tokenId?.slice(0, 8) || 'Unknown';
      io.to(`campaign:${socket.campaignId}`).emit('combat:remove', data.participantId);
      appendCombatLog(data.combatId, socket.campaignId!, 'remove', `${rname} removed from combat`, combat?.round || 1);
    });

    socket.on('combat:initiative:update', async (data) => {
      if (!socket.campaignId) return;
      const participant = await prisma.combatParticipant.update({
        where: { id: data.participantId },
        data: { initiative: data.initiative },
      });
      const combat = await prisma.combatTracker.findUnique({ where: { id: participant.combatId }, select: { round: true } });
      const iname = participant.label || participant.tokenId.slice(0, 8);
      io.to(`campaign:${socket.campaignId}`).emit('combat:initiative:update', participant as any);
      appendCombatLog(participant.combatId, socket.campaignId!, 'initiative', `${iname}'s initiative set to ${data.initiative}`, combat?.round || 1);
    });

    // ─── Dice ───
    socket.on('dice:roll', async (data) => {
      const max = parseInt(data.request.diceType.slice(1), 10);
      const result = Math.floor(Math.random() * max) + 1 + (data.request.modifier || 0);

      const roll = await prisma.diceRoll.create({
        data: {
          userId: socket.userId!,
          campaignId: data.campaignId,
          diceType: data.request.diceType,
          modifier: data.request.modifier || 0,
          result,
          isPrivate: data.request.isPrivate || false,
          label: data.request.label || null,
        },
      });

      if (data.request.isPrivate) {
        // Send only to the roller and the DM
        socket.emit('dice:roll_private', roll as any);
        const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
        if (campaign) {
          io.to(`user:${campaign.dmId}`).emit('dice:roll_private', roll as any);
        }
      } else {
        io.to(`campaign:${data.campaignId}`).emit('dice:roll', roll as any);
      }
    });

    // ─── Chat ───
    socket.on('chat:message', async (data) => {
      const msg = await prisma.chatMessage.create({
        data: {
          campaignId: data.campaignId,
          userId: socket.userId!,
          username: socket.username!,
          content: data.content,
          type: 'text',
        },
      });
      io.to(`campaign:${data.campaignId}`).emit('chat:message', msg as any);
    });

    socket.on('chat:whisper', async (data) => {
      const msg = await prisma.chatMessage.create({
        data: {
          campaignId: data.campaignId,
          userId: socket.userId!,
          username: socket.username!,
          content: data.content,
          type: 'text',
          isPrivate: true,
        },
      });
      // Send to sender and DM
      socket.emit('chat:whisper', { ...msg, note: 'Sent to DM' } as any);
      const campaign = await prisma.campaign.findUnique({ where: { id: data.campaignId } });
      if (campaign) {
        io.to(`user:${campaign.dmId}`).emit('chat:whisper', msg as any);
      }
    });

    socket.on('disconnect', () => {
      if (socket.campaignId) {
        io.to(`campaign:${socket.campaignId}`).emit('room:players', getOnlinePlayers(io, socket.campaignId));
      }
      console.log(`User disconnected: ${socket.username}`);
    });
  });

  return io;
}

function getOnlinePlayers(io: Server, campaignId: string): Array<{ userId: string; username: string }> {
  const room = io.sockets.adapter.rooms.get(`campaign:${campaignId}`);
  if (!room) return [];
  const players: Array<{ userId: string; username: string }> = [];
  for (const socketId of room) {
    const sock = io.sockets.sockets.get(socketId) as AuthenticatedSocket | undefined;
    if (sock?.userId) {
      players.push({ userId: sock.userId, username: sock.username || 'Unknown' });
    }
  }
  return players;
}
