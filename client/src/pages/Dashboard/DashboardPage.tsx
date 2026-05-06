import { useEffect, useState } from 'react';
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

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async () => {
    await createCampaign(name, description || undefined);
    setName('');
    setDescription('');
    setShowCreate(false);
  };

  const handleJoin = async () => {
    await joinCampaign(inviteCode.toUpperCase());
    setInviteCode('');
    setShowJoin(false);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-dnd-surface border-b border-dnd-accent px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold">DND Visualizer</h1>
          <div className="flex items-center gap-4">
            <span className="text-dnd-muted text-sm">Welcome, {user?.username}</span>
            <button
              onClick={logout}
              className="text-sm text-dnd-muted hover:text-dnd-primary"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => setShowCreate(true)}
            className="bg-dnd-primary text-white px-4 py-2 rounded font-semibold hover:opacity-90"
          >
            + New Campaign
          </button>
          <button
            onClick={() => setShowJoin(true)}
            className="bg-dnd-accent text-white px-4 py-2 rounded font-semibold hover:opacity-90"
          >
            Join Campaign
          </button>
        </div>

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-dnd-surface rounded-lg p-6 w-full max-w-md border border-dnd-accent">
              <h2 className="text-lg font-bold mb-4">New Campaign</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Campaign name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text"
                />
                <textarea
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text resize-none h-20"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCreate}
                    className="flex-1 bg-dnd-primary text-white py-2 rounded font-semibold hover:opacity-90"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 bg-gray-700 text-white py-2 rounded hover:opacity-90"
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-dnd-surface rounded-lg p-6 w-full max-w-md border border-dnd-accent">
              <h2 className="text-lg font-bold mb-4">Join Campaign</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text uppercase"
                  maxLength={8}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleJoin}
                    className="flex-1 bg-dnd-accent text-white py-2 rounded font-semibold hover:opacity-90"
                  >
                    Join
                  </button>
                  <button
                    onClick={() => setShowJoin(false)}
                    className="flex-1 bg-gray-700 text-white py-2 rounded hover:opacity-90"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Campaign List */}
        {loading ? (
          <div className="text-center text-dnd-muted py-12">Loading campaigns...</div>
        ) : campaigns.length === 0 ? (
          <div className="text-center text-dnd-muted py-12">
            <p className="text-lg mb-2">No campaigns yet</p>
            <p className="text-sm">Create a new campaign or join one with an invite code.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c: any) => (
              <div
                key={c.id}
                onClick={() => navigate(`/campaign/${c.id}`)}
                className="bg-dnd-surface border border-dnd-accent rounded-lg p-5 cursor-pointer hover:border-dnd-primary transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg">{c.name}</h3>
                  {c.dmId === user?.id && (
                    <span className="text-xs bg-dnd-primary/20 text-dnd-primary px-2 py-0.5 rounded">
                      DM
                    </span>
                  )}
                </div>
                {c.description && (
                  <p className="text-dnd-muted text-sm mb-3 line-clamp-2">{c.description}</p>
                )}
                <div className="flex items-center justify-between text-xs text-dnd-muted">
                  <span>DM: {c.dm?.username || 'Unknown'}</span>
                  <span>Code: {c.inviteCode}</span>
                </div>
                {c.dmId === user?.id && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this campaign?')) deleteCampaign(c.id);
                    }}
                    className="mt-3 text-xs text-dnd-danger hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
