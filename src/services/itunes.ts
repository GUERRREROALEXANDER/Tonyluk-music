// Pure helpers for iTunes Search API, no DOM.
import type { Song } from "../core/song.js";
export type Chip = "all" | "artist" | "song";

export interface SearchResult {
  remoteId: string;
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  artworkUrl: string;
  trackTimeMillis?: number;
}

export function buildSearchUrl(term: string, chip: Chip): string {
  const base = "https://itunes.apple.com/search";
  const t = term.trim();
  let url = `${base}?term=${encodeURIComponent(t)}&media=music&entity=song&limit=25`;
  if (chip === "artist") url += "&attribute=artistTerm";
  else if (chip === "song") url += "&attribute=songTerm";
  return url;
}

export function cacheKey(term: string, chip: Chip): string {
  return `${term.toLowerCase().trim()}::${chip}`;
}

export function parseResults(json: unknown): SearchResult[] {
  if (json === null || json === undefined) return [];
  if (typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  const results = obj["results"];
  if (!Array.isArray(results)) return [];
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const item of results) {
    if (item === null || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const previewUrl = rec["previewUrl"];
    if (typeof previewUrl !== "string" || previewUrl.trim() === "") continue;
    const rawId = rec["trackId"];
    if (rawId === undefined || rawId === null) continue;
    const remoteId = String(rawId);
    if (seen.has(remoteId)) continue;
    seen.add(remoteId);
    const trackName = typeof rec["trackName"] === "string" && (rec["trackName"] as string).trim() !== "" ? (rec["trackName"] as string) : "Unknown track";
    const artistName = typeof rec["artistName"] === "string" && (rec["artistName"] as string).trim() !== "" ? (rec["artistName"] as string) : "Unknown artist";
    const collectionName = typeof rec["collectionName"] === "string" ? (rec["collectionName"] as string) : "";
    const artworkRaw = typeof rec["artworkUrl100"] === "string" ? (rec["artworkUrl100"] as string) : "";
    const artworkUrl = artworkRaw ? artworkRaw.replace("100x100bb", "300x300bb") : "";
    const ttm = rec["trackTimeMillis"];
    const trackTimeMillis = typeof ttm === "number" && Number.isFinite(ttm) ? ttm : undefined;
    out.push({
      remoteId,
      title: trackName,
      artist: artistName,
      album: collectionName,
      previewUrl: previewUrl as string,
      artworkUrl,
      trackTimeMillis,
    });
  }
  return out;
}

export class SearchCache {
  private map = new Map<string, { value: SearchResult[]; time: number }>();
  ttl = 5 * 60 * 1000;
  max = 20;
  private now: () => number;
  constructor(nowFn: () => number = () => Date.now()) {
    this.now = nowFn;
  }
  get(key: string): SearchResult[] | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (this.now() - e.time > this.ttl) {
      this.map.delete(key);
      return undefined;
    }
    return e.value;
  }
  set(key: string, value: SearchResult[]): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, time: this.now() });
    if (this.map.size > this.max) {
      const first = this.map.keys().next().value as string | undefined;
      if (first !== undefined) this.map.delete(first);
    }
  }
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }
  size(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
}

const searchCache = new SearchCache();

export async function searchItunes(
  term: string,
  chip: Chip,
  signal?: AbortSignal,
  fetchFn: typeof fetch = fetch,
): Promise<SearchResult[]> {
  const key = cacheKey(term, chip);
  const cached = searchCache.get(key);
  if (cached) return cached;
  if (term.trim().length < 2) return [];
  const response = await fetchFn(buildSearchUrl(term, chip), { signal });
  if (!response.ok) throw new Error(`iTunes search failed (${response.status})`);
  const results = parseResults(await response.json() as unknown);
  searchCache.set(key, results);
  return results;
}

export function songFromItunes(result: SearchResult): Song {
  return {
    id: `itunes:${result.remoteId}`,
    title: result.title,
    artist: result.artist,
    album: result.album,
    url: result.previewUrl,
    artworkUrl: result.artworkUrl,
    duration: 30,
    trackTimeMillis: result.trackTimeMillis,
    remoteId: result.remoteId,
    source: "itunes",
  };
}
