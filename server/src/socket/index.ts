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

    // Check if socket user is the DM of their current campaign
    async function isDM(): Promise<boolean> {
      if (!socket.campaignId || !socket.userId) return false;
      const campaign = await prisma.campaign.findUnique({
        where: { id: socket.campaignId },
        select: { dmId: true },
      });
      return campaign?.dmId === socket.userId;
    }

    // Check if socket user can modify a token (DM or owner)
    async function canModifyToken(tokenId: string): Promise<boolean> {
      if (!socket.userId) return false;
      if (await isDM()) return true;
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        select: { ownerId: true },
      });
      return token?.ownerId === socket.userId;
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
    // Token create: relay to other clients (REST API already persisted it)
    socket.on('token:create', (data) => {
      if (!socket.campaignId) return;
      socket.to(`campaign:${data.campaignId}`).emit('token:create', data.token as any);
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

    // Token move: final position save + broadcast (DM or token owner)
    socket.on('token:move', async (data) => {
      if (!socket.campaignId || !(await canModifyToken(data.tokenId))) return;
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
      if (!socket.campaignId || !(await canModifyToken(tokenId))) return;
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
    socket.on('map:fog:update', async (data) => {
      if (!socket.campaignId || !(await isDM())) return;
      prisma.map
        .update({ where: { id: data.mapId }, data: { fogData: data.fogData } })
        .catch(console.error);
      socket.to(`campaign:${data.campaignId}`).emit('map:fog:update', data.fogData);
    });

    socket.on('map:grid:update', async (data) => {
      if (!socket.campaignId || !(await isDM())) return;
      prisma.map
        .update({ where: { id: data.mapId }, data: data.grid })
        .catch(console.error);
      socket.to(`campaign:${data.campaignId}`).emit('map:grid:update', data.grid);
    });

    // ─── Map Annotations ───
    socket.on('map:annotation:update', async (data) => {
      if (!socket.campaignId || !(await isDM())) return;
      socket.to(`campaign:${data.campaignId}`).emit('map:annotation:update', data.data);
    });

    socket.on('map:annotation:clear', async (data) => {
      if (!socket.campaignId || !(await isDM())) return;
      socket.to(`campaign:${data.campaignId}`).emit('map:annotation:clear');
    });

    // DM viewport sync — push DM's zoom/pan to all players
    socket.on('map:viewport:sync', async (data: { campaignId: string; mapId: string; offset: { x: number; y: number }; scale: number }) => {
      if (!socket.campaignId || !(await isDM())) return;
      socket.to(`campaign:${data.campaignId}`).emit('map:viewport:sync', {
        mapId: data.mapId,
        offset: data.offset,
        scale: data.scale,
      });
    });

    // ─── Combat Operations ───

    // Get or create combat for a map (auto-import all tokens) — DM only
    socket.on('combat:start', async (data: { campaignId: string; mapId: string }) => {
      if (!socket.campaignId || !(await isDM())) return;
      const { campaignId, mapId } = data;

      // Find existing paused/setup/active combat for this map
      let combat = await prisma.combatTracker.findFirst({
        where: { mapId, status: { in: ['setup', 'active', 'paused'] } },
        include: { participants: true },
      });

      // Clean up any participants whose tokens don't belong to this map
      // (retroactive fix for data created before per-map isolation)
      if (combat) {
        const mapTokenIds = new Set(
          (await prisma.token.findMany({ where: { mapId }, select: { id: true } })).map((t: { id: string }) => t.id)
        );
        const staleParticipants = combat.participants.filter((p: { tokenId: string; id: string }) => !mapTokenIds.has(p.tokenId));
        if (staleParticipants.length > 0) {
          await prisma.combatParticipant.deleteMany({
            where: { id: { in: staleParticipants.map((p: { id: string }) => p.id) } },
          });
          combat = (await prisma.combatTracker.findUnique({
            where: { id: combat.id },
            include: { participants: true },
          }))!;
        }
      }

      if (!combat) {
        // Count previous combats + map name in parallel
        const [previousCount, mapInfo, mapTokens] = await Promise.all([
          prisma.combatTracker.count({ where: { mapId } }),
          prisma.map.findUnique({ where: { id: mapId }, select: { name: true } }),
          prisma.token.findMany({ where: { mapId }, select: { id: true, name: true } }),
        ]);

        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
        const autoName = `${mapInfo?.name || 'Map'}-战斗${previousCount + 1}-${timeStr}`;

        combat = await prisma.combatTracker.create({
          data: {
            campaignId,
            mapId,
            name: autoName,
            status: 'setup',
          },
          include: { participants: true },
        });

        // Bulk-insert all map tokens as participants
        if (mapTokens.length > 0) {
          await prisma.combatParticipant.createMany({
            data: mapTokens.map((t: { id: string; name: string }) => ({
              combatId: combat!.id,
              tokenId: t.id,
              initiative: 0,
              label: t.name,
            })),
          });
          // Re-fetch to get the created participants with their IDs
          combat = (await prisma.combatTracker.findUnique({
            where: { id: combat.id },
            include: { participants: true },
          }))!;
        }
      } else if (combat.status === 'paused') {
        // Resume paused combat
        await prisma.combatTracker.update({
          where: { id: combat.id },
          data: { status: 'active', isActive: true },
        });
        combat = (await prisma.combatTracker.findUnique({
          where: { id: combat.id },
          include: { participants: true },
        }))!;
      }

      io.to(`campaign:${campaignId}`).emit('combat:start', combat as any);
      emitSystemMessage(campaignId, 'Combat mode activated.');
    });

    // Start recording — transition from setup to active (DM only)
    socket.on('combat:start_recording', async (combatId: string) => {
      if (!socket.campaignId || !(await isDM())) return;
      const combat = await prisma.combatTracker.findUnique({
        where: { id: combatId },
        include: { participants: true },
      });
      if (!combat || combat.status !== 'setup') return;

      // Set first active turn
      const sorted = [...combat.participants].sort((a, b) => b.initiative - a.initiative);
      if (sorted.length > 0) {
        await prisma.combatParticipant.update({
          where: { id: sorted[0].id },
          data: { isActiveTurn: true },
        });
      }

      const updated = await prisma.combatTracker.update({
        where: { id: combatId },
        data: {
          status: 'active',
          isActive: true,
          startedAt: new Date(),
          round: 1,
          currentTurnIndex: 0,
          log: [],
        },
        include: { participants: true },
      });

      io.to(`campaign:${socket.campaignId}`).emit('combat:start', updated as any);
      emitSystemMessage(socket.campaignId!, `Combat "${updated.name}" — recording started! Round 1 begins.`);
      appendCombatLog(combatId, socket.campaignId!, 'start', `Combat "${updated.name}" recording started`, 1);
    });

    // Pause combat (DM only)
    socket.on('combat:pause', async (combatId: string) => {
      if (!socket.campaignId || !(await isDM())) return;
      await prisma.combatTracker.update({
        where: { id: combatId },
        data: { status: 'paused', isActive: false },
      });
      io.to(`campaign:${socket.campaignId}`).emit('combat:end');
      emitSystemMessage(socket.campaignId!, 'Combat paused.');
    });

    // End combat with save/discard option (DM only)
    socket.on('combat:end', async (data: { combatId: string; save: boolean }) => {
      if (!socket.campaignId || !(await isDM())) return;
      const { combatId, save } = data;

      if (save) {
        await prisma.combatTracker.update({
          where: { id: combatId },
          data: {
            status: 'completed',
            isActive: false,
            endedAt: new Date(),
          },
        });
        const combat = await prisma.combatTracker.findUnique({ where: { id: combatId }, select: { name: true } });
        emitSystemMessage(socket.campaignId!, `Combat "${combat?.name}" saved to map history.`);
      } else {
        // Discard — delete the combat and its participants
        await prisma.combatParticipant.deleteMany({ where: { combatId } });
        await prisma.combatTracker.delete({ where: { id: combatId } });
        emitSystemMessage(socket.campaignId!, 'Combat discarded.');
      }

      io.to(`campaign:${socket.campaignId}`).emit('combat:end');
    });

    // Update combat name (DM only)
    socket.on('combat:update_name', async (data: { combatId: string; name: string }) => {
      if (!socket.campaignId || !(await isDM())) return;
      await prisma.combatTracker.update({
        where: { id: data.combatId },
        data: { name: data.name },
      });
      io.to(`campaign:${socket.campaignId}`).emit('combat:update_name', data);
    });

    socket.on('combat:next_turn', async (combatId: string) => {
      if (!socket.campaignId || !(await isDM())) return;
      const combat = await prisma.combatTracker.findUnique({
        where: { id: combatId },
        include: { participants: true },
      });
      if (!combat || combat.participants.length === 0) return;

      // Sort by initiative descending for correct turn order
      const sorted = [...combat.participants].sort((a, b) => b.initiative - a.initiative);
      const currentId = sorted[combat.currentTurnIndex]?.id;
      const nextIndex = (combat.currentTurnIndex + 1) % sorted.length;
      const isNewRound = nextIndex === 0;

      // Clear all active turns
      await prisma.combatParticipant.updateMany({
        where: { combatId },
        data: { isActiveTurn: false },
      });

      // Set the next participant as active
      await prisma.combatParticipant.update({
        where: { id: sorted[nextIndex].id },
        data: { isActiveTurn: true },
      });

      const updated = await prisma.combatTracker.update({
        where: { id: combatId },
        data: {
          currentTurnIndex: nextIndex,
          round: isNewRound ? combat.round + 1 : combat.round,
        },
        include: { participants: true },
      });

      // Map participants to reflect sorted order with isActiveTurn flags
      updated.participants = updated.participants.map((p: any) => ({
        ...p,
        isActiveTurn: p.id === sorted[nextIndex].id,
      }));

      const cp = updated.participants.find((p: any) => p.id === sorted[nextIndex].id);
      const label = cp?.label || cp?.tokenId?.slice(0, 8) || 'Unknown';
      io.to(`campaign:${socket.campaignId}`).emit('combat:next_turn', updated as any);
      appendCombatLog(combatId, socket.campaignId!, 'turn', `Round ${updated.round} — ${label}'s turn`, updated.round);
    });

    socket.on('combat:prev_turn', async (combatId: string) => {
      if (!socket.campaignId || !(await isDM())) return;
      const combat = await prisma.combatTracker.findUnique({
        where: { id: combatId },
        include: { participants: true },
      });
      if (!combat || combat.participants.length === 0) return;

      // Sort by initiative descending for correct turn order
      const sorted = [...combat.participants].sort((a, b) => b.initiative - a.initiative);
      const prevIndex = (combat.currentTurnIndex - 1 + sorted.length) % sorted.length;

      // Clear all active turns
      await prisma.combatParticipant.updateMany({
        where: { combatId },
        data: { isActiveTurn: false },
      });

      // Set the previous participant as active
      await prisma.combatParticipant.update({
        where: { id: sorted[prevIndex].id },
        data: { isActiveTurn: true },
      });

      const updated = await prisma.combatTracker.update({
        where: { id: combatId },
        data: { currentTurnIndex: prevIndex },
        include: { participants: true },
      });

      updated.participants = updated.participants.map((p: any) => ({
        ...p,
        isActiveTurn: p.id === sorted[prevIndex].id,
      }));

      const cp = updated.participants.find((p: any) => p.id === sorted[prevIndex].id);
      const plabel = cp?.label || cp?.tokenId?.slice(0, 8) || 'Unknown';
      io.to(`campaign:${socket.campaignId}`).emit('combat:prev_turn', updated as any);
      appendCombatLog(combatId, socket.campaignId!, 'turn', `Round ${updated.round} — ${plabel}'s turn`, updated.round);
    });

    socket.on('combat:add', async (data) => {
      if (!socket.campaignId || !(await isDM())) return;
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
      if (!socket.campaignId || !(await isDM())) return;
      const participant = await prisma.combatParticipant.findUnique({ where: { id: data.participantId } });
      await prisma.combatParticipant.delete({ where: { id: data.participantId } });
      const combat = await prisma.combatTracker.findUnique({ where: { id: data.combatId }, select: { round: true } });
      const rname = participant?.label || participant?.tokenId?.slice(0, 8) || 'Unknown';
      io.to(`campaign:${socket.campaignId}`).emit('combat:remove', data.participantId);
      appendCombatLog(data.combatId, socket.campaignId!, 'remove', `${rname} removed from combat`, combat?.round || 1);
    });

    socket.on('combat:action', async (data: { combatId: string; tokenId: string; action: string; target?: string; value?: number; note?: string }) => {
      if (!socket.campaignId) return;
      const combat = await prisma.combatTracker.findUnique({ where: { id: data.combatId }, select: { round: true } });
      const token = await prisma.token.findUnique({ where: { id: data.tokenId }, select: { name: true } });
      const actorName = token?.name || data.tokenId.slice(0, 8);
      const actionLabels: Record<string, string> = {
        dash: 'Dash',
        melee: 'Melee Attack',
        ranged: 'Ranged Attack',
        spell: 'Cast Spell',
        bonus: 'Bonus Action',
        dodge: 'Dodge',
        disengage: 'Disengage',
        help: 'Help',
        ready: 'Ready Action',
        other: 'Other',
      };
      const actionLabel = actionLabels[data.action] || data.action;
      let msg = `${actorName}: ${actionLabel}`;
      if (data.target) msg += ` → ${data.target}`;
      if (data.value !== undefined) msg += ` (${data.value})`;
      if (data.note) msg += ` — ${data.note}`;
      io.to(`campaign:${socket.campaignId}`).emit('combat:log', {
        type: 'action',
        message: msg,
        round: combat?.round || 1,
        timestamp: new Date().toISOString(),
      });
      appendCombatLog(data.combatId, socket.campaignId!, 'action', msg, combat?.round || 1);
    });

    socket.on('combat:initiative:update', async (data) => {
      if (!socket.campaignId || !(await isDM())) return;
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

    // ─── Character Operations ───
    socket.on('character:update', (data: { characterId: string; updates: Record<string, any> }) => {
      if (!socket.campaignId) return;
      prisma.character
        .update({ where: { id: data.characterId }, data: data.updates })
        .then((updated: any) => {
          io.to(`campaign:${socket.campaignId!}`).emit('character:update', updated as any);
        })
        .catch(console.error);
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
