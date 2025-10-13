import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function SignIn() {
  const [mode, setMode] = useState<'signup'|'signin'>('signup');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function upsertProfile(userId: string, name?: string) {
    if (!userId) return;
    if (name && name.trim()) {
      await supabase.from('users').upsert({ id: userId, name: name.trim() });
    } else {
      // ensure a row exists even if name is empty
      await supabase.from('users').upsert({ id: userId });
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === 'signup') {
        // Check if username is already taken
        const { data: existingUsers, error: checkError } = await supabase
          .from('users')
          .select('name')
          .eq('name', displayName.trim())
          .limit(1);
        
        if (checkError) throw checkError;
        
        if (existingUsers && existingUsers.length > 0) {
          throw new Error('Username already taken. Please choose a different name.');
        }
        
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        const user = data.user ?? (await supabase.auth.getUser()).data.user;
        if (user) await upsertProfile(user.id, displayName);
        // If confirmations are on, user must confirm via email first.
        nav('/', { replace: true });
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        const user = data.user ?? (await supabase.auth.getUser()).data.user;
        if (user) {
          const metaName = (user.user_metadata as any)?.display_name as string | undefined;
          await upsertProfile(user.id, metaName);
        }
        nav('/', { replace: true });
      }
    } catch (e:any) {
      setErr(e?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center bg-gray-50 p-6 pt-20">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border bg-white p-6 shadow space-y-4">
        <h1 className="text-xl font-bold">{mode === 'signup' ? 'Create your account' : 'Sign in'}</h1>

        {mode === 'signup' && (
          <div>
            <label className="block text-sm font-medium">Display name</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Thomas B"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium">Email</label>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Password</label>
          <input
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
          />
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl px-4 py-2 font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? (mode === 'signup' ? 'Creating…' : 'Signing in…') : (mode === 'signup' ? 'Create account' : 'Sign in')}
        </button>

        <div className="text-xs text-slate-500">
          {mode === 'signup' ? (
            <>Already have an account?{' '}
              <button type="button" onClick={() => setMode('signin')} className="underline">Sign in</button>
            </>
          ) : (
            <>New here?{' '}
              <button type="button" onClick={() => setMode('signup')} className="underline">Create an account</button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}