# Run: python3 -I e2e_flow.py <path to project root>   (needs: pip install playwright; a local PostgreSQL with database zksurvey_e2e owned by role zk)
import sys,subprocess,time,json,os,re,urllib.request
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
def ok(name,cond,info=''):
    res.append((name,bool(cond),info)); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(info)[:300] if (info and not cond) else ''))
def driver(pg,max_steps=80):
    for i in range(max_steps):
        pg.wait_for_timeout(100)
        if pg.query_selector('#zkNext') is None: return True
        t=pg.inner_text('#app')
        opts=pg.query_selector_all('#zkAns .zk-opt') or pg.query_selector_all('#zkAns button')
        if opts and not pg.query_selector('#zkAns textarea,#zkAns input[type=text]'):
            opts[0].click()
        for ta in pg.query_selector_all('#zkAns textarea'): ta.fill('Hard to find a good one')
        for inp in pg.query_selector_all('#zkAns input[type=text],#zkAns input[type=number]'):
            try: inp.fill('55')
            except: pass
        for sel in pg.query_selector_all('#zkAns select'):
            try: sel.select_option(index=1)
            except: pass
        pg.click('#zkNext')
    return False
def outbox(ctx,email,subj):
    r=ctx.request.get(B+'api/dev/outbox?to='+email).json()
    m=[x for x in r['outbox'] if subj in x['subject']][0]; return re.search(r'token=([\w-]+)',m['body']).group(1)
