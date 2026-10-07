import { autoReveal } from "./ui/motion.js";
import { AuthService } from "./services/auth.js";
import type { AuthUser } from "./services/auth.js";
import { searchItunes, songFromItunes } from "./services/itunes.js";
import { createStore, ACTIONS } from "./ui/store.js";
import { h } from "./ui/dom.js";
import { mountAuth } from "./ui/auth/authView.js";
import { mountAppShell } from "./ui/shell/appShell.js";
import { rehydrateLocalSongs } from "./services/userData.js";
import { toast } from "./ui/toast.js";

const authRoot = document.getElementById("auth-root"); const appRoot = document.getElementById("app-root"); const auth = new AuthService();
let activeStore: ReturnType<typeof createStore> | null = null;
if (!authRoot || !appRoot) throw new Error("App mount points are missing");

function mountApp(user: AuthUser): void {
  authRoot!.hidden = true; authRoot!.replaceChildren(); appRoot!.hidden = false; activeStore = createStore(user);
  void rehydrateLocalSongs(activeStore.library); mountAppShell(appRoot!, logout); preloadYouTube();
}
function logout(): void { auth.logout(); if (activeStore) { activeStore.data.flushLibrary(); activeStore.controller.destroy(); activeStore = null; } appRoot!.hidden = true; appRoot!.replaceChildren(); mountAuth(authRoot!, auth, mountApp); }
function preloadYouTube(): void { const load = (): void => { const script = document.createElement("script"); script.src = "https://www.youtube.com/iframe_api"; script.async = true; document.head.append(script); }; const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback; if (idle) idle(load, { timeout: 2500 }); else window.setTimeout(load, 1200); }

async function demoUser(): Promise<AuthUser> { try { return await auth.register("Demo", "demo@tonyluk.local", "GoldenHour26"); } catch { return auth.login("demo@tonyluk.local", "GoldenHour26"); } }
async function seedDemo(): Promise<void> {
  if (location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  if (new URLSearchParams(location.search).get("demo") !== "1") return;
  try {
    const user = await demoUser(); mountApp(user); if (!activeStore) return;
    const list = activeStore.library.getActiveList(); if (!list || list.size > 0) return;
    const songs = await searchItunes("golden hour", "all");
    for (const result of songs.slice(0, 5)) ACTIONS.addLast(songFromItunes(result));
    activeStore.data.flushLibrary();
  } catch { const message = h("span", {}, "Demo setup could not load music. Please reload to try again."); document.getElementById("toast-root")?.append(message); }
}

const existingUser = auth.currentUser();
if (existingUser) mountApp(existingUser); else mountAuth(authRoot, auth, mountApp);
if (location.hostname === "localhost" || location.hostname === "127.0.0.1") void seedDemo();
window.addEventListener("tlm:error", event => { const detail = (event as CustomEvent<string>).detail; toast({ message: detail || "Playback failed", tone: "error" }); });

// Every range slider paints its gold fill from its own value (the seek bar also updates it from playback time).
const syncRangeFill = (input: HTMLInputElement): void => { const min = Number(input.min || 0), max = Number(input.max || 100); input.style.setProperty("--fill", `${max > min ? (Number(input.value) - min) / (max - min) * 100 : 0}%`); };
document.addEventListener("input", (event) => { const target = event.target; if (target instanceof HTMLInputElement && target.type === "range") syncRangeFill(target); });
new MutationObserver(() => document.querySelectorAll<HTMLInputElement>('input[type="range"]:not([data-filled])').forEach((input) => { input.dataset.filled = ""; syncRangeFill(input); })).observe(document.body, { childList: true, subtree: true });
autoReveal();
