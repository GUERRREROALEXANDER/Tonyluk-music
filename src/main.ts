import { AuthService } from "./services/auth.js";
import type { AuthUser } from "./services/auth.js";
import { createStore } from "./ui/store.js";
import { h, initials } from "./ui/dom.js";
import { mountAuth } from "./ui/auth/authView.js";
const authRoot=document.getElementById("auth-root");const appRoot=document.getElementById("app-root");const auth=new AuthService();let currentUser:AuthUser|null=auth.currentUser();let activeStore:ReturnType<typeof createStore>|null=null;
if(!authRoot||!appRoot)throw new Error("App mount points are missing");
function mountApp(user:AuthUser):void{authRoot!.hidden=true;authRoot!.replaceChildren();appRoot!.hidden=false;activeStore=createStore(user);const signout=h("button",{class:"placeholder-signout",type:"button",onClick:()=>logout()},"Sign out");const top=h("header",{class:"placeholder-bar"},h("img",{src:"assets/brand/wordmark.png",alt:"Tony Luk Music",width:205,height:125}),h("span",{class:"profile-initials","aria-label":user.name},initials(user.name)),signout);const content=h("main",{class:"placeholder-content"},h("h1",{},`Welcome, ${user.name}`),h("p",{},`Signed in as ${user.email}`));appRoot!.replaceChildren(h("div",{class:"app-placeholder"},top,content));preloadYouTube()}
function logout():void{auth.logout();if(activeStore){activeStore.data.flushLibrary();activeStore.controller.destroy();activeStore=null}appRoot!.hidden=true;appRoot!.replaceChildren();currentUser=null;mountAuth(authRoot!,auth,(user)=>{currentUser=user;mountApp(user)})}
function preloadYouTube():void{const load=()=>{const script=document.createElement("script");script.src="https://www.youtube.com/iframe_api";script.async=true;document.head.append(script)};const idle=(window as Window&{requestIdleCallback?:(callback:()=>void,options?:{timeout:number})=>number}).requestIdleCallback;if(idle)idle(load,{timeout:2500});else window.setTimeout(load,1200)}
if(currentUser)mountApp(currentUser);else mountAuth(authRoot,auth,(user)=>{currentUser=user;window.setTimeout(()=>mountApp(user),150)});
