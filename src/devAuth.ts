// src/devAuth.ts
export type DevUser = { id: string; name: string; short?: string };

export const DEV_USERS: DevUser[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Admin", short: "AD" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Jof",   short: "J"  },
  { id: "33333333-3333-3333-3333-333333333333", name: "Paul",  short: "P"  },
  { id: "44444444-4444-4444-4444-444444444444", name: "Ben",   short: "B"  },
];

const LS_KEY = "totl:dev_user";

export function getCurrentUser(): DevUser {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const id = JSON.parse(raw)?.id as string;
      const found = DEV_USERS.find((u) => u.id === id);
      if (found) return found;
    }
  } catch {}
  // default to Admin
  const def = DEV_USERS[0];
  localStorage.setItem(LS_KEY, JSON.stringify({ id: def.id }));
  return def;
}

/** Set and broadcast a change so any page can refresh UI. */
export function setCurrentUser(id: string) {
  localStorage.setItem(LS_KEY, JSON.stringify({ id }));
  window.dispatchEvent(new CustomEvent("dev-user-changed", { detail: { id } }));
}

/** Subscribe to user changes (returns unsubscriber). */
export function onDevUserChange(cb: (u: DevUser) => void) {
  const handler = () => cb(getCurrentUser());
  window.addEventListener("dev-user-changed", handler as EventListener);
  return () => window.removeEventListener("dev-user-changed", handler as EventListener);
}
// Allow manual user switching (used by dev switcher bar)
export function setDevUser(name: string) {
  const found = DEV_USERS.find(u => u.name === name);
  if (!found) return;

  localStorage.setItem(LS_KEY, JSON.stringify(found));
  window.dispatchEvent(new CustomEvent("dev-user-changed"));
}