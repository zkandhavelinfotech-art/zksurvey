const $ = (s, p=document) => p.querySelector(s);
const $$ = (s, p=document) => [...p.querySelectorAll(s)];

function selectOption(el){
  const group = el.parentElement;
  $$(".option", group).forEach(x=>x.classList.remove("selected"));
  el.classList.add("selected");
}
function toast(msg){
  const t=document.createElement("div");
  t.textContent=msg;t.style.cssText="position:fixed;right:20px;bottom:20px;background:#171b32;color:#fff;padding:13px 17px;border-radius:12px;z-index:99;box-shadow:0 10px 25px #0002;font-size:13px";
  document.body.appendChild(t);setTimeout(()=>t.remove(),2400);
}
function fakeSubmit(){
  toast("Prototype action completed — backend will replace this in Phase 2.");
}
$$("[data-demo]").forEach(x=>x.addEventListener("click",e=>{e.preventDefault();toast(x.dataset.demo)}));
