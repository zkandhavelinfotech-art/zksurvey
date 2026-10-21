/* ZKSurvey — shared data layer for Surveys, Survey Builder and the public runner.
   v13 (Phase 7): storage is the Node.js / PostgreSQL API behind ZKApi (see js/auth.js); plan limits, ownership,
   slug uniqueness and publishing are enforced by the server — the checks here are only faster feedback. */
const ZKData = (function(){
  const LIST_KEY='zk_surveys_v7', DEF_KEY='zk_defs_v7', RESP_KEY='zk_responses_v7';
  const uid = ZKStore.uid;
  const CHOICE = ['Single Choice','Multiple Choice','Dropdown','Image Choice','Ranking'];
  const SCALE = ['Rating','Star Rating','Scale / Likert'];
  const TYPES = ['Single Choice','Multiple Choice','Dropdown','Text','Long Text','Number','Rating','Star Rating','Scale / Likert','Yes / No','Date','Image Choice','Ranking','Price / Currency','Phone','Email','Location','Lead Capture','Consent'];
  const OPS = [['equals','equals'],['not_equals','does not equal'],['contains','contains'],['not_contains','does not contain'],['answered','is answered'],['not_answered','is not answered'],['gt','is greater than'],['lt','is less than']];
  const ACTIONS = [['show','Show question'],['hide','Hide question'],['skipSection','Skip section'],['end','End survey'],['redirect','Redirect to URL']];
  const STATUSES = ['Draft','Published','Unpublished','Archived'];
  const START_KEY='zk_starts_v7', LEAD_KEY='zk_lead_status_v7', SEED_FLAG='zk_seed_done_v7';
  const LEAD_STATUSES=['New','Interested','Qualified','Contacted','Converted'];
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const slugify = s => String(s||'survey').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50) || 'survey';

  /* ---------- seeds ---------- */
  function O(list){ return (list||[]).map(t=>({id:uid('o'), text:t})); }
  function Q(sec, text, type, req, opts, extra){ return Object.assign({id:uid('q'), text:text, type:type, sectionId:sec.id, required:!!req, help:'', options:O(opts)}, extra||{}); }
  function S(name){ return {id:uid('sec'), name:name}; }

  function blankDef(title){
    const s = S('General');
    return {details:{title:title||'Untitled survey', type:'Market Research', industry:'Other', customer:'', product:'', description:'', language:'English', time:'2–4 minutes', leadCapture:'Optional at end', projectId:'', thanks:'Thank you for your time — your answers help us build something better.'},
      sections:[s], questions:[], rules:[], publish:{status:'Draft', slug:'', publishedAt:null, validatedAt:null}};
  }
  function milroDef(){
    const s = ['Consumer Profile','Current Dishwash Behaviour','Current Brand & Product','Pain Points','Milro Product Concept','Price & Pack Size','Marketing Message','Content Preference','Purchase Intent','Optional Lead Capture'].map(S);
    const use = Q(s[1],'Which dishwash product do you use most often?','Single Choice',true,['Dishwash Liquid','Dishwash Bar','Powder','More than one type','Other']);
    const pain = Q(s[3],'What is the biggest problem with your current product?','Multiple Choice',true,['Poor grease removal','Dries hands','Too expensive','Strong fragrance','Wastes too much liquid']);
    const bar = Q(s[3],'What do you dislike about dishwash bars?','Multiple Choice',false,['Melts quickly','Leaves residue','Hard to hold','Not enough foam']);
    const pc = Q(s[5],'Is price an important concern when you choose a dishwash product?','Yes / No',true,[]);
    const ps = Q(s[5],'What price feels reasonable for a 500 ml pack?','Price / Currency',true,[]);
    const intent = Q(s[8],'How likely are you to buy Milro Dishwash after seeing product proof?','Single Choice',true,['Definitely','Probably','Not sure','Definitely not']);
    const lead = Q(s[9],'Want launch updates and an early-bird offer? Share your details.','Lead Capture',false,[]);
    const qs = [
      Q(s[0],'Which age group are you in?','Single Choice',true,['Under 25','25–34','35–44','45 and above']),
      Q(s[0],'Which city do you live in?','Location',false,[]), use,
      Q(s[2],'Which brand do you use today?','Text',false,[]), pain, bar,
      Q(s[4],'How appealing is "Less Liquid. More Cleaning Power."?','Scale / Likert',true,[],{scaleMax:5}),
      pc, ps,
      Q(s[5],'Which pack size would you buy first?','Single Choice',false,['250 ml','500 ml','1 litre','Refill pouch']),
      Q(s[6],'Which message appeals to you most?','Single Choice',true,['Powerful Grease Removal','Tough on Grease, Gentle on Hands','Less Liquid. More Cleaning Power.']),
      Q(s[7],'Where would you like to see product videos and offers?','Multiple Choice',false,['Instagram','YouTube','Facebook','WhatsApp','TV','In-store']),
      intent, lead];
    const R = (conds,action,target,logic)=>({id:uid('r'), logic:logic||'AND', conds:conds, action:action, target:target});
    const rules = [
      R([{qid:use.id,op:'equals',value:'Dishwash Bar'}],'show',bar.id),
      R([{qid:pc.id,op:'equals',value:'Yes'}],'show',ps.id),
      R([{qid:intent.id,op:'equals',value:'Definitely'},{qid:intent.id,op:'equals',value:'Probably'}],'show',lead.id,'OR'),
      R([{qid:intent.id,op:'equals',value:'Definitely not'}],'end','')];
    // "end" fires before the lead question is reached, so the survey stops after purchase intent.
    return {details:{title:'Milro Dishwash Pre-Launch Consumer Research', type:'Product Launch Research', industry:'FMCG', customer:'Milro', product:'Dishwash Liquid + Bar',
      description:'Understand consumer needs, product pain points, price expectations, messaging and purchase intent before launch.', language:'English', time:'5–7 minutes', leadCapture:'Optional at end', projectId:'proj_milro_dishwash',
      thanks:'Thank you for helping us shape the product. We will share the launch date with you soon.'},
      sections:s, questions:qs, rules:rules, publish:{status:'Published', slug:'milro-dishwash-prelaunch', publishedAt:Date.now(), validatedAt:Date.now()}};
  }
  function scriptcraftDef(){
    const s = ['Respondent Profile','Existing Software Experience','New / Alternative-Tool Users','Feature Priorities','Pricing Strategy','Issues & Feedback','Stay Updated'].map(S);
    const A='I already use dedicated screenwriting software (e.g. Final Draft, Celtx, WriterDuet)';
    const B='I write scripts using general tools (Word, Google Docs, pen & paper)';
    const C='I am new to screenwriting';
    const who = Q(s[0],'Which best describes you?','Single Choice',true,[A,B,C]);
    const wantUpdates = Q(s[6],'Would you like to be notified when Scriptcraft Pro launches?','Yes / No',false,[]);
    const lead = Q(s[6],'Share your details for launch updates.','Lead Capture',false,[]);
    const qs = [ who,
      Q(s[0],'What kind of writing do you do?','Multiple Choice',false,['Feature films','Short films','Web series / OTT','TV serials','Stage plays','Advertising / corporate films']),
      Q(s[1],'Which screenwriting software do you use today?','Text',true,[]),
      Q(s[1],'How satisfied are you with it?','Scale / Likert',true,[],{scaleMax:5}),
      Q(s[1],'What do you pay for it today, per month? (enter 0 if free or one-time)','Price / Currency',false,[]),
      Q(s[1],'What is the biggest issue you face with your current tool?','Multiple Choice',true,['Pricing is too high','Steep learning curve','Poor formatting or export quality','No real-time collaboration','No cloud sync / mobile access','Buggy or unstable','Lacks AI writing assistance','Other']),
      Q(s[2],'What do you use to write your scripts today?','Single Choice',true,['Microsoft Word','Google Docs','Pen & paper','Notes app','Other']),
      Q(s[2],'What stops you from using dedicated screenwriting software?','Multiple Choice',false,['Too expensive','Too complex to learn','Did not know one existed','Prefer free / general tools','Other']),
      Q(s[3],'Which features matter most to you?','Multiple Choice',true,['Industry-standard formatting','Cloud sync & mobile access','Real-time collaboration','AI writing assistance','PDF / Final Draft export','Offline access','Beat board & outlining tools','Revision / version history']),
      Q(s[4],'If core screenplay writing and formatting were completely free, which of these would you still expect to pay for?','Multiple Choice',true,['AI writing assistance','Real-time collaboration','Cloud backup & sync','Advanced export formats','Production / breakdown tools','None — I would expect everything free']),
      Q(s[4],'If this software had all the features you need, what is the maximum monthly subscription price you would realistically be willing to pay?','Price / Currency',true,[],{help:'Enter your own amount and currency, for example ₹500, $10 or €8. There are no price bands to pick from.'}),
      Q(s[4],'How would you prefer to pay?','Single Choice',false,['Monthly subscription','Yearly subscription (discounted)','One-time purchase','No preference']),
      Q(s[5],'What is your biggest frustration with screenwriting tools today?','Long Text',false,[]),
      wantUpdates, lead];
    const R = (conds,action,target,logic)=>({id:uid('r'), logic:logic||'AND', conds:conds, action:action, target:target});
    const rules = [
      R([{qid:who.id,op:'not_equals',value:A}],'skipSection',s[1].id),
      R([{qid:who.id,op:'equals',value:A}],'skipSection',s[2].id),
      R([{qid:wantUpdates.id,op:'equals',value:'Yes'}],'show',lead.id)];
    return {details:{title:'Scriptcraft Pro — Pre-Launch Survey', type:'Product Launch Research', industry:'SaaS / Technology', customer:'Scriptcraft Pro', product:'Screenwriting software',
      description:'Understand how writers work today, what frustrates them, which features matter and what they would realistically pay before Scriptcraft Pro launches.', language:'English', time:'5–7 minutes', leadCapture:'Optional at end', projectId:'proj_scriptcraft_prelaunch',
      thanks:'Thank you! Your answers directly shape Scriptcraft Pro. We will notify you at launch if you asked us to.'},
      sections:s, questions:qs, rules:rules, publish:{status:'Draft', slug:'', publishedAt:null, validatedAt:null}};
  }
  /* ---------- v11: Coimbatore category research, NPS and event templates ---------- */
  function coimbatoreDef(){
    const s = ['Household profile','Current behaviour','Pain points','Switching behaviour','New-product acceptance','Purchase channels','Concept reaction','Stay in touch'].map(S);
    const R = (conds,action,target,logic)=>({id:uid('r'), logic:logic||'AND', conds:conds, action:action, target:target});
    const use = Q(s[1],'Which product do you mainly use to wash utensils at home?','Single Choice',true,['Dishwash liquid','Dishwash bar','Powder','Traditional (ash / coconut husk / soap nut)','More than one']);
    const pain1 = Q(s[2],'In your own words, what is the most difficult part of washing utensils at home?','Long Text',false,[]);
    const pain = Q(s[2],'Which of these have you faced with the product you use now?','Multiple Choice',true,['Poor grease removal','Dries or irritates hands','Too expensive','Strong fragrance','Gets used up too quickly','Leaves residue','None of these'],{randomise:true});
    const bar = Q(s[2],'What do you dislike about dishwash bars?','Multiple Choice',false,['Melts quickly','Leaves residue','Hard to hold','Not enough foam','Nothing in particular'],{randomise:true});
    const rank = Q(s[2],'Rank what matters most in a dishwash product (1 = most important)','Ranking',true,['Cleaning power','Quantity / value for money','Fragrance','Gentle on hands','Price'],{randomise:true});
    const sw = Q(s[3],'Have you changed your dishwash product in the last 12 months?','Yes / No',true,[]);
    const swWhy = Q(s[3],'What made you change?','Multiple Choice',false,['Price increase','Not cleaning well','Hand irritation','Friend / family recommendation','Offer or discount','Product not available','Saw an advertisement'],{randomise:true});
    const open = Q(s[3],'How open are you to trying a new dishwash brand?','Single Choice',true,['Very open','Somewhat open','Not open'] );
    const tryNew = Q(s[4],'Would you try a new local liquid dishwash brand?','Single Choice',true,['Definitely','Probably','Not sure','Definitely not']);
    const tryWhy = Q(s[4],'What would make you try it?','Multiple Choice',false,['Lower price','Better grease removal','Gentle on hands','Free / trial pack','Friend\'s recommendation','Discount offer','Pleasant fragrance'],{randomise:true});
    const trial = Q(s[4],'Would you take a small trial pack?','Yes / No',true,[]);
    const lead = Q(s[7],'Want a trial pack and launch updates? Share your details.','Lead Capture',false,[]);
    const qs = [
      Q(s[0],'Which age group are you in?','Single Choice',true,['Under 25','25–34','35–44','45 and above']),
      Q(s[0],'How many people live in your household?','Single Choice',true,['1–2','3–4','5–6','7 or more']),
      Q(s[0],'Who mostly washes the utensils?','Single Choice',false,['I do','A family member','Domestic help','Shared'] ),
      Q(s[0],'Which part of Coimbatore do you live in?','Dropdown',false,['RS Puram','Gandhipuram','Peelamedu','Saravanampatti','Singanallur','Vadavalli','Ganapathy','Podanur','Other']),
      use,
      Q(s[1],'Which brand do you use today?','Text',false,[]),
      Q(s[1],'What do you like most about the product you use now?','Long Text',false,[]),
      Q(s[1],'About how much do you spend on dishwash products each month?','Single Choice',true,['Under ₹50','₹50–100','₹100–200','Above ₹200']),
      Q(s[1],'Do you compare prices before you buy?','Yes / No',true,[]),
      pain1, pain, bar, rank,
      Q(s[2],'How important is removing grease and oil for you?','Scale / Likert',true,[],{scaleMax:5}),
      Q(s[2],'Does your current product get used up faster than you expect?','Yes / No',false,[]),
      sw, swWhy, open, tryNew, tryWhy,
      Q(s[4],'Which format would you prefer?','Single Choice',false,['Liquid','Bar','Powder','No preference']),
      Q(s[4],'Which pack size would you buy first?','Single Choice',false,['250 ml','500 ml','1 litre','Refill pouch']),
      Q(s[4],'What price feels reasonable for a 500 ml pack?','Price / Currency',true,[]),
      trial,
      Q(s[5],'Where do you usually buy dishwash products?','Multiple Choice',true,['Nearby supermarket','Kirana / provision store','E-commerce app','Quick-commerce app','WhatsApp order','Wholesale / monthly stock-up'],{randomise:true}),
      Q(s[5],'Where would you prefer to buy a new brand?','Multiple Choice',true,['WhatsApp ordering','E-commerce','Nearby supermarket'],{randomise:true}),
      Q(s[5],'If you liked a new product, would you recommend it to neighbours or friends?','Single Choice',false,['Definitely','Maybe','No']),
      Q(s[6],'Concept: a liquid dishwash that needs less liquid per wash to remove grease. How appealing is this to you?','Scale / Likert',true,[],{scaleMax:5}),
      Q(s[6],'Which message would make you most likely to look at a new product?','Single Choice',true,['Powerful grease removal','Tough on grease, gentle on hands','Less liquid, more cleaning power']),
      lead];
    const rules = [
      R([{qid:use.id,op:'equals',value:'Dishwash bar'}],'show',bar.id),
      R([{qid:sw.id,op:'equals',value:'Yes'}],'show',swWhy.id),
      R([{qid:tryNew.id,op:'equals',value:'Definitely'},{qid:tryNew.id,op:'equals',value:'Probably'},{qid:tryNew.id,op:'equals',value:'Not sure'}],'show',tryWhy.id,'OR'),
      R([{qid:trial.id,op:'equals',value:'Yes'}],'show',lead.id)];
    const find = t => qs.find(q=>q.text.indexOf(t)===0).id;
    const seg = (name,desc,logic,conds)=>({id:uid('seg'),name:name,desc:desc,logic:logic,conds:conds});
    const segments = [
      seg('A · Existing liquid users','Already use dishwash liquid — the switching target.','AND',[{qid:use.id,op:'equals',value:'Dishwash liquid'}]),
      seg('B · Dishwash-bar users','Use bars — the conversion target.','AND',[{qid:use.id,op:'equals',value:'Dishwash bar'}]),
      seg('C · Price-conscious families','Compare prices or call current product too expensive.','OR',[{qid:find('Do you compare prices'),op:'equals',value:'Yes'},{qid:pain.id,op:'contains',value:'Too expensive'}]),
      seg('D · Convenience-focused households','Prefer WhatsApp or e-commerce ordering.','OR',[{qid:find('Where would you prefer'),op:'contains',value:'WhatsApp'},{qid:find('Where would you prefer'),op:'contains',value:'E-commerce'}])];
    return {details:{title:'Coimbatore Dishwash Category Research', type:'Category Research', industry:'FMCG', customer:'Milro', product:'Dishwash Liquid',
      description:'A short household survey about everyday dishwashing in Coimbatore.', language:'English', time:'5–7 minutes', leadCapture:'Optional at end', projectId:'',
      intro:'We are researching everyday dishwashing problems faced by families in Coimbatore. We are not asking you to buy anything — we only want to understand your experience.',
      targetSample:300, consentText:'I agree to be contacted about a trial pack and launch updates. I can withdraw at any time.',
      thanks:'Thank you. Your answers help us understand what Coimbatore households really need.'},
      sections:s, questions:qs, rules:rules, segments:segments,
      publish:{status:'Published', slug:'coimbatore-dishwash-research', publishedAt:Date.now(), validatedAt:Date.now()}};
  }
  function npsDef(){
    const s=[S('Your score'),S('Why')]; const sc=Q(s[0],'How likely are you to recommend us to a friend or colleague? (0–10)','Scale / Likert',true,[],{scaleMax:10});
    return {details:{title:'Customer NPS Survey', type:'Customer Feedback', industry:'Other', customer:'', product:'', description:'A two-question Net Promoter Score survey.', language:'English', time:'2–4 minutes', leadCapture:'Disabled', projectId:'', thanks:'Thank you for your feedback.'},
      sections:s, questions:[sc, Q(s[1],'What is the main reason for your score?','Long Text',false,[]), Q(s[1],'What is one thing we could do better?','Long Text',false,[])], rules:[], segments:[], publish:{status:'Draft',slug:'',publishedAt:null,validatedAt:null}};
  }
  function eventDef(){
    const s=[S('Experience'),S('Improve')];
    return {details:{title:'Event Feedback Survey', type:'Event Feedback', industry:'Other', customer:'', product:'', description:'Collect feedback right after an event.', language:'English', time:'2–4 minutes', leadCapture:'Optional at end', projectId:'', thanks:'Thanks for coming — see you next time.'},
      sections:s, questions:[Q(s[0],'How would you rate the event overall?','Star Rating',true,[],{scaleMax:5}), Q(s[0],'Which sessions did you enjoy most?','Multiple Choice',false,['Keynote','Workshops','Networking','Food & venue']), Q(s[0],'Would you attend again?','Yes / No',true,[]), Q(s[1],'What should we improve?','Long Text',false,[]), Q(s[1],'Leave your email for the next event invite.','Lead Capture',false,[])],
      rules:[], segments:[], publish:{status:'Draft',slug:'',publishedAt:null,validatedAt:null}};
  }
  /* ---------- v12: generic templates for any product (used by B2C accounts) ---------- */
  function applyOpts(d,o){ o=o||{}; if(o.product) d.details.product=o.product; if(o.company) d.details.customer=o.company; if(o.description) d.details.description=o.description; if(o.market) d.details.market=o.market; return d; }
  function categoryDef(o){
    o=o||{}; const cat=o.category||'this kind of product', mk=o.market||'your city';
    const s=['Respondent profile','Current behaviour','Pain points','Switching behaviour','New-product acceptance','Purchase channels','Concept reaction','Stay in touch'].map(S);
    const R=(conds,action,target,logic)=>({id:uid('r'),logic:logic||'AND',conds:conds,action:action,target:target});
    const sw=Q(s[3],'Have you changed your '+cat+' brand in the last 12 months?','Yes / No',true,[]);
    const swWhy=Q(s[3],'What made you change?','Multiple Choice',false,['Price increase','Quality problem','Friend / family recommendation','Offer or discount','Product not available','Saw an advertisement'],{randomise:true});
    const tryNew=Q(s[4],'Would you try a new local '+cat+' brand?','Single Choice',true,['Definitely','Probably','Not sure','Definitely not']);
    const tryWhy=Q(s[4],'What would make you try it?','Multiple Choice',false,['Lower price','Better quality','Free / trial pack','Friend\'s recommendation','Discount offer','Better packaging'],{randomise:true});
    const trial=Q(s[4],'Would you take a small trial pack or sample?','Yes / No',true,[]);
    const lead=Q(s[7],'Want a sample and launch updates? Share your details.','Lead Capture',false,[]);
    const qs=[Q(s[0],'Which age group are you in?','Single Choice',true,['Under 25','25–34','35–44','45 and above']),
      Q(s[0],'Which part of '+mk+' do you live in?','Text',false,[]),
      Q(s[1],'Which brand of '+cat+' do you use today?','Text',false,[]),
      Q(s[1],'How often do you buy '+cat+'?','Single Choice',true,['Weekly','Monthly','Every few months','Rarely']),
      Q(s[1],'About how much do you spend on '+cat+' in a typical month?','Price / Currency',false,[]),
      Q(s[1],'What do you like most about what you use now?','Long Text',false,[]),
      Q(s[1],'Do you compare prices before you buy?','Yes / No',true,[]),
      Q(s[2],'In your own words, what is the most difficult part of choosing or using '+cat+'?','Long Text',false,[]),
      Q(s[2],'Which of these have you faced?','Multiple Choice',true,['Inconsistent quality','Too expensive','Hard to find','Poor packaging','Too few options','Not sure which brand to trust','None of these'],{randomise:true}),
      Q(s[2],'Rank what matters most when you choose (1 = most important)','Ranking',true,['Quality','Price','Brand trust','Availability','Packaging / design'],{randomise:true}),
      sw,swWhy,Q(s[3],'How open are you to trying a new brand?','Single Choice',true,['Very open','Somewhat open','Not open']),
      tryNew,tryWhy,Q(s[4],'What price feels reasonable for a typical pack?','Price / Currency',true,[]),trial,
      Q(s[5],'Where do you usually buy '+cat+'?','Multiple Choice',true,['Nearby store','Supermarket','E-commerce app','Quick-commerce app','WhatsApp order','Direct from the brand'],{randomise:true}),
      Q(s[5],'Where would you prefer to buy a new brand?','Multiple Choice',true,['WhatsApp ordering','E-commerce','Nearby store or supermarket'],{randomise:true}),
      Q(s[5],'If you liked a new product, would you recommend it to friends or neighbours?','Single Choice',false,['Definitely','Maybe','No']),
      Q(s[6],'Concept: '+(o.concept||'[describe your product in one sentence]')+' How appealing is this to you?','Scale / Likert',true,[],{scaleMax:5}),
      lead];
    const rules=[R([{qid:sw.id,op:'equals',value:'Yes'}],'show',swWhy.id),R([{qid:tryNew.id,op:'equals',value:'Definitely'},{qid:tryNew.id,op:'equals',value:'Probably'},{qid:tryNew.id,op:'equals',value:'Not sure'}],'show',tryWhy.id,'OR'),R([{qid:trial.id,op:'equals',value:'Yes'}],'show',lead.id)];
    const f=t=>qs.find(q=>q.text.indexOf(t)===0).id; const sg=(n,d,l,c)=>({id:uid('seg'),name:n,desc:d,logic:l,conds:c});
    const segments=[sg('A · Open to switching','Very or somewhat open to a new brand.','OR',[{qid:f('How open'),op:'equals',value:'Very open'},{qid:f('How open'),op:'equals',value:'Somewhat open'}]),
      sg('B · Recently switched','Changed brand in the last 12 months.','AND',[{qid:sw.id,op:'equals',value:'Yes'}]),
      sg('C · Price-conscious','Compares prices before buying.','AND',[{qid:f('Do you compare'),op:'equals',value:'Yes'}]),
      sg('D · Convenience-focused','Prefers WhatsApp or e-commerce for a new brand.','OR',[{qid:f('Where would you prefer'),op:'contains',value:'WhatsApp'},{qid:f('Where would you prefer'),op:'contains',value:'E-commerce'}])];
    return applyOpts({details:{title:'Category research — '+cat+' ('+mk+')',type:'Category Research',industry:'Other',customer:'',product:'',description:'A short survey about '+cat+' in '+mk+'.',language:'English',time:'5–7 minutes',leadCapture:'Optional at end',projectId:'',
      intro:'We are researching how people in '+mk+' choose and use '+cat+'. We are not asking you to buy anything — we only want to understand your experience.',targetSample:300,consentText:'I agree to be contacted about a sample and launch updates. I can withdraw at any time.',thanks:'Thank you. Your answers help shape something better for '+mk+'.'},
      sections:s,questions:qs,rules:rules,segments:segments,publish:{status:'Draft',slug:'',publishedAt:null,validatedAt:null}},o);
  }
  function launchDef(o){
    o=o||{}; const prod=o.product||'our product'; const s=['About you','Current use','Product concept','Price','Purchase intent','Stay in touch'].map(S);
    const intent=Q(s[4],'How likely are you to buy '+prod+'?','Single Choice',true,['Definitely','Probably','Not sure','Definitely not']);
    const lead=Q(s[5],'Want launch updates and an early offer? Share your details.','Lead Capture',false,[]);
    const qs=[Q(s[0],'Which age group are you in?','Single Choice',true,['Under 25','25–34','35–44','45 and above']),Q(s[0],'Which city do you live in?','Location',false,[]),
      Q(s[1],'What do you use today for this need?','Text',false,[]),Q(s[1],'What is your biggest problem with it?','Long Text',false,[]),
      Q(s[2],prod+': '+(o.concept||'[describe your product in one sentence]')+' How appealing is this to you?','Scale / Likert',true,[],{scaleMax:5}),
      Q(s[2],'What would you most want to know before trying it?','Long Text',false,[]),
      Q(s[3],'What price feels reasonable?','Price / Currency',true,[]),intent,lead];
    return applyOpts({details:{title:'Launch validation — '+prod,type:'Product Launch Research',industry:'Other',customer:'',product:'',description:'Tell us what you think of '+prod+' before it launches.',language:'English',time:'2–4 minutes',leadCapture:'Optional at end',projectId:'',targetSample:200,thanks:'Thank you for helping us shape '+prod+'.'},
      sections:s,questions:qs,rules:[{id:uid('r'),logic:'OR',conds:[{qid:intent.id,op:'equals',value:'Definitely'},{qid:intent.id,op:'equals',value:'Probably'}],action:'show',target:lead.id}],segments:[],publish:{status:'Draft',slug:'',publishedAt:null,validatedAt:null}},o);
  }
  function pollDef(o){
    o=o||{}; const s=[S('Poll')]; const opts=(o.pollOptions&&o.pollOptions.length>=2)?o.pollOptions:['Option A','Option B'];
    return applyOpts({details:{title:'Quick poll — '+(o.product||'our product'),type:'Poll',industry:'Other',customer:'',product:'',description:'One question. Takes ten seconds.',language:'English',time:'2–4 minutes',leadCapture:'Optional at end',projectId:'',thanks:'Thanks for voting!'},
      sections:s,questions:[Q(s[0],o.pollQuestion||'Which do you prefer?','Single Choice',true,opts),Q(s[0],'Want to hear the result and launch news? Share your details.','Lead Capture',false,[])],rules:[],segments:[],publish:{status:'Draft',slug:'',publishedAt:null,validatedAt:null}},o);
  }
  const TEMPLATES = [
    {id:'category', name:'Category research (any product)', kind:'Category Research', desc:'Category-first survey for a new market: behaviour, pain points, switching, trial, channels, concept last. 4 segments.', make:(t,o)=>categoryDef(o)},
    {id:'launch', name:'Launch validation (any product)', kind:'Product Launch Research', desc:'Concept appeal, price and purchase intent, with lead capture for interested buyers.', make:(t,o)=>launchDef(o)},
    {id:'poll', name:'Quick poll', kind:'Poll', desc:'One question you can also post as a poll on X, YouTube or Instagram Stories.', make:(t,o)=>pollDef(o)},
    {id:'nps', name:'Customer NPS', kind:'Customer Feedback', desc:'Score plus reason — three questions.', make:npsDef},
    {id:'event', name:'Event feedback', kind:'Event Feedback', desc:'Rating, highlights and follow-up.', make:eventDef},
    {id:'blank', name:'Blank survey (any industry)', kind:'General', desc:'Start from scratch with one section.', make:t=>blankDef(t)},
    {id:'coimbatore', sample:true, name:'Sample: Coimbatore dishwash category research', kind:'Category Research', desc:'The Milro reference survey — 30 questions, 4 segments, target 300 households.', make:coimbatoreDef},
    {id:'milro', sample:true, name:'Sample: Milro new product launch', kind:'Product Launch Research', desc:'Brand-aware concept, price and message test.', make:milroDef},
    {id:'scriptcraft', sample:true, name:'Sample: Scriptcraft Pro software pre-launch', kind:'Pre-Launch Validation', desc:'Existing and new tool users, features and pricing.', make:scriptcraftDef}];

  function seedFor(name){
    if(/coimbatore/i.test(name)) return coimbatoreDef();
    if(/dishwash|milro/i.test(name)) return milroDef();
    if(/scriptcraft|screenwrit/i.test(name)) return scriptcraftDef();
    return blankDef(name);
  }
  const CUSTNS = ()=> (typeof ZKAuth!=='undefined' && ZKAuth.isCustomerNs());
  function seedList(){
    if(CUSTNS()) return [];
    return [{id:uid('s'), name:'Dishwash Pre-Launch Survey', updated:Date.now()},
            {id:uid('s'), name:'Coimbatore Dishwash Category Research', updated:Date.now()},
            {id:uid('s'), name:'Scriptcraft Pro — Pre-Launch Survey', updated:Date.now()},
            {id:uid('s'), name:'Concept Test — V2', updated:Date.now()},
            {id:uid('s'), name:'Creative Message Test', updated:Date.now()}];
  }


  /* ---------- synthetic demo responses (static prototype only) ---------- */
  function mulberry32(a){ return function(){ let t=a+=0x6D2B79F5; t=Math.imul(t^t>>>15,t|1); t^=t+Math.imul(t^t>>>7,t|61); return ((t^t>>>14)>>>0)/4294967296; }; }
  function synthAnswer(q, rnd, pick){
    const T=q.type;
    if(T==='Single Choice'||T==='Dropdown'){ const o=q.options.map(x=>x.text);
      if(/purchase|likely are you to|try a new/i.test(q.text)) return pick(o,[0.31,0.38,0.19,0.12]);
      if(/mainly use to wash/i.test(q.text)) return pick(o,[0.38,0.3,0.12,0.08,0.12]);
      if(/prefer to buy a new/i.test(q.text)) return pick(o);
      if(/price.*concern|important concern/i.test(q.text)) return pick(o,[0.62,0.38]);
      return pick(o); }
    if(T==='Yes / No') return pick(['Yes','No'], /price.*concern|important concern|compare prices/i.test(q.text)?[0.62,0.38]:/trial pack/i.test(q.text)?[0.58,0.42]:null);
    if(T==='Multiple Choice'){ const isPain=/biggest problem|biggest issue|have you faced/i.test(q.text);
      const w=q.options.map((o,i)=> isPain ? [0.68,0.47,0.54,0.3,0.2][i]||0.25 : 0.4);
      const sel=q.options.filter((o,i)=>rnd()<w[i]).map(o=>o.text); return sel.length?sel:[q.options[0].text]; }
    if(T==='Ranking') return q.options.map(o=>o.text).sort(()=>rnd()-0.5);
    if(T==='Rating'||T==='Star Rating'||T==='Scale / Likert') return String(1+Math.floor(rnd()*(q.scaleMax||5)));
    if(T==='Number') return String(Math.floor(rnd()*500));
    if(T==='Price / Currency') return String(20+Math.floor(rnd()*80))+' INR (₹)';
    if(T==='Text') return pick(['Current brand','No particular brand','Switch often']);
    if(T==='Long Text') return pick(/difficult part/i.test(q.text)?['Oily vessels take a lot of scrubbing','Hands get dry after washing','The bottle finishes too quickly','Removing burnt stains','Cold water does not clean grease']:['Works fine for now.','Wish it removed grease faster.','Price has gone up a lot recently.','No major complaints.']);
    if(T==='Date') return '2026-0'+(1+Math.floor(rnd()*9))+'-'+(10+Math.floor(rnd()*18));
    if(T==='Phone') return '9'+Math.floor(100000000+rnd()*899999999);
    if(T==='Email') return 'respondent'+Math.floor(rnd()*999)+'@example.com';
    if(T==='Location') return pick(['Chennai','Coimbatore','Madurai','Trichy','Bengaluru']);
    if(T==='Lead Capture') return rnd()<0.35 ? {name:'Respondent '+Math.floor(rnd()*999), mobile:String(9000000000+Math.floor(rnd()*99999999)), email:'', city:pick(['Chennai','Coimbatore','Madurai']), consent:true} : '';
    if(T==='Consent') return 'Agreed';
    return '';
  }
  function generateSynthetic(def, n, seed){
    const rnd=mulberry32(seed||42);
    const pick=(arr,w)=>{ if(!w) return arr[Math.floor(rnd()*arr.length)]; const tot=w.reduce((a,b)=>a+b,0); let r=rnd()*tot; for(let i=0;i<arr.length;i++){ r-=w[i]; if(r<=0) return arr[i]; } return arr[arr.length-1]; };
    const CH=[['instagram','social',0.43],['youtube','social',0.22],['facebook','social',0.18],['whatsapp','social',0.12],['website','organic',0.05]];
    const out=[];
    for(let k=0;k<n;k++){
      const answers={};
      for(const q of def.questions){
        const c=compute(def,answers); if(!c.vis.find(x=>x.id===q.id)) continue;
        answers[q.id]=synthAnswer(q,rnd,pick);
        if(compute(def,answers).ended) break;
      }
      const ch=pick(CH,CH.map(c=>c[2]));
      out.push({demo:true, at:Date.now()-Math.floor(rnd()*14*86400000), answers:answers, utm:{utm_source:ch[0],utm_medium:ch[1],utm_campaign:(def.publish.slug||'survey')+'_prelaunch'}});
    }
    return out;
  }
  function seedResponsesIfEmpty(){
    /* Demo data is seeded once, ever, and only for the two known sample surveys —
       never for a survey the user creates and publishes themselves. */
    if(ZKStore.get(SEED_FLAG, false)) return;
    if(CUSTNS()){ ZKStore.set(SEED_FLAG,true); return; }
    list.forEach(s=>{
      if(!/dishwash|milro|scriptcraft/i.test(s.name)) return;
      const resp = ZKStore.get(RESP_KEY, {});
      if(resp[s.id] && resp[s.id].length) return;
      const d = getDef(s.id);
      if(d.publish.status!=='Published' || !d.questions.length) return;
      const n = /coimbatore/i.test(s.name) ? 64 : /dishwash|milro/i.test(s.name) ? 46 : 28;
      generateSynthetic(d, n, s.id.length).forEach(r=>addResponse(s.id, r));
      const starts=ZKStore.get(START_KEY,{}); starts[s.id]=Math.round(n/0.72); ZKStore.set(START_KEY,starts);
    });
    ZKStore.set(SEED_FLAG, true);
  }

  /* ---------- customers & projects (lightweight hierarchy) ---------- */
  const CUST_KEY='zk_customers_v9', PROJ_KEY='zk_projects_v9';
  function getCustomers(){ return ZKStore.get(CUST_KEY, null) || seedCustomers(); }
  function saveCustomers(v){ ZKStore.set(CUST_KEY, v); }
  function getProjects(custId){ const all = ZKStore.get(PROJ_KEY, null) || seedProjects(); return custId ? all.filter(p=>p.customerId===custId) : all; }
  function saveProjects(v){ ZKStore.set(PROJ_KEY, v); }
  function seedCustomers(){
    if(CUSTNS()){ const a=ZKAuth.current(); const v=[{id:'cust_self',name:(a&&a.company)||'My company',industry:'Other',contact:(a&&a.email)||'',website:'',status:'Active'}]; saveCustomers(v); return v; }
    const v=[{id:'cust_milro',name:'Milro',industry:'FMCG',contact:'',website:'',status:'Active'},
              {id:'cust_scriptcraft',name:'Scriptcraft Pro',industry:'SaaS / Technology',contact:'',website:'',status:'Active'}];
    saveCustomers(v); return v;
  }
  function seedProjects(){
    if(CUSTNS()){ saveProjects([]); return []; }
    const v=[{id:'proj_milro_dishwash',customerId:'cust_milro',name:'Dishwash Product Launch',product:'Dishwash Liquid + Bar',market:'Urban households',geography:'Tamil Nadu, India',launchDate:'',status:'Pre-launch'},
              {id:'proj_scriptcraft_prelaunch',customerId:'cust_scriptcraft',name:'Pre-Launch Validation',product:'Screenwriting software',market:'Screenwriters',geography:'India + global',launchDate:'',status:'Pre-launch'}];
    saveProjects(v); return v;
  }
  function createCustomer(name,industry){ const v=getCustomers(); const c={id:uid('cust'),name:name,industry:industry||'Other',contact:'',website:'',status:'Active'}; v.push(c); saveCustomers(v); return c; }
  function updateCustomer(id,patch){ const v=getCustomers(); const c=v.find(x=>x.id===id); if(c) Object.assign(c,patch); saveCustomers(v); return c; }
  function deleteCustomer(id){ saveCustomers(getCustomers().filter(x=>x.id!==id)); saveProjects(getProjects().filter(p=>p.customerId!==id)); }
  function createProject(customerId,name){ const v=getProjects(); const p={id:uid('proj'),customerId:customerId,name:name,product:'',market:'',geography:'',launchDate:'',status:'Pre-launch'}; v.push(p); saveProjects(v); return p; }
  function updateProject(id,patch){ const v=getProjects(); const p=v.find(x=>x.id===id); if(p) Object.assign(p,patch); saveProjects(v); return p; }
  function deleteProject(id){ saveProjects(getProjects().filter(x=>x.id!==id)); list.forEach(s=>{ const d=getDef(s.id); if(d.details.projectId===id){ d.details.projectId=''; saveDef(s.id,d); } }); }
  function projectLabel(pid){ const p=getProjects().find(x=>x.id===pid); if(!p) return ''; const c=getCustomers().find(x=>x.id===p.customerId); return (c?c.name+' — ':'')+p.name; }
  function surveysForProject(pid){ return list.filter(s=>getDef(s.id).details.projectId===pid); }

  /* ---------- attribution (derived from response UTM data; no separate store) ---------- */
  function allAttribution(){
    const rows = allResponses();
    const bySource={}, byCampaign={};
    rows.forEach(r=>{ const u=r.utm||{}; const src=u.utm_source||'direct';
      bySource[src]=bySource[src]||{source:src,n:0,surveys:new Set()}; bySource[src].n++; bySource[src].surveys.add(r.surveyName);
      const camp=u.utm_campaign||'(none)'; const key=camp+'|'+src+'|'+(u.utm_medium||'');
      byCampaign[key]=byCampaign[key]||{campaign:camp,source:src,medium:u.utm_medium||'',n:0,surveys:new Set(),first:r.at,last:r.at};
      const c=byCampaign[key]; c.n++; c.surveys.add(r.surveyName); c.first=Math.min(c.first,r.at); c.last=Math.max(c.last,r.at);
    });
    const sources=Object.values(bySource).map(s=>({source:s.source,n:s.n,surveys:[...s.surveys],pct:rows.length?Math.round(s.n/rows.length*100):0})).sort((a,b)=>b.n-a.n);
    const campaigns=Object.values(byCampaign).map(c=>({campaign:c.campaign,source:c.source,medium:c.medium,n:c.n,surveys:[...c.surveys],first:c.first,last:c.last})).sort((a,b)=>b.n-a.n);
    return {total:rows.length, sources:sources, campaigns:campaigns};
  }

  /* ---------- growth strategy (30/60/90), content testing, notifications, users (v10) ---------- */
  const STRAT_KEY='zk_strategy_v10', CREATIVE_KEY='zk_creative_v10', USERS_KEY='zk_users_v10';
  const ROLES=['Super Admin','Agency / Consultant','Customer','Marketing Team'];
  function getStrategy(id){ const all=ZKStore.get(STRAT_KEY,{}); if(!all[id]) all[id]={'30':[],'60':[],'90':[]}; return all[id]; }
  function saveStrategyFor(id,obj){ const all=ZKStore.get(STRAT_KEY,{}); all[id]=obj; ZKStore.set(STRAT_KEY,all); }
  function addActivity(id,bucket,act){ const s=getStrategy(id); act=Object.assign({id:uid('act'),status:'Planned'},act); s[bucket].push(act); saveStrategyFor(id,s); return act; }
  function updateActivity(id,bucket,actId,patch){ const s=getStrategy(id); const a=s[bucket].find(x=>x.id===actId); if(a) Object.assign(a,patch); saveStrategyFor(id,s); }
  function deleteActivity(id,bucket,actId){ const s=getStrategy(id); s[bucket]=s[bucket].filter(x=>x.id!==actId); saveStrategyFor(id,s); }
  function autoSuggestStrategy(id){
    const s=getStrategy(id); if(s['30'].length||s['60'].length||s['90'].length) return s;
    const a=analyze(id); if(!a.responses) return s;
    const withOpts=a.questions.filter(q=>q.options.length&&q.answered);
    const wellSampled=withOpts.filter(q=>q.answered>=a.responses*0.5);
    const pain=(wellSampled.filter(q=>q.type==='Multiple Choice').sort((x,y)=>(y.options[0]?y.options[0].pct:0)-(x.options[0]?x.options[0].pct:0))[0])||wellSampled[0];
    const msg=wellSampled.find(q=>/message|messaging|appeal/i.test(q.text));
    const topCh=a.sources[0];
    if(pain) addActivity(id,'30',{objective:'Address top pain point',channel:topCh?topCh.source:'Website',task:'Create content addressing “'+pain.options[0].text+'” ('+pain.options[0].pct+'% of respondents)',owner:'Marketing',start:'',end:'',budget:'',kpi:'Engagement rate'});
    if(msg) addActivity(id,'30',{objective:'Validate winning message',channel:topCh?topCh.source:'Website',task:'Run a creative test for “'+msg.options[0].text+'” ('+msg.options[0].pct+'% preferred it)',owner:'Marketing',start:'',end:'',budget:'',kpi:'Click-through rate'});
    if(topCh) addActivity(id,'60',{objective:'Scale the best channel',channel:topCh.source,task:'Increase budget on '+topCh.source+' — already '+topCh.pct+'% of responses',owner:'Marketing',start:'',end:'',budget:'',kpi:'CAC'});
    addActivity(id,'90',{objective:'Retarget and expand',channel:topCh?topCh.source:'Website',task:'Retarget engaged leads and test a second audience segment',owner:'Marketing',start:'',end:'',budget:'',kpi:'Conversion rate'});
    return getStrategy(id);
  }
  function getCreativeTests(id){ const all=ZKStore.get(CREATIVE_KEY,{}); return all[id]||[]; }
  function saveCreativeTests(id,v){ const all=ZKStore.get(CREATIVE_KEY,{}); all[id]=v; ZKStore.set(CREATIVE_KEY,all); }
  function addCreativeTest(id,t){ const v=getCreativeTests(id); t=Object.assign({id:uid('ct'),status:'Testing'},t); v.push(t); saveCreativeTests(id,v); return t; }
  function updateCreativeTest(id,tid,patch){ const v=getCreativeTests(id); const t=v.find(x=>x.id===tid); if(t) Object.assign(t,patch); saveCreativeTests(id,v); }
  function deleteCreativeTest(id,tid){ saveCreativeTests(id, getCreativeTests(id).filter(x=>x.id!==tid)); }
  function messageQuestions(id){ const a=analyze(id); return a.questions.filter(q=>q.options.length && q.answered && /message|messaging|appeal|creative|concept/i.test(q.text)); }
  function notifications(){
    const out=[];
    list.forEach(s=>{ const d=getDef(s.id);
      if(d.publish.status==='Published' && d.publish.publishedAt) out.push({type:'publish',text:'“'+d.details.title+'” was published',at:d.publish.publishedAt});
      const resp=getResponses(s.id);
      [10,25,50,100].forEach(m=>{ if(resp.length>=m){ const sorted=resp.slice().sort((a,b)=>a.at-b.at); out.push({type:'milestone',text:'“'+d.details.title+'” passed '+m+' responses',at:sorted[m-1]?sorted[m-1].at:Date.now()}); } });
    });
    allResponses().slice(0,8).forEach(r=>{ const d=getDef(r.surveyId); const leadQ=d.questions.find(q=>q.type==='Lead Capture'); if(leadQ && r.answers[leadQ.id]) out.push({type:'lead',text:'New lead captured on “'+d.details.title+'”',at:r.at}); });
    return out.sort((a,b)=>b.at-a.at).slice(0,12);
  }
  function getUsers(){ return ZKStore.get(USERS_KEY, null) || seedUsers(); }
  function seedUsers(){ const a=(typeof ZKAuth!=='undefined')?ZKAuth.current():null; const v=[a&&a.role!=='superadmin'?{id:uid('u'),name:a.name,email:a.email,role:'Owner',status:'Active'}:{id:uid('u'),name:'You',email:'you@zlandavel.com',role:'Super Admin',status:'Active'}]; ZKStore.set(USERS_KEY,v); return v; }
  function saveUsers(v){ ZKStore.set(USERS_KEY,v); }
  function createUser(u){ const v=getUsers(); u=Object.assign({id:uid('u'),status:'Active'},u); v.push(u); saveUsers(v); return u; }
  function updateUser(id,patch){ const v=getUsers(); const u=v.find(x=>x.id===id); if(u) Object.assign(u,patch); saveUsers(v); }
  function deleteUser(id){ saveUsers(getUsers().filter(x=>x.id!==id)); }

  /* ---------- v11: segments, insights, question bank, campaigns, settings, backup ---------- */
  const BANK_KEY='zk_qbank_v11', CAMP_KEY='zk_campaigns_v11', SET_KEY='zk_settings_v11';
  function segMatch(seg, answers){ return seg.logic==='OR' ? seg.conds.some(c=>testCond(c,answers)) : seg.conds.every(c=>testCond(c,answers)); }
  function segmentsOf(id){ return getDef(id).segments||[]; }
  function intentQ(def){ return def.questions.find(q=>/try a new|likely are you to buy|likely are you to/i.test(q.text) && CHOICE.includes(q.type)); }
  function segmentStats(id){
    const def=getDef(id), resp=getResponses(id), iq=intentQ(def);
    const lq=def.questions.filter(q=>q.type==='Lead Capture').map(q=>q.id);
    const pq=def.questions.find(q=>q.type==='Multiple Choice' && /faced|problem|issue/i.test(q.text));
    return segmentsOf(id).map(sg=>{
      const m=resp.filter(r=>segMatch(sg,r.answers));
      const pos=iq?m.filter(r=>['Definitely','Probably'].includes(r.answers[iq.id])).length:0;
      const leads=m.filter(r=>lq.some(q=>r.answers[q])).length;
      let top=null;
      if(pq){ const t={}; m.forEach(r=>toArr(r.answers[pq.id]).forEach(x=>t[x]=(t[x]||0)+1)); const e=Object.entries(t).sort((a,b)=>b[1]-a[1])[0]; if(e) top={text:e[0],pct:Math.round(e[1]/m.length*100)}; }
      return {seg:sg, n:m.length, pct:resp.length?Math.round(m.length/resp.length*100):0, intentPct:m.length&&iq?Math.round(pos/m.length*100):null, leads:leads, topPain:top};
    });
  }
  function segmentCrossTab(id, qid){
    const def=getDef(id), resp=getResponses(id), q=def.questions.find(x=>x.id===qid); if(!q) return null;
    const opts=(q.type==='Yes / No'?['Yes','No']:q.options.map(o=>o.text));
    const cols=segmentsOf(id).map(sg=>{ const m=resp.filter(r=>segMatch(sg,r.answers)&&r.answers[qid]!=null&&r.answers[qid]!==''); const row={}; opts.forEach(o=>{ row[o]=m.length?Math.round(m.filter(r=>toArr(r.answers[qid]).includes(o)).length/m.length*100):0; }); return {seg:sg,n:m.length,row:row}; });
    return {q:q, opts:opts, cols:cols};
  }
  function demoCount(id){ return getResponses(id).filter(r=>r.demo).length; }
  function median(a){ if(!a.length) return null; a=a.slice().sort((x,y)=>x-y); const m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; }
  /* Rule-based insights: plain counting rules, no AI. Each carries the rule that produced it and its evidence size. */
  function insights(id){
    const a=analyze(id), def=a.def, resp=getResponses(id), out=[]; const n=a.responses;
    const add=(cat,text,rule,ev)=>out.push({cat:cat,text:text,rule:rule,n:ev==null?n:ev});
    if(!n) return {n:0, list:[], demo:0};
    a.questions.forEach(q=>{
      if(!q.answered) return; const top=q.options[0], second=q.options[1];
      if(q.type==='Multiple Choice' && /faced|problem|issue/i.test(q.text) && top && !/none/i.test(top.text)) add('Customer','"'+top.text+'" is the most-cited problem with the current product ('+top.pct+'% of answers).','Top option of a problem question',q.answered);
      else if(/purchase|likely are you to|try a new/i.test(q.text) && q.type==='Single Choice'){ const pos=q.options.filter(o=>/^(definitely|probably)$/i.test(o.text)).reduce((s,o)=>s+o.pct,0); add('Launch','Purchase / trial intent: '+pos+'% say Definitely or Probably.','Top-2 box of the intent question',q.answered); const no=q.options.find(o=>/definitely not/i.test(o.text)); if(no&&no.pct>=20) add('Launch','Risk: '+no.pct+'% say Definitely not — look at their objections before launch.','Definitely-not ≥ 20%',q.answered); }
      else if(/message|appeal/i.test(q.text) && top && q.type==='Single Choice') add('Marketing','Best-performing message: "'+top.text+'" ('+top.pct+'%)'+(second?', ahead of "'+second.text+'" ('+second.pct+'%)':'')+'.','Top option of a message question',q.answered);
      else if(/where would you prefer|where would you like|where do you usually buy/i.test(q.text) && top) add('Marketing','Channel signal: "'+top.text+'" leads ('+top.pct+'%).','Top option of a channel question',q.answered);
      else if(/pack size/i.test(q.text) && top) add('Product','Preferred pack size: '+top.text+' ('+top.pct+'%).','Top option of a pack-size question',q.answered);
      else if(/format/i.test(q.text) && top) add('Product','Preferred format: '+top.text+' ('+top.pct+'%).','Top option of a format question',q.answered);
    });
    def.questions.filter(q=>q.type==='Price / Currency').forEach(q=>{ const v=resp.map(r=>parseFloat(r.answers[q.id])).filter(x=>!isNaN(x)); const m=median(v); if(m!=null) add('Product','Median acceptable price: ₹'+m+' (range ₹'+Math.min.apply(null,v)+'–₹'+Math.max.apply(null,v)+').','Median of a price question',v.length); });
    segmentStats(id).filter(s=>s.n).forEach(s=>add('Segments',s.seg.name+': '+s.n+' respondents ('+s.pct+'%)'+(s.intentPct!=null?', '+s.intentPct+'% positive intent':'')+(s.topPain?'; top problem "'+s.topPain.text+'"':'')+'.','Segment rule match',s.n));
    if(a.sources[0]) add('Marketing','Top acquisition source: '+a.sources[0].source+' ('+a.sources[0].pct+'% of responses).','Largest UTM source',n);
    const t=def.details.targetSample; if(t) add('Research','Sample progress: '+n+' of '+t+' target ('+Math.round(n/t*100)+'%).','Responses ÷ target',n);
    if(n<30) add('Research','Caution: fewer than 30 responses — treat every percentage as a direction, not a result.','n < 30',n);
    return {n:n, list:out, demo:demoCount(id)};
  }
  function seedBank(){
    const G=(name,qs)=>({id:uid('bg'),name:name,questions:qs});
    const q=(text,type,opts,extra)=>Object.assign({text:text,type:type,required:false,options:opts||[]},extra||{});
    const v=[ G('Household profile',[q('Which age group are you in?','Single Choice',['Under 25','25–34','35–44','45 and above']),q('How many people live in your household?','Single Choice',['1–2','3–4','5–6','7 or more']),q('Which area do you live in?','Text')]),
      G('Current behaviour',[q('Which product do you mainly use today?','Single Choice',['Liquid','Bar','Powder','More than one']),q('Which brand do you use today?','Text'),q('About how much do you spend each month?','Single Choice',['Under ₹50','₹50–100','₹100–200','Above ₹200'])]),
      G('Pain points',[q('In your own words, what is the most difficult part?','Long Text'),q('Which of these problems have you faced?','Multiple Choice',['Poor performance','Too expensive','Hard to find','Poor quality','None of these'],{randomise:true})]),
      G('Switching & trial',[q('Have you changed product in the last 12 months?','Yes / No'),q('Would you try a new local brand?','Single Choice',['Definitely','Probably','Not sure','Definitely not']),q('Would you take a small trial pack?','Yes / No')]),
      G('Pricing',[q('What price feels reasonable?','Price / Currency'),q('Do you compare prices before you buy?','Yes / No')]),
      G('Channels',[q('Where do you usually buy?','Multiple Choice',['Nearby store','E-commerce app','Quick-commerce app','WhatsApp order'],{randomise:true})]),
      G('NPS',[q('How likely are you to recommend us? (0–10)','Scale / Likert',[],{scaleMax:10}),q('What is the main reason for your score?','Long Text')]) ];
    ZKStore.set(BANK_KEY,v); return v;
  }
  function getBank(){ return ZKStore.get(BANK_KEY,null)||seedBank(); }
  function saveBank(v){ ZKStore.set(BANK_KEY,v); }
  function bankToQuestion(bq, sectionId){ return {id:uid('q'),text:bq.text,type:bq.type,sectionId:sectionId,required:!!bq.required,help:'',options:O(bq.options),scaleMax:bq.scaleMax,randomise:!!bq.randomise}; }
  function getCampaigns(){ return ZKStore.get(CAMP_KEY,[]); }
  function saveCampaigns(v){ ZKStore.set(CAMP_KEY,v); }
  function campaignSlug(name){ return slugify(name).replace(/-/g,'_'); }
  function campaignStats(c){ const s=campaignSlug(c.name); const resp=c.surveyId?getResponses(c.surveyId).filter(r=>r.utm&&r.utm.utm_campaign===s):[]; const lq=c.surveyId?getDef(c.surveyId).questions.filter(q=>q.type==='Lead Capture').map(q=>q.id):[]; const leads=resp.filter(r=>lq.some(q=>r.answers[q])).length; return {responses:resp.length, leads:leads, cpl: leads&&c.budget?Math.round(c.budget/leads):null}; }
  const SET_DEFAULTS={workspace:'Zlandavel Infotech Pvt Ltd', product:'ZKSurvey', defaultMarket:'Coimbatore', language:'English', currency:'INR (₹)', timezone:'Asia/Kolkata', consentText:'I agree to be contacted about this product and can withdraw at any time.', retentionMonths:24, notifyLead:true, notifyMilestone:true, notifyLowConv:true, milestone:100};
  function getSettings(){ return Object.assign({},SET_DEFAULTS,ZKStore.get(SET_KEY,{})); }
  function saveSettings(v){ ZKStore.set(SET_KEY,v); }
  function nsKeys(){ return Object.keys(ZKApi.snapshot().kv); }
  function exportAll(){ const sn=ZKApi.snapshot(); const o={app:'ZKSurvey',build:'v13',phase:'Phase 7',exportedAt:new Date().toISOString(),data:{}}; o.data[LIST_KEY]=sn.list; o.data[DEF_KEY]=sn.defs; o.data[RESP_KEY]=sn.responses; o.data[START_KEY]=sn.starts; Object.keys(sn.kv).forEach(k=>{ o.data[k]=sn.kv[k]; }); return o; }
  function importAll(o){ if(!o||o.app!=='ZKSurvey'||!o.data) throw new Error('Not a ZKSurvey backup file');
    Object.keys(o.data).forEach(k=>{ if(!/^zk_/.test(k)) return; let v=o.data[k]; if(typeof v==='string'){ try{ v=JSON.parse(v); }catch(e){} } ZKApi.write(k,v); });
    const r=ZKApi.flush(); if(!r.ok) throw new Error(r.message||'The server rejected the import.'); }
  function resetAll(){ const r=ZKApi.call('DELETE','/workspace'); if(r.status!==200) throw new Error('Reset failed'); ZKApi.resync(); }

  /* ---------- storage ---------- */
  let defs = ZKStore.get(DEF_KEY, {});
  let list = ZKStore.get(LIST_KEY, null);
  if(!list || (!list.length && !CUSTNS() && !ZKStore.get(SEED_FLAG,false))){ list = seedList(); ZKStore.set(LIST_KEY, list); }
  seedResponsesIfEmpty();
  (function seedCoimbatoreOnce(){
    if(ZKStore.get('zk_seed_coim_v11',false)) return;
    if(CUSTNS()){ ZKStore.set('zk_seed_coim_v11',true); return; }
    if(!list.some(x=>/coimbatore/i.test(x.name))){ const sid=uid('s'); list.push({id:sid,name:'Coimbatore Dishwash Category Research',updated:Date.now()}); ZKStore.set(LIST_KEY,list); }
    const cs=list.find(x=>/coimbatore/i.test(x.name)); const d=getDef(cs.id); const resp=ZKStore.get(RESP_KEY,{});
    if(!(resp[cs.id]&&resp[cs.id].length)){ generateSynthetic(d,64,cs.id.length+7).forEach(r=>addResponse(cs.id,r)); const st=ZKStore.get(START_KEY,{}); st[cs.id]=89; ZKStore.set(START_KEY,st); }
    ZKStore.set('zk_seed_coim_v11',true);
  })();
  function saveList(){ ZKStore.set(LIST_KEY, list); }
  function saveDefs(){ ZKStore.set(DEF_KEY, defs); }
  function getList(){ return list; }
  function getDef(id){
    if(!defs[id]){ const s = list.find(x=>x.id===id); defs[id] = seedFor(s?s.name:'Untitled'); saveDefs(); }
    return defs[id];
  }
  function touch(id){ const s=list.find(x=>x.id===id); if(s) s.updated=Date.now(); saveList(); }
  const lastGood={}; Object.keys(defs).forEach(k=>{ if(defs[k]&&defs[k].publish) lastGood[k]=JSON.parse(JSON.stringify(defs[k].publish)); });
  function saveDef(id, def){
    defs[id]=def; saveDefs(); const s=list.find(x=>x.id===id); if(s){ s.name = def.details.title || s.name; s.updated=Date.now(); saveList(); }
    const lg=lastGood[id]||{status:'Draft',slug:''}, p=def.publish;
    if(p.status==='Published' && (lg.status!=='Published' || lg.slug!==p.slug)){   // publishing: the server decides (verified email, plan caps, unique link)
      const r=ZKApi.flush();
      if(!r.ok){ lastError=r.message||'Could not publish.'; def.publish=JSON.parse(JSON.stringify(lg)); defs[id]=def; saveDefs(); return false; }
    }
    lastGood[id]=JSON.parse(JSON.stringify(def.publish)); lastError=''; return true;
  }
  function statusOf(id){ return getDef(id).publish.status; }
  let lastError='';
  function usage(){ const resp=ZKStore.get(RESP_KEY,{}); let r=0; Object.keys(resp).forEach(k=>(resp[k]||[]).forEach(x=>{ if(!x.demo) r++; })); const pub=list.filter(s=>getDef(s.id).publish.status==='Published').length; return {surveys:list.length,published:pub,responses:r}; }
  function limitCheck(kind){ if(typeof ZKAuth==='undefined') return ''; const a=ZKAuth.current(); if(!a||a.role==='superadmin') return ''; const p=ZKAuth.planOf(a), u=usage();
    if(kind==='survey' && u.surveys>=p.surveys) return 'Your '+p.name+' plan allows '+p.surveys+' survey'+(p.surveys===1?'':'s')+'. Upgrade to create more.';
    return ''; }
  function createSurvey(title, template, opts){
    lastError=limitCheck('survey'); if(lastError) return null;
    const id = uid('s'); list.push({id:id, name:title, updated:Date.now()}); saveList();
    const tpl = TEMPLATES.find(t=>t.id===template)||TEMPLATES[0]; const d = tpl.make(title, opts); if(!d.segments) d.segments=[]; if(opts) applyOpts(d,opts);
    d.details.title = title; d.publish = {status:'Draft', slug:'', publishedAt:null, validatedAt:null};
    defs[id]=d; saveDefs();
    const r=ZKApi.flush(); if(!r.ok){ lastError=r.message||'Could not create the survey.'; list=list.filter(x=>x.id!==id); delete defs[id]; saveList(); saveDefs(); return null; }
    lastGood[id]=JSON.parse(JSON.stringify(d.publish)); return id;
  }
  function duplicateSurvey(id){
    lastError=limitCheck('survey'); if(lastError) return null;
    const src = getDef(id), meta = list.find(x=>x.id===id);
    const nid = uid('s'); const copy = JSON.parse(JSON.stringify(src));
    // re-key ids so the copy is independent
    const map = {}; const rk = o=>{ const n=uid(o.id.split('_')[0]); map[o.id]=n; o.id=n; };
    copy.sections.forEach(rk); copy.questions.forEach(q=>{ rk(q); q.options.forEach(rk); });
    copy.questions.forEach(q=>{ q.sectionId = map[q.sectionId]; });
    copy.rules.forEach(r=>{ r.id=uid('r'); r.conds.forEach(c=>{ c.qid = map[c.qid]||c.qid; }); if(r.action==='show'||r.action==='hide'||r.action==='skipSection') r.target = map[r.target]||r.target; });
    copy.details.title = src.details.title + ' (copy)'; copy.publish = {status:'Draft', slug:'', publishedAt:null, validatedAt:null};
    defs[nid]=copy; saveDefs(); list.push({id:nid, name:copy.details.title, updated:Date.now()}); saveList();
    const r=ZKApi.flush(); if(!r.ok){ lastError=r.message||'Could not duplicate the survey.'; list=list.filter(x=>x.id!==nid); delete defs[nid]; saveList(); saveDefs(); return null; }
    lastGood[nid]=JSON.parse(JSON.stringify(copy.publish)); return nid;
  }
  function deleteSurvey(id){ list = list.filter(x=>x.id!==id); delete defs[id]; saveList(); saveDefs(); ZKApi.flush(); delete lastGood[id]; }
  function findBySlug(slug){ for(const s of list){ const d=getDef(s.id); if(d.publish.status==='Published' && d.publish.slug===slug) return s.id; } return null; }
  function getResponses(id){ const all = ZKStore.get(RESP_KEY, {}); return all[id]||[]; }
  function addResponse(id, r){ const all = ZKStore.get(RESP_KEY, {}); r.id = r.id || uid('resp'); (all[id]=all[id]||[]).push(r); ZKStore.set(RESP_KEY, all); }
  function addStart(id){ const a=ZKStore.get(START_KEY,{}); a[id]=(a[id]||0)+1; ZKStore.set(START_KEY,a); }
  function getStarts(id){ const a=ZKStore.get(START_KEY,{}); return a[id]||getResponses(id).length; }
  function allResponses(){ const all = ZKStore.get(RESP_KEY, {}); const out=[]; list.forEach(s=>{ (all[s.id]||[]).forEach(r=>out.push(Object.assign({surveyId:s.id, surveyName:s.name}, r))); }); return out.sort((a,b)=>b.at-a.at); }
  function secNameOf(def,sid){ const s=def.sections.find(x=>x.id===sid); return s?s.name:''; }
  const CATEGORICAL=['Single Choice','Multiple Choice','Dropdown','Yes / No','Image Choice','Ranking'];
  function analyze(id){
    const def=getDef(id), resp=getResponses(id), starts=getStarts(id);
    const completion = starts ? Math.round(resp.length/starts*100) : (resp.length?100:0);
    const srcTally={}; resp.forEach(r=>{ const s=(r.utm&&r.utm.utm_source)||'direct'; srcTally[s]=(srcTally[s]||0)+1; });
    const sources=Object.entries(srcTally).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({source:k, n:v, pct: resp.length?Math.round(v/resp.length*100):0}));
    const questions = def.questions.filter(q=>CATEGORICAL.includes(q.type)).map(q=>{
      const tally={}; let answered=0;
      resp.forEach(r=>{ const a=r.answers[q.id]; if(a==null||a===''){ return; } answered++; (Array.isArray(a)?a:[a]).forEach(t=>tally[t]=(tally[t]||0)+1); });
      const opts=(q.type==='Yes / No'?['Yes','No']:q.options.map(o=>o.text)).map(t=>({text:t, n:tally[t]||0, pct: answered?Math.round((tally[t]||0)/answered*100):0})).sort((a,b)=>b.n-a.n);
      return {id:q.id, text:q.text, type:q.type, section:secNameOf(def,q.sectionId), answered:answered, options:opts};
    });
    const leadQs = def.questions.filter(q=>q.type==='Lead Capture').map(q=>q.id);
    const leads = resp.filter(r=>leadQs.some(qid=>r.answers[qid])).length;
    return {def:def, responses:resp.length, starts:starts, completion:completion, sources:sources, questions:questions, leads:leads};
  }

  function getLeadStatus(rid){ const a=ZKStore.get(LEAD_KEY,{}); return a[rid]||'New'; }
  function setLeadStatus(rid,st){ const a=ZKStore.get(LEAD_KEY,{}); a[rid]=st; ZKStore.set(LEAD_KEY,a); }

  /* ---------- validation (publish checklist) ---------- */
  function validate(def){
    const out = []; const add=(lvl,t)=>out.push({level:lvl,text:t});
    const d=def.details;
    d.title && d.title.trim() ? add('ok','Survey title is set') : add('bad','Survey title is missing');
    d.thanks && d.thanks.trim() ? add('ok','Thank-you message is set') : add('bad','Thank-you message is missing');
    def.sections.length ? add('ok', def.sections.length+' section(s) configured') : add('bad','Add at least one section');
    def.questions.length ? add('ok', def.questions.length+' question(s) configured') : add('bad','Add at least one question');
    const emptySec = def.sections.filter(s=>!def.questions.some(q=>q.sectionId===s.id));
    emptySec.length ? add('warn','Empty section(s): '+emptySec.map(s=>s.name).join(', ')) : def.sections.length && add('ok','Every section has questions');
    const badChoice = def.questions.filter(q=>CHOICE.includes(q.type) && q.options.length<2);
    badChoice.length ? add('bad', badChoice.length+' choice question(s) need at least 2 answer options') : add('ok','All choice questions have answer options');
    const qids = new Set(def.questions.map(q=>q.id)), sids=new Set(def.sections.map(s=>s.id));
    const dangling = def.rules.filter(r=> r.conds.some(c=>!qids.has(c.qid)) || ((r.action==='show'||r.action==='hide') && !qids.has(r.target)) || (r.action==='skipSection' && !sids.has(r.target)) || (r.action==='redirect' && !/^https?:\/\//i.test(r.target||'')));
    dangling.length ? add('bad', dangling.length+' logic rule(s) point to a missing question, section or URL') : add('ok', def.rules.length ? 'Conditional logic validated ('+def.rules.length+' rule'+(def.rules.length>1?'s':'')+')' : 'No conditional logic (optional)');
    const dup = def.questions.filter((q,i)=>def.questions.findIndex(x=>x.text.trim().toLowerCase()===q.text.trim().toLowerCase())!==i);
    dup.length && add('warn','Duplicate question text found ('+dup.length+')');
    if(d.leadCapture!=='Disabled' && !def.questions.some(q=>q.type==='Lead Capture')) add('warn','Lead capture is enabled but no Lead Capture question exists');
    if(d.type==='Category Research'){
      const brand=(d.customer||'').trim().toLowerCase();
      if(brand){ const bad=def.questions.filter(q=>{ const sec=(def.sections.find(x=>x.id===q.sectionId)||{}).name||''; if(/concept|stay|lead|contact/i.test(sec)) return false; return (q.text+' '+q.options.map(o=>o.text).join(' ')).toLowerCase().includes(brand); });
        bad.length ? add('bad','Brand bias: "'+d.customer+'" is named in '+bad.length+' question(s) before the concept section. Category research should stay brand-neutral.') : add('ok','Brand-neutral: client brand is not named before the concept section'); }
      if(brand && (d.intro||'').toLowerCase().includes(brand)) add('bad','The intro names the client brand — keep it neutral.');
      if(brand && (d.title||'').toLowerCase().includes(brand)) add('bad','The survey title names the client brand — respondents see the title, so keep it neutral.');
      const prod=(d.product||'').trim().toLowerCase(); if(prod && prod.length>2 && (d.title||'').toLowerCase().includes(prod)) add('bad','The survey title names the product — keep category research neutral.');
      const firstPain=def.questions.find(q=>/problem|difficult|issue|pain/i.test(q.text)); if(firstPain && firstPain.type!=='Long Text' && firstPain.type!=='Text') add('warn','Ask the pain-point question unprompted (Long Text) before showing a list of problems.');
      if(!d.targetSample) add('warn','Set a target sample size (e.g. 300 households).');
    }
    return out;
  }

  /* ---------- conditional logic engine ---------- */
  function toArr(a){ if(a==null||a==='') return []; if(Array.isArray(a)) return a.map(String); if(typeof a==='object') return Object.values(a).some(v=>v&&v!==false)?['(filled)']:[]; return [String(a)]; }
  function testCond(c, eff){
    const a = eff[c.qid], arr = toArr(a), v = c.value;
    switch(c.op){
      case 'equals': return arr.length===1 && arr[0]===v;
      case 'not_equals': return !(arr.length===1 && arr[0]===v);
      case 'contains': return arr.some(x=>x===v || x.toLowerCase().includes(String(v).toLowerCase()));
      case 'not_contains': return !arr.some(x=>x===v || x.toLowerCase().includes(String(v).toLowerCase()));
      case 'answered': return arr.length>0;
      case 'not_answered': return arr.length===0;
      case 'gt': return arr.length>0 && parseFloat(arr[0])>parseFloat(v);
      case 'lt': return arr.length>0 && parseFloat(arr[0])<parseFloat(v);
    } return false;
  }
  function sat(r, eff){ if(!r.conds.length) return false; return r.logic==='OR' ? r.conds.some(c=>testCond(c,eff)) : r.conds.every(c=>testCond(c,eff)); }
  /* Ordered single pass: a question's rules only see answers of questions that are themselves visible. */
  function compute(def, answers){
    const qs=def.questions, rules=def.rules, vis=[], eff={}; let ended=false, redirect=null;
    const idx = id => qs.findIndex(q=>q.id===id);
    const hidden = [];
    for(let i=0;i<qs.length;i++){
      const q=qs[i];
      for(const r of rules){ if((r.action==='end'||r.action==='redirect') && sat(r,eff) && Math.max.apply(null,r.conds.map(c=>idx(c.qid)))<i){ ended=true; redirect = r.action==='redirect'?r.target:null; break; } }
      if(ended) break;
      let v = true, why='';
      const shows = rules.filter(r=>r.action==='show' && r.target===q.id);
      if(shows.length){ v = shows.some(r=>sat(r,eff)); if(!v) why='waiting for a “show” rule'; }
      if(v && rules.some(r=>r.action==='hide' && r.target===q.id && sat(r,eff))){ v=false; why='hidden by a rule'; }
      if(v && rules.some(r=>r.action==='skipSection' && r.target===q.sectionId && sat(r,eff))){ v=false; why='section skipped'; }
      if(v){ vis.push(q); if(answers[q.id]!==undefined) eff[q.id]=answers[q.id]; } else hidden.push({q:q, why:why});
    }
    if(!ended){ for(const r of rules){ if((r.action==='end'||r.action==='redirect') && sat(r,eff)){ ended=true; redirect = r.action==='redirect'?r.target:null; break; } } }
    return {vis:vis, hidden:hidden, ended:ended, redirect:redirect};
  }

  /* ---------- survey runner (used by Preview tab and public/run.html) ---------- */
  function mountRunner(el, def, opts){
    opts = opts||{};
    const state = {answers:{}, cur:null, hist:[], done:false, ord:{}};
    function optsOf(q){ if(!q.randomise) return q.options.map(o=>o.text); if(!state.ord[q.id]){ const a=q.options.map(o=>o.text); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } const oi=a.findIndex(x=>/^other/i.test(x)); if(oi>=0) a.push(a.splice(oi,1)[0]); state.ord[q.id]=a; } return state.ord[q.id]; }
    const CURR = ['INR (₹)','USD ($)','EUR (€)','GBP (£)','Other'];
    function render(){
      const c = compute(def, state.answers);
      if(opts.onTrace) opts.onTrace(c, state);
      if(state.done) return renderDone(c);
      if(!state.cur){ state.cur = c.vis[0] ? c.vis[0].id : null; }
      const q = def.questions.find(x=>x.id===state.cur);
      if(!q){ return finish(c); }
      const pos = c.vis.findIndex(x=>x.id===q.id);
      const total = c.vis.length + (c.ended?0:0);
      const sec = def.sections.find(s=>s.id===q.sectionId);
      el.innerHTML = '<div class="zk-run"><div class="meta">'+esc(sec?sec.name:'')+' · Question '+(pos+1)+' of '+total+'</div><div class="bar"><i style="width:'+Math.round(((pos)/Math.max(total,1))*100)+'%"></i></div>'
        + '<h2>'+esc(q.text)+(q.required?' <span style="color:#fda4af">*</span>':'')+'</h2>'+(q.help?'<p class="hint">'+esc(q.help)+'</p>':'<p class="hint"></p>')
        + '<div id="zkAns"></div><div class="err" id="zkErr"></div>'
        + '<div class="nav"><button class="zk-btn" id="zkBack" '+(state.hist.length?'':'disabled')+'>← Back</button><button class="zk-btn primary" id="zkNext">'+(pos>=total-1?'Submit':'Next →')+'</button></div></div>';
      drawAnswer(q, el.querySelector('#zkAns'));
      el.querySelector('#zkBack').onclick = ()=>{ state.cur = state.hist.pop(); render(); };
      el.querySelector('#zkNext').onclick = ()=>{
        const msg = check(q); if(msg){ el.querySelector('#zkErr').textContent = msg; return; }
        const cc = compute(def, state.answers);
        const curIdx = def.questions.findIndex(x=>x.id===q.id);
        const nxt = cc.vis.find(x=>def.questions.findIndex(y=>y.id===x.id)>curIdx);
        if(nxt){ state.hist.push(q.id); state.cur = nxt.id; render(); } else finish(cc);
      };
    }
    function isEmpty(v){ return toArr(v).length===0; }
    function check(q){
      const a = state.answers[q.id];
      if(q.type==='Lead Capture'){
        const o=a||{}; const any = o.name||o.mobile||o.email||o.city;
        if(q.required && !(o.name && (o.mobile||o.email))) return 'Please enter your name and a mobile number or email.';
        if(any && !o.consent) return 'Please tick the consent box so we can contact you.';
        return '';
      }
      if(q.required && isEmpty(a)) return 'This question is required.';
      if(q.type==='Email' && a && !/^\S+@\S+\.\S+$/.test(a)) return 'Enter a valid email address.';
      if(q.type==='Phone' && a && !/^[+\d][\d\s-]{6,}$/.test(a)) return 'Enter a valid phone number.';
      return '';
    }
    function set(q,v){ if(v===''||v==null||(Array.isArray(v)&&!v.length)) delete state.answers[q.id]; else state.answers[q.id]=v; }
    function drawAnswer(q, box){
      const a = state.answers[q.id];
      const t = q.type;
      if(t==='Single Choice'||t==='Image Choice'||t==='Yes / No'){
        const opts = t==='Yes / No' ? ['Yes','No'] : optsOf(q);
        opts.forEach(txt=>{ const b=document.createElement('button'); b.className='zk-opt'+(a===txt?' sel':''); b.innerHTML='<span class="dot"></span><span>'+esc(txt)+'</span>'; b.onclick=()=>{ set(q,txt); drawAnswer(q,box); }; box.appendChild(b); });
      } else if(t==='Multiple Choice'){
        const cur = Array.isArray(a)?a:[];
        optsOf(q).forEach(tx=>{ const o={text:tx}; const b=document.createElement('button'); b.className='zk-opt multi'+(cur.includes(o.text)?' sel':''); b.innerHTML='<span class="dot"></span><span>'+esc(o.text)+'</span>'; b.onclick=()=>{ const n = cur.includes(o.text)?cur.filter(x=>x!==o.text):cur.concat(o.text); set(q,n); drawAnswer(q,box); }; box.appendChild(b); });
      } else if(t==='Ranking'){
        const cur = Array.isArray(a)?a:[];
        box.innerHTML='<p class="hint">Tap in order of preference — 1 is most important.</p>';
        optsOf(q).forEach(tx=>{ const o={text:tx}; const r=cur.indexOf(o.text); const b=document.createElement('button'); b.className='zk-opt'+(r>=0?' sel':''); b.innerHTML='<span class="dot" style="display:grid;place-items:center;font-size:10px;font-weight:900;color:#fff">'+(r>=0?r+1:'')+'</span><span>'+esc(o.text)+'</span>'; b.onclick=()=>{ set(q, r>=0?cur.filter(x=>x!==o.text):cur.concat(o.text)); box.innerHTML=''; drawAnswer(q,box); }; box.appendChild(b); });
      } else if(t==='Dropdown'){
        const s=document.createElement('select'); s.className='zk-select'; s.innerHTML='<option value="">Select…</option>'+q.options.map(o=>'<option'+(a===o.text?' selected':'')+'>'+esc(o.text)+'</option>').join(''); s.onchange=()=>set(q,s.value); box.appendChild(s);
      } else if(t==='Rating'||t==='Star Rating'||t==='Scale / Likert'){
        const max = q.scaleMax || 5; const w=document.createElement('div'); w.className='zk-scale';
        for(let i=1;i<=max;i++){ const b=document.createElement('button'); b.textContent = t==='Star Rating' ? '★ '+i : i; if(String(a)===String(i)) b.className='sel'; b.onclick=()=>{ set(q,String(i)); w.querySelectorAll('button').forEach(x=>x.className=''); b.className='sel'; }; w.appendChild(b); }
        box.appendChild(w);
        if(t==='Scale / Likert'){ const l=document.createElement('div'); l.className='hint'; l.style.cssText='display:flex;justify-content:space-between;margin-top:8px'; l.innerHTML='<span>Strongly disagree / very low</span><span>Strongly agree / very high</span>'; box.appendChild(l); }
      } else if(t==='Long Text'){
        const x=document.createElement('textarea'); x.className='zk-textarea'; x.value=a||''; x.oninput=()=>set(q,x.value.trim()); box.appendChild(x);
      } else if(t==='Price / Currency'){
        const o = (typeof a==='string'? a.split(' '):[]); const w=document.createElement('div'); w.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:10px';
        w.innerHTML='<input class="zk-input" type="number" min="0" placeholder="Amount" value="'+esc(o[0]||'')+'"><select class="zk-select">'+CURR.map(c=>'<option'+((o.slice(1).join(' ')===c)?' selected':'')+'>'+c+'</option>').join('')+'</select>';
        const upd=()=>{ const am=w.children[0].value; set(q, am===''?'':am+' '+w.children[1].value); }; w.children[0].oninput=upd; w.children[1].onchange=upd; box.appendChild(w);
      } else if(t==='Lead Capture'){
        const o = Object.assign({},a||{}); const w=document.createElement('div');
        w.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input class="zk-input" data-k="name" placeholder="Full name"><input class="zk-input" data-k="mobile" placeholder="Mobile / WhatsApp"><input class="zk-input" data-k="email" placeholder="Email (optional)"><input class="zk-input" data-k="city" placeholder="City"></div><label class="zk-check"><input type="checkbox" data-k="consent"> '+esc(def.details.consentText||'I agree to be contacted about this launch. I can opt out any time.')+'</label>';
        w.querySelectorAll('[data-k]').forEach(inp=>{ const k=inp.dataset.k; if(inp.type==='checkbox') inp.checked=!!o[k]; else inp.value=o[k]||''; inp.oninput=inp.onchange=()=>{ o[k]= inp.type==='checkbox'?inp.checked:inp.value.trim(); if(k==='consent'){ if(o.consent){ o.consentText=def.details.consentText||'I agree to be contacted about this launch. I can opt out any time.'; o.consentAt=Date.now(); } else { delete o.consentText; delete o.consentAt; } } set(q, Object.values(o).some(v=>v)?Object.assign({},o):''); }; });
        box.appendChild(w);
      } else if(t==='Consent'){
        const l=document.createElement('label'); l.className='zk-check'; l.innerHTML='<input type="checkbox" '+(a?'checked':'')+'> I agree'; l.querySelector('input').onchange=e=>set(q,e.target.checked?'Agreed':''); box.appendChild(l);
      } else {
        const map={Text:'text',Number:'number',Phone:'tel',Email:'email',Date:'date',Location:'text'};
        const x=document.createElement('input'); x.className='zk-input'; x.type=map[t]||'text'; if(t==='Location') x.placeholder='City / area'; x.value=a||''; x.oninput=()=>set(q,x.value.trim()); box.appendChild(x);
      }
    }
    function finish(c){
      state.done=true; state.redirect=c.redirect;
      if(opts.onSubmit) opts.onSubmit(state.answers);
      render();
    }
    function renderDone(c){
      const rd = state.redirect;
      el.innerHTML='<div class="zk-run" style="text-align:center"><div style="font-size:42px">✓</div><h2>'+esc(def.details.title)+'</h2><p class="hint" style="font-size:15px;color:#cfd6ee">'+esc(def.details.thanks)+'</p>'
        + (rd ? '<p class="hint">'+(opts.preview?'A redirect rule would now send the respondent to:':'Redirecting…')+' <span style="color:#38d0ff">'+esc(rd)+'</span></p>' : '')
        + (opts.preview?'<button class="zk-btn" id="zkRestart">↺ Restart preview</button>':'')+'</div>';
      const b=el.querySelector('#zkRestart'); if(b) b.onclick=()=>{ state.answers={}; state.cur=null; state.hist=[]; state.done=false; render(); };
      if(rd && !opts.preview) setTimeout(()=>{ location.href=rd; }, 1800);
    }
    render();
    return {restart:()=>{ state.answers={}; state.cur=null; state.hist=[]; state.done=false; render(); }};
  }

  return {CHOICE,SCALE,TYPES,OPS,ACTIONS,STATUSES,LEAD_STATUSES,esc,slugify,getList,getDef,saveDef,touch,statusOf,createSurvey,duplicateSurvey,deleteSurvey,findBySlug,getResponses,addResponse,allResponses,addStart,getStarts,getLeadStatus,setLeadStatus,analyze,validate,compute,mountRunner,blankDef,usage,limitCheck,lastError:function(){return lastError;},nsKeys,TEMPLATES,segmentsOf,segMatch,segmentStats,segmentCrossTab,demoCount,insights,getBank,saveBank,bankToQuestion,getCampaigns,saveCampaigns,campaignSlug,campaignStats,getSettings,saveSettings,exportAll,importAll,resetAll,
    getCustomers,createCustomer,updateCustomer,deleteCustomer,getProjects,createProject,updateProject,deleteProject,projectLabel,surveysForProject,allAttribution,
    ROLES,getStrategy,addActivity,updateActivity,deleteActivity,autoSuggestStrategy,getCreativeTests,addCreativeTest,updateCreativeTest,deleteCreativeTest,messageQuestions,notifications,getUsers,createUser,updateUser,deleteUser};
})();
