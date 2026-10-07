import { Library } from "../core/library.js";
import type { Song, SongNode } from "../core/song.js";
import type { DoublyLinkedList } from "../core/doublylinked.js";
import type { Player, RepeatMode } from "../core/player.js";
import { getBlob } from "./idb.js";

export interface UserPreferences {
  volume: number; muted: boolean; shuffle: boolean; repeat: RepeatMode; lyricsOpen: boolean;
  reducedMotion: "system" | "on" | "off";
}
export interface SavedLibrary { library: Library; currentIndex: number; playlistName: string; }
interface SavedPayload { activeName: string; playlists: Record<string, Song[]>; currentIndex: number; }

const DEFAULT_PREFS: UserPreferences = { volume: 0.8, muted: false, shuffle: false, repeat: "off", lyricsOpen: false, reducedMotion: "system" };

export class UserData {
  private readonly prefix: string;
  private pendingLibrary: string | null = null;
  private libraryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly userId: string, private readonly storage: Storage = localStorage) {
    this.prefix = `tlm.u.${userId}.`;
  }

  saveLibrary(library: Library, player: Player<Song>): void {
    const playlists: Record<string, Song[]> = {};
    for (const [name, list] of library.getPlaylistsMap()) {
      const songs: Song[] = []; let node = list.head;
      while (node !== null) {
        const song: Song & { needsBlob?: boolean } = { ...node.value };
        if (song.source === "local" && song.url.startsWith("blob:")) {
          if (!song.id) { node = node.next; continue; }
          song.url = ""; song.needsBlob = true;
        }
        songs.push(song); node = node.next;
      }
      playlists[name] = songs;
    }
    const playing = player.playlist;
    const playlistName = playing ? [...library.getPlaylistsMap()].find(([, list]) => list === playing)?.[0] : undefined;
    const activeName = playlistName ?? library.getActiveName() ?? Object.keys(playlists)[0] ?? "Default";
    const currentIndex = playing && player.current ? indexOfNode(playing, player.current) : -1;
    this.pendingLibrary = JSON.stringify({ activeName, playlists, currentIndex } satisfies SavedPayload);
    if (this.libraryTimer !== null) clearTimeout(this.libraryTimer);
    this.libraryTimer = setTimeout(() => this.flushLibrary(), 300);
  }

  loadLibrary(): SavedLibrary | null {
    const raw = this.pendingLibrary ?? this.storage.getItem(this.key("library"));
    if (!raw) return null;
    let payload: SavedPayload;
    try { payload = JSON.parse(raw) as SavedPayload; } catch { return null; }
    if (!payload || !payload.playlists || typeof payload.playlists !== "object") return null;
    const names = Object.keys(payload.playlists); const firstName = names[0] ?? "Default";
    const library = new Library(firstName);
    const first = library.getPlaylist(firstName);
    if (first) fillList(first, payload.playlists[firstName] ?? []);
    for (const name of names.slice(1)) {
      library.createPlaylist(name);
      const list = library.getPlaylist(name); if (list) fillList(list, payload.playlists[name] ?? []);
    }
    const playlistName = names.includes(payload.activeName) ? payload.activeName : firstName;
    library.switchTo(playlistName);
    const active = library.getActiveList();
    if (active && Number.isInteger(payload.currentIndex) && payload.currentIndex >= 0) active.current = active.nodeAt(payload.currentIndex);
    return { library, currentIndex: Number.isInteger(payload.currentIndex) ? payload.currentIndex : -1, playlistName };
  }

  getFavorites(): Song[] { return Array.from(this.readMap<Song>("favoriteSongs").values()); }
  toggleFavorite(song: Song): boolean {
    const songs = this.readMap<Song>("favoriteSongs");
    if (songs.has(song.id)) songs.delete(song.id); else songs.set(song.id, song);
    this.writeMap("favoriteSongs", songs);
    return songs.has(song.id);
  }
  isFavorite(id: string): boolean { return this.readMap<Song>("favoriteSongs").has(id); }

  pushRecent(song: Song): void {
    const list = this.readArray<Song>("recent").filter((item) => item.id !== song.id);
    list.unshift(song); this.storage.setItem(this.key("recent"), JSON.stringify(list.slice(0, 30)));
  }
  getRecent(): Song[] { return this.readArray<Song>("recent").slice(0, 30); }

  getPrefs(): UserPreferences {
    try {
      const raw: unknown = JSON.parse(this.storage.getItem(this.key("prefs")) ?? "{}");
      return { ...DEFAULT_PREFS, ...(raw && typeof raw === "object" ? raw as Partial<UserPreferences> : {}) };
    } catch { return { ...DEFAULT_PREFS }; }
  }
  setPrefs(patch: Partial<UserPreferences>): UserPreferences {
    const merged = { ...this.getPrefs(), ...patch }; this.storage.setItem(this.key("prefs"), JSON.stringify(merged)); return merged;
  }

  flushLibrary(): void {
    if (this.libraryTimer !== null) clearTimeout(this.libraryTimer);
    this.libraryTimer = null;
    if (this.pendingLibrary !== null) this.storage.setItem(this.key("library"), this.pendingLibrary);
    this.pendingLibrary = null;
  }

  private key(name: string): string { return `${this.prefix}${name}`; }
  private readMap<T extends { id: string }>(name: string): Map<string, T> {
    try {
      const data: unknown = JSON.parse(this.storage.getItem(this.key(name)) ?? "{}");
      return new Map(data && typeof data === "object" && !Array.isArray(data) ? Object.entries(data as Record<string, T>) : []);
    } catch { return new Map(); }
  }
  private writeMap<T extends { id: string }>(name: string, map: Map<string, T>): void { this.storage.setItem(this.key(name), JSON.stringify(Object.fromEntries(map))); }
  private readArray<T>(name: string): T[] {
    try { const data: unknown = JSON.parse(this.storage.getItem(this.key(name)) ?? "[]"); return Array.isArray(data) ? data as T[] : []; } catch { return []; }
  }
}

function indexOfNode(list: DoublyLinkedList<Song>, target: SongNode): number {
  let node = list.head; let index = 0;
  while (node !== null) { if (node === target) return index; node = node.next; index++; }
  return -1;
}
function fillList(list: DoublyLinkedList<Song>, songs: Song[]): void {
  for (const song of songs) list.addLast(song);
}

export async function rehydrateLocalSongs(library: Library): Promise<void> {
  for (const list of library.getPlaylistsMap().values()) {
    let node = list.head;
    while (node !== null) {
      const song = node.value as Song & { needsBlob?: boolean };
      if (song.source === "local" && song.needsBlob && song.id) {
        const blob = await getBlob(song.id);
        if (blob) { song.url = URL.createObjectURL(blob); delete song.needsBlob; }
      }
      node = node.next;
    }
  }
}
