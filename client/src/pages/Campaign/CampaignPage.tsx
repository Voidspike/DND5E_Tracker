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
import CharacterSheet from '../../components/character/CharacterSheet';
import CharacterList from '../../components/character/CharacterList';
import LoadingSkeleton from '../../components/LoadingSkeleton';

type Tab = 'map' | 'combat' | 'dice' | 'chat';

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentCampaign, maps, tokens, characters, loading, fetchCampaign, fetchMaps, createMap, fetchTokensByCampaign, fetchCharacters, updateCampaign, leaveCampaign, kickPlayer } =
    useCampaignStore();
  const { selectedTokenId, onlinePlayers, setFogData } = useGameStore();
  const socket = useSocket(id);

  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [showCharacterSheet, setShowCharacterSheet] = useState(false);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [showInvitePopup, setShowInvitePopup] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapName, setMapName] = useState('');
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [mapUrl, setMapUrl] = useState('');
  const [mapWidth, setMapWidth] = useState(30);
  const [mapHeight, setMapHeight] = useState(20);
  const [mapUploading, setMapUploading] = useState(false);
  const [currentMapId, setCurrentMapId] = useState<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL || '/api';

  const isDM = currentCampaign?.dmId === user?.id;
  const isPlayer = !isDM && currentCampaign?.players?.some((p: any) => p.userId === user?.id);

  useEffect(() => {
    if (id) {
      fetchCampaign(id);
      fetchMaps(id);
      fetchCharacters(id);
    }
  }, [id]);

  useEffect(() => {
    if (maps.length > 0 && id) {
      fetchTokensByCampaign(id);
    }
  }, [maps, id]);

  const currentMap = maps.find((m) => m.id === currentMapId) || maps[0];

  // Sync fogData from current map
  useEffect(() => {
    if (currentMap?.fogData) {
      setFogData(currentMap.fogData);
    } else {
      setFogData(null);
    }
  }, [currentMap?.id]);

  // Set initial current map
  useEffect(() => {
    if (maps.length > 0 && !currentMapId) {
      setCurrentMapId(maps[0].id);
    }
  }, [maps]);

  const handleCreateMap = async () => {
    if (!id || (!mapFile && !mapUrl.trim())) return;
    setMapUploading(true);
    try {
      let imageUrl = mapUrl.trim();
      if (mapFile) {
        const formData = new FormData();
        formData.append('image', mapFile);
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/upload/image`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        imageUrl = data.url;
      }
      await createMap(id, { name: mapName || 'New Map', imageUrl, width: mapWidth, height: mapHeight });
      setShowMapModal(false);
      setMapName('');
      setMapFile(null);
      setMapUrl('');
      setMapWidth(30);
      setMapHeight(20);
    } catch (err) {
      console.error('Create map error:', err);
    } finally {
      setMapUploading(false);
    }
  };

  useEffect(() => {
    if (currentCampaign) {
      setSettingsName(currentCampaign.name);
      setSettingsDesc(currentCampaign.description || '');
    }
  }, [currentCampaign?.name, currentCampaign?.description]);

  const copyInviteCode = async () => {
    const code = currentCampaign?.inviteCode || '';
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSettings = async () => {
    if (!id) return;
    await updateCampaign(id, { name: settingsName, description: settingsDesc || undefined });
    setShowSettings(false);
  };

  if (loading && !currentCampaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dnd-bg">
        <div className="text-dnd-muted text-lg animate-pulse">Loading campaign...</div>
      </div>
    );
  }

  if (!currentCampaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dnd-bg">
        <div className="text-center">
          <p className="text-dnd-muted text-lg mb-4">Campaign not found</p>
          <button onClick={() => navigate('/')} className="text-dnd-primary hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const allPlayers = currentCampaign.players || [];

  return (
    <div className="min-h-screen flex flex-col bg-dnd-bg">
      {/* Header */}
      <header className="bg-dnd-surface/90 backdrop-blur-sm border-b border-dnd-accent/50 px-3 sm:px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => navigate('/')}
            className="text-dnd-muted hover:text-dnd-text shrink-0 hover:bg-dnd-accent/30 rounded-lg p-1.5 transition-colors"
            title="Back to Dashboard"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>

          <div className="min-w-0">
            <h1 className="font-bold truncate">{currentCampaign.name}</h1>
            <div className="flex items-center gap-2 text-xs text-dnd-muted">
              {isDM && <span className="bg-dnd-primary/20 text-dnd-primary px-1.5 py-0.5 rounded font-medium">DM</span>}
              <span>{onlinePlayers.length} online</span>
              <span className="hidden sm:inline">· {allPlayers.length + 1} members</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Invite Code Button */}
          {isDM && (
            <button
              onClick={() => { setShowInvitePopup(true); setCopied(false); }}
              className="text-xs sm:text-sm bg-dnd-accent/40 hover:bg-dnd-accent/60 text-white px-2 sm:px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              <span className="hidden sm:inline">Invite</span>
            </button>
          )}

          {isDM && (
            <button
              onClick={() => setShowMapModal(true)}
              className="text-xs sm:text-sm bg-dnd-accent/40 hover:bg-dnd-accent/60 text-white px-2 sm:px-3 py-1.5 rounded-lg transition-colors"
              title="Add Map"
            >
              <span className="hidden sm:inline">+ Map</span>
              <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            </button>
          )}

          <button
            onClick={() => setShowCharacterSheet(true)}
            className="text-xs sm:text-sm bg-dnd-accent/40 hover:bg-dnd-accent/60 text-white px-2 sm:px-3 py-1.5 rounded-lg transition-colors"
          >
            Characters
          </button>

          {isDM && (
            <button
              onClick={() => setShowSettings(true)}
              className="text-xs sm:text-sm bg-dnd-accent/40 hover:bg-dnd-accent/60 text-white px-2 sm:px-3 py-1.5 rounded-lg transition-colors"
              title="Campaign Settings"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
          )}
        </div>
      </header>

      {/* Invite Popup */}
      {showInvitePopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowInvitePopup(false)}>
          <div className="bg-dnd-surface rounded-xl p-6 w-full max-w-sm border border-dnd-accent shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1">Invite Players</h3>
            <p className="text-dnd-muted text-sm mb-4">
              Share this code with your players to let them join the campaign.
            </p>
            <div className="bg-dnd-bg rounded-xl p-4 text-center mb-4">
              <p className="text-xs text-dnd-muted mb-2">Invite Code</p>
              <p className="text-3xl font-bold tracking-[0.3em] text-dnd-primary">
                {currentCampaign.inviteCode}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copyInviteCode}
                className={`flex-1 py-2.5 rounded-lg font-semibold transition-all ${
                  copied
                    ? 'bg-dnd-success/20 text-dnd-success border border-dnd-success/30'
                    : 'bg-dnd-primary text-white hover:opacity-90'
                }`}
              >
                {copied ? '✓ Copied!' : 'Copy Code'}
              </button>
              <button
                onClick={() => setShowInvitePopup(false)}
                className="px-4 bg-dnd-darker text-white py-2.5 rounded-lg hover:opacity-90"
              >
                Close
              </button>
            </div>
            {allPlayers.length > 0 && (
              <div className="mt-4 pt-4 border-t border-dnd-accent/50">
                <p className="text-xs text-dnd-muted mb-2">Current Players</p>
                <div className="space-y-1.5">
                  {allPlayers.map((p: any) => (
                    <div key={p.userId} className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 bg-dnd-accent/40 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                        {p.user?.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                      <span className="flex-1 truncate">{p.user?.username || 'Unknown'}</span>
                      <span className="text-xs text-dnd-muted capitalize">({p.role})</span>
                      {isDM && (
                        <button
                          onClick={() => kickPlayer(currentCampaign.id, p.userId)}
                          className="text-xs text-dnd-danger/60 hover:text-dnd-danger ml-1 shrink-0"
                          title="Remove player"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!isDM && (
              <button
                onClick={async () => {
                  if (confirm('Leave this campaign?')) {
                    await leaveCampaign(currentCampaign.id);
                    navigate('/');
                  }
                }}
                className="mt-3 w-full text-xs text-dnd-danger/60 hover:text-dnd-danger py-1.5 transition-colors"
              >
                Leave Campaign
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal (DM only) */}
      {showSettings && isDM && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowSettings(false)}>
          <div className="bg-dnd-surface rounded-xl p-6 w-full max-w-md border border-dnd-accent shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Campaign Settings</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-dnd-muted mb-1">Campaign Name</label>
                <input
                  type="text"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text focus:outline-none focus:border-dnd-primary"
                />
              </div>
              <div>
                <label className="block text-sm text-dnd-muted mb-1">Description</label>
                <textarea
                  value={settingsDesc}
                  onChange={(e) => setSettingsDesc(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text focus:outline-none focus:border-dnd-primary resize-none h-24"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 bg-dnd-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 bg-dnd-darker text-white py-2.5 rounded-lg hover:opacity-90"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map Upload Modal */}
      {showMapModal && isDM && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowMapModal(false)}>
          <div className="bg-dnd-surface rounded-xl p-6 w-full max-w-md border border-dnd-accent shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Add Map</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-dnd-muted mb-1">Map Name</label>
                <input
                  type="text"
                  value={mapName}
                  onChange={(e) => setMapName(e.target.value)}
                  placeholder="Dungeon Level 1"
                  className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary"
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm text-dnd-muted mb-1">Grid Width</label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={mapWidth}
                    onChange={(e) => setMapWidth(parseInt(e.target.value) || 5)}
                    className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text focus:outline-none focus:border-dnd-primary"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-dnd-muted mb-1">Grid Height</label>
                  <input
                    type="number"
                    min={5}
                    max={200}
                    value={mapHeight}
                    onChange={(e) => setMapHeight(parseInt(e.target.value) || 5)}
                    className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text focus:outline-none focus:border-dnd-primary"
                  />
                </div>
              </div>
              <p className="text-[11px] text-dnd-muted">Set the map size in grid units. Image will stretch to fill the grid. Adjust grid size later in map settings.</p>
              <div>
                <label className="block text-sm text-dnd-muted mb-1">Upload Image</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(e) => {
                    setMapFile(e.target.files?.[0] || null);
                    setMapUrl('');
                  }}
                  className="w-full text-sm text-dnd-text file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-dnd-primary/20 file:text-dnd-primary hover:file:bg-dnd-primary/30"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-dnd-accent/30" />
                <span className="text-xs text-dnd-muted">OR</span>
                <div className="flex-1 border-t border-dnd-accent/30" />
              </div>
              <div>
                <label className="block text-sm text-dnd-muted mb-1">Image URL</label>
                <input
                  type="url"
                  value={mapUrl}
                  onChange={(e) => {
                    setMapUrl(e.target.value);
                    setMapFile(null);
                  }}
                  placeholder="https://example.com/map.jpg"
                  className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreateMap}
                  disabled={(!mapFile && !mapUrl.trim()) || mapUploading}
                  className="flex-1 bg-dnd-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {mapUploading ? 'Uploading...' : 'Add Map'}
                </button>
                <button
                  onClick={() => setShowMapModal(false)}
                  className="px-4 bg-dnd-darker text-white py-2.5 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Character Sheet Modal */}
      {showCharacterSheet && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => { setShowCharacterSheet(false); setSelectedCharacterId(null); }}>
          <div className="bg-dnd-surface rounded-xl w-full max-w-3xl h-[80vh] border border-dnd-accent shadow-2xl flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Character List Sidebar */}
            <div className="w-64 border-r border-dnd-accent/50 shrink-0 bg-dnd-surface/80">
              <div className="flex items-center justify-between px-4 py-3 border-b border-dnd-accent/30">
                <h3 className="font-bold text-sm">Characters</h3>
                <button
                  onClick={() => { setShowCharacterSheet(false); setSelectedCharacterId(null); }}
                  className="text-dnd-muted hover:text-dnd-text"
                >
                  ✕
                </button>
              </div>
              <CharacterList characters={characters} onSelect={(c) => setSelectedCharacterId(c.id)} />
            </div>

            {/* Character Detail */}
            <div className="flex-1 overflow-hidden">
              {selectedCharacterId && characters.find(c => c.id === selectedCharacterId) ? (
                <CharacterSheet
                  character={characters.find(c => c.id === selectedCharacterId)!}
                  onClose={() => setSelectedCharacterId(null)}
                  socket={socket ?? undefined}
                  campaignId={id}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-dnd-muted text-sm">
                  Select a character to view details
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-dnd-surface/80 border-b border-dnd-accent/50 px-2 sm:px-4 flex gap-0 shrink-0 overflow-x-auto">
        {(['map', 'combat', 'dice', 'chat'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 sm:flex-none px-2 sm:px-5 py-2.5 text-xs sm:text-sm font-medium capitalize whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'text-dnd-primary border-b-2 border-dnd-primary bg-dnd-primary/5'
                : 'text-dnd-muted hover:text-dnd-text hover:bg-dnd-accent/20'
            }`}
          >
            {tab === 'map' ? (
              <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                <span className="hidden xs:inline">Map</span>
              </span>
            ) : tab === 'combat' ? (
              <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="hidden xs:inline">Combat</span>
              </span>
            ) : tab === 'dice' ? (
              <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                <span className="hidden xs:inline">Dice</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1 sm:gap-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                <span className="hidden xs:inline">Chat</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Map Switcher */}
      {maps.length > 1 && activeTab === 'map' && (
        <div className="bg-dnd-surface/60 border-b border-dnd-accent/30 px-3 sm:px-4 py-1.5 flex gap-1.5 overflow-x-auto shrink-0">
          {maps.map((m: any) => (
            <button
              key={m.id}
              onClick={() => setCurrentMapId(m.id)}
              className={`text-xs px-2.5 py-1 rounded whitespace-nowrap transition-colors ${
                currentMapId === m.id
                  ? 'bg-dnd-primary/20 text-dnd-primary font-medium'
                  : 'text-dnd-muted hover:text-dnd-text hover:bg-dnd-accent/20'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          {activeTab === 'map' && currentMap && (
            <MapView
              map={currentMap}
              tokens={tokens}
              isDM={isDM}
              socket={socket}
              selectedTokenId={selectedTokenId}
            />
          )}
          {activeTab === 'map' && !currentMap && loading && (
            <LoadingSkeleton lines={5} />
          )}
          {activeTab === 'map' && !currentMap && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-dnd-muted px-4">
              <div className="w-16 h-16 bg-dnd-accent/30 rounded-2xl flex items-center justify-center mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              </div>
              <p className="text-lg font-semibold mb-1">No Map</p>
              <p className="text-sm">
                {isDM ? 'Upload a map image to get started.' : 'Waiting for the DM to add a map.'}
              </p>
            </div>
          )}
          {activeTab === 'combat' && loading && !currentCampaign && (
            <LoadingSkeleton lines={4} />
          )}
          {activeTab === 'combat' && (
            <CombatTracker isDM={isDM} socket={socket} campaignId={id!} tokens={tokens} />
          )}
          {activeTab === 'dice' && (
            <DiceRoller socket={socket} campaignId={id!} />
          )}
          {activeTab === 'chat' && (
            <ChatPanel socket={socket} campaignId={id!} isDM={isDM} />
          )}
        </div>

        {/* Token Sidebar */}
        {selectedTokenId && (
          <div className="w-72 bg-dnd-surface/80 border-l border-dnd-accent/50 overflow-y-auto shrink-0 hidden sm:block">
            <TokenView
              token={tokens.find((t) => t.id === selectedTokenId)}
              isDM={isDM}
              userId={user?.id}
              socket={socket}
            />
          </div>
        )}
      </div>

      {/* Mobile Token Bottom Sheet */}
      {selectedTokenId && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-dnd-surface border-t border-dnd-accent z-30 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-dnd-accent/50">
            <span className="text-sm font-semibold">Token Details</span>
            <button
              onClick={() => socket.emit('token:select', null)}
              className="text-dnd-muted text-sm"
            >
              Close
            </button>
          </div>
          <TokenView
            token={tokens.find((t) => t.id === selectedTokenId)}
            isDM={isDM}
            userId={user?.id}
            socket={socket}
          />
        </div>
      )}
    </div>
  );
}
