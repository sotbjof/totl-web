// src/services/auth.ts
import { readDB, writeDB } from '../lib/storage';
import type { User } from '../types';

const CURRENT_KEY = 'totl_current_user_id';

function uid(prefix = 'u'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function getCurrentUser(): User {
  const db = readDB();
  let id = localStorage.getItem(CURRENT_KEY);
  if (id && db.users[id]) return db.users[id];

  // First visit: mint a user with a fun name
  const user: User = {
    id: uid('user'),
    name: `Guest-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
  };
  db.users[user.id] = user;
  writeDB(db);
  localStorage.setItem(CURRENT_KEY, user.id);
  return user;
}

export function renameCurrentUser(name: string) {
  const db = readDB();
  const id = localStorage.getItem(CURRENT_KEY);
  if (!id || !db.users[id]) return;
  db.users[id].name = name.trim() || db.users[id].name;
  writeDB(db);
}

export function signOutMock() {
  localStorage.removeItem(CURRENT_KEY);
}