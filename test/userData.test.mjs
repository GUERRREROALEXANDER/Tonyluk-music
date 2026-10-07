import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { UserData } from "../dist/services/userData.js";
import { Library } from "../dist/core/library.js";
import { Player } from "../dist/core/player.js";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
const song = (id) => ({ id, title: `Song ${id}`, url: `https://${id}`, source: "remote" });

describe("UserData", () => {
  it("round trips playlist order, names, and current index", () => {
    const storage = new MemoryStorage(); const data = new UserData("u1", storage);
    const library = new Library("Road Trip"); const first = library.getActiveList();
    first.addLast(song("a")); first.addLast(song("b")); first.addLast(song("c"));
    library.createPlaylist("Quiet"); library.getActiveList().addLast(song("q")); library.switchTo("Road Trip");
    const player = new Player(first); player.play(first.nodeAt(1), first);
    data.saveLibrary(library, player); data.flushLibrary();
    const loaded = data.loadLibrary();
    assert.deepEqual(loaded.library.getNames(), ["Road Trip", "Quiet"]);
    assert.deepEqual(loaded.library.getPlaylist("Road Trip").toArray().map((value) => value.id), ["a", "b", "c"]);
    assert.equal(loaded.playlistName, "Road Trip"); assert.equal(loaded.currentIndex, 1);
    assert.equal(loaded.library.getActiveList().current.value.id, "b");
  });
  it("toggles favorites, deduplicates and caps recents, and merges preferences", () => {
    const data = new UserData("u2", new MemoryStorage());
    assert.equal(data.toggleFavorite(song("fav")), true); assert.equal(data.isFavorite("fav"), true);
    assert.equal(data.getFavorites()[0].id, "fav"); assert.equal(data.toggleFavorite(song("fav")), false);
    for (let i = 0; i < 35; i++) data.pushRecent(song(String(i)));
    data.pushRecent(song("34"));
    assert.equal(data.getRecent().length, 30); assert.equal(data.getRecent()[0].id, "34");
    assert.deepEqual(data.getPrefs(), { volume: 0.8, muted: false, shuffle: false, repeat: "off", lyricsOpen: false, reducedMotion: "system" });
    assert.deepEqual(data.setPrefs({ volume: 0.3, repeat: "one" }), { volume: 0.3, muted: false, shuffle: false, repeat: "one", lyricsOpen: false, reducedMotion: "system" });
  });
});
