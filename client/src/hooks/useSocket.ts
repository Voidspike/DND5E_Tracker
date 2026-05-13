import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { useGameStore } from '../stores/gameStore';
import { useCampaignStore } from '../stores/campaignStore';
import type { CombatTracker, CombatParticipant, Token, Character } from '@dnd/shared';

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
    addCombatLogEntry,
  } = useGameStore();
  const syncToken = useCampaignStore((s) => s.syncToken);
  const removeToken = useCampaignStore((s) => s.removeToken);
  const syncCharacter = useCampaignStore((s) => s.syncCharacter);
  const setSelectedTokenId = useGameStore((s) => s.setSelectedTokenId);
  const setCombatMode = useGameStore((s) => s.setCombatMode);
  const setCombatTargetTokenId = useGameStore((s) => s.setCombatTargetTokenId);

  useEffect(() => {
    if (!token || !campaignId) return;

    const socket = connectSocket();

    socket.on('room:players', setOnlinePlayers);
    socket.on('chat:message', addChatMessage);
    socket.on('dice:roll', addDiceRoll);
    socket.on('dice:roll_private', addDiceRoll);
    socket.on('map:fog:update', (data: string) => setFogData(data));
    socket.on('combat:start', (combat: CombatTracker) => { setCombatTracker(combat); setCombatMode(true); });
    socket.on('combat:next_turn', (combat: CombatTracker) => setCombatTracker(combat));
    socket.on('combat:prev_turn', (combat: CombatTracker) => setCombatTracker(combat));
    socket.on('combat:end', () => { setCombatTracker(null); setCombatMode(false); setCombatTargetTokenId(null); });
    socket.on('combat:update_name', (data: { combatId: string; name: string }) => {
      setCombatTracker((prev) => prev ? { ...prev, name: data.name } as CombatTracker : null);
    });
    socket.on('combat:add', (participant: CombatParticipant) => addCombatParticipant(participant));
    socket.on('combat:remove', (participantId: string) => removeCombatParticipant(participantId));
    socket.on('combat:initiative:update', (participant: CombatParticipant) => updateCombatParticipant(participant));
    socket.on('token:update', (t: Token) => syncToken(t));
    socket.on('token:move', (data: { id: string; x: number; y: number }) => syncToken(data));
    socket.on('token:create', (t: Token) => syncToken(t));
    socket.on('token:delete', (id: string) => removeToken(id));
    socket.on('token:select', (id: string | null) => setSelectedTokenId(id));
    socket.on('character:update', (c: Character) => syncCharacter(c));
    socket.on('combat:log', (entry: { type: string; message: string; round: number; timestamp: string }) => addCombatLogEntry(entry));

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
      socket.off('combat:update_name');
      socket.off('combat:add');
      socket.off('combat:remove');
      socket.off('combat:initiative:update');
      socket.off('token:update');
      socket.off('token:move');
      socket.off('token:create');
      socket.off('token:delete');
      socket.off('token:select');
      socket.off('character:update');
      socket.off('combat:log');
    };
  }, [token, campaignId]);

  return getSocket();
}
