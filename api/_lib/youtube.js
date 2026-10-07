// Kept in plain JavaScript for the Vercel Node function; parsing mirrors src/services/youtube.ts.
export function parseIsoDuration(value) {
  const match = typeof value === "string" ? value.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/) : null;
  if (!match) return 0;
  return Number(match[1] ?? 0) * 86400 + Number(match[2] ?? 0) * 3600 + Number(match[3] ?? 0) * 60 + Number(match[4] ?? 0);
}

export function cleanYoutubeTitle(title, author = "") {
  let cleaned = String(title ?? "");
  if (author && cleaned.toLowerCase().startsWith(`${author.toLowerCase()} - `)) cleaned = cleaned.slice(author.length + 3);
  cleaned = cleaned.replace(/\(Official Video\)|\[Official Music Video\]|\(Official Music Video\)|\(Official Lyric Video\)|\[Official Lyric Video\]|\(Lyrics\)|\[Lyrics\]|\(Lyric Video\)|\(HD\)|\[HD\]|4K Remaster|\(4K\)|\[4K\]|\(Remastered\)|\s*-\s*Topic\s*$/gi, "");
  return cleaned.replace(/\s*\(\s*\)|\s*\[\s*\]/g, "").replace(/\s{2,}/g, " ").replace(/[\s\-–—]+$/g, "").trim() || String(title ?? "").trim();
}

export function shapeYoutubeResults(search, details) {
  const durations = new Map((details.items ?? []).map((item) => [item.id, item.contentDetails?.duration ?? ""]));
  const seen = new Set();
  return (search.items ?? []).flatMap((item) => {
    const videoId = item.id?.videoId;
    if (!videoId || seen.has(videoId)) return [];
    seen.add(videoId);
    const title = item.snippet?.title ?? "Unknown";
    const channel = item.snippet?.channelTitle ?? "Unknown";
    const thumb = item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
    return [{ videoId, title, cleanedTitle: cleanYoutubeTitle(title, channel), channel, duration: parseIsoDuration(durations.get(videoId) ?? ""), thumbnail: thumb }];
  });
}
