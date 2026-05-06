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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-dnd-surface rounded-lg p-8 w-full max-w-md border border-dnd-accent">
        <h1 className="text-2xl font-bold text-center mb-2">Create Account</h1>
        <p className="text-dnd-muted text-center mb-6">Join the adventure</p>

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
              className="w-full bg-dnd-bg border border-dnd-accent rounded px-3 py-2 text-dnd-text focus:outline-none focus:border-dnd-primary"
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
              minLength={6}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-dnd-primary text-white py-2 rounded font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="text-center text-sm text-dnd-muted mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-dnd-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
