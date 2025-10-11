// src/pages/SignIn.tsx
import { useState } from 'react';
import { signIn } from '../lib/auth';

export default function SignIn({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      signIn(name, email || undefined);
      onDone();
    } catch (e:any) {
      setErr(e?.message || 'Could not sign in');
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 md:p-8 shadow-sm border max-w-lg">
      <h1 className="text-2xl font-bold">Sign in to play</h1>
      <p className="mt-2 text-sm text-slate-600">
        Choose a display name. This identifies you on global and mini-league tables.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Display name *</label>
          <input
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={e=>setName(e.target.value)}
            placeholder="e.g. Thomas B"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Email (optional)</label>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={e=>setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <p className="mt-1 text-xs text-slate-500">Used later for login + syncing across devices.</p>
        </div>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <button
          type="submit"
          className="rounded-xl px-4 py-2 font-semibold bg-blue-600 text-white hover:bg-blue-700"
        >
          Continue
        </button>
      </form>
    </section>
  );
}