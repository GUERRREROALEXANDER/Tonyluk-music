import { iconMarkup } from "./icons.js";
import type { IconName } from "./icons.js";
type Child=Node|string|null|false|undefined|Child[];
type Attrs=Record<string,unknown>;
export function h<K extends keyof HTMLElementTagNameMap>(tag:K,attrs?:Attrs|null,...children:Child[]):HTMLElementTagNameMap[K]{
 const el=document.createElement(tag); if(attrs) for(const [key,value] of Object.entries(attrs)){if(value===null||value===undefined||value===false)continue;
  if(key==="class"||key==="className")el.className=String(value);else if(key==="dataset"&&typeof value==="object")Object.assign(el.dataset,value);
  else if(key==="style"&&typeof value==="object")Object.assign(el.style,value);
  else if(key.startsWith("on:")&&typeof value==="function")el.addEventListener(key.slice(3),value as EventListener);
  else if(/^on[A-Z]/.test(key)&&typeof value==="function")el.addEventListener(key.slice(2).toLowerCase(),value as EventListener);
  else if(key in el&&key!=="aria-label"&&key!=="role")try{(el as unknown as Record<string,unknown>)[key]=value}catch{el.setAttribute(key,String(value))}
  else el.setAttribute(key,value===true?"":String(value));}
 const append=(child:Child):void=>{if(Array.isArray(child)){child.forEach(append);return}if(child===null||child===undefined||child===false)return;el.append(child instanceof Node?child:document.createTextNode(String(child)))};children.forEach(append);return el;
}
export function clear(el:Element):void{el.replaceChildren()}
export function qs<T extends Element=HTMLElement>(selector:string,root:ParentNode=document):T|null{return root.querySelector<T>(selector)}
export function icon(name:IconName,size=24):SVGElement{const doc=new DOMParser().parseFromString(iconMarkup(name,size),"image/svg+xml");return doc.documentElement as unknown as SVGElement}
export function formatTime(seconds:number):string{if(!Number.isFinite(seconds)||seconds<0)return "–:––";const n=Math.floor(seconds),s=String(n%60).padStart(2,"0");if(n>=3600)return `${Math.floor(n/3600)}:${String(Math.floor(n/60)%60).padStart(2,"0")}:${s}`;return `${Math.floor(n/60)}:${s}`}
export function initials(name:string):string{return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>part[0]?.toUpperCase()??"").join("")||"TL"}
