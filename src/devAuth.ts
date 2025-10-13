// src/devAuth.ts
export type DevUser = { id: string; name: string; short?: string };

export const DEV_USERS: DevUser[] = [
  { id: "4542c037-5b38-40d0-b189-847b8f17c222", name: "Jof", short: "J" },
  { id: "f8a1669e-2512-4edf-9c21-b9f87b3efbe2", name: "Carl", short: "C" },
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
  // default to Jof (new admin)
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