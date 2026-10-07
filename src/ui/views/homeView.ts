import { formatTime, h, icon } from "../dom.js";
import { ACTIONS, on, store } from "../store.js";
import { navigate } from "../router.js";
import { searchItunes, songFromItunes } from "../../services/itunes.js";
import { observeReveals } from "../motion.js";
import { playlistTile } from "../components/playlistTile.js";

const moods = ["Golden Hour", "Lo-fi Focus", "Latin Hits", "Acoustic Mornings", "Rock Classics", "Jazz Evenings"];
export function mountHomeView(root: HTMLElement): void {
  const app = store!; const hour = new Date().getHours(); const day = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const page = h("section", { class: "home-page" }, h("header", { class: "home-greeting", "data-reveal": "" }, h("span", { class: "eyebrow mono-label" }, "GOLDEN HOUR"), h("h1", {}, `Good ${day}, ${app.user.name.split(/\s+/)[0]}`), h("p", {}, "Music that walks beside you.")));
  const recent = app.data.getRecent(); const favorites = app.data.getFavorites();
  if (!recent.length || !favorites.length) page.append(h("aside", { class: "welcome-panel", "data-reveal": "" }, icon("paw", 24), h("div", {}, h("strong", {}, "Your next favorite is waiting."), h("p", {}, "Search the catalog and start building your listening story.")), h("button", { class: "gold-button", type: "button", onClick: () => navigate("search") }, "Find music")));
  page.append(sectionTitle("Continue listening", "recent", "See all"));
  const rail = h("div", { class: "recent-rail", dataset: { stagger: "" } });
  if (recent.length) recent.slice(0, 6).forEach(song => {
    let node = app.library.getActiveList()?.head ?? null; while (node && node.value.id !== song.id) node = node.next;
    const card = h("button", { type: "button", class: "recent-card", "data-reveal": "", onClick: () => { if (node) void ACTIONS.playNode(node); else { const added = ACTIONS.addLast(song); void ACTIONS.playNode(added); } } }, h("span", { class: "recent-art" }, h("img", { src: song.artworkUrl || "assets/brand/app-icon.png", alt: "", width: 160, height: 160, loading: "lazy", decoding: "async" }), h("i", {}, icon("play", 20))), h("strong", {}, song.title), h("small", {}, song.artist ?? "Unknown artist")); rail.append(card);
  }); else rail.append(emptyPanel("No recent songs yet. Pick something from Search and it will appear here.")); page.append(rail);
  page.append(sectionTitle("Your playlists", "library", "See all")); const grid = h("div", { class: "playlist-grid home-playlists", dataset: { stagger: "" } });
  for (const name of app.library.getNames()) { const list = app.library.getPlaylist(name)!; grid.append(playlistTile(name, list, () => { ACTIONS.openPlaylist(name); navigate(`playlist/${encodeURIComponent(name)}`); }, "home-playlist-tile")); }
  page.append(grid);
  page.append(sectionTitle("Favorites", "favorites", "See all")); const favRows = h("div", { class: "home-favorites", dataset: { stagger: "" } });
  favorites.slice(0, 6).forEach(song => { const row = h("button", { type: "button", class: "home-favorite", "data-reveal": "", onClick: () => playSong(song) }, h("img", { src: song.artworkUrl || "assets/brand/app-icon.png", alt: "", width: 48, height: 48, loading: "lazy", decoding: "async" }), h("span", {}, h("strong", {}, song.title), h("small", {}, song.artist ?? "Unknown artist")), icon("play", 18)); favRows.append(row); });
  if (!favorites.length) favRows.append(emptyPanel("Your favorites will be gathered here. Save a song with the heart button.")); page.append(favRows);
  page.append(sectionTitle("Discover", "search", "Explore all")); const discover = h("div", { class: "mood-grid", dataset: { stagger: "" } });
  moods.forEach(term => { const card = h("button", { type: "button", class: "mood-card", "data-reveal": "", onClick: () => navigate(`search?q=${encodeURIComponent(term)}`) }, h("span", { class: "mood-mosaic" }, ...Array.from({ length: 4 }, () => h("span", { class: "mood-placeholder" }, icon("paw", 14)))), h("strong", {}, term)); discover.append(card); if ("IntersectionObserver" in window) { const io = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { void searchItunes(term, "all").then(items => { const mosaic = card.querySelector(".mood-mosaic"); if (mosaic) mosaic.replaceChildren(...items.slice(0, 4).map(item => h("img", { src: item.artworkUrl, alt: "", width: 66, height: 66, loading: "lazy", decoding: "async" }))); }); io.disconnect(); } }, { rootMargin: "120px" }); io.observe(card); } });
  page.append(discover); root.replaceChildren(page); observeReveals(page);
  function playSong(song: (typeof recent)[number]): void { let item = app.library.getActiveList()?.head ?? null; while (item && item.value.id !== song.id) item = item.next; const playing = item ?? ACTIONS.addLast(song); void ACTIONS.playNode(playing); }
  // Re-render once per frame after data changes; subscriptions are dropped first so the emit loop never re-enters.
  const refresh = (): void => { stop(); if (!root.isConnected || !location.hash.startsWith("#/home") || root.firstElementChild !== page) return; requestAnimationFrame(() => { if (root.firstElementChild === page) mountHomeView(root); }); }; const unsubscribers = (["library", "recent", "favorites"] as const).map(topic => on(topic, refresh)); const stop = (): void => unsubscribers.forEach(off => off());;
}
function sectionTitle(title: string, route: string, link: string): HTMLElement { return h("header", { class: "home-section-heading", "data-reveal": "" }, h("h2", {}, title), h("button", { type: "button", onClick: () => navigate(route) }, link)); }
function emptyPanel(message: string): HTMLElement { return h("div", { class: "home-empty" }, icon("paw", 18), h("p", {}, message)); }
