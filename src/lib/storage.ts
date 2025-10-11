// src/lib/storage.ts
const KEY = 'totl_db_v1';

type DB = {
  users: Record<string, { id: string; name: string }>;
  leagues: Record<string, {
    id: string;
    name: string;
    code: string;
    ownerId: string;
    memberIds: string[];
    createdAt: number;
  }>;
};

function emptyDB(): DB {
  return { users: {}, leagues: {} };
}

export function readDB(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as DB : emptyDB();
  } catch {
    return emptyDB();
  }
}
export function writeDB(db: DB) {
  localStorage.setItem(KEY, JSON.stringify(db));
}
export function resetDB() {
  writeDB(emptyDB());
}