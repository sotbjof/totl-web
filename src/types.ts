// src/types.ts
export type User = { id: string; name: string };

export type League = {
  id: string;
  name: string;
  code: string;        // join code
  ownerId: string;     // creator
  memberIds: string[]; // max 8
  createdAt: number;
};