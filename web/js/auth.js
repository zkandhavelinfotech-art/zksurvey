/* ZKAuth + ZKApi (v13 · Phase 7) — the browser side of the Node.js / PostgreSQL backend.
   Accounts, sessions, plans, billing and all survey data now live on the server (httpOnly session cookie,
   scrypt password hashes, tenant-scoped SQL). This file keeps the synchronous API the Phase 6 screens were
   built on by loading a snapshot of the signed-in account at page start (one blocking request) and
   writing changes back to the server (debounced, and flushed before the page closes).
   Every rule that matters — limits, ownership, slug uniqueness, publishing, payment — is enforced on the
   server; the checks in the screens are only there to give faster feedback. */
const ZKApi = (function(){
  const me = document.currentScript;
  const base = me ? me.src.replace(/js\/auth\.js.*$/,'') : '/';
  const API = base + 'api';
  const path = location.pathname;
  const isAdminPage = /\/admin\//.test(path) && !/\/admin\/login\.html$/.test(path);
  const isRunner = /\/public\/run\.html$/.test(path);

  function callSync(method, url, body){
    const x = new XMLHttpRequest();
    try{
      x.open(method, API + url, false);
      x.setRequestHeader('X-ZK-CSRF','1');
      if(body !== undefined) x.setRequestHeader('Content-Type','application/json');
      x.send(body === undefined ? null : JSON.stringify(body));
    }catch(e){ return {status:0, data:{error:'network', message:'Cannot reach the server. Check your connection and try again.'}}; }
    let data = null; try{ data = JSON.parse(x.responseText); }catch(e){}
    return {status:x.status, data:data || {}};
  }

  const xhr = callSync;
  const S = {user:null, plans:[], ws:{list:[],defs:{},responses:{},starts:{},kv:{}}, admin:null, usage:null, payment:{mode:'mock'}};
  const KEYS = {list:'zk_surveys_v7', defs:'zk_defs_v7', responses:'zk_responses_v7', starts:'zk_starts_v7'};
  let known = {surveys:{}, resp:{}, starts:{}, kv:{}};

  function rebuildKnown(){
    known = {surveys:{}, resp:{}, starts:{}, kv:{}};
    S.ws.list.forEach(function(s){ if(S.ws.defs[s.id]) known.surveys[s.id] = JSON.stringify({meta:s, def:S.ws.defs[s.id]}); });
    Object.keys(S.ws.responses||{}).forEach(function(k){ known.resp[k] = {}; (S.ws.responses[k]||[]).forEach(function(r){ known.resp[k][r.id] = 1; }); });
    Object.keys(S.ws.starts||{}).forEach(function(k){ known.starts[k] = S.ws.starts[k]; });
    Object.keys(S.ws.kv||{}).forEach(function(k){ known.kv[k] = JSON.stringify(S.ws.kv[k]); });
  }
  function loadWs(w){ S.ws = {list:w.list||[], defs:w.defs||{}, responses:w.responses||{}, starts:w.starts||{}, kv:w.kv||{}}; rebuildKnown(); }

  /* ---- boot: one blocking request before any page script runs ---- */
  (function boot(){
    const r = xhr('GET', '/bootstrap' + (isAdminPage ? '' : '?lite=1'));
    if(r.status === 200){
      S.user = r.data.user; S.plans = r.data.plans || []; S.payment = r.data.payment || S.payment; S.usage = r.data.usage || null;
      if(r.data.workspace) loadWs(r.data.workspace);
      S.admin = r.data.admin || null;
    }
  })();

  /* ---- key/value facade used by ZKStore ---- */
  const clone = v => v === undefined ? v : JSON.parse(JSON.stringify(v));
  function read(key, fb){
    if(key === KEYS.list) return S.ws.list;
    if(key === KEYS.defs) return S.ws.defs;
    if(key === KEYS.responses) return S.ws.responses;
    if(key === KEYS.starts) return S.ws.starts;
    return Object.prototype.hasOwnProperty.call(S.ws.kv, key) ? clone(S.ws.kv[key]) : fb;
  }
  let timer = null; const canWrite = () => !!S.user && S.user.status === 'active' && !isRunner;
  function write(key, val){
    if(!canWrite()) return;
    if(key === KEYS.list) S.ws.list = val; else if(key === KEYS.defs) S.ws.defs = val;
    else if(key === KEYS.responses) S.ws.responses = val; else if(key === KEYS.starts) S.ws.starts = val;
    else S.ws.kv[key] = clone(val);
    clearTimeout(timer); timer = setTimeout(function(){ const r = flush(); if(!r.ok) fail(r); }, 250);
  }
  function remove(key){ if(!canWrite()) return; delete S.ws.kv[key]; delete known.kv[key]; xhr('DELETE', '/kv/' + encodeURIComponent(key)); }

  function fail(r){
    if(r.status === 401){ location.replace(base + 'login.html?msg=expired'); return; }
    const msg = r.message || 'Could not save your change.';
    if(typeof window.zkToast === 'function') window.zkToast(msg); else if(typeof toast === 'function') toast(msg); else alert(msg);
    resync(); setTimeout(function(){ location.reload(); }, 1600);
  }

  /* Push local changes to the server. Returns {ok} or {ok:false,status,code,message}. */
  function ka(method, url, body){   // page is closing: fire-and-forget request that survives navigation (keepalive, 64 KB limit)
    try{ fetch(API + url, {method:method, keepalive:true, credentials:'same-origin', headers:{'X-ZK-CSRF':'1','Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body)}).catch(function(){}); }catch(e){}
    return {status:200, data:{}};
  }
  function flush(closing){
    clearTimeout(timer); timer = null;
    if(!canWrite()) return {ok:true};
    const xhr = closing ? ka : callSync;
    const lst = S.ws.list, defs = S.ws.defs, ids = {};
    let r;
    // 1) surveys (definition + list entry) — server enforces plan limits, publish rules and slug uniqueness
    for(const s of lst){
      ids[s.id] = 1; if(!defs[s.id]) continue;
      const str = JSON.stringify({meta:s, def:defs[s.id]});
      if(known.surveys[s.id] === str) continue;
      r = xhr('PUT', '/surveys/' + encodeURIComponent(s.id), {meta:s, def:defs[s.id]});
      if(r.status !== 200) return {ok:false, status:r.status, code:r.data.error, message:r.data.message};
      known.surveys[s.id] = str;
    }
    for(const id of Object.keys(known.surveys)){
      if(ids[id]) continue;
      xhr('DELETE', '/surveys/' + encodeURIComponent(id)); delete known.surveys[id]; delete known.resp[id]; delete known.starts[id];
    }
    // 2) sample responses added / removed from the dashboard (real responses only arrive via the public runner)
    for(const sid of Object.keys(S.ws.responses || {})){
      if(!known.surveys[sid]) continue;
      const cur = S.ws.responses[sid] || [], kn = known.resp[sid] = known.resp[sid] || {}, curIds = {};
      const add = []; cur.forEach(function(x){ curIds[x.id] = 1; if(!kn[x.id] && x.demo) add.push(x); });
      for(let i = 0; i < add.length; i += 500){
        r = xhr('POST', '/surveys/' + encodeURIComponent(sid) + '/responses/bulk', {responses:add.slice(i, i + 500)});
        if(r.status !== 200) return {ok:false, status:r.status, code:r.data.error, message:r.data.message};
      }
      add.forEach(function(x){ kn[x.id] = 1; });
      const gone = Object.keys(kn).filter(function(k){ return !curIds[k]; });
      if(gone.length){ xhr('POST', '/surveys/' + encodeURIComponent(sid) + '/responses/delete', {ids:gone}); gone.forEach(function(k){ delete kn[k]; }); }
    }
    for(const sid of Object.keys(S.ws.starts || {})){
      if(!known.surveys[sid] || known.starts[sid] === S.ws.starts[sid]) continue;
      r = xhr('PUT', '/surveys/' + encodeURIComponent(sid) + '/starts', {count:S.ws.starts[sid]}); if(r.status === 200) known.starts[sid] = S.ws.starts[sid];
    }
    // 3) everything else (campaigns, segments, strategy, settings …)
    const dirty = {}; let n = 0;
    Object.keys(S.ws.kv).forEach(function(k){ const s = JSON.stringify(S.ws.kv[k]); if(known.kv[k] !== s){ dirty[k] = S.ws.kv[k]; n++; } });
    if(n){
      const ks = Object.keys(dirty);
      for(let i = 0; i < ks.length; i += 40){
        const part = {}; ks.slice(i, i + 40).forEach(function(k){ part[k] = dirty[k]; });
        r = xhr('PUT', '/kv', {entries:part});
        if(r.status !== 200) return {ok:false, status:r.status, code:r.data.error, message:r.data.message};
        Object.keys(part).forEach(function(k){ known.kv[k] = JSON.stringify(part[k]); });
      }
    }
    return {ok:true};
  }
  function resync(){ const r = xhr('GET', '/workspace'); if(r.status === 200) loadWs(r.data); return r.status === 200; }
  window.addEventListener('pagehide', function(){ if(timer) flush(true); });
  window.addEventListener('beforeunload', function(){ if(timer) flush(true); });
  // in-app navigation: save pending changes synchronously before the browser leaves the page
  document.addEventListener('click', function(e){ if(timer && e.target.closest && e.target.closest('a[href]')){ const r = flush(); if(!r.ok) fail(r); } }, true);

  const origin = new URL(base, location.href).origin;
  return {base:base, api:API, origin:origin, state:S, read:read, write:write, remove:remove, flush:flush, resync:resync, call:xhr, isRunner:isRunner,
    snapshot:function(){ return {list:clone(S.ws.list), defs:clone(S.ws.defs), responses:clone(S.ws.responses), starts:clone(S.ws.starts), kv:clone(S.ws.kv)}; },
    setUser:function(u){ S.user = u; }, setPlans:function(p){ S.plans = p; }};
})();

const ZKAuth = (function(){
  const S = ZKApi.state, base = ZKApi.base;
  const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e||'');
  const fmtErr = r => (r.data && (r.data.errors && r.data.errors.length ? r.data.errors : [r.data.message])) || ['Something went wrong.'];

  function plans(){ return S.plans.length ? S.plans : [{id:'free',name:'Free',price:0,surveys:1,responses:100,formats:1,watermark:true,ads:false,clients:false,seats:1}]; }
  function savePlans(p){ const r = ZKApi.call('PUT', '/admin/plans', {plans:p}); if(r.status === 200) ZKApi.setPlans(r.data.plans); return r.status === 200 ? '' : (r.data.message || 'Could not save plans.'); }
  function current(){ return S.user; }
  function isSuper(){ return !!S.user && S.user.role === 'superadmin'; }
  function accounts(){ return S.admin ? S.admin.accounts : (S.user ? [S.user] : []); }
  function events(){ return S.admin ? S.admin.events : []; }
  function event(){ /* events are recorded by the server */ }

  function register(o){
    const r = ZKApi.call('POST', '/auth/register', {name:o.name, email:o.email, password:o.password, company:o.company, focus:o.focus, plan:o.plan, terms:!!o.terms});
    if(r.status === 201){ S.user = r.data.account; return {account:r.data.account}; }
    return {errors:fmtErr(r)};
  }
  function login(email, pw, twoFactorCode, tempToken){
    const payload = tempToken ? { tempToken: tempToken, code: twoFactorCode } : { email: email, password: pw };
    const endpoint = tempToken ? '/auth/verify-2fa' : '/auth/login';
    const r = ZKApi.call('POST', endpoint, payload);
    if(r.status === 200){
      if(r.data.twoFactorRequired){
        return { twoFactorRequired: true, tempToken: r.data.tempToken, email: r.data.email, message: r.data.message };
      }
      S.user = r.data.account;
      return { account: r.data.account };
    }
    return { error: (r.data && r.data.message) || 'Sign-in failed.' };
  }
  function logout(){ ZKApi.flush(); ZKApi.call('POST', '/auth/logout'); S.user = null; try{ sessionStorage.removeItem('zk_demo_banner_off'); }catch(e){} }
  function updateAccount(id, patch){
    const mine = S.user && id === S.user.id;
    const r = mine ? ZKApi.call('PATCH', '/account', patch) : ZKApi.call('PATCH', '/admin/accounts/' + encodeURIComponent(id), patch);
    if(r.status !== 200) return null;
    if(mine){ S.user = r.data.account; return S.user; }
    const rr = ZKApi.call('GET', '/admin/accounts'); if(rr.status === 200 && S.admin) S.admin.accounts = rr.data.accounts;
    return (S.admin && S.admin.accounts.find(a => a.id === id)) || {};
  }
  function changePassword(id, oldPw, newPw){ const r = ZKApi.call('POST', '/account/password', {current:oldPw, next:newPw}); return r.status === 200 ? '' : (r.data.message || 'Could not change password.'); }
  function deleteAccount(id){
    const r = ZKApi.call('DELETE', '/admin/accounts/' + encodeURIComponent(id));
    if(r.status === 200 && S.admin) S.admin.accounts = S.admin.accounts.filter(a => a.id !== id);
    return r.status === 200;
  }
  function key(k){ return k; }
  function nsKeys(){ return Object.keys(ZKApi.snapshot().kv); }
  function isCustomerNs(){ return ZKApi.isRunner || !(S.user && S.user.role === 'superadmin'); }  // only the platform admin gets the built-in sample surveys
  function slugOwner(){ return null; }
  function slugTaken(slug){ if(!S.user || !slug) return false; const r = ZKApi.call('GET', '/slugs/' + encodeURIComponent(slug)); return !!(r.data && r.data.taken); }
  function setSlug(){} function dropSlug(){}
  function myId(){ return S.user ? S.user.id : ''; }
  function planOf(a){ a = a || S.user; const id = a ? a.plan : 'free'; return plans().find(p => p.id === id) || plans()[0]; }
  function usageOf(a){
    if(a && a.usage) return a.usage;
    if(a && S.user && a.id !== S.user.id) return {surveys:0, published:0, responses:0};
    const ws = S.ws; let r = 0; Object.keys(ws.responses || {}).forEach(k => (ws.responses[k] || []).forEach(x => { if(!x.demo) r++; }));
    const pub = ws.list.filter(s => ws.defs[s.id] && ws.defs[s.id].publish && ws.defs[s.id].publish.status === 'Published').length;
    return {surveys:ws.list.length, published:pub, responses:r};
  }
  function can(feature){ const a = S.user; if(a && a.role === 'superadmin') return true; return !!planOf(a)[feature]; }

  /* ---- route guard (convenience only: the server refuses unauthorised API calls regardless) ---- */
  (function(){
    const path = location.pathname, file = path.split('/').pop();
    if(!/\/admin\//.test(path) || file === 'login.html') return;
    const a = S.user;
    if(!a){ location.replace(base + 'login.html?next=' + encodeURIComponent(path.split('/admin/')[1] + location.search)); return; }
    if(a.status !== 'active'){ logout(); location.replace(base + 'login.html?msg=suspended'); return; }
    if(/^(platform|architecture)\.html$/.test(file) && a.role !== 'superadmin'){ location.replace(base + 'admin/dashboard.html'); return; }
    if(a.role === 'owner' && /^(dashboard|analytics|responses|leads|reports|sources|insights|segments|strategy-builder|content-testing|launch-journey|distribute|campaign-builder|survey-builder)\.html$/.test(file) && usageOf(a).surveys === 0){ location.replace('onboarding.html?need=1'); return; }
  })();

  return {base:base, plans:plans, savePlans:savePlans, accounts:accounts, current:current, isSuper:isSuper, register:register, login:login, logout:logout, updateAccount:updateAccount,
    changePassword:changePassword, deleteAccount:deleteAccount, key:key, nsKeys:nsKeys, isCustomerNs:isCustomerNs, slugOwner:slugOwner, slugTaken:slugTaken, setSlug:setSlug, dropSlug:dropSlug,
    planOf:planOf, usageOf:usageOf, can:can, event:event, events:events, validEmail:validEmail, myId:myId, ns:function(){ return ''; }, prefixOf:function(){ return ''; }, api:ZKApi};
})();
