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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-dnd-surface rounded-lg p-8 w-full max-w-md border border-dnd-accent">
        <h1 className="text-2xl font-bold text-center mb-2">DND Visualizer</h1>
        <p className="text-dnd-muted text-center mb-6">Sign in to your account</p>

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
              className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text focus:outline-none focus:border-dnd-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-dnd-muted mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); clearError(); }}
              className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text focus:outline-none focus:border-dnd-primary"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dnd-primary text-white py-2 rounded font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-dnd-muted mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-dnd-primary hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
