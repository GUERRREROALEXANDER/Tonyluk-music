import { AuthService } from "../../services/auth.js";
import { h, initials, icon } from "../dom.js";
import { applyMotionPref } from "../motion.js";
import { on, store } from "../store.js";

export function mountProfileView(root: HTMLElement, onSignOut: () => void): void {
  const app = store!; const prefs = app.data.getPrefs(); const songs = app.library.getNames().reduce((sum, name) => sum + (app.library.getPlaylist(name)?.size ?? 0), 0);
  const page = h("section", { class: "profile-page" }, h("header", { class: "view-heading" }, h("div", {}, h("span", { class: "eyebrow mono-label" }, "YOUR ACCOUNT"), h("h1", {}, "Profile"))));
  const identity = h("section", { class: "profile-card profile-identity" }, h("span", { class: "profile-avatar-large" }, initials(app.user.name)), h("div", {}, h("h2", {}, app.user.name), h("p", {}, app.user.email), h("small", {}, `Member since ${new Date(app.user.createdAt).toLocaleDateString("en", { month: "long", year: "numeric" })}`)));
  const nameInput = h("input", { type: "text", value: app.user.name, maxlength: 40, "aria-label": "Your name" }); const save = h("button", { type: "submit", class: "gold-button" }, "Save name"); const feedback = h("p", { class: "profile-feedback", role: "status" });
  const form = h("form", { class: "profile-card profile-form", onSubmit: (event: Event) => { event.preventDefault(); try { const updated = new AuthService().updateProfile({ name: nameInput.value }); app.user = updated; identity.querySelector("h2")!.textContent = updated.name; identity.querySelector(".profile-avatar-large")!.textContent = initials(updated.name); const topAvatar = document.querySelector(".profile-initials"); if (topAvatar) topAvatar.textContent = initials(updated.name); feedback.textContent = "Your profile is up to date."; } catch (error) { feedback.textContent = error instanceof Error ? error.message : "Could not update your profile."; } } }, h("h2", {}, "Personal details"), h("label", {}, "Name", nameInput), h("label", {}, "Email", h("input", { type: "email", value: app.user.email, readonly: true, "aria-label": "Email address" })), feedback, save);
  const favoriteCount = app.data.getFavorites().length;
  const stats = h("section", { class: "profile-stats" }, stat("Playlists", app.library.getNames().length), stat("Songs", songs), stat("Favorites", favoriteCount), stat("Plays recorded", app.data.getPlaysCount()));
  const motion = h("select", { "aria-label": "Motion preference", value: prefs.reducedMotion }, h("option", { value: "system" }, "System"), h("option", { value: "on" }, "Reduced"), h("option", { value: "off" }, "Full"));
  motion.addEventListener("change", () => { const value = motion.value as "system" | "on" | "off"; app.data.setPrefs({ reducedMotion: value }); applyMotionPref(value); });
  const lyrics = h("input", { type: "checkbox", checked: prefs.lyricsOpen, "aria-label": "Keep lyrics panel open" }); lyrics.addEventListener("change", () => app.data.setPrefs({ lyricsOpen: lyrics.checked }));
  const preferences = h("section", { class: "profile-card profile-preferences" }, h("h2", {}, "Preferences"), h("label", {}, "Motion", motion), h("label", { class: "profile-toggle" }, h("span", {}, "Keep lyrics panel open"), lyrics));
  const danger = h("section", { class: "profile-card profile-danger" }, h("h2", {}, "Sign out"), h("p", {}, "Your account and music are stored locally in this browser."), h("button", { type: "button", class: "danger-button", onClick: onSignOut }, icon("logout", 18), " Sign out"));
  page.append(identity, stats, form, preferences, danger); root.replaceChildren(page);
}
function stat(label: string, value: number): HTMLElement { return h("article", { class: "stat-card" }, h("strong", {}, String(value)), h("span", {}, label)); }
