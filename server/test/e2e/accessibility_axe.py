# Run from the project root: npm i --no-save axe-core; python3 -I server/test/e2e/accessibility_axe.py "$PWD"   (needs playwright and a local PostgreSQL database zksurvey_e2e owned by role zk)
import subprocess,time,os,json,sys,glob
from playwright.sync_api import sync_playwright
import urllib.request
root='/home/claude/zksurvey_build/ZKSurvey_v13_Phase7_Node_Postgres'

PORT=3302; B=f'http://localhost:{PORT}/'
env=dict(os.environ,PORT=str(PORT),DATABASE_URL='postgres://zk:zk@localhost:5432/zksurvey_e2e',SUPER_EMAIL='root@zksurvey.test',SUPER_PASSWORD='RootPass123',NODE_ENV='development',APP_URL=B.rstrip('/'))
subprocess.run(['psql','postgres://zk:zk@localhost:5432/zksurvey_e2e','-qc','drop schema public cascade; create schema public;'],capture_output=True)
srv=subprocess.Popen(['node','server/src/index.js'],cwd=root,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
for i in range(40):
    try: urllib.request.urlopen(B+'healthz',timeout=1); break
    except Exception: time.sleep(0.3)

axe=open('node_modules/axe-core/axe.min.js').read()
try:
  with sync_playwright() as p:
    b=p.chromium.launch();pg=b.new_page(viewport={'width':1360,'height':900})
    
    pg.goto(B+'login.html');pg.fill('#e','root@zksurvey.test');pg.fill('#p','RootPass123');pg.click('button[type=submit]');pg.wait_for_timeout(700)
    pages=['index.html','pricing.html','register.html','login.html','legal.html','forgot.html','reset.html','verify.html','support.html']+['admin/'+os.path.basename(x) for x in sorted(glob.glob(root+'/web/admin/*.html')) if not x.endswith('login.html')]+['public/run.html?s=milro-dishwash-prelaunch']
    agg={}
    for u in pages:
      pg.goto(B+u);pg.wait_for_timeout(500);pg.evaluate(axe)
      r=pg.evaluate("axe.run({runOnly:['wcag2a','wcag2aa']}).then(r=>r.violations.map(v=>({id:v.id,imp:v.impact,n:v.nodes.length,t:v.nodes.slice(0,2).map(n=>n.target.join(' '))})))")
      for v in r: agg.setdefault(v['id'],[]).append((u,v['imp'],v['n'],v['t']))
    for k,v in agg.items(): print(k,v[0][1],len(v),'pages;',v[0])
    print('done',len(pages))
finally: srv.terminate()
