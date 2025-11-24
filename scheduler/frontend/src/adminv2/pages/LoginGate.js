import React, { useState } from 'react';

export default function LoginGate({ onLogin, loading, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onLogin?.({ username, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg p-8 space-y-6">
        <div>
          <div className="text-xs uppercase tracking-wide font-semibold text-blue-500">Admin console</div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Sign in</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Use your Open Ireland Lab admin credentials to continue.
          </p>
        </div>
        {error && (
          <div className="text-sm text-red-600 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md px-3 py-2">
            {error}
          </div>
        )}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Username
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          Need access? Contact a Super Admin to request an invitation.
        </p>
      </div>
    </div>
  );
}

