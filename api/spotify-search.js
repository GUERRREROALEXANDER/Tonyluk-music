let tokenCache = { value: "", expiresAt: 0 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", process.env.ALLOWED_ORIGIN ?? "*");
  res.setHeader("Access-Control-Allow-Methods", "GET");
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=300");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const query = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  if (query.length < 2 || query.length > 100) return res.status(400).json({ error: "q must be 2 to 100 characters" });
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(501).json({ error: "Spotify credentials not configured" });
  try {
    if (!tokenCache.value || tokenCache.expiresAt <= Date.now()) {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const tokenResponse = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: "grant_type=client_credentials" });
      if (!tokenResponse.ok) return res.status(502).json({ error: "Spotify search unavailable" });
      const tokenData = await tokenResponse.json();
      if (typeof tokenData.access_token !== "string") return res.status(502).json({ error: "Spotify search unavailable" });
      tokenCache = { value: tokenData.access_token, expiresAt: Date.now() + Math.max(0, Number(tokenData.expires_in ?? 3600) - 60) * 1000 };
    }
    const params = new URLSearchParams({ type: "track", limit: "15", q: query });
    const response = await fetch(`https://api.spotify.com/v1/search?${params}`, { headers: { Authorization: `Bearer ${tokenCache.value}` } });
    if (!response.ok) return res.status(502).json({ error: "Spotify search unavailable" });
    const data = await response.json();
    const items = (data.tracks?.items ?? []).map((track) => ({ id: track.id, uri: track.uri, title: track.name, artist: track.artists?.map((artist) => artist.name).join(", ") ?? "", album: track.album?.name ?? "", artworkUrl: track.album?.images?.[0]?.url ?? "", duration: Number(track.duration_ms ?? 0) / 1000 }));
    return res.status(200).json({ items });
  } catch {
    return res.status(502).json({ error: "Spotify search unavailable" });
  }
}
