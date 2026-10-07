import type { DoublyLinkedList } from "../../core/doublylinked.js";
import type { Song, SongNode } from "../../core/song.js";
import { h, icon } from "../dom.js";
import { prefersReducedMotion } from "../motion.js";
import { on } from "../store.js";

/**
 * "The Chain": draws the playlist exactly as it is stored — by walking head → next.
 *   null ← [HEAD] ⇄ [ ] ⇄ [TAIL] → null
 * A gold paw marks list.current. Next/Previous only slide the paw; structural
 * changes (insert, delete, move) re-render with FLIP so the relinking is visible.
 */
export function mountChain(list: DoublyLinkedList<Song>, play: (node: SongNode) => void, vertical = false): HTMLElement {
  const track = h("div", { class: "chain-track" });
  const marker = h("span", { class: "chain-marker", "aria-hidden": "true" }, icon("paw", 14), "CURRENT");
  const root = h("div", { class: `chain ${vertical ? "chain-vertical" : ""}`, role: "list", "aria-label": "Playlist as a doubly linked list" }, track);
  const elements = new Map<SongNode, HTMLElement>();

  const nodeElement = (node: SongNode, index: number): HTMLElement => {
    const isHead = node === list.head; const isTail = node === list.tail;
    return h("button", {
      type: "button", class: "chain-node", role: "listitem", title: node.value.title,
      "aria-label": `Song ${index + 1} of ${list.size}: ${node.value.title}`, onClick: () => play(node),
    },
      h("span", { class: "chain-end mono-label" }, isHead && isTail ? "HEAD · TAIL" : isHead ? "HEAD" : isTail ? "TAIL" : ""),
      h("img", { src: node.value.artworkUrl || "assets/brand/app-icon.png", alt: "", width: 56, height: 56, loading: "lazy", decoding: "async" }),
      h("span", { class: "chain-title" }, node.value.title));
  };

  const link = (): HTMLElement => h("span", { class: "chain-link", "aria-hidden": "true" },
    h("span", { class: "chain-arrow is-next" }, h("small", {}, "next"), h("i", {})),
    h("span", { class: "chain-arrow is-prev" }, h("i", {}), h("small", {}, "prev")));

  /** Moves the paw onto list.current (transform only, so it can slide). */
  const placeMarker = (): void => {
    for (const el of elements.values()) el.classList.remove("is-current");
    const el = list.current ? elements.get(list.current) : undefined;
    if (!el) { marker.classList.remove("is-visible"); return; }
    el.classList.add("is-current");
    const x = vertical ? 0 : el.offsetLeft + el.offsetWidth / 2;
    const y = vertical ? el.offsetTop : 0;
    marker.style.transform = vertical ? `translate3d(0, ${y}px, 0)` : `translate3d(${x}px, 0, 0) translateX(-50%)`;
    marker.classList.add("is-visible");
    const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
    if (root.scrollWidth > root.clientWidth || root.scrollHeight > root.clientHeight) {
      root.scrollTo({ left: vertical ? 0 : el.offsetLeft - root.clientWidth / 2 + el.offsetWidth / 2, top: vertical ? el.offsetTop - root.clientHeight / 2 : 0, behavior });
    }
  };

  /** Rebuilds the chain from the pointers and animates what changed. */
  const render = (): void => {
    const before = new Map<SongNode, DOMRect>();
    for (const [node, el] of elements) before.set(node, el.getBoundingClientRect());
    const previous = new Set(elements.keys());
    elements.clear();

    const fragment = document.createDocumentFragment();
    fragment.append(h("span", { class: "chain-null mono-label" }, "null"));
    if (list.head) fragment.append(link());
    let node = list.head; let index = 0;
    while (node !== null) {
      const el = nodeElement(node, index);
      elements.set(node, el); fragment.append(el);
      fragment.append(link());
      node = node.next; index++;
    }
    fragment.append(h("span", { class: "chain-null mono-label" }, "null"), marker);
    track.replaceChildren(fragment);
    placeMarker();

    if (prefersReducedMotion() || previous.size === 0 || typeof track.animate !== "function") return;
    for (const [current, el] of elements) {
      const old = before.get(current);
      if (!old) {
        el.animate([{ transform: "scale(.6)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], { duration: 420, easing: "cubic-bezier(.22,1,.36,1)" });
        for (const neighbour of [current.prev, current.next]) {
          const n = neighbour ? elements.get(neighbour) : undefined;
          n?.classList.add("is-relinked"); setTimeout(() => n?.classList.remove("is-relinked"), 900);
        }
        continue;
      }
      const now = el.getBoundingClientRect();
      const dx = old.left - now.left; const dy = old.top - now.top;
      if (dx !== 0 || dy !== 0) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" });
    }
  };

  render();
  on("library", render);
  on("playback", placeMarker);
  return root;
}
