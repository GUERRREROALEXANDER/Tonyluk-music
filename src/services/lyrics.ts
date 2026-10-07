import type { Song } from "../core/song.js";
import { cleanYoutubeTitle } from "./youtube.js";

export interface LyricLine { time: number; text: string; }
export interface LyricsResult { synced: LyricLine[] | null; plain: string | null; instrumental: boolean; }

export function parseLrc(text: string): LyricLine[] {
  const out: LyricLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    const tags = [...line.matchAll(/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g)];
    const content = line.replace(/\[[^\]]*\]/g, "").trim();
    if (tags.length === 0) continue;
    const metadataOnly = /^\s*\[(?:ar|ti|al|by|re|ve|offset|length|la|la|tool):/i.test(line);
    if (metadataOnly) continue;
    for (const tag of tags) {
      const mins = Number(tag[1]); const secs = Number(tag[2]);
      const fraction = tag[3] ?? "0";
      const millis = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction);
      out.push({ time: mins * 60 + secs + millis / 1000, text: content || "♪" });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}

export function activeLineIndex(lines: LyricLine[], seconds: number): number {
  let low = 0; let high = lines.length - 1; let found = -1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const line = lines[mid];
    if (!line) break;
    if (line.time <= seconds) { found = mid; low = mid + 1; } else high = mid - 1;
  }
  return found;
}

const cache = new Map<string, LyricsResult | null>();

export async function fetchLyrics(song: Song, signal?: AbortSignal): Promise<LyricsResult | null> {
  const cached = cache.get(song.id);
  if (cached !== undefined) return cached;
  const track = cleanYoutubeTitle(song.title).replace(/\s+feat\.?\s+.*$/i, "").trim();
  const artist = (song.artist ?? "").replace(/\s+feat\.?\s+.*$/i, "").trim();
  const params = new URLSearchParams({ artist_name: artist, track_name: track });
  if (song.duration !== undefined && Number.isFinite(song.duration) && song.duration > 0 && song.source !== "itunes") params.set("duration", String(Math.round(song.duration)));
  let response = await fetch(`https://lrclib.net/api/get?${params}`, { signal });
  if (response.status === 404) {
    const search = new URLSearchParams({ track_name: track, artist_name: artist });
    response = await fetch(`https://lrclib.net/api/search?${search}`, { signal });
    if (!response.ok) { cache.set(song.id, null); return null; }
    const matches = await response.json() as unknown;
    const first = Array.isArray(matches) ? matches[0] : undefined;
    if (!first || typeof first !== "object") { cache.set(song.id, null); return null; }
    const result = lyricsFromRecord(first as Record<string, unknown>);
    cache.set(song.id, result); return result;
  }
  if (!response.ok) { cache.set(song.id, null); return null; }
  const record = await response.json() as Record<string, unknown>;
  const result = lyricsFromRecord(record); cache.set(song.id, result); return result;
}

function lyricsFromRecord(record: Record<string, unknown>): LyricsResult {
  const syncedText = typeof record.syncedLyrics === "string" ? record.syncedLyrics : "";
  const plain = typeof record.plainLyrics === "string" && record.plainLyrics.trim() ? record.plainLyrics : null;
  return { synced: syncedText ? parseLrc(syncedText) : null, plain, instrumental: record.instrumental === true };
}
