# Run: python3 -I regression_v11.py <path to project root>   (needs: pip install playwright; a local PostgreSQL with database zksurvey_e2e owned by role zk)
import sys,subprocess,time,json,glob,os
from playwright.sync_api import sync_playwright
root=sys.argv[1]; shots=sys.argv[2] if len(sys.argv)>2 else None

PORT=3300; B=f'http://localhost:{PORT}/'
env=dict(os.environ,PORT=str(PORT),DATABASE_URL='postgres://zk:zk@localhost:5432/zksurvey_e2e',SUPER_EMAIL='root@zksurvey.test',SUPER_PASSWORD='RootPass123',NODE_ENV='development',APP_URL=B.rstrip('/'))
subprocess.run(['psql','postgres://zk:zk@localhost:5432/zksurvey_e2e','-qc','drop schema public cascade; create schema public;'],capture_output=True)
srv=subprocess.Popen(['node','server/src/index.js'],cwd=root,env=env,stdout=open('/tmp/e2e_server.log','w'),stderr=subprocess.STDOUT)
for i in range(40):
    try: urllib.request.urlopen(B+'healthz',timeout=1); break
    except Exception: time.sleep(0.3)
res=[]; errs=[]
def startgo(pg):
    if pg.query_selector('#cons'): pg.check('#cons')
    pg.click('#go')
def ok(name,cond,info=''):
    res.append((name,bool(cond),info)); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(info) if (info and not cond) else ''))
