import type { DoublyLinkedList } from "../core/doublylinked.js";
import type { Player } from "../core/player.js";
import type { Song, SongNode } from "../core/song.js";
import { prevAction } from "../core/player.js";
import { AudioEngine, mapYtError, shouldSkipOnError, SpotifyEngine, YouTubeEngine } from "./engines.js";
import type { EngineEvent, EngineKind, PlaybackEngine } from "./engines.js";

export type PlaybackState = "playing" | "paused" | "buffering" | "loading";
type ControllerEvents = {
  time: (time: number, duration: number) => void;
  state: (state: PlaybackState) => void;
  track: (node: SongNode) => void;
  error: (message: string) => void;
  ended: () => void;
};
export interface EngineFactory {
  audio(element: HTMLAudioElement): PlaybackEngine;
  youtube(hostElementId: string): PlaybackEngine;
  spotify(hostElement: HTMLElement): PlaybackEngine;
}

export class PlaybackController {
  private readonly audioEngine: PlaybackEngine;
  private youtubeEngine: PlaybackEngine | null = null;
  private spotifyEngine: PlaybackEngine | null = null;
  private activeEngine: PlaybackEngine;
  private readonly listeners: { [K in keyof ControllerEvents]: Set<ControllerEvents[K]> } = {
    time: new Set(), state: new Set(), track: new Set(), error: new Set(), ended: new Set(),
  };
  private token = 0;
  private skipUsed = false;
  private volume = 0.8;
  private muted = false;
  private currentList: DoublyLinkedList<Song> | null = null;
  private readonly factory: EngineFactory;

  constructor(
    private readonly player: Player<Song>,
    audioElement: HTMLAudioElement,
    private readonly youtubeHostId = "ytHost",
    private readonly spotifyHost?: HTMLElement,
    factory?: Partial<EngineFactory>,
  ) {
    this.factory = {
      audio: (element) => new AudioEngine(element),
      youtube: (hostId) => new YouTubeEngine(hostId),
      spotify: (host) => new SpotifyEngine(host),
      ...factory,
    };
    this.audioEngine = this.factory.audio(audioElement);
    this.activeEngine = this.audioEngine;
    this.subscribe(this.audioEngine);
  }

  on<K extends keyof ControllerEvents>(event: K, callback: ControllerEvents[K]): void { this.listeners[event].add(callback); }
  off<K extends keyof ControllerEvents>(event: K, callback: ControllerEvents[K]): void { this.listeners[event].delete(callback); }

  async playNode(node: SongNode, list: DoublyLinkedList<Song>): Promise<void> {
    this.skipUsed = false;
    await this.playNodeInternal(node, list);
  }

  private async playNodeInternal(node: SongNode, list: DoublyLinkedList<Song>): Promise<void> {
    this.player.play(node, list); this.currentList = list;
    const song = node.value;
    let engine: PlaybackEngine;
    try { engine = this.engineFor(song); }
    catch (error) { this.emit("error", error instanceof Error ? error.message : "Playback failed"); this.emit("state", "paused"); return; }
    const changedEngine = engine !== this.activeEngine;
    const loadToken = ++this.token;
    if (changedEngine) this.activeEngine.pause();
    this.activeEngine = engine;
    if (changedEngine) { engine.setVolume(this.volume); engine.setMuted(this.muted); }
    this.emit("track", node); this.emit("state", "loading");
    try {
      await engine.load(song);
      if (loadToken !== this.token) return;
      await engine.play();
      if (loadToken !== this.token) return;
    } catch (error) {
      if (loadToken !== this.token) return;
      this.handleFailure(error, engine);
    }
  }

