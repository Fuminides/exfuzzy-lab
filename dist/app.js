'use strict';
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths = {
 workflow:'<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 6h6a3 3 0 0 1 3 3v6M6 9v7a2 2 0 0 0 2 2h7"/>',
 flask:'<path d="M9 3h6M10 3v6L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2L14 9V3M8 14h8"/>',
 database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/>',
 sliders:'<path d="M4 6h6m4 0h6M4 12h11m4 0h1M4 18h1m4 0h11"/><circle cx="12" cy="6" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="7" cy="18" r="2"/>',
 curves:'<path d="M2 19h20M2 19C6 19 6 5 11 5s5 14 9 14M9 19c4 0 4-10 8-10s4 10 6 10"/>',
 chart:'<path d="M4 3v17h17M8 15l4-5 4 2 5-6"/>',
 external:'<path d="M14 3h7v7M21 3l-9 9M10 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-5"/>',
 github:'<path d="M9 20c-5 1-5-3-7-3m14 5v-4c0-1-.1-2-1-2 3-.4 6-1.5 6-6 0-1.2-.4-2.4-1-3 .2-1 .2-2-.3-3-2-.3-3 .7-4 1a14 14 0 0 0-7 0c-1-.3-2-1.3-4-1C4.2 5 4.2 6 4.5 7A5 5 0 0 0 3 10c0 4.5 3 5.6 6 6-.8.4-1 1.2-1 2v4"/>',
 shield:'<path d="M12 2L3 6v6c0 6 9 10 9 10s9-4 9-10V6L12 2zM8 12l3 3 5-6"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4"/>',
 upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 play:'<path d="m8 4 12 8-12 8z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
 check:'<path d="m5 12 4 4L19 6"/>',
 leaf:'<path d="M20 3C7 1 2 10 8 16s15 1 12-13zM5 21 16 10"/>',
 copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 expand:'<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
function icons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
/* exFuzzy 3.3.0 learners. The browser engine ships PyMoo as pure-Python wheels, so every learner runs here. */
const LEARNERS={
 association_additive:{label:'Association rules, additive voting',short:'Association rules',cls:'FuzzyRulesClassifier',browser:true,recommended:true,speed:2,when:'You want a dependable first model. Every matching rule votes, so predictions are stable and the rule base stays small.',blurb:'Mines candidate rules on the fuzzy partitions, keeps a compact rule base with a genetic search, and lets every matching rule vote with its certainty-factor weight.'},
 association_sufficient:{label:'Association rules, strongest rule',short:'Association rules',cls:'FuzzyRulesClassifier',browser:true,speed:2,when:'You want each prediction explained by one rule you can point to. Only the strongest matching rule of each class counts.',blurb:'The same mining and selection, but at prediction time only the strongest matching rule of each class counts.'},
 ferl:{label:'FERL rule tree',short:'FERL',cls:'FERL',browser:true,speed:3,when:'You want results in seconds. Rules come from a tree, so they share conditions and read well in order.',blurb:'Grows a fuzzy rule tree greedily on the same partitions. Every tree node is a rule; votes use its class probabilities. Fast, with no genetic search.'},
 rule_mine:{label:'Rule mining + genetic optimisation',short:'RuleMineClassifier',cls:'RuleMineClassifier',browser:true,speed:1,when:'You want a second opinion from a different search. PyMoo selects the rule base from the mined candidates and the strongest rule decides.',blurb:'Mines candidate rules, then a PyMoo genetic algorithm selects the final rule base. The strongest rule decides; rules are weighted by their dominance score.'},
 rule_finetune:{label:'Rule mining + genetic fine-tuning',short:'RuleFineTuneClassifier',cls:'RuleFineTuneClassifier',browser:true,speed:1,when:'You want the search to go further and can wait the longest. A second genetic pass adjusts the selected rule base.',blurb:'Two PyMoo stages: first select the mined rules, then fine-tune the selected rule base with a second genetic search.'}};
const SPEED=['','Slower, genetic search','Moderate','Fastest'];
const learnerOf=key=>LEARNERS[key]||LEARNERS.association_additive;
const state = {step:'data', view:'workspace', queue:[], queueTotal:0, queueRestore:null, csv:null, fileName:'', meta:null, target:'', features:[], kinds:{}, separator:'auto',
 config:{learner:'association_additive',n_rules:15,n_ants:2,n_terms:3,n_gen:40,pop_size:40,seed:42,test_size:.25},
 runs:[],activeRun:0,resultTab:'overview',busy:false,ready:false,worker:null,pending:null,counter:0,ruleSearch:'',predictionFilter:'all'};
let toastTimer;
function toast(message,error=false){$('#toast').textContent=message;$('#toast').className='toast'+(error?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.add('hidden'),6500);}
function modal(html){$('#modal-body').innerHTML=html;icons();$('#modal').showModal();}
function closeModal(){$('#modal').close();}
/* The engine status lives in one place, the topbar: idle, warming up in the background, ready, or busy with the current task (then with Cancel). */
function engineStatus(text,spinning=false,cancellable=false){const el=$('#engine-status');el.hidden=!text;$('#engine-status-text').textContent=text||'';$('#engine-spinner').hidden=!spinning;$('#engine-cancel').hidden=!cancellable;}
function setProgress(message){engineStatus(message,true,true);}
function finishBusy(){state.busy=false;state.pending=null;engineStatus('');render();}
/* The engine boots quietly in the background; the user only sees it while it works on their request. */
function warmEngine(){if(state.worker||state.busy)return;state.warming=true;makeWorker().postMessage({action:'init'});}
function makeWorker(){
 if(state.worker)return state.worker;
 const w=new Worker('./worker.js?v=2');state.worker=w;  // the query defeats a stale cached worker
 w.onmessage=({data})=>{
  if(data.type==='progress'){state.bootMessage=data.message;state.bootStageAt=Date.now();if(state.busy)setProgress(data.message==='Training…'&&state.pending?.label||data.message);runHint();return;}
  if(data.type==='ready'){state.ready=true;state.warming=false;state.bootMessage='';runHint();return;}
  if(!state.pending){if(data.type==='error'){state.warming=false;state.worker?.terminate();state.worker=null;state.ready=false;}return;}
  if(data.id!==state.pending.id)return;
  const pending=state.pending;
  if(data.type==='error'){
   clearQueue();finishBusy();
   const detail=data.message.split('\n').filter(l=>l.trim()).slice(-3).join('\n');
   modal(`<h2 class="modal-title">Training failed.</h2><p class="modal-description">Your data is still in this browser. The engine reported:</p><pre class="error-detail">${esc(detail)}</pre><div class="modal-actions"><button class="button primary" data-action="close-modal">Back to workspace</button></div>`);
   return;
  }
  if(data.type==='result'){
   const run={...data.result,name:`Experiment ${String(state.runs.length+1).padStart(2,'0')}`,fileName:pending.fileName,csv:pending.csv,created:new Date().toISOString()};
   state.runs.push(run);state.activeRun=state.runs.length-1;state.step='results';state.view='workspace';state.resultTab='overview';state.ruleSearch='';state.predictionFilter='all';
   if(state.queue.length){state.busy=false;state.pending=null;nextQueued();return;}
   if(state.queueTotal){clearQueue();state.view='experiments';}
   finishBusy();
  }
 };
 w.onerror=()=>{const quiet=!state.busy;state.warming=false;state.bootMessage='';state.worker?.terminate();state.worker=null;state.ready=false;runHint();if(quiet)return;finishBusy();toast('The Python engine could not start. Check your connection, then try again.',true);};
 return w;
}
function send(action,csv,extra={}){
 if(state.busy){toast('Wait for the current task or cancel it first.');return;}
 state.busy=true;const id=++state.counter;
 state.pending={id,action,csv,fileName:extra.fileName||state.fileName,label:extra.label};
 state.warming=false;setProgress(state.ready?(extra.label||'Training…'):(state.bootMessage||'Starting Python in your browser (step 1 of 4)…'));
 render();makeWorker().postMessage({id,action,csv,config:extra.config||{separator:state.separator}});
}
async function loadSample(name){
 if(state.busy)return;
 try{const r=await fetch('./samples/'+name+'.csv');if(!r.ok)throw Error();const csv=await r.text();state.separator='auto';inspectLocal(csv,name==='iris'?'iris.csv':'materials.csv');}catch(e){toast('The example dataset could not be loaded. Please try again.',true);}
}
async function loadFile(file){
 if(!file)return;
 if(file.size>2*1024*1024){toast('Please use a CSV smaller than 2 MB for this browser workspace.',true);return;}
 try{inspectLocal(await file.text(),file.name);}catch(e){toast('The file could not be read.',true);}
}
/* Dataset inspection runs in JavaScript so the Data step never waits for Python. It mirrors engine.inspect_dataset:
   pandas' default missing-value tokens, numeric columns when every present value parses as a number (infinities count
   as missing, as the engine replaces them), and exFuzzy's rule that a whole-numbered column with at most 5 distinct
   values is categorical. The detected separator is passed to the engine so both read the file the same way. */
const NA_TOKENS=new Set(['','#N/A','#N/A N/A','#NA','-1.#IND','-1.#QNAN','-NaN','-nan','1.#IND','1.#QNAN','<NA>','N/A','NA','NULL','NaN','None','n/a','nan','null']);
const NUM_RE=/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/,INF_RE=/^[+-]?inf(inity)?$/i;
function parseCSV(text,sep){
 const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
  else if(c==='"')quoted=true;
  else if(c===sep){row.push(field);field='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);rows.push(row);row=[];field='';}
  else field+=c;}
 if(field!==''||row.length){row.push(field);rows.push(row);}
 return rows.filter(r=>!(r.length===1&&r[0].trim()===''));
}
function detectSeparator(text){
 const lines=text.split(/\r?\n/).filter(l=>l.trim()).slice(0,25);let best=',',bestScore=-1;
 for(const c of [',',';','\t','|']){const counts=lines.map(l=>l.split(c).length-1);const min=Math.min(...counts),max=Math.max(...counts);const score=min>0?(min===max?min*10:min):-1;if(score>bestScore){bestScore=score;best=c;}}
 return best;
}
function inspectCSV(text,separator='auto'){
 const sep=separator==='auto'?detectSeparator(text):separator;
 const rows=parseCSV(text,sep);if(rows.length<2)throw Error('The file needs a header row and data rows.');
 const header=rows[0].map(h=>String(h).trim()),data=rows.slice(1);
 if(new Set(header).size!==header.length)throw Error('Column names must be unique after trimming whitespace.');
 if(header.length<2)throw Error('The file needs at least one predictor and a target column. Check the delimiter.');
 if(data.length<10||data.length>5000)throw Error('This browser workspace supports 10 to 5,000 rows per dataset.');
 const columns=header.map((name,j)=>{
  const raw=data.map(r=>(r[j]??'').trim()),present=raw.filter(v=>!NA_TOKENS.has(v));
  const numeric=present.length>0&&present.every(v=>NUM_RE.test(v)||INF_RE.test(v));
  const values=numeric?present.filter(v=>!INF_RE.test(v)).map(Number):present;
  const uniq=[...new Set(values)];
  const kind=values.length===0?'numeric':!numeric?'categorical':(uniq.length<=5&&uniq.every(v=>Math.floor(v)===v))?'categorical':'numeric';
  return {name,kind,unique:uniq.length,missing:raw.length-values.length,examples:uniq.slice(0,4).map(String),numeric};
 });
 const cell=(v,col)=>{v=(v??'').trim();if(NA_TOKENS.has(v))return null;if(col.numeric)return INF_RE.test(v)?null:Number(v);return v;};
 const preview=data.slice(0,8).map(r=>Object.fromEntries(header.map((name,j)=>[name,cell(r[j],columns[j])])));
 const missing=columns.reduce((n,c)=>n+c.missing,0);
 return {rows:data.length,columns:columns.map(({numeric,...c})=>c),preview,missing,separator:sep};
}
function inspectLocal(csv,fileName){
 try{
  const meta=inspectCSV(csv,state.separator);
  state.csv=csv;state.fileName=fileName;state.meta=meta;state.separator=meta.separator;
  state.target=meta.columns.at(-1).name;state.features=meta.columns.filter(c=>c.name!==state.target).slice(0,12).map(c=>c.name);
  state.kinds=Object.fromEntries(meta.columns.map(c=>[c.name,c.kind]));state.step='data';state.view='workspace';render();
  warmEngine();
 }catch(e){modal(`<h2 class="modal-title">This file can't be used yet.</h2><p class="modal-description">${esc(e.message)}</p><div class="modal-actions"><button class="button primary" data-action="close-modal">Back to workspace</button></div>`);}
}
function currentRun(){return state.runs[state.activeRun];}
function configSnapshot(){return {...state.config,target:state.target,features:[...state.features],kinds:{...state.kinds},separator:state.separator};}
function runExperiment(){const invalid=$('#config-panel input:invalid');if(invalid){invalid.reportValidity();return;}if(!state.csv||!state.features.length){toast('Load a dataset and select at least one predictor.',true);return;}send('run',state.csv,{config:configSnapshot(),label:state.queueTotal?`Training ${learnerOf(state.config.learner).short} (${state.queueTotal-state.queue.length} of ${state.queueTotal})…`:undefined});}
/* Compare all learners: the same data, split and budget, one run per learner, then the Experiments table. */
function runAll(){if(!state.csv||!state.features.length){toast('Load a dataset and select at least one predictor.',true);return;}if(state.busy){toast('Wait for the current task or cancel it first.');return;}closeModal();state.queue=Object.keys(LEARNERS);state.queueTotal=state.queue.length;state.queueRestore=state.config.learner;nextQueued();}
function nextQueued(){state.config.learner=state.queue.shift();runExperiment();}
function clearQueue(){if(state.queueRestore)state.config.learner=state.queueRestore;state.queue=[];state.queueTotal=0;state.queueRestore=null;}
function panelHeader(title,subtitle,glyph='database',right=''){return `<div class="panel-head"><div class="panel-title"><span>${icon(glyph)}</span><div><h3>${title}</h3><p>${subtitle}</p></div></div>${right}</div>`;}
function dropzone(){return `<div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="Upload a CSV dataset"><div class="upload-symbol">${icon('upload')}</div><h4>Drop a CSV here</h4><p>Explore your data and learn fuzzy rules. Everything stays in this browser.</p><span class="button primary">${icon('plus')}Choose dataset</span><small class="file-hint">CSV or TSV · up to 5,000 rows · 2 MB</small></div>`;}
function sampleCards(){return `<div class="or-line">OR EXPLORE A SAMPLE DATASET</div><div class="sample-grid"><button class="sample-card" data-sample="iris"><span class="sample-glyph">✳</span><span><strong>Iris flowers</strong><small>150 rows · 4 numeric predictors</small></span><span class="sample-arrow">↗</span></button><button class="sample-card" data-sample="materials"><span class="sample-glyph">◈</span><span><strong>Material screening</strong><small>240 rows · mixed data · synthetic</small></span><span class="sample-arrow">↗</span></button></div>`;}
function dataPanel(){
 if(!state.meta)return `<div class="panel-body import-body">${dropzone()}${sampleCards()}<div class="center"><button class="paste-action" data-action="paste">Or paste tabular data</button></div></div>`;
 const m=state.meta,num=m.columns.filter(c=>state.kinds[c.name]==='numeric').length;
 return `<div class="panel-body"><div class="dataset-summary"><span>${icon('database')}</span><div><strong>${esc(state.fileName)}</strong><small>${m.rows.toLocaleString()} rows · ${m.columns.length} columns</small></div><button class="button subtle small" data-action="datasets">Replace</button></div><div class="stats-row"><div class="stat-box"><small>NUMERIC</small><strong>${num}</strong><span class="unit">columns</span></div><div class="stat-box"><small>CATEGORICAL</small><strong>${m.columns.length-num}</strong><span class="unit">columns</span></div><div class="stat-box"><small>MISSING VALUES</small><strong>${m.missing}</strong><span class="unit">cells</span></div></div><p class="section-description">Choose the target on the right. Tick the predictors to include and correct a detected type if needed.</p><div class="table-wrap"><table><thead><tr><th>USE</th><th>COLUMN</th><th>TYPE</th><th>UNIQUE</th><th>MISSING</th></tr></thead><tbody>${m.columns.map(c=>`<tr><td>${c.name===state.target?'<span class="pill">TARGET</span>':`<input type="checkbox" aria-label="Use ${esc(c.name)} as predictor" data-feature="${esc(c.name)}" ${state.features.includes(c.name)?'checked':''} ${state.busy?'disabled':''}>`}</td><td title="${esc(c.examples.join(', '))}">${esc(c.name)}</td><td><select aria-label="Type of ${esc(c.name)}" data-kind="${esc(c.name)}" ${state.busy?'disabled':''}><option value="numeric" ${state.kinds[c.name]==='numeric'?'selected':''}>Numeric</option><option value="categorical" ${state.kinds[c.name]==='categorical'?'selected':''}>Categorical</option></select></td><td>${c.unique}</td><td>${c.missing?'<span class="missing-cell">'+c.missing+'</span>':'—'}</td></tr>`).join('')}</tbody></table></div><div class="table-caption"><span>DATA PREVIEW</span><span>First ${m.preview.length} rows</span></div><div class="table-wrap"><table><thead><tr>${m.columns.map(c=>`<th>${esc(c.name)}</th>`).join('')}</tr></thead><tbody>${m.preview.map(row=>`<tr>${m.columns.map(c=>`<td title="${esc(row[c.name])}">${esc(row[c.name]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}
function preparePanel(){
 if(!state.meta)return emptyData('Import a dataset first.');
 const rows=state.meta.rows, fraction=state.config.test_size;
 return `<div class="panel-body"><div class="setup-banner"><strong>${esc(state.target)}</strong> is your target. The model will learn from <strong>${state.features.length} predictors</strong> and predict the target class for held-out rows.</div><h3 class="sub-title">Stratified holdout</h3><p class="section-description">Class proportions are preserved in a seeded split. Each run records the exact row assignments.</p><div class="split-bar"><div class="split-train" style="width:${(1-fraction)*100}%"></div><div class="split-test" style="width:${fraction*100}%"></div></div><div class="split-labels"><span>Training · ${Math.round((1-fraction)*100)}%</span><span>Test · ${Math.round(fraction*100)}%</span></div><div class="table-caption"><span>PREPROCESSING POLICY</span><span>Fitted on training data only</span></div><div class="table-wrap"><table><thead><tr><th>COLUMN</th><th>TYPE</th><th>MISSING VALUES</th></tr></thead><tbody>${state.features.map(f=>`<tr><td>${esc(f)}</td><td>${state.kinds[f]==='categorical'?'Categorical':'Numeric'}</td><td>${state.kinds[f]==='categorical'?'Explicit (missing) category':'Training median'}</td></tr>`).join('')}</tbody></table></div><div class="note">${icon('shield')} Numeric fuzzy partitions are built from training rows only. Categories use exact-match memberships. Unseen test categories fire no category term. Rows with a missing target are excluded before splitting.</div></div>`;
}
function illustration(){return `<svg class="empty-art" viewBox="0 0 180 100" fill="none" aria-hidden="true"><path d="M12 82H168M26 15v67" stroke="#dfe7d3"/><path d="M26 82C45 82 44 21 68 21s25 61 45 61" stroke="#90ab73" stroke-width="2.4"/><path d="M65 82c21 0 21-43 43-43s22 43 43 43" stroke="#bcaccd" stroke-width="2.4"/><path d="M26 82C45 82 44 21 68 21s25 61 45 61" fill="#eff4e7" opacity=".4"/><circle cx="107" cy="39" r="4" fill="#bcaccd"/><circle cx="68" cy="21" r="4" fill="#90ab73"/><path d="M126 16h29M126 23h18" stroke="#e0e6d7" stroke-width="3" stroke-linecap="round"/></svg>`;}
function emptyData(title){return `<div class="empty-results">${illustration()}<h3>${title}</h3><p>Import a CSV or explore a sample. Numeric and categorical predictors both work.</p><button class="button primary" data-step="data">${icon('database')}Choose dataset</button></div>`;}
function modelPanel(){
 const L=learnerOf(state.config.learner),ferl=L.cls==='FERL';
 return `<div class="panel-body"><div class="learner-row"><div><h3 class="sub-title">${esc(L.label)}</h3><p class="section-description">${esc(L.blurb)}</p></div><button class="button outline small" data-action="learner">Change learner</button></div><p class="plan-line">At most <strong>${state.config.n_rules}</strong> rules of up to <strong>${Math.min(state.config.n_ants,state.features.length||12)}</strong> condition${Math.min(state.config.n_ants,state.features.length||12)===1?'':'s'}${ferl?' (tree depth)':''}, <strong>${state.config.n_terms}</strong> terms per numeric predictor and one crisp set per category${ferl?'':`, <strong>${state.config.n_gen}</strong> generations of <strong>${state.config.pop_size}</strong>`}, seed <strong>${state.config.seed}</strong>.</p><div class="note">${ferl?'FERL grows the tree greedily until the rule budget or the depth is reached. Generations and population size do not apply.':`Search stops early after ${Math.min(20,state.config.n_gen)} generations without improvement. All selected predictors are kept; candidate rules require 0.05 support and 0.5 confidence. Up to 40 candidates per class enter selection.`}</div></div>`;
}
const percent=v=>(v*100).toFixed(1)+'%';
function resultPanel(){
 const r=currentRun();
 if(!r)return `<div class="empty-results">${illustration()}<h3>No results yet</h3><p>Run an experiment to see held-out performance, readable rules and the fitted fuzzy sets.</p><button class="button outline" data-step="model">Configure your model ${icon('arrow')}</button><p class="example-link"><button class="paste-action" data-action="explore-example">Preview the rules &amp; fuzzy sets explorer with an example result</button></p></div>`;
 let content=state.resultTab==='rules'?ruleResults(r):state.resultTab==='partitions'?partitionResults(r):state.resultTab==='predictions'?predictionResults(r):overviewResults(r);
 return panelHeader('Results',esc(r.fileName)+' · '+esc(r.name),'chart',`<select class="run-selector" id="run-selector" aria-label="View experiment">${state.runs.map((v,i)=>`<option value="${i}" ${i===state.activeRun?'selected':''}>${esc(v.name)}</option>`).join('')}</select>`)+`<div class="panel-body"><div class="results-meta"><span><strong>${esc(r.learner_label||learnerOf(r.config?.learner).label)}</strong></span><span><strong>${r.train_rows}</strong> training rows</span><span><strong>${r.test_rows}</strong> test rows</span><span><strong>${r.rules.length}</strong> rules</span><span><strong>${r.elapsed}s</strong> fit & evaluation</span></div><div class="metric-grid">${[['Macro F1','macro_f1'],['Accuracy','accuracy'],['Balanced accuracy','balanced_accuracy']].map(([label,key])=>`<div class="metric-card"><small>${label.toUpperCase()}</small><div class="metric-value">${percent(r.test_metrics[key])}</div><p>Train ${percent(r.train_metrics[key])}</p></div>`).join('')}</div><div class="explore-cta"><img class="cta-mark" src="./brand/exfuzzy-mark.png" alt=""><div><strong>Explore rules &amp; fuzzy sets</strong><p>Readable rules, large membership plots, linked selection.</p></div><div class="cta-actions"><button class="button primary" data-action="explore">${icon('curves')}Explore rules &amp; fuzzy sets</button><button class="button ghost" data-action="export">${icon('download')}Save model</button></div></div><nav class="result-tabs" aria-label="Result views">${[['overview','Overview'],['rules','Rules · '+r.rules.length],['partitions','Fuzzy sets'],['predictions','Predictions']].map(([key,label])=>`<button data-result-tab="${key}" class="${state.resultTab===key?'active':''}">${label}</button>`).join('')}</nav><div id="result-content">${content}</div><div class="step-actions"><button class="button subtle small" data-view="experiments">Compare experiments ${icon('arrow')}</button></div></div>`;
}
function overviewResults(r){
 const max=Math.max(...r.confusion.flat(),1);
 return `<h3 class="sub-title">Held-out confusion matrix</h3><p class="axis-label">Confusion matrix · held-out data · rows = actual, columns = predicted</p><div class="table-wrap"><table class="confusion-table"><thead><tr><th>ACTUAL ↓ / PREDICTED →</th>${r.classes.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${r.confusion.map((row,i)=>`<tr><th>${esc(r.classes[i])}</th>${row.map((v,j)=>`<td title="Actual ${esc(r.classes[i])}, predicted ${esc(r.classes[j])}: ${v}" style="background:${i===j?`rgba(31,90,67,${.08+.4*v/max})`:`rgba(196,164,112,${.08+.3*v/max})`}">${v}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="table-caption"><span>PER-CLASS PERFORMANCE</span><span>${r.conditions} total conditions</span></div><div class="table-wrap"><table><thead><tr><th>CLASS</th><th>PRECISION</th><th>RECALL</th><th>F1</th><th>TEST ROWS</th></tr></thead><tbody>${r.classes.map(c=>{const m=r.report[c];return `<tr><td>${esc(c)}</td><td>${percent(m.precision)}</td><td>${percent(m.recall)}</td><td>${percent(m['f1-score'])}</td><td>${m.support}</td></tr>`;}).join('')}</tbody></table></div>${r.notes.map(n=>`<div class="note warning">${esc(n)}</div>`).join('')}${r.warnings.length?`<details class="note warning"><summary>Library notices (${r.warnings.length})</summary>${r.warnings.map(esc).join('<br>')}</details>`:''}<div class="note">A stratified holdout measures this seeded run. Repeated tuning against the same test set can overfit the evaluation; use a separate final dataset when reporting research results.</div>`;
}
function ruleResults(r){return `<div class="rule-filter"><input type="search" id="rule-search" placeholder="Search a feature, term or class…" aria-label="Search rules" value="${esc(state.ruleSearch)}"><button class="button subtle small" data-action="download-rules">${icon('download')}Rules.txt</button></div><p class="section-description">Confidence and support are computed on training data. Weights are penalized certainty factors; they are not prediction probabilities.</p><div id="rule-list">${ruleList(r)}</div>`;}
function ruleList(r){
 const q=state.ruleSearch.toLowerCase();const list=r.rules.filter(rule=>JSON.stringify(rule.conditions).toLowerCase().includes(q)||rule.consequent.toLowerCase().includes(q));
 if(!r.rules.length)return '<div class="note warning">No rules met the selection criteria. The classifier predicts the training majority class. Try a larger rule budget or a different partition count.</div>';
 if(!list.length)return '<div class="note">No rules match your search.</div>';
 return list.map(rule=>`<article class="rule-card"><div class="rule-line"><span class="rule-number">${String(rule.id).padStart(2,'0')}</span><span class="rule-key">IF</span>${rule.conditions.map((c,i)=>`${i?'<span class="rule-key">AND</span>':''}<span>${esc(c.feature)} is <span class="term">${esc(c.term)}</span></span>`).join('')}<span class="rule-key">THEN</span><span class="term consequent">${esc(rule.consequent)}</span></div><div class="rule-meta"><span><strong>${percent(rule.confidence)}</strong> confidence</span><span><strong>${percent(rule.support)}</strong> class support</span><span><strong>${rule.weight==null?'—':rule.weight.toFixed(3)}</strong> weight</span></div></article>`).join('');
}
const colors=['#0072b2','#e69f00','#009e73','#cc79a7','#d55e00']; /* same palette as the explorer */
function chart(v){
 const lo=v.x[0],hi=v.x.at(-1),W=460,H=126,L=28,R=445,T=12,B=105;
 const lines=[0,.5,1].map(y=>`<line x1="${L}" x2="${R}" y1="${B-y*(B-T)}" y2="${B-y*(B-T)}" stroke="#e9eedf" stroke-dasharray="3 4"/><text x="6" y="${B-y*(B-T)+3}">${y}</text>`).join('');
 return `<svg viewBox="0 0 ${W} ${H}" class="numeric-chart" role="img" aria-label="Fitted membership functions for ${esc(v.name)}">${lines}${v.terms.map((t,i)=>{const pts=t.y.map((y,j)=>`${L+j/(v.x.length-1)*(R-L)},${B-y*(B-T)}`).join(' ');return `<polygon points="${L},${B} ${pts} ${R},${B}" fill="${colors[i%colors.length]}" opacity=".06"/><polyline points="${pts}" fill="none" stroke="${colors[i%colors.length]}" stroke-width="2"/>`;}).join('')}<text x="${L}" y="122">${Number(lo.toPrecision(4))}</text><text x="${R}" y="122" text-anchor="end">${Number(hi.toPrecision(4))}</text></svg>`;
}
function partitionResults(r){return `<p class="section-description">Actual partitions fitted on training rows. Numeric terms use trapezoidal membership functions. Categories retain crisp equality memberships.</p>${r.variables.map(v=>`<div class="partition-card"><span class="pill">${v.kind==='numeric'?'NUMERIC':'CATEGORICAL'}</span><h4>${esc(v.name)}</h4>${v.kind==='numeric'?`${chart(v)}<div class="legend-row">${v.terms.map((t,i)=>`<span><i style="background:${colors[i%colors.length]}"></i>${esc(t.name)}</span>`).join('')}</div>`:`<div class="category-chips">${v.terms.map(t=>`<span>${esc(t.name)}</span>`).join('')}</div><p class="form-hint">Membership is 1 for a matching category and 0 otherwise.</p>`}</div>`).join('')}`;}
function predictionResults(r){return `<div class="rule-filter"><select id="prediction-filter" aria-label="Filter predictions"><option value="all" ${state.predictionFilter==='all'?'selected':''}>All test rows</option><option value="errors" ${state.predictionFilter==='errors'?'selected':''}>Errors only</option><option value="fallback" ${state.predictionFilter==='fallback'?'selected':''}>Majority fallback</option></select><button class="button subtle small" data-action="download-predictions">${icon('download')}Predictions.csv</button></div><p class="section-description">Row numbers refer to the original CSV, including its header. Fallback means no rule fired and the training majority class was used.</p><div id="prediction-list">${predictionTable(r)}</div>`;}
function predictionTable(r){const rows=r.predictions.filter(p=>state.predictionFilter==='all'||state.predictionFilter==='errors'&&!p.correct||state.predictionFilter==='fallback'&&p.fallback);return `<div class="table-caption"><span>${rows.length} MATCHING TEST ROWS</span><span>Showing up to 150</span></div><div class="table-wrap"><table><thead><tr><th>CSV ROW</th><th>ACTUAL</th><th>PREDICTED</th><th>RESULT</th><th>FALLBACK</th></tr></thead><tbody>${rows.slice(0,150).map(p=>`<tr><td title="${esc(Object.entries(p.values).map(([k,v])=>k+': '+v).join(' · '))}">${p.row}</td><td>${esc(p.actual)}</td><td>${esc(p.predicted)}</td><td><span class="${p.correct?'status-correct':'status-error'}">${p.correct?'Correct':'Error'}</span></td><td>${p.fallback?'Yes':'—'}</td></tr>`).join('')||'<tr><td colspan="5">No rows match this filter.</td></tr>'}</tbody></table></div>`;}
/* Settings follow the step: data and prepare show the target and the split; model and results show the learner and its budget. */
function configPanel(){
 const c=state.config,m=state.meta,dis=state.busy?'disabled':'';
 const target=`<div class="form-field"><label class="config-label" for="target">Target variable</label><select id="target" ${!m||state.busy?'disabled':''}>${m?m.columns.map(x=>`<option value="${esc(x.name)}" ${x.name===state.target?'selected':''}>${esc(x.name)}</option>`).join(''):'<option>Choose a dataset first</option>'}</select><p class="form-hint">The class to predict.</p></div>`;
 const split=`<div class="form-field"><label class="config-label" for="test_size">Train / test split <span class="field-value">${Math.round((1-c.test_size)*100)} / ${Math.round(c.test_size*100)}</span></label><input type="range" id="test_size" data-config="test_size" min=".15" max=".4" step=".05" value="${c.test_size}" ${dis}><div class="range-legend"><span>More training</span><span>More testing</span></div></div><div class="form-field"><label class="config-label" for="seed">Random seed</label><input type="number" id="seed" data-config="seed" min="0" max="2147483646" value="${c.seed}" ${dis}><p class="form-hint">Fixes the stratified split and the search.</p></div>`;
 const learnerL=learnerOf(c.learner),ferl=learnerL.cls==='FERL';
 const model=`<button type="button" class="model-label" data-action="learner" ${dis} aria-label="Choose the fuzzy model">${icon('curves')}<div><strong>${esc(learnerL.label)}</strong><small>Fuzzy model · change</small></div><span class="model-chevron">›</span></button><div class="form-split"><div class="form-field"><label class="config-label" for="n_rules">Rule budget</label><input type="number" id="n_rules" data-config="n_rules" min="2" max="40" value="${c.n_rules}" ${dis}></div><div class="form-field"><label class="config-label" for="n_terms">Numeric terms</label><select id="n_terms" data-config="n_terms" ${dis}>${[2,3,4,5].map(v=>`<option ${v===c.n_terms?'selected':''}>${v}</option>`).join('')}</select></div></div>${ferl?'':`<div class="form-field"><label class="config-label" for="n_gen">Generations</label><input type="number" id="n_gen" data-config="n_gen" min="1" max="200" value="${c.n_gen}" ${dis}><p class="form-hint">Search budget; stops early when it stops improving.</p></div>`}<button class="button subtle small config-link" data-action="advanced">${icon('sliders')}Advanced settings</button>`;
 const run=`<div class="config-button"><button class="button primary full" data-action="run" ${!state.csv||!state.features.length||state.busy?'disabled':''}>${state.busy?'<span class="spinner"></span>Working…':icon('play')+(state.runs.length?'Run again':'Run experiment')}</button><p class="form-hint" id="run-hint">${runHintText()}</p></div>`;
 const early=state.step==='data'||state.step==='prepare';
 return `<div class="panel-head"><h3>${early?'Data settings':'Model settings'}</h3></div><div class="config-body">${early?target+split+`<div class="config-button"><button class="button primary full" data-step="${state.step==='data'?'prepare':'model'}">${state.step==='data'?'Continue to prepare':'Continue to model'} ${icon('arrow')}</button></div>`:model+run}</div>`;
}
function experimentView(){
 if(!state.runs.length)return `<div class="experiments-heading"><div><div class="eyebrow">YOUR RESEARCH NOTEBOOK</div><h1>Experiments, side by side.</h1><p>Keep the data and split fixed. Change one idea at a time.</p></div></div><section class="main-panel"><div class="empty-results">${illustration()}<h3>Make room for your first discovery.</h3><p>Completed runs will appear here for comparison. Save a model to keep it after this session.</p><button class="button primary" data-view="workspace">${icon('plus')}Build an experiment</button></div></section>`;
 const groups=new Set(state.runs.map(r=>(r.dataset_sha256||r.csv)+':'+r.config.target));
 return `<div class="experiments-heading"><div><div class="eyebrow">YOUR RESEARCH NOTEBOOK</div><h1>Experiments, side by side.</h1><p>${state.runs.length} completed runs in this tab. Save the models you want to keep.</p></div><button class="button outline" data-action="new">${icon('plus')}New experiment</button></div>${groups.size>1?'<div class="note warning">These runs include different datasets or targets. Their metrics are not directly comparable.</div>':''}<div class="compare-card"><h3>Performance & interpretability</h3><div class="table-wrap"><table><thead><tr><th>EXPERIMENT</th><th>DATASET / TARGET</th><th>TEST MACRO F1</th><th>ACCURACY</th><th>RULES</th><th>CONDITIONS</th><th>SEED</th><th>TEST %</th><th></th></tr></thead><tbody>${state.runs.map((r,i)=>`<tr><td>${esc(r.name)}<p class="form-hint">${esc(learnerOf(r.config.learner).short)} · ${r.elapsed}s · ${r.config.n_terms} terms · budget ${r.config.n_rules}</p></td><td>${esc(r.fileName)}<p class="form-hint">${esc(r.config.target)}</p></td><td>${percent(r.test_metrics.macro_f1)}<div class="metric-bar"><div style="width:${r.test_metrics.macro_f1*100}%"></div></div></td><td>${percent(r.test_metrics.accuracy)}</td><td>${r.rules.length}</td><td>${r.conditions}</td><td>${r.config.seed}</td><td>${Math.round(r.config.test_size*100)}</td><td><button class="button subtle small" data-open-run="${i}">Explore ↗</button></td></tr>`).join('')}</tbody></table></div></div><div class="note">Compare runs on the same data, target, predictors and split. Changing the seed or test size changes the held-out rows. All preprocessing is fitted on training data only.</div>`;
}
function render(){
 $('#workspace-view').classList.toggle('hidden',state.view!=='workspace');$('#experiments-view').classList.toggle('hidden',state.view!=='experiments');$('#explorer-view').classList.toggle('hidden',state.view!=='explorer');
 document.querySelectorAll('.nav-item[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===(state.view==='explorer'?'workspace':state.view)));
 $('#run-count').textContent=state.runs.length;
 $('#export-top').classList.toggle('hidden',!state.runs.length||state.view!=='workspace');
 if(state.view==='experiments')$('#experiments-view').innerHTML=experimentView();
 else if(state.view==='explorer')renderExplorer();
 else{
  const order=['data','prepare','model','results'],idx=order.indexOf(state.step);
  document.querySelectorAll('.step').forEach(el=>{const i=order.indexOf(el.dataset.step);el.classList.toggle('selected',i===idx);el.classList.toggle('done',i<idx||(el.dataset.step==='data'&&!!state.meta&&i!==idx)||(el.dataset.step==='results'&&!!state.runs.length&&i!==idx));el.setAttribute('aria-current',i===idx?'step':'false');});
  $('#node-data').textContent=state.meta?`${state.fileName} · ${state.meta.rows} rows`:'No dataset yet';
  $('#node-prepare').textContent=state.meta?`${state.features.length} predictors → ${state.target} · ${Math.round((1-state.config.test_size)*100)}/${Math.round(state.config.test_size*100)}`:'Target and split';
  $('#node-model-tag').textContent=learnerOf(state.config.learner).label;
  $('#node-result').textContent=state.runs.length?state.runs.length+' completed run'+(state.runs.length>1?'s':''):'Rules and fuzzy sets';
  const heads={data:state.meta?['Dataset','Check the columns, choose the target, then continue.']:['Start with a dataset','Import a CSV to discover interpretable fuzzy rules.'],prepare:['Prepare the experiment','Choose the target, the predictors and an honest holdout split.'],model:['Build an interpretable model','Pick a learner and its budget, then run.'],results:['Results','Performance, rules and fuzzy sets for this run.']};
  $('#page-title').textContent=heads[state.step][0];$('#page-sub').textContent=heads[state.step][1];
  $('#main-panel').innerHTML=state.step==='data'?dataPanel():state.step==='prepare'?preparePanel():state.step==='model'?modelPanel():resultPanel();
  $('#config-panel').innerHTML=configPanel();
  const single=!state.meta;$('#config-panel').classList.toggle('hidden',single);$('.workspace-grid').classList.toggle('single',single);$('#main-panel').classList.toggle('import',single&&state.step==='data');
 }
 icons();
 const dz=$('#dropzone');if(dz){dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('drag-over');});dz.addEventListener('dragleave',()=>dz.classList.remove('drag-over'));dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('drag-over');loadFile(e.dataTransfer.files[0]);});dz.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();$('#file-input').click();}});}
}
function datasetsModal(){modal(`<div class="eyebrow">BRING YOUR QUESTION</div><h2 class="modal-title">Choose your dataset.</h2><p class="modal-description">Use your own CSV, paste a table, or start with an example. Data stays in this tab.</p><button class="dataset-choice" data-action="choose-file">${icon('upload')}<div><strong>Upload your CSV</strong><p>Numeric and categorical data · up to 5,000 rows · 2 MB</p></div></button><button class="dataset-choice" data-sample="iris">${icon('leaf')}<div><strong>Iris flowers</strong><p>150 flowers, four measurements, three species · scikit-learn Iris</p></div></button><button class="dataset-choice" data-sample="materials">${icon('flask')}<div><strong>Material screening</strong><p>240 synthetic samples · numeric measurements + categorical process</p></div></button><div class="data-controls"><label class="form-hint" for="separator">CSV delimiter</label><select id="separator"><option value="auto" ${state.separator==='auto'?'selected':''}>Detect automatically</option><option value="," ${state.separator===','?'selected':''}>Comma</option><option value=";" ${state.separator===';'?'selected':''}>Semicolon</option><option value="\t" ${state.separator==='\t'?'selected':''}>Tab</option></select><button class="paste-action" data-action="paste">Paste data instead</button></div>`);}
function advancedModal(){const c=state.config;modal(`<div class="eyebrow">A LITTLE MORE CONTROL</div><h2 class="modal-title">Search settings.</h2><p class="modal-description">More conditions allow richer rules, but increase the candidate search. Start small and compare.</p><div class="form-split"><div class="form-field"><label class="config-label" for="adv-ants">Max conditions per rule</label><select id="adv-ants">${[1,2,3].map(n=>`<option ${c.n_ants===n?'selected':''}>${n}</option>`).join('')}</select></div><div class="form-field"><label class="config-label" for="adv-pop">Population size</label><input type="number" id="adv-pop" min="4" max="100" value="${c.pop_size}"></div></div><div class="note">The browser workspace supports up to 12 predictors and 24 training categories per categorical predictor. The learner is exFuzzy's FuzzyRulesClassifier with fixed fuzzy partitions and additive weighted rule voting.</div><div class="modal-actions"><button class="button outline" data-action="close-modal">Cancel</button><button class="button primary" data-action="save-advanced" ${state.busy?'disabled':''}>Apply settings</button></div>`);}
function learnerModal(){const speed=n=>`<span class="speed" aria-hidden="true">${[1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>${SPEED[n]}`;modal(`<h2 class="modal-title">Choose a learner.</h2><p class="modal-description">All learners share the same fuzzy partitions, split and evaluation, so runs stay comparable. Rule budget and conditions per rule apply to every learner.</p><div class="learner-list" role="group" aria-label="Learners">${Object.entries(LEARNERS).map(([key,L])=>`<button type="button" class="learner-choice${key===state.config.learner?' selected':''}" data-action="pick-learner" data-learner="${key}" aria-pressed="${key===state.config.learner}"><span class="learner-check" aria-hidden="true">${key===state.config.learner?icon('check'):''}</span><span class="learner-text"><span class="learner-head"><strong>${esc(L.label)}</strong>${L.recommended?'<span class="learner-tag">Recommended</span>':''}</span><p class="when">${esc(L.when)}</p><span class="learner-meta"><span>${speed(L.speed)}</span><span>${esc(L.cls)}${L.cls.startsWith('Rule')?' · PyMoo':''}</span></span></span></button>`).join('')}</div><div class="modal-foot"><p>Not sure? Run every learner on this split and pick from the results table.</p><button type="button" class="button outline" data-action="run-all" ${!state.csv||!state.features.length||state.busy?'disabled':''}>${icon('flask')}Compare all learners</button></div>`);}
function runHintText(){return state.ready?'Python engine ready · runs locally in this browser':state.bootMessage?'Preparing the Python engine: '+state.bootMessage.replace(/…$/,'')+'. Run will start when it is ready.':'The Python engine starts on first use.';}
function runHint(){const el=$('#run-hint');if(el)el.textContent=runHintText();}
setInterval(()=>{if(!state.busy||state.ready||!state.bootStageAt)return;const s=Math.round((Date.now()-state.bootStageAt)/1000);if(s>=25&&s%5===0)setProgress(state.bootMessage.replace(/…$/,'')+` · still working after ${s}s. Files come from this site's /pyodide/ folder; check the browser's network panel if this never finishes.`);},1000);
function cancelTask(){clearQueue();state.worker?.terminate();state.worker=null;state.ready=false;state.warming=false;finishBusy();toast('Task stopped. Your data and completed experiments are still in this tab.');}
function csvEscape(v){return '"'+String(v??'').replaceAll('"','""')+'"';}
function predictionCSV(r){const fs=r.config.features;return ['csv_row,actual,predicted,correct,majority_fallback,'+fs.map(csvEscape).join(','),...r.predictions.map(p=>[p.row,p.actual,p.predicted,p.correct,p.fallback,...fs.map(f=>p.values[f])].map(csvEscape).join(','))].join('\r\n');}
function download(name,content,type='text/plain'){const blob=content instanceof Blob?content:new Blob([content],{type});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
// Small, uncompressed ZIP writer. All files remain on the user's device.
function zipFiles(files){
 const enc=new TextEncoder();const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
 const local=[],central=[];let offset=0;
 const u16=(d,o,n)=>d.setUint16(o,n,true),u32=(d,o,n)=>d.setUint32(o,n>>>0,true);
 for(const [name,content] of Object.entries(files)){
  const n=enc.encode(name),b=content instanceof Uint8Array?content:enc.encode(content);let crc=0xffffffff;for(const byte of b)crc=crcTable[(crc^byte)&255]^(crc>>>8);crc=(crc^0xffffffff)>>>0;
  const h=new Uint8Array(30+n.length),d=new DataView(h.buffer);u32(d,0,0x04034b50);u16(d,4,20);u16(d,6,0x800);u32(d,14,crc);u32(d,18,b.length);u32(d,22,b.length);u16(d,26,n.length);h.set(n,30);
  local.push(h,b);const c=new Uint8Array(46+n.length),v=new DataView(c.buffer);u32(v,0,0x02014b50);u16(v,4,20);u16(v,6,20);u16(v,8,0x800);u32(v,16,crc);u32(v,20,b.length);u32(v,24,b.length);u16(v,28,n.length);u32(v,42,offset);c.set(n,46);central.push(c);offset+=h.length+b.length;
 }
 const csize=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),d=new DataView(end.buffer);u32(d,0,0x06054b50);u16(d,8,central.length);u16(d,10,central.length);u32(d,12,csize);u32(d,16,offset);return new Blob([...local,...central,end],{type:'application/zip'});
}
function saveModelModal(){
 const r=currentRun();if(!r)return;if(!r.model_b64){toast('This stored example has no saved model. Run an experiment to save one.',true);return;}
 modal(`<h2 class="modal-title">Save this model.</h2><p class="modal-description">One zip with the trained model and everything needed to use it or train it again. Nothing leaves this browser until you download it.</p><ul class="save-list"><li><code>model.pkl</code><span>The trained model with its preprocessing. Reload it in Python without training again.</span></li><li><code>load_model.py</code><span>Predicts the classes of a new CSV with the saved model.</span></li><li><code>rules.txt</code><span>The rules as text, with <code>fuzzy_sets.txt</code> for the partitions.</span></li><li><code>experiment.py</code><span>The same training code the app ran, with <code>config.json</code> and your <code>dataset.csv</code>.</span></li><li><code>results.json</code><span>Metrics, rules, predictions and row assignments.</span></li></ul><pre class="snippet">pip install -r requirements.txt
python load_model.py new_rows.csv</pre><div class="modal-actions"><button type="button" class="button subtle" data-action="close-modal">Cancel</button><button type="button" class="button primary" data-action="export-download">${icon('download')}Download zip</button></div>`);
}
async function exportBundle(){
 const r=currentRun();if(!r||!r.model_b64)return;
 try{
  const [code,loader]=await Promise.all(['./engine.py','./load_model.py'].map(f=>fetch(f).then(res=>{if(!res.ok)throw Error();return res.text();})));
  const {csv,model_b64,fuzzy_sets_text,...results}=r;const env=r.environment;
  const requirements=`ex-fuzzy==3.3.0\npymoo==${env.pymoo||'0.6.1.6'}\nnumpy==${env.numpy}\npandas==${env.pandas}\nscipy==${env.scipy}\nscikit-learn==${env.scikit_learn}\n`;
  const readme=`# ${r.name} — exFuzzy Lab\n\nLearner: ${r.learner_label||learnerOf(r.config.learner).label} (ex_fuzzy.${r.learner})\nexFuzzy: 3.3.0 · PyMoo: ${env.pymoo||'not used'}\nDataset: ${r.fileName} · Target: ${r.config.target}\nCreated: ${r.created}\nRuntime: Python ${env.python}\n\n## Use the model\n\nCreate a Python environment, then run:\n\n    pip install -r requirements.txt\n    python load_model.py new_rows.csv\n\nnew_rows.csv needs the same predictor columns as the training data. The script writes new_rows.predictions.csv. In Python:\n\n    from load_model import load_model\n    model = load_model("model.pkl")\n    labels = model.predict(frame)\n    model.print_rules()\n\nmodel.pkl is a Python pickle made with the versions in requirements.txt. Only open model files you saved yourself.\n\n## Train it again\n\n    python experiment.py\n\nThe script reads dataset.csv and config.json, runs the same training-only preprocessing and seeded stratified holdout, and writes reproduced-results.json. Cross-platform floating-point differences can affect a genetic search.\n\n## Contents\n\n- model.pkl: the trained model and its preprocessing\n- load_model.py: predicts new rows with the saved model\n- rules.txt: the rules as text; fuzzy_sets.txt: the fuzzy partitions in exFuzzy's text format\n- predictions.csv: held-out predictions\n- results.json: metrics, rules, preprocessing, environment, predictions and row assignments\n- dataset.csv: your original CSV (sensitive data stays in this downloaded bundle)\n- config.json: selected columns, types, split, seed and training settings\n- experiment.py: the same experiment code used by the web app\n- requirements.txt: pinned dependencies\n\nModels are evaluated on one holdout. Repeated tuning on that holdout biases its estimate.\n\nexFuzzy and this app are distributed under AGPL-3.0-or-later. Source: https://github.com/Fuminides/ex-fuzzy\n`;
  const pkl=Uint8Array.from(atob(model_b64),c=>c.charCodeAt(0));
  download(`exfuzzy-${r.name.toLowerCase().replaceAll(' ','-')}.zip`,zipFiles({'model.pkl':pkl,'load_model.py':loader,'rules.txt':r.rules_text,'fuzzy_sets.txt':fuzzy_sets_text||'','predictions.csv':predictionCSV(r),'results.json':JSON.stringify(results,null,2),'dataset.csv':csv,'config.json':JSON.stringify(r.config,null,2),'experiment.py':code,'requirements.txt':requirements,'README.md':readme}));closeModal();toast('Model saved. The zip includes model.pkl, load_model.py and your data.');
 }catch{toast('The bundle could not be assembled. Check that the site is fully loaded and try again.',true);}
}
document.addEventListener('click',e=>{
 const step=e.target.closest('[data-step]');if(step){state.step=step.dataset.step;render();return;}
 const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;render();return;}
 const tab=e.target.closest('[data-result-tab]');if(tab){state.resultTab=tab.dataset.resultTab;render();return;}
 const sample=e.target.closest('[data-sample]');if(sample){if($('#modal').open)closeModal();loadSample(sample.dataset.sample);return;}
 const run=e.target.closest('[data-open-run]');if(run){state.activeRun=Number(run.dataset.openRun);state.view='workspace';state.step='results';state.resultTab='overview';render();return;}
 if(e.target.closest('#dropzone')){if(!state.busy)$('#file-input').click();return;}
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(!action)return;
 if(action==='datasets')datasetsModal();
 else if(action==='choose-file'){closeModal();$('#file-input').click();}
 else if(action==='close-modal')closeModal();
 else if(action==='run')runExperiment();
 else if(action==='export')saveModelModal();
 else if(action==='export-download')exportBundle();
 else if(action==='run-all')runAll();
 else if(action==='explore'){if(currentRun())openExplorer({kind:'run',index:state.activeRun});}
 else if(action==='explore-example')openExplorer({kind:'fixture',name:'materials'});
 else if(action==='cancel')cancelTask();
 else if(action==='advanced')advancedModal();
 else if(action==='learner')learnerModal();
 else if(action==='pick-learner'){const key=e.target.closest('[data-learner]')?.dataset.learner;if(key&&LEARNERS[key]?.browser){state.config.learner=key;closeModal();render();}}
 else if(action==='save-advanced'){const ants=Number($('#adv-ants').value),pop=Number($('#adv-pop').value);if(!Number.isInteger(pop)||pop<4||pop>100){toast('Choose a population size from 4 to 100.',true);return;}state.config.n_ants=ants;state.config.pop_size=pop;closeModal();render();}
 else if(action==='paste')modal(`<div class="eyebrow">STRAIGHT FROM YOUR NOTEBOOK</div><h2 class="modal-title">Paste your data.</h2><p class="modal-description">Include the header row. Comma, semicolon and tab delimiters are supported.</p><textarea class="paste-text" id="paste-data" aria-label="Tabular data" placeholder="temperature,material,result\n22.4,alloy,pass\n…"></textarea><div class="modal-actions"><button class="button outline" data-action="close-modal">Cancel</button><button class="button primary" data-action="load-paste">Load dataset</button></div>`);
 else if(action==='load-paste'){const csv=$('#paste-data').value;if(!csv.trim()){toast('Paste a table with a header first.',true);return;}if(new Blob([csv]).size>2*1024*1024){toast('Please keep the table smaller than 2 MB.',true);return;}closeModal();inspectLocal(csv,'pasted-data.csv');}
 else if(action==='new'){if(state.busy){toast('Finish or cancel the current task first.');return;}state.view='workspace';state.step=state.csv?'model':'data';render();toast(state.csv?'Adjust a setting and run again. Your completed experiments are kept in this tab.':'Choose a dataset to start your experiment.');}
 else if(action==='download-rules'&&currentRun())download('exfuzzy-rules.txt',currentRun().rules_text);
 else if(action==='download-predictions'&&currentRun())download('exfuzzy-predictions.csv',predictionCSV(currentRun()),'text/csv');
});
document.addEventListener('change',e=>{
 const el=e.target;
 if(el.id==='file-input'){loadFile(el.files[0]);el.value='';return;}
 if(el.id==='target'){
  const old=state.target;state.target=el.value;state.features=state.features.filter(f=>f!==state.target);if(old!==state.target&&!state.features.includes(old)&&state.features.length<12)state.features.push(old);render();
 }else if(el.dataset.feature){
  const f=el.dataset.feature;if(el.checked){if(state.features.length>=12){el.checked=false;toast('Select up to 12 predictors in the browser workspace.',true);return;}state.features.push(f);}else state.features=state.features.filter(v=>v!==f);render();
 }else if(el.dataset.kind){state.kinds[el.dataset.kind]=el.value;render();}
 else if(el.dataset.config){const v=Number(el.value);if(!el.checkValidity()||!Number.isFinite(v)){el.reportValidity();return;}state.config[el.dataset.config]=v;render();}
 else if(el.id==='run-selector'){state.activeRun=Number(el.value);state.ruleSearch='';state.predictionFilter='all';render();}
 else if(el.id==='prediction-filter'){state.predictionFilter=el.value;$('#prediction-list').innerHTML=predictionTable(currentRun());}
 else if(el.id==='separator')state.separator=el.value;
});
document.addEventListener('input',e=>{if(e.target.id==='rule-search'){state.ruleSearch=e.target.value;$('#rule-list').innerHTML=ruleList(currentRun());}});
setTimeout(warmEngine,300);
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeModal();}});
render();