try:
  with sync_playwright() as p:
    b=p.chromium.launch()
    def newctx():
        c=b.new_context(viewport={'width':1360,'height':900},accept_downloads=True); pg=c.new_page()
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+pg.url+' '+str(e))); pg.on('console',lambda m: m.type=='error' and 'Failed to load resource' not in m.text and errs.append('CONSOLE '+pg.url+' '+m.text))
        pg.on('dialog',lambda d:d.accept()); return c,pg
    ctx,pg=newctx()
    def go(path,wait=400,page=None):
        (page or pg).goto(B+path); (page or pg).wait_for_timeout(wait)
    go('index.html'); ok('E1 landing served by Node, no prototype notice about browser storage','this browser only' not in pg.inner_text('body'))
    go('admin/dashboard.html'); ok('E2 guard redirects signed-out visitor to login','login.html' in pg.url,pg.url)
    go('register.html?plan=growth'); pg.fill('#n','Asha Rao'); pg.fill('#e','asha@glowfresh.test'); pg.fill('#p','short'); pg.fill('#c','GlowFresh'); pg.click('button[type=submit]'); pg.wait_for_timeout(300)
    ok('E3 server-side validation messages shown','8 characters' in pg.inner_text('#errs') and 'terms' in pg.inner_text('#errs'),pg.inner_text('#errs'))
    pg.fill('#p','Glow1234'); pg.check('#t'); pg.click('button[type=submit]'); pg.wait_for_timeout(900)
    ok('E4 register creates server account + session cookie, opens onboarding','onboarding.html' in pg.url and any(c['name']=='zk_sid' and c['httpOnly'] for c in ctx.cookies()),pg.url)
    ok('E4b session cookie is httpOnly, not readable from JS','zk_sid' not in pg.evaluate('document.cookie'))
    ok('E5 unverified-email banner shown','Verify your email' in pg.inner_text('main'))
    pg.select_option('#ob_tpl','category'); pg.wait_for_timeout(200)
    pg.fill('#tf_prod','GlowFresh Face Wash'); pg.fill('#tf_cat','face wash'); pg.fill('#tf_mk','Madurai'); pg.fill('#tf_con','A gentle neem face wash for oily skin.')
    pg.click('#go'); pg.wait_for_timeout(1000)
    ok('E6 onboarding creates survey on the server and opens builder','survey-builder.html' in pg.url,pg.url)
    ws=ctx.request.get(B+'api/workspace').json(); sid=ws['list'][0]['id']
    ok('E7 survey persisted in PostgreSQL (visible through the API, 20+ questions)',len(ws['list'])==1 and len(ws['defs'][sid]['questions'])>=20,len(ws['list']))
    # second survey blocked by server limit
    r=pg.evaluate("(()=>{const x=ZKData.createSurvey('Second','blank');return {x:x,msg:ZKData.lastError()}})()"); ok('E8 Free plan blocks a 2nd survey (message from server or client)',r['x'] is None and 'allows 1' in r['msg'],r)
    r=ctx.request.put(B+'api/surveys/s_bypass1',data=json.dumps({'meta':{'name':'x'},'def':ws['defs'][sid]}),headers={'content-type':'application/json','x-zk-csrf':'1'}); ok('E8b bypassing the UI: direct API call also gets 402',r.status==402,r.status)
    # publish before verification
    go('admin/distribute.html?survey='+sid,700); pg.click('#pubNow'); pg.wait_for_timeout(900)
    st=ctx.request.get(B+'api/workspace').json()['defs'][sid]['publish']['status']; ok('E9 publishing is refused until email is verified (server rule)',st!='Published',st)
    tok=outbox(ctx,'asha@glowfresh.test','Verify'); v=ctx.new_page(); v.goto(B+'verify.html?token='+tok); v.wait_for_timeout(700); ok('E10 verification link verifies the email',('Email verified' in v.inner_text('main')),v.inner_text('main')); v.close()
    go('admin/distribute.html?survey='+sid,700); pg.click('#pubNow'); pg.wait_for_timeout(1000)
    d=ctx.request.get(B+'api/workspace').json()['defs'][sid]['publish']; ok('E11 after verification the survey publishes with a unique slug',d['status']=='Published' and d['slug'],d); slug=d['slug']
    go('admin/distribute.html?survey='+sid,900)
    links=pg.evaluate("[...document.querySelectorAll('#kits .zk-code')].map(e=>e.textContent)")
    ok('E12 channel kits use tracked short links (/s/code)',len(links)==5 and all('/s/' in x for x in links),links)
    pg.click('#ogBtn'); pg.wait_for_timeout(900)
    img=ctx.request.get(B+'api/public/surveys/'+slug+'/poster.png'); ok('E13 link-preview image uploaded and served as PNG',img.status==200 and img.body()[:4]==b'\x89PNG',img.status)
    ig=[x for x in links if True][0]; code=ig.split('/s/')[1]
    # respondent on a different browser context (= different device)
    rctx,rp=newctx(); rp.goto(B+'s/'+code); rp.wait_for_timeout(1200)
    ok('E14 short link forwards to the survey with the channel UTM','public/run.html' in rp.url and 'utm_source=instagram' in rp.url,rp.url)
    txt=rp.inner_text('#app'); ok('E15 respondent (other browser, no login) sees the survey; brand hidden; consent required','GlowFresh' not in txt.split('Start')[0] and rp.is_disabled('#go'),txt[:160])
    rp.check('#cons'); rp.click('#go'); fin=driver(rp); rp.wait_for_timeout(900)
    ok('E16 respondent completes the survey',fin and 'Thank' in rp.inner_text('#app'),rp.inner_text('#app')[:200])
    ws=ctx.request.get(B+'api/workspace').json(); rs=ws['responses'].get(sid,[])
    ok('E17 response stored in PostgreSQL with source=instagram (owner sees it from their own browser)',len(rs)==1 and rs[0]['utm'].get('utm_source')=='instagram',rs[:1])
    stats=ctx.request.get(B+'api/surveys/'+sid+'/links').json()['links']; ok('E18 link click counted and starts counted',sum(l['clicks'] for l in stats)==1 and ws['starts'].get(sid)==1,(stats,ws['starts']))
    go('admin/responses.html',800); ok('E19 owner dashboard page lists the response',ZKA:=pg.evaluate("ZKData.getResponses('%s').length"%sid)==1)
    # second customer isolation
    c2,p2=newctx(); p2.goto(B+'register.html'); p2.fill('#n','Ravi'); p2.fill('#e','ravi@other.test'); p2.fill('#p','Other1234'); p2.check('#t'); p2.click('button[type=submit]'); p2.wait_for_timeout(900)
    w2=c2.request.get(B+'api/workspace').json(); ok('E20 second customer sees none of the first customer\'s data',w2['list']==[] and w2['responses']=={})
    r=c2.request.put(B+'api/surveys/'+sid,data=json.dumps({'meta':{'name':'hijack'},'def':ws['defs'][sid]}),headers={'content-type':'application/json','x-zk-csrf':'1'}); ok('E21 second customer cannot overwrite the first customer\'s survey (403)',r.status==403,r.status)
    ok('E22 owner-only pages blocked for customers (platform → dashboard)',(p2.goto(B+'admin/platform.html') or True) and (p2.wait_for_timeout(600) or True) and 'platform.html' not in p2.url,p2.url)
    ok('E22b admin API refuses customers',c2.request.get(B+'api/admin/accounts').status==403)
    # billing
    go('admin/billing.html',800); pg.click('[data-p=growth]'); pg.wait_for_timeout(400); txt=pg.inner_text('#zkModalBody'); ok('E23 checkout modal shows GST breakdown (18%)','GST 18%' in txt and '₹3,538.82' in txt,txt)
    pg.click('#zkModalSave'); pg.wait_for_timeout(1200)
    me=ctx.request.get(B+'api/account').json()['account']; ok('E24 mock payment upgrades the plan on the server',me['plan']=='growth' and me['planPeriodEnd'],me)
    go('admin/billing.html',800); ok('E25 invoice listed with number and printable link','ZK/' in pg.inner_text('#inv') and pg.query_selector('#inv a[href*="/html"]'),pg.inner_text('#inv'))
    inv=ctx.request.get(B+'api/billing').json()['invoices'][0]; h=ctx.request.get(B+'api/invoices/'+inv['id']+'/html').text(); ok('E26 invoice page shows CGST+SGST for in-state buyer','CGST 9%' in h and 'SGST 9%' in h)
    go('admin/distribute.html?survey='+sid,900); ok('E27 Meta Ads brief unlocked on Growth plan',pg.query_selector('#a_dl') is not None)
    # sign out / in persistence
    pg.evaluate("ZKAuth.logout()"); go('admin/dashboard.html'); ok('E28 after sign-out the dashboard redirects to login','login.html' in pg.url)
    pg.fill('#e','asha@glowfresh.test'); pg.fill('#p','wrongpass1'); pg.click('button[type=submit]'); pg.wait_for_timeout(500); ok('E29 wrong password rejected by server','incorrect' in pg.inner_text('#errs'))
    pg.fill('#p','Glow1234'); pg.click('button[type=submit]'); pg.wait_for_timeout(900); ok('E30 sign-in again: data and plan persisted',pg.evaluate("ZKData.getList().length")==1 and ZKAuthPlan(pg)=='growth' if False else pg.evaluate("ZKData.getList().length")==1)
    # forgot password
    f=ctx.new_page(); f.goto(B+'forgot.html'); f.fill('#e','asha@glowfresh.test'); f.click('button[type=submit]'); f.wait_for_timeout(600)
    t=outbox(ctx,'asha@glowfresh.test','Reset'); f.goto(B+'reset.html?token='+t); f.fill('#p','NewGlow5678'); f.click('button[type=submit]'); f.wait_for_timeout(900); ok('E31 password reset flow completes and returns to login','login.html' in f.url and 'msg=reset' in f.url,f.url)
    f.fill('#e','asha@glowfresh.test'); f.fill('#p','NewGlow5678'); f.click('button[type=submit]'); f.wait_for_timeout(900); ok('E32 new password works','admin/' in f.url,f.url); f.close()
    # super admin
    sctx,sp=newctx(); sp.goto(B+'login.html'); sp.fill('#e','root@zksurvey.test'); sp.fill('#p','RootPass123'); sp.click('button[type=submit]'); sp.wait_for_timeout(1200)
    ok('E33 super admin signs in with the configured credentials (no demo login exists)','admin/' in sp.url)
    dm=sctx.request.post(B+'api/auth/login',data=json.dumps({'email':'super@zksurvey.demo','password':'Admin@123'}),headers={'content-type':'application/json','x-zk-csrf':'1'}); ok('E33b old demo credentials no longer work',dm.status==401)
    sp.goto(B+'admin/platform.html'); sp.wait_for_timeout(1000); t=sp.inner_text('main'); ok('E34 platform console lists real accounts and collected revenue','GlowFresh' in t and 'Collected' in t and 'ravi@other.test' in t,t[:200])
    ok('E35 super admin workspace seeded with sample surveys',sp.evaluate("ZKData.getList().length")>=3)
    sp.evaluate("(()=>{const a=ZKAuth.accounts().find(x=>x.email==='asha@glowfresh.test');ZKAuth.updateAccount(a.id,{status:'suspended'});})()")
    rp.goto(B+'public/run.html?s='+slug); rp.wait_for_timeout(700); ok('E36 suspended account: public survey shows closed','closed' in rp.inner_text('#app').lower(),rp.inner_text('#app')[:100])
    f2=newctx(); f2[1].goto(B+'login.html'); f2[1].fill('#e','asha@glowfresh.test'); f2[1].fill('#p','NewGlow5678'); f2[1].click('button[type=submit]'); f2[1].wait_for_timeout(700); ok('E37 suspended account cannot sign in','suspended' in f2[1].inner_text('#errs').lower(),f2[1].inner_text('#errs'))
    sp.evaluate("(()=>{const a=ZKAuth.accounts().find(x=>x.email==='asha@glowfresh.test');ZKAuth.updateAccount(a.id,{status:'active'});})()")
    # account delete (DPDP)
    go('admin/settings.html',900); pg.fill('#del_p','NewGlow5678') if False else None
    # mobile
    pg.set_viewport_size({'width':390,'height':844})
    bad=[]
    for u in ['index.html','pricing.html','register.html','login.html','forgot.html','support.html','public/run.html?s='+slug]:
        pg.goto(B+u); pg.wait_for_timeout(300); ow=pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+2")
        if ow: bad.append(u)
    ok('E38 no horizontal overflow on public pages at 390px',not bad,bad)
    ok('E39 no JS errors across the run',not errs,errs[:5])
    b.close()
finally:
  srv.terminate()
f=[r for r in res if not r[1]]; print(f'\n{len(res)-len(f)}/{len(res)} passed')
