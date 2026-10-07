import { describe, it } from "node:test";
import assert from "node:assert/strict";
import youtubeSearch from "../api/youtube-search.js";

function makeResponse() {
  return {
    code: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.code = code; return this; },
    json(value) { this.body = value; return this; },
  };
}

describe("youtube-search API", () => {
  it("rejects invalid q with 400", async () => {
    const res = makeResponse(); await youtubeSearch({ method: "GET", query: { q: "x" } }, res);
    assert.equal(res.code, 400); assert.equal(typeof res.body.error, "string");
  });
  it("returns 501 when no API key is configured", async () => {
    const previous = process.env.YOUTUBE_API_KEY; delete process.env.YOUTUBE_API_KEY;
    try {
      const res = makeResponse(); await youtubeSearch({ method: "GET", query: { q: "music" } }, res);
      assert.equal(res.code, 501); assert.match(res.body.error, /not configured/);
    } finally { if (previous !== undefined) process.env.YOUTUBE_API_KEY = previous; }
  });
});
