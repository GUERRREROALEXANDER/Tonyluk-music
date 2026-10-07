import { h, icon, initials } from "../dom.js";
import { navigate, onRoute } from "../router.js";
import { store } from "../store.js";

export function mountTopbar(onSignOut: () => void): HTMLElement {
  const app = store!; const nav = h("nav", { class: "top-nav", "aria-label": "Main navigation" }); const routes = [["Home", "home"], ["Search", "search"], ["Library", "library"], ["Favorites", "favorites"]] as const;
  const buttons = routes.map(([label, path]) => { const button = h("button", { type: "button", class: "nav-pill", onClick: () => navigate(path) }, label); nav.append(button); return button; });
  onRoute(route => buttons.forEach((button, index) => { button.classList.toggle("is-active", routes[index]?.[1] === route || (route === "playlist" && routes[index]?.[1] === "library")); }));
  const search = h("button", { type: "button", class: "search-trigger", "aria-label": "Search music", onClick: () => navigate("search") }, icon("search", 19), h("span", {}, "Search"), h("kbd", {}, "/"));
  const menu = h("details", { class: "avatar-menu" }, h("summary", { class: "profile-initials", "aria-label": "Profile menu" }, initials(app.user.name)), h("div", { class: "avatar-popover" }, h("button", { type: "button", onClick: () => navigate("profile") }, "Profile"), h("button", { type: "button", onClick: () => navigate("recent") }, "Recently played"), h("button", { type: "button", onClick: onSignOut }, "Sign out")));
  const header = h("header", { class: "topbar" }, h("a", { class: "wordmark", href: "#/home", "aria-label": "Tony Luk Music home" }, h("img", { src: "assets/brand/wordmark.png", alt: "Tony Luk Music", width: 205, height: 125 })), nav, h("div", { class: "topbar-actions" }, search, menu));
  document.addEventListener("keydown", event => { if (event.key === "/" && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) { event.preventDefault(); navigate("search"); setTimeout(() => document.querySelector<HTMLInputElement>(".search-page input")?.focus(), 0); } }); return header;
}
