import type { DoublyLinkedList } from "../../core/doublylinked.js";
import type { Song } from "../../core/song.js";
import { formatTime, h, icon } from "../dom.js";

export function playlistTile(name: string, list: DoublyLinkedList<Song>, onOpen: () => void, className = ""): HTMLElement {
  const images: HTMLElement[] = []; let node = list.head;
  for (let i = 0; i < 4 && node; i++, node = node.next) images.push(h("img", { src: node.value.artworkUrl || "assets/brand/app-icon.png", alt: "", width: 92, height: 92, loading: "lazy", decoding: "async" }));
  while (images.length < 4) images.push(h("span", { class: "mosaic-empty" }, icon("paw", 18)));
  const duration = list.toArray().reduce((sum, song) => sum + (song.duration ?? 0), 0);
  return h("article", { class: `playlist-tile ${className}`, "data-reveal": "" }, h("button", { type: "button", class: "tile-open", onClick: onOpen }, h("span", { class: "tile-mosaic" }, images), h("strong", {}, name), h("small", {}, `${list.size} songs · ${formatTime(duration)}`)));
}
