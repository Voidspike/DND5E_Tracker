import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/gameStore';

export function useSocket(campaignId?: string) {
  const token = useAuthStore((s) => s.token);
  const {
    setOnlinePlayers,
    addChatMessage,
    addDiceRoll,
    setFogData,
    setCombatTracker,
    addCombatParticipant,
    removeCombatParticipant,
    updateCombatParticipant,
  } = useGameStore();

  useEffect(() => {
    if (!token || !campaignId) return;

    const socket = connectSocket();

    socket.on('room:players', setOnlinePlayers);
    socket.on('chat:message', addChatMessage);
    socket.on('dice:roll', addDiceRoll);
    socket.on('dice:roll_private', addDiceRoll);
    socket.on('map:fog:update', (data: string) => setFogData(data));
    socket.on('combat:start', (combat: any) => setCombatTracker(combat));
    socket.on('combat:next_turn', (combat: any) => setCombatTracker(combat));
    socket.on('combat:prev_turn', (combat: any) => setCombatTracker(combat));
    socket.on('combat:end', () => setCombatTracker(null));
    socket.on('combat:add', (participant: any) => addCombatParticipant(participant));
    socket.on('combat:remove', (participantId: string) => removeCombatParticipant(participantId));
    socket.on('combat:initiative:update', (participant: any) => updateCombatParticipant(participant));

    socket.emit('room:join', campaignId);

    return () => {
      socket.emit('room:leave', campaignId);
      socket.off('room:players');
      socket.off('chat:message');
      socket.off('dice:roll');
      socket.off('dice:roll_private');
      socket.off('map:fog:update');
      socket.off('combat:start');
      socket.off('combat:next_turn');
      socket.off('combat:prev_turn');
      socket.off('combat:end');
      socket.off('combat:add');
      socket.off('combat:remove');
      socket.off('combat:initiative:update');
    };
  }, [token, campaignId]);

  return getSocket();
}
