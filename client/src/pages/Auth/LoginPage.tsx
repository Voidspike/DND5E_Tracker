import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function LoginPage() {
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-b from-dnd-surface to-dnd-bg">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-12">
          {/* Branding */}
          <div className="flex-1 text-center lg:text-left">
            <div className="w-20 h-20 mx-auto lg:mx-0 bg-dnd-accent rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-dnd-accent/30">
              <span className="text-3xl font-bold text-dnd-primary">D20</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              DND Campaign<br />Visualizer
            </h1>
            <p className="text-dnd-muted text-lg max-w-md mx-auto lg:mx-0">
              Real-time collaborative tool for D&amp;D campaigns.
              Dungeon Masters and players, unite around the virtual table.
            </p>
            <div className="flex flex-wrap gap-4 mt-6 justify-center lg:justify-start">
              <span className="text-xs bg-dnd-accent/30 text-dnd-muted px-3 py-1.5 rounded-full">
                🎲 Real-time sync
              </span>
              <span className="text-xs bg-dnd-accent/30 text-dnd-muted px-3 py-1.5 rounded-full">
                🗺️ Interactive maps
              </span>
              <span className="text-xs bg-dnd-accent/30 text-dnd-muted px-3 py-1.5 rounded-full">
                ⚔️ Combat tracker
              </span>
            </div>
          </div>

          {/* Login Form */}
          <div className="w-full max-w-md">
            <div className="bg-dnd-surface rounded-xl p-8 border border-dnd-accent shadow-xl">
              <h2 className="text-2xl font-bold mb-1">Welcome back</h2>
              <p className="text-dnd-muted text-sm mb-6">Sign in to continue your adventure</p>

              {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-dnd-muted mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    placeholder="dm@example.com"
                    className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary focus:ring-1 focus:ring-dnd-primary/50 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-dnd-muted mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    placeholder="password123"
                    className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary focus:ring-1 focus:ring-dnd-primary/50 transition-colors"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-dnd-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-dnd-accent/50">
                <p className="text-xs text-dnd-muted text-center mb-3">Quick test accounts</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEmail('dm@example.com'); setPassword('password123'); }}
                    className="flex-1 text-xs bg-dnd-accent/30 text-dnd-muted px-2 py-1.5 rounded hover:bg-dnd-accent/50 transition-colors"
                  >
                    Login as DM
                  </button>
                  <button
                    onClick={() => { setEmail('player@example.com'); setPassword('password123'); }}
                    className="flex-1 text-xs bg-dnd-accent/30 text-dnd-muted px-2 py-1.5 rounded hover:bg-dnd-accent/50 transition-colors"
                  >
                    Login as Player
                  </button>
                </div>
              </div>

              <p className="text-center text-sm text-dnd-muted mt-4">
                New to the table?{' '}
                <Link to="/register" className="text-dnd-primary hover:underline font-medium">
                  Create an account
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
