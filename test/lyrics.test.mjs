import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseLrc, activeLineIndex } from "../dist/services/lyrics.js";

describe("lyrics", () => {
  it("parses multiple timestamps, ignores metadata, sorts, and preserves blank lyric lines", () => {
    const lines = parseLrc("[ar:Artist]\n[00:03.20]Third\n[00:01.00][00:02.50]First\n[00:04.00]");
    assert.deepEqual(lines, [
      { time: 1, text: "First" }, { time: 2.5, text: "First" },
      { time: 3.2, text: "Third" }, { time: 4, text: "♪" },
    ]);
  });
  it("finds the active line at boundary times", () => {
    const lines = [{ time: 2, text: "a" }, { time: 5, text: "b" }];
    assert.equal(activeLineIndex(lines, 1.99), -1);
    assert.equal(activeLineIndex(lines, 2), 0);
    assert.equal(activeLineIndex(lines, 8), 1);
    assert.equal(activeLineIndex([], 1), -1);
  });
});
