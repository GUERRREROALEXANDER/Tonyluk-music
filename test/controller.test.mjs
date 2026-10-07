import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PlaybackController } from "../dist/playback/controller.js";
import { Library } from "../dist/core/library.js";
import { Player } from "../dist/core/player.js";

class FakeEngine {
  constructor(kind = "audio") {
    this.kind = kind; this.supportsVolume = kind !== "spotify"; this.callbacks = new Map();
    this.currentTime = 0; this.duration = 10; this.paused = true; this.loads = []; this.plays = 0;
  }
  load(song) { this.loads.push(song); return Promise.resolve(); }
  async play() { this.plays++; this.paused = false; }
  pause() { this.paused = true; }
  seek(time) { this.currentTime = time; }
  setVolume() {} setMuted() {} setRate() {} destroy() {}
  on(event, callback) { if (!this.callbacks.has(event)) this.callbacks.set(event, []); this.callbacks.get(event).push(callback); }
  fire(event, data) { for (const callback of this.callbacks.get(event) ?? []) callback(data); }
}
function setup(engine = new FakeEngine()) {
  const library = new Library(); const list = library.getActiveList();
  for (const id of ["a", "b", "c"]) list.addLast({ id, title: id, url: id, source: "remote" });
  const player = new Player(list);
  const controller = new PlaybackController(player, {}, "ytHost", {}, { audio: () => engine, youtube: () => new FakeEngine("youtube"), spotify: () => new FakeEngine("spotify") });
  return { list, player, controller, engine };
}

describe("PlaybackController", () => {
  it("moves through linked next and previous pointers", async () => {
    const { list, player, controller } = setup();
    await controller.playNode(list.head, list); await controller.next();
    assert.equal(player.current.value.id, "b");
    await controller.prev(); assert.equal(player.current.value.id, "a");
  });
  it("ignores completion of a stale load", async () => {
    const { list, controller, engine } = setup();
    let resolveFirst;
    engine.load = (song) => song.id === "a" ? new Promise((resolve) => { resolveFirst = resolve; }) : Promise.resolve();
    const first = controller.playNode(list.head, list);
    const second = controller.playNode(list.head.next, list);
    resolveFirst(); await Promise.all([first, second]);
    assert.equal(engine.plays, 1);
  });
  it("advances on ended and repeats the same track in repeat-one", async () => {
    const { list, player, controller, engine } = setup();
    await controller.playNode(list.head, list); engine.fire("ended");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(player.current.value.id, "b");
    player.setRepeat("one"); engine.fire("ended");
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(player.current.value.id, "b"); assert.equal(engine.currentTime, 0);
  });
  it("skips a failed item only once in a consecutive failure chain", async () => {
    const { list, player, controller } = setup();
    const engine = controller["activeEngine"];
    engine.load = async (song) => { if (song.id !== "a") throw new Error("unplayable"); };
    await controller.playNode(list.head, list);
    engine.fire("error", new Error("unplayable"));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(player.current.value.id, "b");
    assert.equal(engine.paused, true);
  });
});