  async next(): Promise<SongNode | null> {
    this.skipUsed = false;
    return this.advance();
  }
  async prev(): Promise<SongNode | null> {
    this.skipUsed = false;
    if (prevAction(this.currentTime) === "restart") { this.seek(0); await this.activeEngine.play(); return this.player.current; }
    const node = this.player.prev();
    if (!node || !this.currentList) { this.emit("state", "paused"); return null; }
    await this.playNode(node, this.currentList); return node;
  }
  async togglePlay(): Promise<void> {
    if (this.activeEngine.paused) await this.activeEngine.play(); else this.activeEngine.pause();
  }
  seek(seconds: number): void { this.activeEngine.seek(seconds); }
  /** Volume and mute are remembered so every engine gets them when it becomes active. */
  setVolume(value: number): void { this.volume = Math.max(0, Math.min(1, value)); this.activeEngine.setVolume(this.volume); }
  setMuted(muted: boolean): void { this.muted = muted; this.activeEngine.setMuted(muted); }
  get currentTime(): number { return this.activeEngine.currentTime; }
  get duration(): number { return this.activeEngine.duration; }
  get paused(): boolean { return this.activeEngine.paused; }
  get activeKind(): EngineKind { return this.activeEngine.kind; }
  get supportsVolume(): boolean { return this.activeEngine.supportsVolume; }

  destroy(): void {
    this.token++;
    this.audioEngine.destroy(); this.youtubeEngine?.destroy(); this.spotifyEngine?.destroy();
    for (const set of Object.values(this.listeners)) set.clear();
  }

  private engineFor(song: Song): PlaybackEngine {
    if (song.source === "youtube") {
      if (!this.youtubeEngine) { this.youtubeEngine = this.factory.youtube(this.youtubeHostId); this.subscribe(this.youtubeEngine); }
      return this.youtubeEngine;
    }
    if (song.source === "spotify") {
      if (!this.spotifyHost) throw new Error("Spotify host element is required");
      if (!this.spotifyEngine) { this.spotifyEngine = this.factory.spotify(this.spotifyHost); this.subscribe(this.spotifyEngine); }
      return this.spotifyEngine;
    }
    return this.audioEngine;
  }

  private subscribe(engine: PlaybackEngine): void {
    const on = (event: EngineEvent, callback: (data?: unknown) => void): void => {
      engine.on(event, (data) => { if (engine === this.activeEngine) callback(data); });
    };
    on("time", (time) => this.emit("time", typeof time === "number" ? time : engine.currentTime, engine.duration));
    on("state", (state) => {
      if (state === "playing" || state === "paused" || state === "buffering" || state === "loading") this.emit("state", state);
    });
    on("error", (error) => this.handleFailure(error, engine));
    on("ended", () => { this.emit("ended"); void this.handleEnded(); });
  }

  private async handleEnded(): Promise<void> {
    if (this.player.repeat === "one") {
      this.seek(0); await this.activeEngine.play(); return;
    }
    this.skipUsed = false;
    const node = await this.advance();
    if (!node) this.emit("state", "paused");
  }

  private async advance(): Promise<SongNode | null> {
    const node = this.player.next();
    if (!node || !this.currentList) { this.emit("state", "paused"); return null; }
    await this.playNodeInternal(node, this.currentList);
    return node;
  }

  private handleFailure(error: unknown, engine: PlaybackEngine): void {
    if (engine !== this.activeEngine) return;
    // The browser blocked autoplay: the song is fine, it just needs a user gesture. Stay on it, paused.
    if (error instanceof Error && error.name === "NotAllowedError") { this.emit("state", "paused"); return; }
    const code = typeof error === "number" ? error : undefined;
    const message = engine.kind === "youtube" && code !== undefined ? mapYtError(code) : error instanceof Error ? error.message : "Playback failed";
    this.emit("error", message);
    engine.pause();
    if (this.skipUsed) { this.emit("state", "paused"); return; }
    if (engine.kind === "youtube" && code !== undefined && !shouldSkipOnError(code)) { this.emit("state", "paused"); return; }
    this.skipUsed = true;
    void this.advance();
  }

  private emit<K extends keyof ControllerEvents>(event: K, ...args: Parameters<ControllerEvents[K]>): void {
    for (const callback of this.listeners[event]) (callback as (...values: Parameters<ControllerEvents[K]>) => void)(...args);
  }
}
