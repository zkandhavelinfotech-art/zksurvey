/* ZKSurvey — Phase 5 functional layer
   Lightweight server-backed (ZKApi) CRUD + modal helpers shared by
   admin/surveys.html, admin/questions.html and admin/survey-builder.html.
   This keeps the prototype a static site (no backend) while making
   create / edit / delete actions actually persist in the browser,
   so reviewers can exercise real workflows instead of decorative buttons. */

const ZKStore = {
  get(key, fallback){ try{ const v = ZKApi.read(key, undefined); return v === undefined ? fallback : v; }catch(e){ return fallback; } },
  set(key, val){ ZKApi.write(key, val); },
  remove(key){ ZKApi.remove(key); },
  uid(prefix){ return (prefix||'id')+'_'+Math.random().toString(36).slice(2,9); }
};

function zkModal(title, bodyHtml, onSave, saveLabel){
  zkModalClose();
  const wrap = document.createElement('div');
  wrap.className = 'zk-modal-overlay';
  wrap.id = 'zkModalOverlay';
  wrap.innerHTML =
    '<div class="zk-modal">' +
      '<div class="zk-row" style="margin-bottom:16px"><h3>' + title + '</h3><button type="button" class="zk-modal-close" data-close>\u2715</button></div>' +
      '<div id="zkModalBody">' + bodyHtml + '</div>' +
      '<div class="zk-modal-actions"><button type="button" class="btn btn-outline" data-close>Cancel</button><button type="button" class="btn btn-primary" id="zkModalSave">' + (saveLabel||'Save') + '</button></div>' +
    '</div>';
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-close]').forEach(function(b){ b.addEventListener('click', zkModalClose); });
  wrap.addEventListener('click', function(e){ if(e.target===wrap) zkModalClose(); });
  document.getElementById('zkModalSave').addEventListener('click', function(){
    if(onSave(wrap) !== false) zkModalClose();
  });
}
function zkModalClose(){ const m=document.getElementById('zkModalOverlay'); if(m) m.remove(); }
function zkConfirm(msg, cb){ if(window.confirm(msg)) cb(); }

/* Parses an uploaded .xlsx/.xls/.csv file of questions into a plain array.
   Expected columns (any case, order-independent): Section, Question, Type, Options, Required
   Options column: pipe-separated, e.g. "Poor grease removal|Dries hands|Too expensive" */
function zkParseQuestionFile(file, onRows){
  const isCsv = /\.csv$/i.test(file.name);
  const reader = new FileReader();
  reader.onload = function(e){
    let rows = [];
    try{
      if(isCsv){
        rows = zkParseCsv(e.target.result);
      } else if(window.XLSX){
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(sheet, {defval:''});
      } else {
        toast('Excel engine unavailable — try a .csv file instead.');
        return;
      }
    }catch(err){
      toast('Could not read that file. Please check the format and try again.');
      return;
    }
    onRows(rows);
  };
  if(isCsv) reader.readAsText(file); else reader.readAsArrayBuffer(file);
}
function zkParseCsv(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim().length);
  if(!lines.length) return [];
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(function(line){
    const cells = line.split(',');
    const row = {};
    headers.forEach(function(h,i){ row[h] = (cells[i]||'').trim(); });
    return row;
  });
}
function zkDownloadCsvTemplate(){
  const csv = 'Section,Question,Type,Options,Required\n'
    + 'Pain Points,What is the biggest problem with your current product?,Multiple Choice,Poor grease removal|Dries hands|Too expensive|Strong fragrance,Y\n'
    + 'Purchase Intent,How likely are you to purchase after seeing product proof?,Scale / Likert,,Y\n';
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zksurvey-question-import-template.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

/* ---- v12: shared "new survey from template" form (templates page, surveys page, builder, onboarding) ---- */
function zkTplFieldsHtml(id){
  const f=(i,l,ph,ta)=>'<label class="zk-label" for="'+i+'">'+l+'</label>'+(ta?'<textarea class="zk-textarea" rows="3" id="'+i+'" placeholder="'+ph+'"></textarea>':'<input class="zk-input" id="'+i+'" placeholder="'+ph+'">');
  let h=f('tf_prod','Product or service name','e.g. GlowFresh Face Wash');
  if(id==='category') h+=f('tf_cat','Product category *','e.g. face wash, dishwash liquid')+f('tf_mk','Market or city','e.g. Coimbatore')+f('tf_con','Your product in one sentence (shown near the end of the survey)','e.g. A gentle neem face wash for oily skin');
  if(id==='launch') h+=f('tf_con','Your product in one sentence *','e.g. A gentle neem face wash for oily skin');
  if(id==='poll') h+=f('tf_pq','Poll question *','e.g. Which flavour should we launch first?')+f('tf_po','Options, one per line (2–4) *','Mango\nGuava',true);
  return h;
}
function zkTplOpts(id){
  const v=i=>{ const e=document.getElementById(i); return e?e.value.trim():''; };
  const o={product:v('tf_prod')}; const a=(typeof ZKAuth!=='undefined')?ZKAuth.current():null; if(a) o.company=a.company;
  if(id==='category'){ o.category=v('tf_cat'); o.market=v('tf_mk'); o.concept=v('tf_con'); if(!o.category) return {error:'Enter the product category.'}; }
  if(id==='launch'){ o.concept=v('tf_con'); if(!o.concept) return {error:'Describe your product in one sentence.'}; }
  if(id==='poll'){ o.pollQuestion=v('tf_pq'); o.pollOptions=v('tf_po').split('\n').map(x=>x.trim()).filter(Boolean).slice(0,4); if(!o.pollQuestion) return {error:'Enter the poll question.'}; if(o.pollOptions.length<2) return {error:'Enter at least 2 poll options.'}; }
  return o;
}
function zkCreateSurveyModal(tplId, onDone){
  const T=ZKData.TEMPLATES.filter(t=>!(t.sample && typeof ZKAuth!=='undefined' && ZKAuth.isCustomerNs()));
  tplId = tplId && T.some(t=>t.id===tplId) ? tplId : T[0].id;
  const body='<label class="zk-label" style="margin-top:0" for="cs_t">Survey title *</label><input class="zk-input" id="cs_t" placeholder="e.g. Customer research — Q4">'
    +'<label class="zk-label" for="cs_tpl">Start from</label><select class="zk-select" id="cs_tpl">'+T.map(t=>'<option value="'+t.id+'"'+(t.id===tplId?' selected':'')+'>'+t.name+'</option>').join('')+'</select><div id="cs_f"></div>';
  zkModal('Create a new survey', body, function(){
    const id=document.getElementById('cs_tpl').value, title=document.getElementById('cs_t').value.trim();
    const o=zkTplOpts(id); if(o.error){ toast(o.error); return false; }
    const TP=ZKData.TEMPLATES.find(x=>x.id===id); const t=title||(TP.sample?TP.name.replace(/^Sample: /,''):TP.make('',o).details.title);
    const nid=ZKData.createSurvey(t,id,o); if(!nid){ toast(ZKData.lastError()); return false; }
    onDone(nid);
  }, 'Create draft');
  const fill=()=>{ document.getElementById('cs_f').innerHTML=zkTplFieldsHtml(document.getElementById('cs_tpl').value); };
  document.getElementById('cs_tpl').onchange=fill; fill();
}
