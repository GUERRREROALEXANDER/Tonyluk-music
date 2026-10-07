export type MotionPref="system"|"on"|"off";
export function observeReveals(root:ParentNode=document):void{const nodes=Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));root.querySelectorAll<HTMLElement>("[data-stagger] > *").forEach((el:HTMLElement,i:number)=>el.style.setProperty("--i",String(i)));if(!("IntersectionObserver" in window)){nodes.forEach(n=>n.classList.add("is-in"));return}const io=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add("is-in");io.unobserve(entry.target)}}),{threshold:.15});nodes.forEach(n=>io.observe(n))}
export function withViewTransition(update:()=>void):void{const doc=document as Document&{startViewTransition?:(cb:()=>void)=>unknown};if(doc.startViewTransition&&!prefersReducedMotion())doc.startViewTransition(update);else{update();document.querySelector("main")?.classList.add("view-fade")}}
export function flip(elements:Element[],mutate:()=>void):void{const first=elements.map(el=>el.getBoundingClientRect());mutate();elements.forEach((el,i)=>{const a=first[i],b=el.getBoundingClientRect();if(!a||!b)return;const dx=a.left-b.left,dy=a.top-b.top;if(dx||dy)el.animate([{transform:`translate(${dx}px,${dy}px)`},{transform:"translate(0,0)"}],{duration:360,easing:"cubic-bezier(.22,1,.36,1)"})})}
export function prefersReducedMotion():boolean{const pref=document.documentElement.dataset.motion;if(pref==="reduced")return true;if(pref==="full")return false;return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false}
export function applyMotionPref(pref:MotionPref):void{document.documentElement.dataset.motion=pref==="on"?"reduced":pref==="off"?"full":"system"}

/**
 * Watches the whole document: any element with data-reveal that gets added later
 * (views, tiles, rows) is observed automatically, so no view can forget to reveal its content.
 */
export function autoReveal(): void {
  const stamp = (root: ParentNode): void => root.querySelectorAll<HTMLElement>("[data-stagger]").forEach((parent) => Array.from(parent.children).forEach((child, i) => (child as HTMLElement).style.setProperty("--i", String(i))));
  if (!("IntersectionObserver" in window)) { new MutationObserver(() => document.querySelectorAll("[data-reveal]:not(.is-in)").forEach((n) => n.classList.add("is-in"))).observe(document.body, { childList: true, subtree: true }); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-in"); io.unobserve(entry.target); } }), { threshold: 0.12 });
  const scan = (): void => { stamp(document); document.querySelectorAll<HTMLElement>("[data-reveal]:not(.is-in):not([data-watched])").forEach((n) => { n.dataset.watched = ""; io.observe(n); }); };
  let queued = false;
  new MutationObserver(() => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; scan(); }); }).observe(document.body, { childList: true, subtree: true });
  scan();
}