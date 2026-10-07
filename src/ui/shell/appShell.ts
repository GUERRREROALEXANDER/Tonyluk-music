import { h } from "../dom.js";
import { onRoute, navigate } from "../router.js";
import { mountPlaylistView } from "../views/playlistView.js";
import { mountLibraryView } from "../views/libraryView.js";
import { mountHomeView } from "../views/homeView.js";
import { mountSearchView } from "../views/searchView.js";
import { mountSongListView } from "../views/songListView.js";
import { mountProfileView } from "../views/profileView.js";
import { mountTopbar } from "./topbar.js";
import { mountPlayerDock } from "./playerDock.js";
import { mountNowPlaying } from "./nowPlaying.js";
import { store, ACTIONS } from "../store.js";
import { applyMotionPref } from "../motion.js";

export function mountAppShell(root: HTMLElement, onSignOut: () => void): void {
  applyMotionPref(store!.data.getPrefs().reducedMotion);
  const outlet = h("main", { class: "app-outlet", id: "route-outlet", tabindex: "-1" });
  const mobile = h("nav", { class: "mobile-tabs", "aria-label": "Main navigation" });
  const mobileRoutes: Array<[string, string]> = [["Home", "home"], ["Search", "search"], ["Library", "library"], ["Favorites", "favorites"]];
  for (const [label, route] of mobileRoutes) mobile.append(h("button", { type: "button", onClick: () => navigate(route) }, label));
  let open = store!.data.getPrefs().lyricsOpen; let shell: HTMLElement;
  const toggleNowPlaying = (): void => { open = !open; shell.classList.toggle("now-open", open); store!.data.setPrefs({ lyricsOpen: open }); };
  shell = h("div", { class: `app-shell ${open ? "now-open" : ""}` }, mountTopbar(onSignOut), outlet, mountNowPlaying(toggleNowPlaying), mountPlayerDock(toggleNowPlaying), mobile); root.replaceChildren(shell);
  onRoute((route, parameter) => {
    store!.view = route;
    if (route === "playlist" && parameter) { if (store!.library.getNames().includes(parameter) && store!.library.getActiveName() !== parameter) ACTIONS.openPlaylist(parameter); mountPlaylistView(outlet); }
    else if (route === "library") mountLibraryView(outlet);
    else if (route === "search") mountSearchView(outlet);
    else if (route === "favorites" || route === "recent") mountSongListView(outlet, route);
    else if (route === "profile") mountProfileView(outlet, onSignOut);
    else mountHomeView(outlet);
  });
}
