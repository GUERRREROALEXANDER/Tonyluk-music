import { h, icon } from "../dom.js";
import { ACTIONS, on, store } from "../store.js";
import { toast } from "../toast.js";
import { navigate } from "../router.js";
import { playlistTile } from "../components/playlistTile.js";

export function mountLibraryView(root: HTMLElement): void {
  const page = h("section", { class: "library-page" }, h("header", { class: "view-heading" }, h("div", {}, h("span", { class: "eyebrow mono-label" }, "YOUR MUSIC"), h("h1", {}, "Your library")), h("button", { type: "button", class: "gold-button", onClick: createForm }, icon("plus", 18), " New playlist")));
  const grid = h("div", { class: "playlist-grid", dataset: { stagger: "" } }); page.append(grid); root.replaceChildren(page);
  function createForm(): void { if (page.querySelector(".new-playlist-form")) return; const input = h("input", { type: "text", maxlength: 40, placeholder: "Playlist name", "aria-label": "Playlist name" }); const form = h("form", { class: "new-playlist-form", onSubmit: (event: Event) => { event.preventDefault(); try { ACTIONS.createPlaylist(input.value); render(); toast({ message: `Created “${input.value.trim()}”` }); } catch (error) { toast({ message: error instanceof Error ? error.message : "Could not create playlist", tone: "error" }); } } }, input, h("button", { type: "submit", class: "gold-button" }, "Create")); page.insertBefore(form, grid); input.focus(); }
  function render(): void { const fragment = document.createDocumentFragment(); for (const name of store!.library.getNames()) { const list = store!.library.getPlaylist(name)!; const tile = playlistTile(name, list, () => { ACTIONS.openPlaylist(name); navigate(`playlist/${encodeURIComponent(name)}`); }); tile.append(h("details", { class: "tile-menu" }, h("summary", { "aria-label": `Options for ${name}` }, icon("more", 19)), h("div", { class: "avatar-popover" }, h("button", { type: "button", onClick: () => { const next = prompt("Playlist name", name); if (next) try { ACTIONS.renamePlaylist(name, next); render(); } catch (e) { toast({ message: e instanceof Error ? e.message : "Rename failed", tone: "error" }); } } }, "Rename"), h("button", { type: "button", onClick: () => { if (store!.library.getNames().length <= 1) { toast({ message: "Your library needs at least one playlist.", tone: "error" }); return; } if (confirm(`Delete “${name}”?`)) { ACTIONS.deletePlaylist(name); render(); } } }, "Delete")))); fragment.append(tile); } grid.replaceChildren(fragment); }
  render(); on("library", render);
}
