import { useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function RegisterPage() {
  const { register, loading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await register(username, email, password);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-b from-dnd-surface to-dnd-bg">
        <div className="w-full max-w-6xl flex flex-col lg:flex-row items-center gap-12">
          {/* Branding */}
          <div className="flex-1 text-center lg:text-left">
            <div className="w-20 h-20 mx-auto lg:mx-0 bg-dnd-accent rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-dnd-accent/30">
              <span className="text-3xl font-bold text-dnd-primary">D20</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4">
              Join the<br />Adventure
            </h1>
            <p className="text-dnd-muted text-lg max-w-md mx-auto lg:mx-0">
              Create your account and start exploring. Whether you're a Dungeon Master or a player, the virtual table awaits.
            </p>
          </div>

          {/* Register Form */}
          <div className="w-full max-w-md">
            <div className="bg-dnd-surface rounded-xl p-8 border border-dnd-accent shadow-xl">
              <h2 className="text-2xl font-bold mb-1">Create Account</h2>
              <p className="text-dnd-muted text-sm mb-6">Begin your journey</p>

              {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-2 rounded mb-4 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-dnd-muted mb-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => { setUsername(e.target.value); clearError(); }}
                    placeholder="Choose a name"
                    className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary focus:ring-1 focus:ring-dnd-primary/50 transition-colors"
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm text-dnd-muted mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); clearError(); }}
                    placeholder="you@example.com"
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
                    placeholder="At least 6 characters"
                    className="w-full bg-dnd-bg border border-dnd-accent rounded-lg px-3 py-2.5 text-dnd-text placeholder-dnd-muted/40 focus:outline-none focus:border-dnd-primary focus:ring-1 focus:ring-dnd-primary/50 transition-colors"
                    required
                    minLength={6}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-dnd-primary text-white py-2.5 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </form>

              <p className="text-center text-sm text-dnd-muted mt-4">
                Already have an account?{' '}
                <Link to="/login" className="text-dnd-primary hover:underline font-medium">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
