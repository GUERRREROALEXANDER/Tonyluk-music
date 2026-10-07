import type { Song } from "../core/song.js";
import { classifyUrl } from "./links.js";
import { apiBase } from "./config.js";

export interface SpotifyMeta { title: string; thumbnail_url: string; }
export interface SpotifyResult {
  id: string; uri: string; title: string; artist: string; album: string; artworkUrl: string; duration: number;
}

export function parseSpotifyTrack(input: string): string | null {
  const classified = classifyUrl(input);
  if (classified.kind !== "spotify" || !classified.trackId) return null;
  const match = input.trim().match(/^spotify:track:([A-Za-z0-9]+)$/);
  if (match) return match[1] ?? null;
  try {
    const url = new URL(input.trim());
    if (url.hostname.toLowerCase() !== "open.spotify.com") return null;
    return url.pathname.match(/\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]+)/i)?.[1] ?? null;
  } catch { return null; }
}

export async function fetchSpotifyMeta(trackId: string, fetchFn: typeof fetch = fetch): Promise<SpotifyMeta> {
  const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${encodeURIComponent(trackId)}`)}`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Spotify metadata failed (${response.status})`);
  const data = await response.json() as Record<string, unknown>;
  return { title: typeof data.title === "string" ? data.title : "", thumbnail_url: typeof data.thumbnail_url === "string" ? data.thumbnail_url : "" };
}

export async function searchSpotify(query: string, signal?: AbortSignal): Promise<{ available: boolean; items: SpotifyResult[] }> {
  const response = await fetch(`${apiBase()}/api/spotify-search?q=${encodeURIComponent(query.trim())}`, { signal });
  if (response.status === 501) return { available: false, items: [] };
  if (!response.ok) throw new Error(`Spotify search failed (${response.status})`);
  const payload = await response.json() as { items?: unknown };
  return { available: true, items: Array.isArray(payload.items) ? payload.items as SpotifyResult[] : [] };
}

export function songFromSpotify(result: SpotifyResult): Song {
  return { id: `spotify:${result.id}`, title: result.title, artist: result.artist, album: result.album, url: `https://open.spotify.com/track/${result.id}`, artworkUrl: result.artworkUrl, duration: result.duration, spotifyUri: result.uri || `spotify:track:${result.id}`, source: "spotify" };
}
