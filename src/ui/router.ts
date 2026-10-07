import { withViewTransition } from "./motion.js";
export type Route="home"|"search"|"library"|"playlist"|"favorites"|"recent"|"profile";
type RouteCallback=(route:Route,parameter?:string)=>void;const callbacks=new Set<RouteCallback>();
function read():{route:Route;parameter?:string}{const path=location.hash.replace(/^#\/?/,"")||"home";const [route,...rest]=path.split("/");if(route==="playlist")return{route,parameter:decodeURIComponent(rest.join("/"))};const valid:Route[]=["home","search","library","favorites","recent","profile"];return{route:valid.includes(route as Route)?route as Route:"home"}}
export function navigate(path:string):void{const hash=`#/${path.replace(/^\//,"")}`;if(location.hash===hash){const r=read();callbacks.forEach(cb=>cb(r.route,r.parameter));return}withViewTransition(()=>{location.hash=hash})}
export function onRoute(cb:RouteCallback):()=>void{callbacks.add(cb);const current=read();cb(current.route,current.parameter);return()=>callbacks.delete(cb)}
window.addEventListener("hashchange",()=>{const r=read();callbacks.forEach(cb=>cb(r.route,r.parameter))});if(!location.hash)history.replaceState(null,"",`${location.pathname}${location.search}#/home`);
