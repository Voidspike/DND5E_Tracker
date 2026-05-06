import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCampaignStore } from '../../stores/campaignStore';
import { useGameStore } from '../../stores/gameStore';
import { useSocket } from '../../hooks/useSocket';
import MapView from '../../components/map/MapView';
import TokenView from '../../components/token/TokenView';
import CombatTracker from '../../components/combat/CombatTracker';
import DiceRoller from '../../components/dice/DiceRoller';
import ChatPanel from '../../components/chat/ChatPanel';

type Tab = 'map' | 'combat' | 'dice' | 'chat';

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentCampaign, maps, tokens, characters, loading, fetchCampaign, fetchMaps, fetchTokens, fetchCharacters } =
    useCampaignStore();
  const { selectedTokenId, onlinePlayers } = useGameStore();
  const socket = useSocket(id);

  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);

  const isDM = currentCampaign?.dmId === user?.id;

  useEffect(() => {
    if (id) {
      fetchCampaign(id);
      fetchMaps(id);
      fetchCharacters(id);
    }
  }, [id]);

  useEffect(() => {
    if (maps.length > 0) {
      fetchTokens(maps[0].id);
    }
  }, [maps]);

  if (loading && !currentCampaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-dnd-muted">Loading campaign...</div>
      </div>
    );
  }

  if (!currentCampaign) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-dnd-muted mb-4">Campaign not found</p>
          <button onClick={() => navigate('/')} className="text-dnd-primary hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const currentMap = maps[0];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-dnd-surface border-b border-dnd-accent px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="text-dnd-muted hover:text-dnd-text">
            &larr;
          </button>
          <h1 className="font-bold">{currentCampaign.name}</h1>
          {isDM && <span className="text-xs bg-dnd-primary/20 text-dnd-primary px-2 py-0.5 rounded">DM</span>}
          <span className="text-xs text-dnd-muted">
            {onlinePlayers.length} online
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCharacterSheet(true)}
            className="text-sm bg-dnd-accent px-3 py-1 rounded hover:opacity-90"
          >
            Characters
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-dnd-surface border-b border-dnd-accent px-4 flex gap-1 shrink-0">
        {(['map', 'combat', 'dice', 'chat'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab
                ? 'text-dnd-primary border-b-2 border-dnd-primary'
                : 'text-dnd-muted hover:text-dnd-text'
            }`}
          >
            {tab === 'map' ? 'Map' : tab === 'combat' ? 'Combat' : tab === 'dice' ? 'Dice' : 'Chat'}
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Active Tab Content */}
        <div className="flex-1 relative">
          {activeTab === 'map' && currentMap && (
            <MapView
              map={currentMap}
              tokens={tokens}
              isDM={isDM}
              socket={socket}
            />
          )}
          {activeTab === 'map' && !currentMap && (
            <div className="flex items-center justify-center h-full text-dnd-muted">
              No maps loaded. {isDM ? 'Upload a map to get started.' : 'Waiting for the DM to add a map.'}
            </div>
          )}
          {activeTab === 'combat' && (
            <CombatTracker isDM={isDM} socket={socket} campaignId={id!} />
          )}
          {activeTab === 'dice' && (
            <DiceRoller socket={socket} campaignId={id!} />
          )}
          {activeTab === 'chat' && (
            <ChatPanel socket={socket} campaignId={id!} />
          )}
        </div>

        {/* Token View Sidebar (when a token is selected) */}
        {selectedTokenId && (
          <div className="w-72 bg-dnd-surface border-l border-dnd-accent overflow-y-auto shrink-0">
            <TokenView
              token={tokens.find((t) => t.id === selectedTokenId)}
              isDM={isDM}
              userId={user?.id}
              socket={socket}
            />
          </div>
        )}
      </div>

      {/* Character Sheet Modal */}
      {showCharacterSheet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dnd-surface rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto border border-dnd-accent">
            <div className="p-4 border-b border-dnd-accent flex items-center justify-between">
              <h2 className="font-bold text-lg">Character Sheets</h2>
              <button
                onClick={() => setShowCharacterSheet(false)}
                className="text-dnd-muted hover:text-dnd-text"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-3">
              {characters.length === 0 ? (
                <p className="text-dnd-muted text-center py-4">No characters in this campaign yet.</p>
              ) : (
                characters.map((ch: any) => (
                  <div
                    key={ch.id}
                    className="bg-dnd-bg rounded p-4 border border-dnd-accent cursor-pointer hover:border-dnd-primary"
                    onClick={() => setSelectedCharacterId(ch.id === selectedCharacterId ? null : ch.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold">{ch.name}</h3>
                      <span className="text-xs text-dnd-muted">
                        Lv.{ch.level} {ch.race} {ch.class}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-dnd-muted">
                      <span>HP: {ch.hpCurrent}/{ch.hpMax}</span>
                      <span>AC: {ch.ac}</span>
                    </div>
                    {selectedCharacterId === ch.id && (
                      <div className="mt-3 pt-3 border-t border-dnd-accent text-sm space-y-1">
                        {ch.stats && typeof ch.stats === 'object' && (
                          <div className="flex gap-2">
                            {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((s) => (
                              <span key={s} className="bg-dnd-accent/30 px-2 py-1 rounded text-xs uppercase">
                                {s}: {(ch.stats as any)[s] ?? '-'}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
