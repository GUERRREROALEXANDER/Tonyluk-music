import type { SongNode } from "../../core/song.js";
import { h, icon, formatTime } from "../dom.js";
import { ACTIONS, store } from "../store.js";
import { toast } from "../toast.js";
import { openOpsSheet } from "./opsSheet.js";
import { moveTarget } from "../../core/library.js";

export function songRow(node: SongNode, index: number, onRemove: (node: SongNode) => void, onUpdate: () => void): HTMLElement {
  const app = store!; const song = node.value; const current = app.player.current === node;
  const row = h("article", { class: `song-row ${current ? "is-active" : ""}`, dataset: { songId: song.id, index: String(index) }, tabindex: "0", "aria-label": `${index + 1}. ${song.title} by ${song.artist ?? "Unknown artist"}`, onDblClick: () => { void ACTIONS.playNode(node); }, onKeyDown: (event: KeyboardEvent) => { if (event.key === "Enter") void ACTIONS.playNode(node); } });
  const rowIndex = (): number => Number(row.dataset.index ?? index);
  const play = h("button", { type: "button", class: "row-play icon-button", "aria-label": `Remove ${song.title}`, onClick: () => onRemove(node) }, icon("trash", 18));
  const heart = h("button", { type: "button", class: "icon-button row-heart", "aria-label": `Favorite ${song.title}`, onClick: () => { const added = ACTIONS.toggleFavorite(song); heart.replaceChildren(icon(added ? "heart-filled" : "heart", 19)); heart.setAttribute("aria-pressed", String(added)); } }, icon(app.data.isFavorite(song.id) ? "heart-filled" : "heart", 19)); heart.setAttribute("aria-pressed", String(app.data.isFavorite(song.id)));
  const menu = h("details", { class: "row-menu" }); const summary = h("summary", { "aria-label": `More options for ${song.title}` }, icon("more", 20)); const actions = h("div", { class: "row-menu-popover" });
  const action = (label: string, run: () => void): void => { actions.append(h("button", { type: "button", onClick: () => { menu.open = false; run(); } }, label)); };
  action("Play", () => { void ACTIONS.playNode(node); }); action("Play next", () => { const list = app.library.getActiveList(); const i = app.player.current && list ? list.indexOf(app.player.current) : -1; ACTIONS.insertAt(Math.max(0, i + 1), song); toast({ message: `Queued “${song.title}” next` }); });
  action("Move up", () => { const at = rowIndex(); if (at > 0) { ACTIONS.moveSong(at, at - 1); onUpdate(); } }); action("Move down", () => { const at = rowIndex(), list = app.library.getActiveList(); if (list && at < list.size - 1) { ACTIONS.moveSong(at, at + 1); onUpdate(); } });
  action("Insert above", () => openOpsSheet("insert", rowIndex())); action("Insert below", () => openOpsSheet("insert", rowIndex() + 1)); action("Remove", () => onRemove(node)); menu.append(summary, actions);
  const grip = h("button", { type: "button", class: "row-grip icon-button", "aria-label": `Reorder ${song.title}`, onPointerDown: (event: PointerEvent) => { event.preventDefault(); const finish = (up: PointerEvent): void => { document.removeEventListener("pointerup", finish); const siblings = Array.from(row.parentElement?.querySelectorAll<HTMLElement>(".song-row") ?? []); const from = siblings.indexOf(row); const to = siblings.findIndex(candidate => up.clientY < candidate.getBoundingClientRect().top + candidate.getBoundingClientRect().height / 2); const target = moveTarget(from, to < 0 ? siblings.length : to); if (target !== null) { ACTIONS.moveSong(from, target); onUpdate(); } }; document.addEventListener("pointerup", finish, { once: true }); } }, icon("grip", 18));
  row.append(grip, h("span", { class: "row-position tabular-nums" }, String(index + 1).padStart(2, "0")), play, h("img", { class: "row-cover", src: song.artworkUrl || "assets/brand/app-icon.png", alt: "", width: 44, height: 44, loading: "lazy", decoding: "async" }), h("span", { class: "row-title" }, h("strong", {}, song.title), h("small", {}, song.artist ?? "Unknown artist")), h("span", { class: "row-album" }, song.album ?? ""), h("span", { class: "source-badge" }, song.source === "itunes" ? "Preview 30s" : song.source === "youtube" ? "YouTube" : song.source === "spotify" ? "Spotify" : song.source === "local" ? "Local" : "CC"), heart, h("span", { class: "row-duration tabular-nums" }, formatTime(song.duration ?? 0)), menu);
  return row;
}
