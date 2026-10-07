import type { ListNode } from "./doublylinked.js";

export interface Song {
  id: string;
  title: string;
  url: string;
  duration?: number;
  fileName?: string;
  fileSize?: number;
  artist?: string;
  album?: string;
  source: "local" | "remote" | "youtube" | "spotify" | "itunes";
  remoteId?: string;
  artworkUrl?: string;
  trackTimeMillis?: number;
  videoId?: string;
  spotifyUri?: string;
  addedAt?: number;
  license?: string;
  attribution?: string;
  noCors?: boolean;
}

export type SongNode = ListNode<Song>;
