/* ZKSurvey shell — consistent footer, active menu state, mobile nav, role switcher, notifications and toast on every page. */
(function(){
  const me = document.currentScript;
  const base = me ? me.src.replace(/js\/shell\.js.*$/, '') : '';
  const year = new Date().getFullYear();
  const file = location.pathname.split('/').pop() || 'index.html';

  /* Toast (replaces the inline-styled one in app.js) */
  window.toast = function(msg){
    document.querySelectorAll('.zk-toast').forEach(x=>x.remove());
    const t = document.createElement('div'); t.className = 'zk-toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(()=>t.remove(), 2600);
  };
  document.querySelectorAll('[data-toast]').forEach(x=>x.addEventListener('click', e=>{ e.preventDefault(); toast(x.dataset.toast); }));

  /* Sidebar: correct active link, extra nav entries, role switcher, powered-by line */
  const ROLE_KEY='zk_role_v10';
  const escH = t => String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function ZKData_usage(){ try{ return (typeof ZKData!=='undefined')?ZKData.usage():null; }catch(e){ return null; } }
  const ALL='superadmin,agency,customer,marketing,owner';
  const ROLE_MAP = {
    'dashboard.html':ALL, 'customers.html':'superadmin,agency', 'products.html':'superadmin,agency',
    'surveys.html':'superadmin,agency,marketing,owner', 'survey-builder.html':'superadmin,agency,marketing,owner', 'questions.html':'superadmin,agency,marketing,owner',
    'campaigns.html':'superadmin,agency,marketing,owner', 'sources.html':'superadmin,agency,marketing,owner', 'responses.html':ALL,
    'leads.html':'superadmin,agency,marketing,owner', 'analytics.html':ALL, 'insights.html':ALL,
    'growth-framework.html':ALL, 'strategy-builder.html':'superadmin,agency,marketing,owner', 'content-testing.html':'superadmin,agency,marketing,owner',
    'reports.html':ALL, 'settings.html':'superadmin,owner', 'users.html':'superadmin',
    'segments.html':ALL, 'survey-templates.html':'superadmin,agency,marketing,owner', 'campaign-builder.html':'superadmin,agency,marketing,owner', 'architecture.html':'superadmin',
    'launch-journey.html':ALL, 'distribute.html':'superadmin,agency,marketing,owner', 'billing.html':'owner', 'platform.html':'superadmin'
  };

  const sb = document.querySelector('.sidebar');
  if(sb){
    let links = [...sb.querySelectorAll('.side-link')];
    const sv = links.find(a=>/surveys\.html$/.test(a.getAttribute('href')||''));
    if(sv && !links.some(a=>/survey-builder\.html$/.test(a.getAttribute('href')||''))){
      const a = document.createElement('a'); a.className='side-link'; a.href = sv.getAttribute('href').replace('surveys.html','survey-builder.html'); a.innerHTML='<span>✎</span>&nbsp; Survey Builder';
      sv.after(a);
    }
    links = [...sb.querySelectorAll('.side-link')];
    const gf = links.find(a=>/growth-framework\.html$/.test(a.getAttribute('href')||''));
    if(gf && !links.some(a=>/strategy-builder\.html$/.test(a.getAttribute('href')||''))){
      const a = document.createElement('a'); a.className='side-link'; a.href = gf.getAttribute('href').replace('growth-framework.html','strategy-builder.html'); a.innerHTML='<span>◈</span>&nbsp; Strategy Builder';
      gf.after(a);
      const b = document.createElement('a'); b.className='side-link'; b.href = gf.getAttribute('href').replace('growth-framework.html','content-testing.html'); b.innerHTML='<span>❖</span>&nbsp; Content Testing';
      a.after(b);
    }
    links = [...sb.querySelectorAll('.side-link')];
    const settingsLink = links.find(a=>/settings\.html$/.test(a.getAttribute('href')||''));
    if(settingsLink && !links.some(a=>/users\.html$/.test(a.getAttribute('href')||''))){
      const u = document.createElement('a'); u.className='side-link'; u.href = settingsLink.getAttribute('href').replace('settings.html','users.html'); u.innerHTML='<span>☺</span>&nbsp; Users';
      settingsLink.after(u);
    }
    /* v11: Segments, Templates, Architecture entries; honest label for the Insights page */
    function addAfter(ref, href, icon, label){ links = [...sb.querySelectorAll('.side-link')]; if(links.some(a=>(a.getAttribute('href')||'').split('/').pop()===href)) return; const r = links.find(a=>(a.getAttribute('href')||'').split('/').pop()===ref); if(!r) return; const a=document.createElement('a'); a.className='side-link'; a.href=(r.getAttribute('href')||'').replace(ref,href); a.innerHTML='<span>'+icon+'</span>&nbsp; '+label; r.after(a); }
    addAfter('survey-builder.html','survey-templates.html','❏','Templates');
    addAfter('analytics.html','segments.html','◑','Segments');
    addAfter('users.html','architecture.html','⬡','Architecture');
    addAfter('dashboard.html','launch-journey.html','⚑','Launch Journey');
    addAfter('survey-templates.html','distribute.html','✺','Distribute');
    addAfter('dashboard.html','platform.html','⛭','Platform Console');
    addAfter('settings.html','billing.html','₹','Plan & Billing');
    sb.querySelectorAll('.side-link').forEach(a=>{ if(/insights\.html$/.test(a.getAttribute('href')||'')) a.innerHTML='<span>✦</span>&nbsp; Insights'; if(/questions\.html$/.test(a.getAttribute('href')||'')) a.innerHTML='<span>?</span>&nbsp; Question Bank'; });
    links = [...sb.querySelectorAll('.side-link')];
    links.forEach(a=>{
      a.classList.toggle('active', (a.getAttribute('href')||'').split('/').pop() === file);
      const f = (a.getAttribute('href')||'').split('/').pop();
      a.dataset.roles = ROLE_MAP[f] || 'superadmin,agency,customer,marketing';
    });
    const acct = (typeof ZKAuth!=='undefined') ? ZKAuth.current() : null;
    const isSup = !acct || acct.role==='superadmin';
    if(isSup && !sb.querySelector('.role-switch')){
      const w = document.createElement('div'); w.className='role-switch';
      w.innerHTML = '<label for="zkRoleSel">Viewing as</label><select id="zkRoleSel"><option value="superadmin">Super Admin</option><option value="agency">Agency / Consultant</option><option value="customer">Customer</option><option value="marketing">Marketing user</option><option value="owner">Account owner (B2C customer)</option></select>';
      sb.querySelector('.logo').after(w);
    }
    if(!isSup && !sb.querySelector('.acct-box')){
      const p = ZKAuth.planOf(acct), u = ZKData_usage();
      const w = document.createElement('div'); w.className='acct-box';
      w.style.cssText='padding:12px 14px;margin:10px 12px;border:1px solid #262e4d;border-radius:12px;background:#0d1224;font-size:12px';
      w.innerHTML='<b style="color:#fff;font-size:13px;display:block;overflow-wrap:anywhere">'+escH(acct.company)+'</b><span style="color:#9aa4c0;overflow-wrap:anywhere">'+escH(acct.email)+'</span><div style="margin-top:8px"><span class="zk-chip c">'+escH(p.name)+' plan</span></div>'
        +(u?'<div style="margin-top:8px;color:#9aa4c0">Surveys '+u.surveys+' / '+p.surveys+'<br>Responses '+u.responses+' / '+p.responses+'</div>':'')+'<a href="billing.html" style="color:#9ce6ff;display:inline-block;margin-top:8px">Upgrade plan</a>';
      sb.querySelector('.logo').after(w);
    }
    if(!sb.querySelector('.signout')){ const so=document.createElement('a'); so.href='#'; so.className='side-link signout'; so.dataset.roles=ALL; so.innerHTML='<span>⏻</span>&nbsp; Sign out'; so.onclick=e=>{ e.preventDefault(); ZKAuth.logout(); location.href=base+'login.html'; }; sb.appendChild(so); }
    function applyRole(r){
      const ownerAgency = (r==='owner') && typeof ZKAuth!=='undefined' && ZKAuth.can('clients') && !isSup;
      [...sb.querySelectorAll('.side-link')].forEach(a=>{ const f=(a.getAttribute('href')||'').split('/').pop(); let ok=(a.dataset.roles||'').split(',').includes(r);
        if(ownerAgency && /^(customers|products)\.html$/.test(f)) ok=true;
        if(a.classList.contains('signout')) ok=true;
        a.style.display = ok ? '' : 'none'; });
    }
    const roleSel = sb.querySelector('#zkRoleSel');
    const savedRole = isSup ? (localStorage.getItem(ROLE_KEY) || 'superadmin') : 'owner';
    if(roleSel){ roleSel.value = savedRole; roleSel.onchange = () => { localStorage.setItem(ROLE_KEY, roleSel.value); applyRole(roleSel.value); toast('Viewing as ' + roleSel.options[roleSel.selectedIndex].text + ' (menu preview only — not access control)'); }; }
    applyRole(savedRole);
    if(!sb.querySelector('.sidebar-foot')){
      const f = document.createElement('div'); f.className='sidebar-foot'; f.innerHTML='Powered by<br><b style="color:#cfd6ee">Zlandavel Infotech Pvt Ltd</b><br>Chennai, India'; sb.appendChild(f);
    }

    /* Notifications bell: real events derived from survey/response data */
    if(!document.getElementById('zkNotifBtn')){
      const btn = document.createElement('button'); btn.id='zkNotifBtn'; btn.className='zk-btn sm'; btn.title='Notifications'; btn.textContent='🔔';
      btn.style.cssText='position:fixed;top:14px;right:22px;z-index:300';
      const panel = document.createElement('div'); panel.id='zkNotifPanel';
      panel.style.cssText='position:fixed;top:54px;right:22px;z-index:300;display:none;width:320px;max-height:70vh;overflow:auto;background:#141a33;border:1px solid #2a3356;border-radius:14px;padding:10px;box-shadow:0 18px 50px rgba(0,0,0,.5)';
      document.body.appendChild(btn); document.body.appendChild(panel);
      btn.onclick = (e) => {
        e.stopPropagation();
        if(panel.style.display==='block'){ panel.style.display='none'; return; }
        const items = (typeof ZKData !== 'undefined' && ZKData.notifications) ? ZKData.notifications() : [];
        panel.innerHTML = items.length ? items.map(n=>{
          const label = n.type==='lead' ? 'New lead' : n.type==='milestone' ? 'Milestone' : 'Published';
          return '<div style="padding:9px 4px;border-bottom:1px solid #22294a;font-size:13px"><b style="color:#fff">'+label+'</b><div style="color:#9aa4c0;margin-top:2px">'+n.text+'</div><div style="color:#6b7596;font-size:11px;margin-top:3px">'+new Date(n.at).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})+'</div></div>';
        }).join('') : '<div style="color:#9aa4c0;font-size:13px;padding:10px 4px">No notifications yet.</div>';
        panel.style.display='block';
      };
      document.addEventListener('click', e=>{ if(panel.style.display==='block' && !panel.contains(e.target) && e.target!==btn) panel.style.display='none'; });
    }
  }


  /* v11: label demo data wherever numbers are shown */
  (function(){
    try{
      if(typeof ZKData==='undefined') return; const main=document.querySelector('.main'); if(!main) return;
      if(!/(dashboard|analytics|responses|leads|reports|insights|segments|sources|growth-framework)\.html$/.test(file)) return;
      if(sessionStorage.getItem('zk_demo_banner_off')) return;
      let demo=0,total=0; ZKData.getList().forEach(x=>{ const r=ZKData.getResponses(x.id); total+=r.length; demo+=r.filter(y=>y.demo).length; });
      if(!demo) return;
      const b=document.createElement('div'); b.className='zk-note'; b.style.cssText='margin-bottom:14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap';
      b.innerHTML='<span><b>Sample data.</b> '+demo+' of '+total+' responses here are generated demo data so the screens have something to show. Your own survey responses are never mixed in unlabelled. Reset or export from <a href="settings.html" style="color:#9ce6ff">Settings</a>.</span><button class="zk-btn sm" type="button">Hide</button>';
      b.querySelector('button').onclick=()=>{ try{ sessionStorage.setItem('zk_demo_banner_off','1'); }catch(e){} b.remove(); };
      const h=main.querySelector('.page-head'); if(h) h.after(b); else main.prepend(b);
    }catch(e){}
  })();

  /* v12: owner banners (finish setup / complete chosen plan) */
  (function(){
    try{
      if(typeof ZKAuth==='undefined'||!/dashboard\.html$/.test(file)) return; const a=ZKAuth.current(); if(!a||a.role!=='owner') return; const main=document.querySelector('.main'); if(!main) return;
      const msgs=[]; if(a.wantedPlan && a.wantedPlan!==a.plan && a.wantedPlan!=='free') msgs.push('You chose the <b>'+escH(a.wantedPlan)+'</b> plan at sign-up. <a href="billing.html?upgrade='+escH(a.wantedPlan)+'" style="color:#9ce6ff">Complete your upgrade</a>.');
      if(!a.onboarded) msgs.push('Finish setting up: <a href="onboarding.html" style="color:#9ce6ff">create your first survey</a>.');
      if(!msgs.length) return; const b=document.createElement('div'); b.className='zk-note'; b.style.marginBottom='14px'; b.innerHTML=msgs.join('<br>'); const h=main.querySelector('.page-head'); if(h) h.after(b); else main.prepend(b);
    }catch(e){}
  })();


  /* v13: email-verification banner (publishing and checkout need a verified address; the server enforces it) */
  (function(){
    try{
      if(typeof ZKAuth==='undefined'||!/\/admin\//.test(location.pathname)) return; const a=ZKAuth.current(); if(!a||a.role==='superadmin'||a.emailVerified) return; const main=document.querySelector('.main'); if(!main) return;
      const b=document.createElement('div'); b.className='zk-note'; b.setAttribute('role','status'); b.style.cssText='margin-bottom:14px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap';
      b.innerHTML='<span><b>Verify your email.</b> We sent a link to '+escH(a.email)+'. You need a verified email to publish surveys or subscribe to a plan.</span><button class="zk-btn sm" type="button">Resend link</button>';
      b.querySelector('button').onclick=function(){ const r=ZKApi.call('POST','/auth/resend-verification',{}); toast(r.status===200?'Verification email sent.':(r.data.message||'Could not send.')); };
      const h=main.querySelector('.page-head'); if(h) h.after(b); else main.prepend(b);
    }catch(e){}
  })();

  /* Public header: mobile menu toggle */
  const tb = document.querySelector('.topbar');
  if(tb && !tb.querySelector('.nav-toggle')){
    const btn = document.createElement('button'); btn.className='nav-toggle'; btn.setAttribute('aria-label','Menu'); btn.textContent='☰';
    btn.onclick = ()=>tb.classList.toggle('open');
    const c = tb.querySelector('.container'); if(c) c.insertBefore(btn, c.querySelector('.nav'));
  }

  /* Public header: account links */
  (function(){ const n=document.getElementById('authNav'); if(!n||typeof ZKAuth==='undefined') return; const a=ZKAuth.current(); if(a){ n.innerHTML='<a href="'+base+'admin/dashboard.html">Dashboard</a><a class="btn btn-outline" href="#" id="soBtn">Sign out</a>'; document.getElementById('soBtn').onclick=e=>{ e.preventDefault(); ZKAuth.logout(); location.href=base+'index.html'; }; } })();

  /* Footer */
  if(!document.querySelector('.zk-footer')){
    const full = !!document.querySelector('.topbar') && !document.querySelector('.survey-wrap');
    const f = document.createElement('footer'); f.className = 'zk-footer' + (full ? '' : ' compact');
    f.innerHTML =
      '<div class="inner"><div><a class="logo" href="'+base+'index.html"><span class="logo-mark">ZK</span><span class="logo-text">ZKSurvey<small>Survey &amp; Launch Intelligence</small></span></a>'
      + '<p>Build any survey — product launch, pre-launch validation, customer feedback — and turn responses into insight, interested leads and a launch plan.</p></div>'
      + '<div><h5>Platform</h5><a href="'+base+'admin/surveys.html">Surveys</a><a href="'+base+'admin/survey-builder.html">Survey Builder</a><a href="'+base+'admin/dashboard.html">Dashboard</a><a href="'+base+'admin/growth-framework.html">Growth Framework</a></div>'
      + '<div><h5>Use cases</h5><a href="'+base+'index.html#usecases">Product launch</a><a href="'+base+'index.html#usecases">Software pre-launch</a><a href="'+base+'index.html#usecases">Customer feedback</a></div>'
      + '<div><h5>Company</h5><a href="'+base+'index.html#features">Features</a><a href="'+base+'admin/architecture.html">Architecture</a><a href="'+base+'admin/settings.html">Settings</a><a href="'+base+'pricing.html">Pricing</a><a href="'+base+'login.html">Sign in</a><a href="'+base+'support.html">Support</a><a href="'+base+'legal.html">Terms &amp; privacy</a></div></div>'
      + '<div class="bar">© '+year+' <b>ZKSurvey</b> · v13 · Phase 7 build · Powered by <b>Zlandavel Infotech Pvt Ltd</b>, Chennai, India</div>';
    (document.querySelector('.main') || document.body).appendChild(f);
  }
})();

/* a11y: label unlabeled controls, make scrollable table wrappers keyboard-focusable (runs after page scripts) */
window.addEventListener('load', function(){
  setTimeout(function(){
    document.querySelectorAll('select,input,textarea').forEach(function(el){
      if(el.type==='hidden'||el.getAttribute('aria-label')||el.getAttribute('aria-labelledby')) return;
      if(el.id && document.querySelector('label[for="'+el.id+'"]')) return;
      if(el.closest('label')) return;
      var l=el.parentElement && el.parentElement.querySelector('label');
      var t=(l&&l.textContent.trim())||el.getAttribute('placeholder')||el.getAttribute('title')||el.id.replace(/^[a-z]+_?/,'').replace(/[_-]/g,' ')||'Field';
      el.setAttribute('aria-label',t.replace(/\s*\*\s*$/,''));
    });
    document.querySelectorAll('.table-wrap').forEach(function(w){
      if(w.scrollWidth>w.clientWidth && !w.hasAttribute('tabindex')){w.setAttribute('tabindex','0');w.setAttribute('role','region');w.setAttribute('aria-label','Scrollable table');}
    });
  },400);
});