WHITE_JS="""()=>{const bad=[];document.querySelectorAll('body,body *').forEach(e=>{if(e.closest('#qr'))return;const r=e.getBoundingClientRect();if(r.width<60||r.height<24)return;const c=getComputedStyle(e).backgroundColor;const m=c.match(/rgba?\\(([^)]+)\\)/);if(!m)return;const p=m[1].split(',').map(x=>parseFloat(x));const a=p.length>3?p[3]:1;if(a>0.5&&p[0]>225&&p[1]>225&&p[2]>225)bad.push(e.tagName+'.'+e.className)});return bad.slice(0,5)}"""
try:
  with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1360,'height':900}); pg=ctx.new_page()
    pg.on('pageerror',lambda e:errs.append('PAGEERR '+pg.url+' '+str(e))); pg.on('console',lambda m: m.type=='error' and errs.append('CONSOLE '+pg.url+' '+m.text))
    pg.on('dialog',lambda d:d.accept())
    def go(path): pg.goto(B+path); pg.wait_for_timeout(350)
    go('login.html'); pg.fill('#e','root@zksurvey.test'); pg.fill('#p','RootPass123'); pg.click('button[type=submit]'); pg.wait_for_timeout(700)
    go('admin/surveys.html')
    info=pg.evaluate("""()=>{const l=ZKData.getList();const c=l.find(s=>/coimbatore/i.test(s.name));const d=ZKData.getDef(c.id);return {id:c.id,q:d.questions.length,seg:d.segments.length,t:d.details.targetSample,n:ZKData.getResponses(c.id).length}}""")
    ok('T1 Coimbatore survey seeded (>=25 q, 4 segments, target 300, demo responses)',info['q']>=25 and info['seg']==4 and info['t']==300 and info['n']>=60,info)
    cid=info['id']
    # T2/T3 runner
    go('public/run.html?s=coimbatore-dishwash-research&utm_source=whatsapp&utm_medium=messaging&utm_campaign=t_run')
    txt=pg.inner_text('#app'); ok('T2 neutral intro, client brand hidden',('Milro' not in txt) and 'not asking you to buy' in txt,txt[:120])
    RS=lambda: ctx.request.get(B+'api/workspace').json()['responses'].get(cid,[])
    before=len(RS())
    startgo(pg); finished=False; seen_client=False
    for i in range(60):
        pg.wait_for_timeout(120)
        if pg.query_selector('#zkNext') is None: finished=True; break
        t=pg.inner_text('#app')
        if 'Milro' in t and 'Concept' not in t: seen_client=True
        ans=pg.query_selector('#zkAns')
        if ans:
            opts=pg.query_selector_all('#zkAns .zk-opt')
            if not opts: opts=pg.query_selector_all('#zkAns button')
            if opts and not pg.query_selector('#zkAns textarea,#zkAns input[type=text]'):
                # ranking / choice: click first option(s)
                opts[0].click()
                if len(opts)>1 and 'Rank' in t:
                    for o in pg.query_selector_all('#zkAns .zk-opt')[1:]: 
                        try: o.click()
                        except: pass
            for ta in pg.query_selector_all('#zkAns textarea'): ta.fill('Oily vessels are hard to clean')
            for inp in pg.query_selector_all('#zkAns input[type=text],#zkAns input[type=number]'):
                try: inp.fill('55')
                except: pass
            for sel in pg.query_selector_all('#zkAns select'):
                try: sel.select_option(index=1)
                except: pass
        pg.click('#zkNext')
    pg.wait_for_timeout(600); after=len(RS())
    last=RS()[-1]
    ok('T3 full run submits a response with UTM, not marked demo',after==before+1 and last['utm'].get('utm_source')=='whatsapp' and not last.get('demo'),{'before':before,'after':after,'finished':finished,'err':pg.inner_text('#app')[:200]})
    # T4 logic
    go('admin/surveys.html')
    lg=pg.evaluate(f"""(()=>{{const d=ZKData.getDef('{cid}');const f=t=>d.questions.find(q=>q.text.indexOf(t)===0);const use=f('Which product do you mainly'),bar=f('What do you dislike about dishwash bars'),trial=f('Would you take a small trial'),lead=d.questions.find(q=>q.type==='Lead Capture');
      const vis=a=>ZKData.compute(d,a).vis.map(q=>q.id);
      return {{barHidden:!vis({{[use.id]:'Dishwash liquid'}}).includes(bar.id),barShown:vis({{[use.id]:'Dishwash bar'}}).includes(bar.id),leadHidden:!vis({{[trial.id]:'No'}}).includes(lead.id),leadShown:vis({{[trial.id]:'Yes'}}).includes(lead.id)}}}})()""")
    ok('T4 conditional logic (bar users, trial-pack → lead capture)',all(lg.values()),lg)
    # T5 segments
    go('admin/segments.html?survey='+cid)
    n=pg.evaluate("document.querySelectorAll('#segCards .zk-card').length"); cmp=pg.inner_text('#cmp')
    ok('T5a segments page shows 4 cards and compare table',n==4 and '%' in cmp,{'n':n})
    pg.click('#addSeg'); pg.wait_for_timeout(200); pg.fill('#sg_n','Test segment'); pg.click('#zkModalSave'); pg.wait_for_timeout(300)
    n2=pg.evaluate("document.querySelectorAll('#segCards .zk-card').length"); ok('T5b add segment',n2==5,n2)
    btns=pg.query_selector_all('#segCards [data-d]'); btns[-1].click(); pg.wait_for_timeout(300)
    n3=pg.evaluate("document.querySelectorAll('#segCards .zk-card').length"); ok('T5c delete segment',n3==4,n3)
    # T6 question bank
    go('admin/questions.html'); g=pg.evaluate("ZKData.getBank().length"); ok('T6a bank has groups',g>=7,g)
    pg.click('#addG'); pg.fill('#g_n','My group'); pg.click('#zkModalSave'); pg.wait_for_timeout(200)
    pg.click('#addQ'); pg.fill('#b_t','Do you like it?'); pg.select_option('#b_y','Yes / No'); pg.click('#zkModalSave'); pg.wait_for_timeout(200)
    ok('T6b add group + question persists',pg.evaluate("ZKData.getBank().find(g=>g.name==='My group').questions.length")==1)
    # create survey for insert
    sid=pg.evaluate("ZKData.createSurvey('Regression survey','blank')"); 
    pg.click('#useG'); pg.wait_for_timeout(200); pg.select_option('#i_s',sid); pg.click('#zkModalSave'); pg.wait_for_timeout(250)
    ok('T6c insert bank group into survey',pg.evaluate(f"ZKData.getDef('{sid}').questions.length")==1)
    # builder bank button
    go('admin/survey-builder.html?survey='+sid); pg.evaluate("tab(2)"); pg.click('#btnBank'); pg.wait_for_timeout(200); pg.click('#zkModalSave'); pg.wait_for_timeout(300)
    ok('T6d builder "From question bank" inserts',pg.evaluate(f"ZKData.getDef('{sid}').questions.length")>=2)
    # T7 templates
    go('admin/survey-templates.html'); cards=pg.evaluate("document.querySelectorAll('[data-t]').length"); ok('T7a templates page lists 9 (incl. samples for super admin)',cards==9,cards)
    pg.click('[data-t=nps]'); pg.fill('#cs_t','NPS test'); pg.click('#zkModalSave'); pg.wait_for_timeout(600)
    ok('T7b template creates draft and opens builder',('survey-builder.html' in pg.url) and pg.evaluate("def.questions.length")==3,pg.url)
    # T8 campaign
    go('admin/campaign-builder.html'); ok('T8-pre QR renders on first load',pg.evaluate("!!document.querySelector('#qr svg')"))
    go('admin/campaign-builder.html?survey='+cid); pg.fill('#c_n','Coimbatore WhatsApp trial'); pg.select_option('#c_ch','whatsapp'); pg.fill('#c_bu','5000'); pg.click('#save'); pg.wait_for_timeout(250)
    lnk=pg.inner_text('#lnk'); qr=pg.evaluate("!!document.querySelector('#qr svg')")
    ok('T8a campaign saved with tagged link + QR',pg.evaluate("ZKData.getCampaigns().length")==1 and 'utm_campaign=coimbatore_whatsapp_trial' in lnk and 'coimbatore-dishwash-research' in lnk and qr,lnk)
    go('admin/campaigns.html'); ok('T8b campaign listed',  'Coimbatore WhatsApp trial' in pg.inner_text('#tbl'))
    # T9 settings
    go('admin/settings.html'); pg.fill('#s_m','Madurai'); pg.click('#save'); pg.wait_for_timeout(200); go('admin/settings.html')
    ok('T9a settings persist',pg.input_value('#s_m')=='Madurai')
    exp=pg.evaluate("ZKData.exportAll()"); ok('T9b export contains workspace',exp['app']=='ZKSurvey' and len(exp['data'])>5)
    pg.evaluate("(o)=>{ZKData.resetAll(); }",None); 
    pg.evaluate("(o)=>ZKData.importAll(o)",exp); go('admin/surveys.html'); ok('T9c import restores',pg.evaluate("ZKData.getCampaigns().length")==1)
    # T10 insights
    go('admin/insights.html?survey='+cid); t=pg.inner_text('#out'); ok('T10 insights listed with rule + evidence',t.count('Rule:')>=8 and 'not AI' in pg.inner_text('main'),t.count('Rule:'))
    # T11 architecture
    go('admin/architecture.html'); ok('T11 architecture page has 4 tables',pg.evaluate("document.querySelectorAll('table').length")==4)
    # T12 brand bias
    bias=pg.evaluate("""(()=>{const id=ZKData.createSurvey('Bias test','blank');const d=ZKData.getDef(id);d.details.type='Category Research';d.details.customer='Milro';d.questions.push({id:'qq1',text:'How much do you like Milro?',type:'Text',sectionId:d.sections[0].id,required:false,help:'',options:[]});return ZKData.validate(d).filter(x=>x.level==='bad').map(x=>x.text)})()""")
    ok('T12 brand-bias validation flags client name in category research',any('Brand bias' in x for x in bias),bias)
    # T13 redirects
    go('public/survey-intent.html'); pg.wait_for_timeout(500); ok('T13a legacy public page redirects to runner','run.html' in pg.url,pg.url)
    go('admin/customer-dashboard.html'); pg.wait_for_timeout(400); ok('T13b customer-dashboard redirects','dashboard.html' in pg.url,pg.url)
    # T15 demo banner
    go('admin/analytics.html'); ok('T15 demo-data banner shown','Sample data' in pg.inner_text('main'))
    # T16 menu entries
    go('admin/dashboard.html'); side=pg.inner_text('.sidebar'); ok('T16 sidebar has Segments, Templates, Architecture, Question Bank, Insights',all(x in side for x in ['Segments','Templates','Architecture','Question Bank','Insights']),side[:300])
    # T17 regression: new survey -> publish -> run -> counted, not demo
    nid=pg.evaluate("""(()=>{const id=ZKData.createSurvey('Reg flow','blank');const d=ZKData.getDef(id);d.questions.push({id:'rq1',text:'Pick one',type:'Single Choice',sectionId:d.sections[0].id,required:true,help:'',options:[{id:'o1',text:'A'},{id:'o2',text:'B'}]});d.publish={status:'Published',slug:'reg-flow',publishedAt:Date.now(),validatedAt:Date.now()};ZKData.saveDef(id,d);return id})()""")
    go('public/run.html?s=reg-flow'); startgo(pg); pg.click('#zkAns .zk-opt'); pg.click('#zkNext'); pg.wait_for_timeout(300)
    pg.query_selector('#zkNext') and pg.click('#zkNext'); pg.wait_for_timeout(300)
    rr=ctx.request.get(B+'api/workspace').json()['responses'].get(nid,[]); ok('T17 user survey response counted, no demo flag',len(rr)==1 and not rr[0].get('demo'),rr)
    # T18 page audit
    pages=sorted(glob.glob(root+'/admin/*.html'))+[root+'/index.html']
    urls=['admin/'+os.path.basename(x) for x in pages if '/admin/' in x and os.path.basename(x) not in ('login.html',)]+['index.html','pricing.html','register.html','login.html','legal.html','public/run.html?s=coimbatore-dishwash-research','public/run.html?s=milro-dishwash-prelaunch']
    bad=[]
    for u in urls:
        for w,h in [(1360,900),(768,900),(390,800)]:
            pg.set_viewport_size({'width':w,'height':h}); pg.goto(B+u); pg.wait_for_timeout(450)
            if 'customer-dashboard' in u or 'survey-preview' in u: continue
            wh=pg.evaluate(WHITE_JS); ov=pg.evaluate("document.documentElement.scrollWidth-window.innerWidth")
            if wh: bad.append((u,w,'white',wh))
            if ov>2: bad.append((u,w,'overflow',ov))
            if shots and w in (390,1360) and ('segments' in u or 'architecture' in u or 'campaign-builder' in u or 'insights' in u or 'questions' in u or 'settings' in u or 'templates' in u or 'campaigns.html' in u or 'run.html?s=coim' in u):
                pg.screenshot(path=f"{shots}/{u.replace('/','_').split('?')[0]}_{w}.png",full_page=False)
    ok('T18 no white backgrounds / horizontal overflow on '+str(len(urls))+' pages × 3 widths',not bad,bad[:8])
    ok('T19 no console/page errors across the run',not errs,errs[:6])
    b.close()
finally: srv.kill()
f=[r for r in res if not r[1]]; print('\n%d/%d passed'%(len(res)-len(f),len(res)))
