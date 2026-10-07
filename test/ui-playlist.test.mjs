import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div><div id='toast-root'></div></body></html>", { url: "http://localhost/" });
globalThis.window = dom.window; globalThis.document = dom.window.document; globalThis.location = dom.window.location;
globalThis.Node = dom.window.Node; globalThis.HTMLElement = dom.window.HTMLElement; globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.DOMParser = dom.window.DOMParser; globalThis.CustomEvent = dom.window.CustomEvent; Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
dom.window.HTMLElement.prototype.scrollIntoView = function () {};

const { DoublyLinkedList } = await import("../dist/core/doublylinked.js");
const { Library } = await import("../dist/core/library.js");
const { Player } = await import("../dist/core/player.js");
const { UserData } = await import("../dist/services/userData.js");
const { setStoreForMount } = await import("../dist/ui/store.js");
const { mountPlaylistView } = await import("../dist/ui/views/playlistView.js");

class MemoryStorage {
  data = new Map();
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
  clear() { this.data.clear(); }
}

function verifyLinks(list) {
  assert.equal(list.head?.prev ?? null, null); assert.equal(list.tail?.next ?? null, null);
  let count = 0; let previous = null; let node = list.head;
  while (node) { assert.equal(node.prev, previous); if (node.next) assert.equal(node.next.prev, node); previous = node; node = node.next; count++; }
  assert.equal(previous, list.tail); assert.equal(count, list.size);
}

async function addSong(label, buttonLabel) {
  const ops = [...document.querySelectorAll(".operation-button")].find(button => button.textContent.includes(buttonLabel));
  ops.click();
  const input = document.querySelector(".ops-sheet input[type=search]"); input.value = label; input.dispatchEvent(new window.Event("input", { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 350));
  document.querySelector(".ops-result").click(); document.querySelector(".ops-sheet>.gold-button").click();
  await new Promise(resolve => setTimeout(resolve, 10));
}

describe("playlist view list operations", () => {
  it("keeps row order and linked pointers aligned for add, insert, delete, next and previous", async () => {
    globalThis.fetch = async url => {
      const term = new URL(String(url)).searchParams.get("term") ?? "song";
      return { ok: true, json: async () => ({ results: Array.from({ length: 6 }, (_, index) => ({ trackId: `${term}-${index}`, trackName: `${term} ${index}`, artistName: "Demo Artist", collectionName: "Demo Album", previewUrl: `https://audio.test/${term}-${index}.mp3`, artworkUrl100: "https://img.test/cover.png", trackTimeMillis: 30000 })) }) };
    };
    const library = new Library("My Playlist"); const list = library.getActiveList(); const player = new Player(list); const data = new UserData("test", new MemoryStorage());
    const controller = { supportsVolume: true, currentTime: 0, duration: 30, activeKind: "audio", paused: true, playNode: async node => player.play(node, list), next: async () => player.next(), prev: async () => player.prev(), togglePlay: async () => {}, setVolume() {}, setMuted() {}, seek() {}, on() {}, destroy() {} };
    setStoreForMount({ user: { id: "test", name: "Demo", email: "demo@example.test", createdAt: 0 }, library, player, controller, data, view: "playlist", playbackState: "paused" });
    const root = document.getElementById("root"); mountPlaylistView(root);
    await addSong("first-song", "Add first"); await addSong("last-song", "Add last"); await addSong("middle-song", "Insert at position");
    assert.deepEqual([...root.querySelectorAll(".row-title strong")].map(row => row.textContent), ["first-song 0", "middle-song 0", "last-song 0"]);
    verifyLinks(list); assert.equal(list.head.value.title, "first-song 0"); assert.equal(list.head.next.prev, list.head); assert.equal(list.tail.value.title, "last-song 0");
    root.querySelector(".operation-button.delete-mode")?.click();
    const deleteToggle = [...root.querySelectorAll(".operation-button")].find(button => button.textContent.includes("Delete")); deleteToggle.click();
    root.querySelector(".song-row .row-play").click();
    assert.deepEqual([...root.querySelectorAll(".row-title strong")].map(row => row.textContent), ["middle-song 0", "last-song 0"]); verifyLinks(list);
    const first = list.head; const nextButton = [...root.querySelectorAll(".operation-button")].find(button => button.textContent.includes("Next")); const previousButton = [...root.querySelectorAll(".operation-button")].find(button => button.textContent.includes("Previous"));
    nextButton.click(); await new Promise(resolve => setImmediate(resolve)); assert.equal(list.current, first); nextButton.click(); await new Promise(resolve => setImmediate(resolve)); assert.equal(list.current, first.next); previousButton.click(); await new Promise(resolve => setImmediate(resolve)); assert.equal(list.current, first);
  });
});
