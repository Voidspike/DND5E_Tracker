import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCampaignStore } from '../../stores/campaignStore';

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const { campaigns, loading, fetchCampaigns, createCampaign, deleteCampaign, joinCampaign } =
    useCampaignStore();
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return;
    const campaign = await createCampaign(name, description || undefined);
    setName('');
    setDescription('');
    setShowCreate(false);
    if (campaign?.id) navigate(`/campaign/${campaign.id}`);
  }, [name, description, createCampaign, navigate]);

  const handleJoin = useCallback(async () => {
    if (!inviteCode.trim()) return;
    setJoinError('');
    try {
      await joinCampaign(inviteCode.toUpperCase());
      setInviteCode('');
      setShowJoin(false);
    } catch (err) {
      setJoinError((err as Error).message);
    }
  }, [inviteCode, joinCampaign]);

  const copyInviteCode = useCallback(async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }, []);

  const myCampaigns = campaigns.filter((c: any) => c.dmId === user?.id);
  const joinedCampaigns = campaigns.filter((c: any) => c.dmId !== user?.id);

  return (
    <div className="min-h-screen bg-gradient-to-b from-dnd-surface/50 to-dnd-bg">
      {/* Header */}
      <header className="bg-dnd-surface/80 backdrop-blur-sm border-b border-dnd-accent/50 px-6 py-3 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-dnd-accent rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-dnd-primary">D20</span>
            </div>
            <h1 className="text-lg font-bold">DND Visualizer</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-dnd-muted text-sm hidden sm:inline">Welcome, {user?.username}</span>
            <button
              onClick={logout}
              className="text-sm text-dnd-muted hover:text-dnd-primary transition-colors px-3 py-1.5 rounded hover:bg-dnd-accent/30"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-dnd-primary text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity shadow-lg shadow-dnd-primary/20 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Campaign (DM)
          </button>
          <button
            onClick={() => setShowJoin(true)}
            className="bg-dnd-accent text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
            Join Campaign (Player)
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-dnd-surface rounded-xl p-6 w-full max-w-md border border-dnd-accent shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-4">New Campaign</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Campaign name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary"
                  autoFocus
                />
                <textarea
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary resize-none h-20"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    disabled={!name.trim()}
                    className="flex-1 bg-dnd-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Create & Enter
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="px-4 bg-gray-700 text-white py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Join Modal */}
        {showJoin && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowJoin(false)}>
            <div className="bg-dnd-surface rounded-xl p-6 w-full max-w-md border border-dnd-accent shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-lg font-bold mb-1">Join Campaign</h2>
              <p className="text-dnd-muted text-sm mb-4">Enter the invite code shared by your DM</p>

              {joinError && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded-lg mb-3 text-sm">
                  {joinError}
                </div>
              )}

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="e.g. DND2024"
                  value={inviteCode}
                  onChange={(e) => { setInviteCode(e.target.value.toUpperCase()); setJoinError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary uppercase tracking-widest text-center text-lg font-bold"
                  maxLength={8}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleJoin}
                    disabled={!inviteCode.trim()}
                    className="flex-1 bg-dnd-accent text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => setShowJoin(false)}
                    className="px-4 bg-gray-700 text-white py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center text-dnd-muted py-12">Loading campaigns...</div>
        )}

        {!loading && campaigns.length === 0 && (
          /* Empty state */
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto bg-dnd-accent/30 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-dnd-muted">?</span>
            </div>
            <p className="text-xl font-semibold mb-2">No campaigns yet</p>
            <p className="text-dnd-muted mb-6 max-w-md mx-auto">
              Create a campaign as a Dungeon Master, or join one with an invite code from your DM.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowCreate(true)}
                className="bg-dnd-primary text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90"
              >
                Create Campaign
              </button>
              <button
                onClick={() => setShowJoin(true)}
                className="bg-dnd-accent text-white px-5 py-2 rounded-lg font-semibold hover:opacity-90"
              >
                Join with Code
              </button>
            </div>
          </div>
        )}

        {!loading && campaigns.length > 0 && (
          <div className="space-y-8">
            {/* My Campaigns (as DM) */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold">Your Campaigns</h2>
                <span className="text-xs bg-dnd-primary/20 text-dnd-primary px-2 py-0.5 rounded">{myCampaigns.length}</span>
              </div>

              {myCampaigns.length === 0 ? (
                <div className="bg-dnd-surface/50 border border-dashed border-dnd-accent/50 rounded-lg p-6 text-center">
                  <p className="text-dnd-muted text-sm">You haven't created any campaigns yet.</p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="mt-2 text-dnd-primary text-sm hover:underline"
                  >
                    Create your first campaign
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {myCampaigns.map((c: any) => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      isDM
                      userId={user?.id}
                      onEnter={() => navigate(`/campaign/${c.id}`)}
                      onCopy={() => copyInviteCode(c.inviteCode, c.id)}
                      copied={copiedId === c.id}
                      onDelete={() => { if (confirm('Delete this campaign?')) deleteCampaign(c.id); }}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Joined Campaigns (as Player) */}
            {joinedCampaigns.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-bold">Joined Campaigns</h2>
                  <span className="text-xs bg-dnd-accent/30 text-dnd-muted px-2 py-0.5 rounded">{joinedCampaigns.length}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {joinedCampaigns.map((c: any) => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      isDM={false}
                      onEnter={() => navigate(`/campaign/${c.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function CampaignCard({
  campaign,
  isDM,
  userId,
  onEnter,
  onCopy,
  copied,
  onDelete,
}: {
  campaign: any;
  isDM: boolean;
  userId?: string;
  onEnter: () => void;
  onCopy?: () => void;
  copied?: boolean;
  onDelete?: () => void;
}) {
  const playerCount = campaign.players?.length || 0;

  return (
    <div
      onClick={onEnter}
      className="bg-dnd-surface border border-dnd-accent/60 rounded-xl p-5 cursor-pointer hover:border-dnd-primary/50 hover:shadow-lg hover:shadow-dnd-primary/5 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-bold text-lg group-hover:text-dnd-primary transition-colors">{campaign.name}</h3>
        {isDM && (
          <span className="text-xs bg-dnd-primary/20 text-dnd-primary px-2 py-0.5 rounded font-medium">
            DM
          </span>
        )}
      </div>
      {campaign.description && (
        <p className="text-dnd-muted text-sm mb-3 line-clamp-2">{campaign.description}</p>
      )}
      <div className="flex items-center justify-between text-xs text-dnd-muted mb-3">
        <span>DM: {campaign.dm?.username || 'Unknown'}</span>
        <span>{playerCount} player{playerCount !== 1 ? 's' : ''}</span>
      </div>

      {isDM && onCopy && (
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onCopy}
            className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition-all ${
              copied
                ? 'bg-dnd-success/20 text-dnd-success border border-dnd-success/30'
                : 'bg-dnd-accent/30 text-dnd-muted hover:bg-dnd-accent/50 border border-dnd-accent/30'
            }`}
          >
            {copied ? '✓ Copied!' : `Copy Code: ${campaign.inviteCode}`}
          </button>
          <button
            onClick={onEnter}
            className="text-xs bg-dnd-primary/20 text-dnd-primary px-3 py-1.5 rounded-lg font-medium hover:bg-dnd-primary/30 transition-colors border border-dnd-primary/30"
          >
            Enter
          </button>
        </div>
      )}

      {!isDM && (
        <button
          onClick={(e) => { e.stopPropagation(); onEnter(); }}
          className="w-full text-xs bg-dnd-accent/40 text-white py-1.5 rounded-lg font-medium hover:bg-dnd-accent/60 transition-colors"
        >
          Enter Campaign
        </button>
      )}

      {isDM && onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="mt-2 text-xs text-dnd-danger/60 hover:text-dnd-danger transition-colors"
        >
          Delete Campaign
        </button>
      )}
    </div>
  );
}
