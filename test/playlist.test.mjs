import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DoublyLinkedList, ListNode } from "../dist/core/doublylinked.js";

function values(list) {
  return [...list.traverseForward()].map((node) => node.value);
}

function assertLinks(list) {
  assert.equal(list.head?.prev ?? null, null);
  assert.equal(list.tail?.next ?? null, null);
  for (const node of list.traverseForward()) {
    if (node.next !== null) assert.equal(node.next.prev, node);
  }
}

describe("playlist linked-list behavior", () => {
  it("handles an empty list and safe boundary operations", () => {
    const list = new DoublyLinkedList();
    assert.equal(list.isEmpty(), true);
    assert.equal(list.length, 0);
    assert.equal(list.getCurrent(), null);
    assert.equal(list.moveNext(), null);
    assert.equal(list.movePrev(), null);
    assert.throws(() => list.removeAt(0), RangeError);
  });

  it("supports a one-node list and clears pointers on delete", () => {
    const list = new DoublyLinkedList();
    const only = list.addLast("only");
    list.setCurrent(only);
    assert.equal(list.moveNext(), null);
    assert.equal(list.current, only);
    assert.equal(list.movePrev(), null);
    assert.equal(list.moveNext(true), only);
    assert.equal(list.movePrev(true), only);
    assert.equal(list.delete(only), "only");
    assert.equal(list.head, null);
    assert.equal(list.tail, null);
    assert.equal(list.current, null);
    assert.equal(list.length, 0);
  });

  it("adds at both ends and inserts at start, middle, and end", () => {
    const list = new DoublyLinkedList();
    list.addFirst(2);
    list.addLast(4);
    list.insertAt(0, 1);
    list.insertAt(2, 3);
    list.insertAt(list.size, 5);
    assert.deepEqual(values(list), [1, 2, 3, 4, 5]);
    assertLinks(list);
  });

  it("rejects invalid insert positions", () => {
    const list = new DoublyLinkedList();
    list.addLast(10);
    assert.throws(() => list.insertAt(-1, 0), RangeError);
    assert.throws(() => list.insertAt(list.size + 1, 20), RangeError);
  });

  it("keeps links consistent when deleting the head, tail, and middle", () => {
    const list = new DoublyLinkedList();
    const head = list.addLast(1);
    const middle = list.addLast(2);
    const tail = list.addLast(3);
    assert.equal(list.delete(head), 1);
    assertLinks(list);
    assert.equal(list.delete(tail), 3);
    assertLinks(list);
    assert.equal(list.delete(middle), 2);
    assertLinks(list);
    assert.equal(list.isEmpty(), true);
  });

  it("repairs current to next, then previous, when its node is deleted", () => {
    const list = new DoublyLinkedList();
    const first = list.addLast(1);
    const current = list.addLast(2);
    const last = list.addLast(3);
    list.setCurrent(current);
    list.delete(current);
    assert.equal(list.current, last);
    list.delete(last);
    list.setCurrent(first);
    list.delete(first);
    assert.equal(list.current, null);
  });

  it("traverses in both directions and exposes length", () => {
    const list = new DoublyLinkedList();
    list.addLast("A"); list.addLast("B"); list.addLast("C");
    assert.equal(list.length, 3);
    assert.deepEqual([...list.traverseForward()].map((node) => node.value), ["A", "B", "C"]);
    assert.deepEqual([...list.traverseBackward()].map((node) => node.value), ["C", "B", "A"]);
  });

  it("moves current with and without wrapping", () => {
    const list = new DoublyLinkedList();
    const first = list.addLast(1);
    const last = list.addLast(2);
    assert.equal(list.moveNext(), first);
    assert.equal(list.moveNext(), last);
    assert.equal(list.moveNext(), null);
    assert.equal(list.current, last);
    assert.equal(list.moveNext(true), first);
    assert.equal(list.movePrev(), null);
    assert.equal(list.current, first);
    assert.equal(list.movePrev(true), last);
  });

  it("rejects a current node owned by another list", () => {
    const list = new DoublyLinkedList();
    const foreign = new ListNode(7);
    assert.throws(() => list.setCurrent(foreign), Error);
  });
});

describe("current pointer during split and concat", () => {
  it("moves current to the split list when its node crosses the cut", () => {
    const list = new DoublyLinkedList();
    list.addLast("A"); list.addLast("B");
    const movedCurrent = list.addLast("C");
    list.setCurrent(movedCurrent);
    const right = list.splitAt(2);
    assert.equal(list.current, null);
    assert.equal(right.current, movedCurrent);
    assert.deepEqual(list.toArray(), ["A", "B"]);
    assert.deepEqual(right.toArray(), ["C"]);
  });

  it("transfers current from the concatenated list and empties its current pointer", () => {
    const left = new DoublyLinkedList();
    left.addLast("A");
    const right = new DoublyLinkedList();
    const playing = right.addLast("B");
    right.setCurrent(playing);
    left.concat(right);
    assert.equal(left.current, playing);
    assert.equal(right.current, null);
    assert.deepEqual(left.toArray(), ["A", "B"]);
  });
});
