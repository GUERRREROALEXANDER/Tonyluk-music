import { shapeYoutubeResults } from "./_lib/youtube.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=300");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const query = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 100) return res.status(400).json({ error: "q must be 2 to 100 characters" });
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(501).json({ error: "YouTube API key not configured" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const params = new URLSearchParams({ part: "snippet", type: "video", videoCategoryId: "10", maxResults: "15", q: query, key });
    const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: controller.signal });
    if (!searchResponse.ok) return res.status(502).json({ error: "YouTube search unavailable" });
    const search = await searchResponse.json();
    const ids = (search.items ?? []).map((item) => item.id?.videoId).filter(Boolean).join(",");
    if (!ids) return res.status(200).json({ items: [] });
    const detailParams = new URLSearchParams({ part: "contentDetails", id: ids, key });
    const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${detailParams}`, { signal: controller.signal });
    if (!detailsResponse.ok) return res.status(502).json({ error: "YouTube search unavailable" });
    return res.status(200).json({ items: shapeYoutubeResults(search, await detailsResponse.json()) });
  } catch {
    return res.status(502).json({ error: "YouTube search unavailable" });
  } finally { clearTimeout(timeout); }
}
