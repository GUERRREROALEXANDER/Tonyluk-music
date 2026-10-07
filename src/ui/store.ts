import { Library } from "../core/library.js";
import { DoublyLinkedList } from "../core/doublylinked.js";
import { Player } from "../core/player.js";
import type { RepeatMode } from "../core/player.js";
import type { Song, SongNode } from "../core/song.js";
import { PlaybackController } from "../playback/controller.js";
import type { PlaybackState } from "../playback/controller.js";
import type { AuthUser } from "../services/auth.js";
import { UserData } from "../services/userData.js";
export type Topic="library"|"playback"|"time"|"favorites"|"recent"|"prefs"|"user"|"view";
export interface DeleteInfo{song:Song;index:number;playlist:string;wasCurrent:boolean}
export interface AppStore{user:AuthUser;library:Library;player:Player<Song>;controller:PlaybackController;data:UserData;view:string;playbackState:PlaybackState}
type Callback=()=>void;const listeners=new Map<Topic,Set<Callback>>();
export function on(topic:Topic,cb:Callback):()=>void{let set=listeners.get(topic);if(!set){set=new Set();listeners.set(topic,set)}set.add(cb);return()=>set?.delete(cb)}
export function emit(topic:Topic):void{listeners.get(topic)?.forEach(cb=>cb())}
export let store:AppStore|null=null;
export function createStore(user:AuthUser):AppStore{const data=new UserData(user.id);const saved=data.loadLibrary();const library=saved?.library??new Library("My Playlist");if(!saved&&library.getNames().length===0)library.createPlaylist("My Playlist");const player=new Player<Song>(library.getActiveList());const prefs=data.getPrefs();player.shuffle=prefs.shuffle;player.repeat=prefs.repeat;const audio=document.getElementById("audio");if(!(audio instanceof HTMLAudioElement))throw new Error("Audio element is missing");const spotify=document.getElementById("spotifyHost");const controller=new PlaybackController(player,audio,"ytHost",spotify??undefined);controller.setVolume(prefs.volume);controller.setMuted(prefs.muted);if(saved&&saved.currentIndex>=0){const current=player.playlist?.nodeAt(saved.currentIndex)??null;player.current=current}
 const app:AppStore={user,library,player,controller,data,view:"home",playbackState:"paused"};controller.on("state",state=>{app.playbackState=state;emit("playback")});controller.on("track",node=>{player.play(node,player.playlist);data.pushRecent(node.value);data.saveLibrary(library,player);emit("playback");emit("recent")});controller.on("time",()=>emit("time"));controller.on("error",message=>{window.dispatchEvent(new CustomEvent("tlm:error",{detail:message}))});store=app;return app}
function active(s:AppStore):DoublyLinkedList<Song>{return s.library.getActiveList()??new DoublyLinkedList<Song>()}
function persist(s:AppStore,topic:Topic="library"):void{s.player.setPlayingList(active(s));s.data.saveLibrary(s.library,s.player);emit(topic)}
export const ACTIONS={
 addFirst(song:Song,s=store!):SongNode{const n=active(s).addFirst(song);s.player.notifyInsert(n);persist(s);return n},
 addLast(song:Song,s=store!):SongNode{const n=active(s).addLast(song);s.player.notifyInsert(n);persist(s);return n},
 insertAt(index:number,song:Song,s=store!):SongNode{const n=active(s).insertAt(index,song);s.player.notifyInsert(n);persist(s);return n},
 deleteNode(node:SongNode,s=store!):DeleteInfo{const list=active(s),index=list.indexOf(node);if(index<0)throw new Error("Song is not in the active playlist");const info={song:node.value,index,playlist:s.library.getActiveName()??"My Playlist",wasCurrent:s.player.current===node};s.player.handleRemoval(node);s.player.notifyRemove(node);list.delete(node);persist(s);return info},
 undoDelete(info:DeleteInfo,s=store!):SongNode{if(s.library.getActiveName()!==info.playlist)s.library.switchTo(info.playlist);const node=active(s).insertAt(Math.min(info.index,active(s).size),info.song);s.player.notifyInsert(node);if(info.wasCurrent)s.player.play(node,active(s));persist(s);return node},
 moveSong(from:number,to:number,s=store!):void{active(s).move(from,to);persist(s)},
 async playNode(node:SongNode,s=store!):Promise<void>{await s.controller.playNode(node,active(s));persist(s,"playback")},
 async next(s=store!):Promise<void>{await s.controller.next();emit("playback")},async prev(s=store!):Promise<void>{await s.controller.prev();emit("playback")},
 async togglePlay(s=store!):Promise<void>{await s.controller.togglePlay()},toggleShuffle(s=store!):void{s.player.toggleShuffle();s.data.setPrefs({shuffle:s.player.shuffle});emit("prefs")},cycleRepeat(s=store!):RepeatMode{const mode=s.player.cycleRepeat();s.data.setPrefs({repeat:mode});emit("prefs");return mode},
 setVolume(v:number,s=store!):void{s.controller.setVolume(v);s.data.setPrefs({volume:v});emit("prefs")},toggleMute(s=store!):void{const prefs=s.data.getPrefs();s.controller.setMuted(!prefs.muted);s.data.setPrefs({muted:!prefs.muted});emit("prefs")},seek(seconds:number,s=store!):void{s.controller.seek(seconds)},
 toggleFavorite(song:Song,s=store!):boolean{const result=s.data.toggleFavorite(song);emit("favorites");return result},
 createPlaylist(name:string,s=store!):void{s.library.createPlaylist(name);s.player.setPlayingList(active(s));persist(s)},renamePlaylist(oldName:string,name:string,s=store!):void{s.library.renamePlaylist(oldName,name);persist(s)},deletePlaylist(name:string,s=store!):void{s.library.deletePlaylist(name);s.player.setPlayingList(active(s));persist(s)},openPlaylist(name:string,s=store!):void{s.library.switchTo(name);s.player.setPlayingList(active(s));persist(s)}
};
