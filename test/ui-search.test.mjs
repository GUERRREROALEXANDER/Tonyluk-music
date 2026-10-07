import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div><div id='toast-root'></div></body></html>", { url: "http://localhost/#/search" });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.location = dom.window.location;
globalThis.Node = dom.window.Node; globalThis.HTMLElement = dom.window.HTMLElement; globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.DOMParser = dom.window.DOMParser; globalThis.CustomEvent = dom.window.CustomEvent; globalThis.AbortController = dom.window.AbortController;
globalThis.localStorage = dom.window.localStorage;
Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });

const { Library } = await import("../dist/core/library.js");
const { Player } = await import("../dist/core/player.js");
const { UserData } = await import("../dist/services/userData.js");
const { setStoreForMount } = await import("../dist/ui/store.js");
const { mountSearchView } = await import("../dist/ui/views/searchView.js");

class MemoryStorage { data = new Map(); get length() { return this.data.size; } key(index) { return [...this.data.keys()][index] ?? null; } getItem(key) { return this.data.get(key) ?? null; } setItem(key, value) { this.data.set(key, String(value)); } removeItem(key) { this.data.delete(key); } clear() { this.data.clear(); } }
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function setup() {
  globalThis.localStorage?.removeItem("tlm.searchSource.search");
  const library = new Library("Active"); const list = library.getActiveList(); const player = new Player(list); const data = new UserData("search", new MemoryStorage());
  const controller = { supportsVolume: true, currentTime: 0, duration: 30, activeKind: "audio", paused: true, playNode: async node => player.play(node, library.getActiveList()), next: async () => player.next(), prev: async () => player.prev(), togglePlay: async () => {}, setVolume() {}, setMuted() {}, seek() {}, on() {}, destroy() {} };
  setStoreForMount({ user: { id: "search", name: "Demo", email: "demo@example.test", createdAt: 0 }, library, player, controller, data, view: "search", playbackState: "paused" });
  const root = document.getElementById("root"); mountSearchView(root); return { root, list };
}
let requestCount = 0; let abortCount = 0;
function catalogFetch() { requestCount = 0; abortCount = 0; globalThis.fetch = async (url, options = {}) => { requestCount++; const term = new URL(String(url)).searchParams.get("term") ?? "song"; return new Promise((resolve, reject) => { const timer = setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({ results: [{ trackId: term, trackName: `${term} song`, artistName: "Coldplay", collectionName: "Parachutes", previewUrl: "https://audio.test/song.mp3", artworkUrl100: "https://img.test/cover.png", trackTimeMillis: 30000 }] }) }), 180); options.signal?.addEventListener("abort", () => { abortCount++; clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true }); }); }; }

describe("multi-source search UI", () => {
  it("debounces input and aborts the previous request", async () => {
    catalogFetch(); const { root } = setup(); const input = root.querySelector("input[type=search]"); input.value = "coldplay"; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(200); assert.equal(requestCount, 0); assert.equal(root.querySelectorAll(".search-skeleton").length, 6); await wait(180); assert.equal(requestCount, 1); input.value = "coldplay yellow"; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(620); assert.ok(abortCount >= 1); assert.match(root.textContent, /coldplay yellow song/); assert.equal(root.querySelectorAll(".search-song-row").length, 1);
  });
  it("renders Catalog results", async () => { catalogFetch(); const { root } = setup(); const input = root.querySelector("input[type=search]"); input.value = "artist"; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(600); assert.match(root.textContent, /artist song/); assert.match(root.textContent, /Preview 30s/); });
  it("shows the Spotify credentials state for a 501 response", async () => { globalThis.fetch = async () => ({ ok: false, status: 501, json: async () => ({}) }); const { root } = setup(); root.querySelector('[role=tab][aria-selected="false"]')?.click(); [...root.querySelectorAll('[role=tab]')].find(button => button.textContent === "Spotify").click(); const input = root.querySelector("input[type=search]"); input.value = "track"; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(420); assert.match(root.textContent, /Spotify search needs server credentials/); assert.ok([...root.querySelectorAll("button")].some(button => button.textContent === "Paste link")); });
  it("adds a pasted YouTube link at the end of the active list", async () => { globalThis.fetch = async url => String(url).includes("youtube.com/oembed") ? ({ ok: true, json: async () => ({ title: "Linked song", author_name: "Artist", thumbnail_url: "https://img.test/y.png" }) }) : ({ ok: true, json: async () => ({}) }); const { root, list } = setup(); [...root.querySelectorAll('[role=tab]')].find(button => button.textContent === "Paste link").click(); const input = root.querySelector("input[type=search]"); input.value = "https://youtu.be/abcdefghijk"; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(30); [...root.querySelectorAll(".search-song-row button")].find(button => button.textContent === "Add last")?.click(); assert.equal(list.tail?.value.title, "Linked song"); });
  it("inserts a result at the chosen list index", async () => { catalogFetch(); const { root, list } = setup(); list.addLast({ id: "a", title: "A", source: "remote" }); list.addLast({ id: "b", title: "B", source: "remote" }); const input = root.querySelector("input[type=search]"); input.value = "insert"; input.dispatchEvent(new window.Event("input", { bubbles: true })); await wait(600); root.querySelector(".search-song-row button:last-child").click(); document.querySelector('.ops-stepper button[aria-label="Move position earlier"]').click(); document.querySelector(".ops-sheet>.gold-button").click(); assert.deepEqual(list.toArray().map(song => song.title), ["A", "insert song", "B"]); assert.equal(list.nodeAt(1)?.prev, list.head); assert.equal(list.tail?.value.title, "B"); });
});
