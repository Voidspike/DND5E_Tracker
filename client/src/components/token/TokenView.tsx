import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { useCampaignStore } from '../../stores/campaignStore';

interface TokenViewProps {
  token: any;
  isDM: boolean;
  userId?: string;
  socket: Socket;
}

export default function TokenView({ token, isDM, userId, socket }: TokenViewProps) {
  const { updateToken, deleteToken, characters } = useCampaignStore();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(token?.name || '');
  const [hp, setHp] = useState(token?.hpCurrent?.toString() || '');
  const [hpMax, setHpMax] = useState(token?.hpMax?.toString() || '');
  const [newEffect, setNewEffect] = useState('');
  const [linking, setLinking] = useState(false);

  if (!token) return null;

  const canEdit = isDM || token.ownerId === userId;

  const handleSave = async () => {
    const updates: any = {};
    if (name !== token.name) updates.name = name;
    if (hp !== token.hpCurrent?.toString()) updates.hpCurrent = parseInt(hp) || null;
    if (hpMax !== token.hpMax?.toString()) updates.hpMax = parseInt(hpMax) || null;

    if (Object.keys(updates).length > 0) {
      await updateToken(token.id, updates);
      socket.emit('token:update', { campaignId: token.campaignId, tokenId: token.id, updates });
    }
    setEditing(false);
  };

  const handleDragEnd = async (dx: number, dy: number) => {
    const newX = token.x + dx;
    const newY = token.y + dy;
    await updateToken(token.id, { x: newX, y: newY });
    socket.emit('token:move', { tokenId: token.id, x: newX, y: newY });
  };

  const linkedChar = token.characterId ? characters.find((c: any) => c.id === token.characterId) : null;
  const portraitUrl = linkedChar?.imageUrl || token.imageUrl;

  return (
    <div className="p-4">
      {/* Token Preview */}
      {portraitUrl ? (
        <div
          className="w-16 h-16 rounded-full mx-auto mb-3 overflow-hidden border-2"
          style={{ borderColor: token.color }}
        >
          <img src={portraitUrl} alt={token.name} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div
          className="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center text-xl font-bold"
          style={{ backgroundColor: token.color + '60', border: `3px solid ${token.color}` }}
        >
          {token.name.charAt(0).toUpperCase()}
        </div>
      )}

      <h3 className="text-center font-bold mb-1">{token.name}</h3>
      {linkedChar ? (
        <p className="text-center text-xs text-dnd-accent mb-2">
          Lv{linkedChar.level} {linkedChar.class}
        </p>
      ) : (
        <p className="text-center text-xs text-dnd-muted mb-4 capitalize">{token.type}</p>
      )}

      {/* Stats */}
      <div className="space-y-2 text-sm">
        {token.hpMax && (
          <div className="bg-dnd-bg rounded p-2">
            <div className="flex justify-between text-xs text-dnd-muted mb-1">
              <span>HP</span>
              <span>{token.hpCurrent ?? '?'}/{token.hpMax}</span>
            </div>
            <div className="h-2 bg-dnd-darker rounded overflow-hidden">
              <div
                className="h-full bg-dnd-success rounded transition-all"
                style={{ width: `${Math.max(0, ((token.hpCurrent || 0) / token.hpMax) * 100)}%` }}
              />
            </div>
          </div>
        )}
        {token.ac && (
          <div className="bg-dnd-bg rounded p-2 flex justify-between">
            <span className="text-dnd-muted">AC</span>
            <span className="font-bold">{token.ac}</span>
          </div>
        )}
        <div className="bg-dnd-bg rounded p-2 flex justify-between">
          <span className="text-dnd-muted">Position</span>
          <span className="font-mono text-xs">({token.x.toFixed(1)}, {token.y.toFixed(1)})</span>
        </div>
      </div>

      {/* Character Link */}
      {canEdit && (
        <div className="mt-3">
          <p className="text-xs text-dnd-muted mb-1">Link Character</p>
          {characters.length === 0 ? (
            <p className="text-xs text-dnd-muted italic">No characters available</p>
          ) : (
            <select
              value={token.characterId || ''}
              disabled={linking}
              onChange={async (e) => {
                const charId = e.target.value || null;
                setLinking(true);
                try {
                  if (charId) {
                    const char = characters.find((c: any) => c.id === charId);
                    if (!char) return;
                    const updates: Record<string, unknown> = {
                      characterId: charId,
                      name: char.name,
                      hpCurrent: char.hpCurrent,
                      hpMax: char.hpMax,
                      ac: char.ac,
                      darkvision: char.darkvision,
                      speed: char.speed,
                      imageUrl: token.imageUrl || char.imageUrl,
                    };
                    Object.keys(updates).forEach(k => {
                      if (updates[k] === undefined || updates[k] === null) delete updates[k];
                    });
                    await updateToken(token.id, updates);
                    socket.emit('token:update', { tokenId: token.id, updates });
                  } else {
                    await updateToken(token.id, { characterId: null });
                    socket.emit('token:update', { tokenId: token.id, updates: { characterId: null } });
                  }
                } catch (err) {
                  console.error('[TokenView] Failed to link character:', err);
                } finally {
                  setLinking(false);
                }
              }}
              className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1 text-sm"
            >
              <option value="">None</option>
              {characters.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Lv{c.level} {c.class})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Status Effects */}
      <div className="mt-3">
        <p className="text-xs text-dnd-muted mb-1">Status Effects</p>
        <div className="flex flex-wrap gap-1">
          {(token.statusEffects && Array.isArray(token.statusEffects) ? token.statusEffects : []).map((effect: string, i: number) => (
            <span key={i} className="text-xs bg-dnd-warning/20 text-dnd-warning px-2 py-0.5 rounded flex items-center gap-1">
              {effect}
              {canEdit && (
                <button
                  onClick={async () => {
                    const effects = (token.statusEffects || []).filter((_: string, idx: number) => idx !== i);
                    const updates = { statusEffects: effects };
                    await updateToken(token.id, updates);
                    socket.emit('token:update', { campaignId: token.campaignId, tokenId: token.id, updates });
                  }}
                  className="text-dnd-warning/80 hover:text-dnd-danger leading-none"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
        {canEdit && (
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              value={newEffect}
              onChange={(e) => setNewEffect(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === 'Enter' && newEffect.trim()) {
                  const effects = [...(token.statusEffects || []), newEffect.trim()];
                  const updates = { statusEffects: effects };
                  await updateToken(token.id, updates);
                  socket.emit('token:update', { campaignId: token.campaignId, tokenId: token.id, updates });
                  setNewEffect('');
                }
              }}
              className="flex-1 bg-dnd-bg border border-dnd-accent rounded px-2 py-0.5 text-xs"
              placeholder="Add effect..."
            />
            <button
              onClick={async () => {
                if (!newEffect.trim()) return;
                const effects = [...(token.statusEffects || []), newEffect.trim()];
                const updates = { statusEffects: effects };
                await updateToken(token.id, updates);
                socket.emit('token:update', { campaignId: token.campaignId, tokenId: token.id, updates });
                setNewEffect('');
              }}
              className="bg-dnd-accent text-white px-2 py-0.5 rounded text-xs hover:opacity-90"
            >
              +
            </button>
          </div>
        )}
      </div>

      {/* Edit Form */}
      {canEdit && (
        <div className="mt-4 space-y-2">
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1 text-sm"
                placeholder="Name"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1 text-sm"
                  placeholder="HP"
                />
                <input
                  type="number"
                  value={hpMax}
                  onChange={(e) => setHpMax(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded px-2 py-1 text-sm"
                  placeholder="Max HP"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex-1 bg-dnd-primary text-white py-1 rounded text-sm hover:opacity-90"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 bg-dnd-darker text-white py-1 rounded text-sm hover:opacity-90"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="w-full bg-dnd-accent text-white py-1 rounded text-sm hover:opacity-90"
            >
              Edit
            </button>
          )}

          {isDM && (
            <button
              onClick={async () => {
                if (confirm('Delete this token?')) {
                  await deleteToken(token.id);
                  socket.emit('token:delete', token.id);
                }
              }}
              className="w-full bg-dnd-danger/20 text-dnd-danger/80 py-1 rounded text-sm hover:bg-dnd-danger/30"
            >
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
