// src/components/UserSwitcher.tsx
import React, { useEffect, useState } from "react";
import { DEV_USERS, getCurrentUser, onDevUserChange, setCurrentUser } from "../devAuth";

export default function UserSwitcher() {
  const [me, setMe] = useState(getCurrentUser());

  // Keep this component in sync even if another page changes the user
  useEffect(() => onDevUserChange(setMe), []);

  return (
    <select
      aria-label="Switch dev user"
      value={me.id}
      onChange={(e) => {
        setCurrentUser(e.target.value);
        // local UI immediately reflects the choice
        setMe(getCurrentUser());
      }}
      className="border rounded px-2 py-1"
    >
      {DEV_USERS.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}