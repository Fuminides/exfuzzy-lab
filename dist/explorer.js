'use strict';
/* Rules & Fuzzy Sets Explorer.
   A full-width inspection workspace for one completed experiment. It renders the values already
   present in the result JSON (rules, confidence, support, weights, sampled membership arrays,
   parameters, categories). It never recomputes, smooths or estimates scientific output.
   Loaded after app.js and shares its helpers ($, esc, icon, icons, state, render, percent, download, toast). */

const ex={source:null,example:null,loading:false,error:'',selected:null,search:'',klass:'all',sort:'id',layout:'cards',
 variable:null,term:null,featureSearch:'',split:44,cursor:null};
/* Okabe–Ito based palette: distinguishable for common colour-vision deficiencies. Colour is paired with
   a dash pattern on charts and with a text label everywhere, so colour is never the only signal. */
const TERM_COLORS=['#0072b2','#e69f00','#009e73','#cc79a7','#d55e00','#56b4e9','#7a5c2e','#4d4d4d'];
const TERM_DASHES=['','10 5','3 4','12 4 3 4','6 3 2 3','1 4','14 4 2 4','8 3'];
const termColor=i=>TERM_COLORS[((i%TERM_COLORS.length)+TERM_COLORS.length)%TERM_COLORS.length];
const termDash=i=>TERM_DASHES[((i%TERM_DASHES.length)+TERM_DASHES.length)%TERM_DASHES.length];
const SORTS={id:['Rule number',(a,b)=>a.id-b.id,'rule number'],confidence:['Confidence',(a,b)=>b.confidence-a.confidence||a.id-b.id,'confidence, highest first'],
 support:['Class support',(a,b)=>b.support-a.support||a.id-b.id,'class support, highest first'],weight:['Weight',(a,b)=>(b.weight??-1)-(a.weight??-1)||a.id-b.id,'weight, highest first'],
 conditions:['Condition count',(a,b)=>b.conditions.length-a.conditions.length||a.id-b.id,'condition count, most first']};
const EXAMPLES={materials:'materials.csv (synthetic, browser engine)',iris:'Iris (scikit-learn, native Python engine)'};
const ruleLabel=id=>'Rule '+String(id).padStart(2,'0');
/* Values are shown as recorded: 8 significant digits keep parameters such as 243.2001 intact while hiding float noise like 81.47874999999999. Raw values stay in title attributes. */
const fmtNum=(n,digits=8)=>{if(typeof n!=='number'||!Number.isFinite(n))return String(n);const a=Math.abs(n);if(a>=1e9||(a>0&&a<1e-5))return n.toExponential(4);return String(Number(n.toPrecision(digits)));};
const plural=(n,word)=>n+' '+(n===1?word:word.endsWith('y')?word.slice(0,-1)+'ies':word+'s');
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const slug=s=>String(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')||'chart';

function exData(){if(!ex.source)return null;return ex.source.kind==='run'?state.runs[ex.source.index]:ex.example;}
function exVariable(name){return exData()?.variables.find(v=>v.name===name)||null;}
function termIndex(v,term){return v?v.terms.findIndex(t=>t.name===term):-1;}
function selectedRule(){const d=exData();return d?d.rules.find(r=>r.id===ex.selected)||null:null;}
function ruleText(r){return 'IF '+r.conditions.map(c=>`${c.feature} is ${c.term}`).join(' AND ')+' THEN '+r.consequent;}
function visibleRules(d){
 const q=ex.search.trim().toLowerCase();
 return d.rules.filter(r=>(ex.klass==='all'||r.consequent===ex.klass)&&(!q||ruleText(r).toLowerCase().includes(q)||ruleLabel(r.id).toLowerCase().includes(q)||String(r.id)===q)).sort(SORTS[ex.sort][1]);
}
function isActiveCond(r,c){return ex.selected===r.id&&ex.variable===c.feature&&ex.term===c.term;}

/* ---------- opening and closing ---------- */
function openExplorer(source){
 Object.assign(ex,{source,selected:null,search:'',klass:'all',sort:'id',variable:null,term:null,featureSearch:'',cursor:null,error:'',loading:false});
 if(source.kind==='run')state.activeRun=source.index;
 else{
  ex.example=null;ex.loading=true;
  fetch(`./fixtures/${source.name}-result.json`).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();})
   .then(json=>{ex.example={...json,name:'Example result',fileName:EXAMPLES[source.name]||source.name,example:true};},e=>{ex.error='The example result could not be loaded ('+e.message+'). Serve the app over HTTP so ./fixtures/ is reachable.';})
   .then(()=>{ex.loading=false;if(state.view==='explorer')render();});
 }
 state.view='explorer';render();
 requestAnimationFrame(()=>$('#ex-heading')?.focus());
}
function closeExplorer(){
 state.view='workspace';if(state.runs.length)state.step='results';render();
 requestAnimationFrame(()=>($('[data-action="explore"]')||$('#main-panel'))?.focus?.());
}

/* ---------- rendering ---------- */
function renderExplorer(){
 const root=$('#explorer-view');const d=exData();
 if(ex.loading){root.innerHTML=exHeader(null)+`<div class="ex-state" role="status"><span class="spinner"></span><p>Loading the example result…</p></div>`;return;}
 if(ex.error||!d){root.innerHTML=exHeader(null)+`<div class="ex-state"><h2>${ex.error?'The example could not be loaded.':'No experiment to explore yet.'}</h2><p>${ex.error?esc(ex.error):'Run an experiment first. Its rules and fitted partitions will appear here.'}</p><button type="button" class="button primary" data-ex="back">Back to experiment</button></div>`;return;}
 if(!ex.variable||!exVariable(ex.variable)){ex.variable=d.variables[0]?.name||null;ex.term=null;}
 root.innerHTML=exHeader(d)+`<div class="ex-body" style="--split:${ex.split}">${rulesPane(d)}<div class="ex-divider" role="separator" aria-orientation="vertical" aria-label="Resize the rule list" aria-valuemin="30" aria-valuemax="65" aria-valuenow="${ex.split}" tabindex="0" title="Drag or use arrow keys to resize"></div>${detailPane(d)}</div>`;
 icons();drawCharts();
}
function exHeader(d){
 const title=d?esc(d.name||'Experiment'):'Rules & fuzzy sets';
 const nCond=d?(d.conditions??d.rules.reduce((n,r)=>n+r.conditions.length,0)):0;
 const meta=d?`${d.example?'<span class="example-note">Stored example</span>':''}<span>${esc(d.fileName||'dataset')}</span><span>Target <strong>${esc(d.config?.target??'—')}</strong></span>${d.learner?`<span>${esc(d.config?.learner&&LEARNERS[d.config.learner]?LEARNERS[d.config.learner].label:(d.learner_label||d.learner))}</span>`:''}<span>${nCond} conditions${d.test_rows!=null?` · ${d.test_rows} held-out rows`:''}</span>`:'';
 const stats=d?`<div class="ex-stats" aria-label="Experiment summary"><div class="ex-stat"><small>Rules</small><strong>${d.rules.length}</strong></div>${d.test_metrics?`<div class="ex-stat metric"><small>Test macro F1</small><strong title="${d.test_metrics.macro_f1}">${percent(d.test_metrics.macro_f1)}</strong></div><div class="ex-stat metric"><small>Test accuracy</small><strong title="${d.test_metrics.accuracy}">${percent(d.test_metrics.accuracy)}</strong></div>`:''}</div>`:'';
 const actions=d?(d.example?`<button type="button" class="button subtle small" data-ex="rules-txt">${icon('download')}Rules.txt</button>`:`<button type="button" class="button subtle small" data-ex="rules-txt">${icon('download')}Rules.txt</button><button type="button" class="button primary small" data-action="export">${icon('download')}Save model</button>`):'';
 return `<div class="ex-nav"><button type="button" class="link-button back-link" data-ex="back">${icon('arrow')}Back to experiment</button></div><header class="ex-head"><div class="ex-title"><h1 id="ex-heading" tabindex="-1">${title}</h1>${meta?`<p class="ex-meta">${meta}</p>`:''}</div><div class="ex-actions">${actions}</div>${stats}</header>`;
}

/* rules pane */
function rulesPane(d){
 const classes=d.classes?.length?d.classes:[...new Set(d.rules.map(r=>r.consequent))];
 return `<section class="ex-pane pane-rules" id="pane-rules" aria-labelledby="rules-title"><div class="pane-head"><h2 id="rules-title">Rules <span class="pane-count" aria-label="${plural(d.rules.length,'rule')}">${d.rules.length}</span></h2><div class="layout-toggle" role="group" aria-label="Rule layout"><button type="button" data-ex="layout" data-layout="cards" aria-pressed="${ex.layout==='cards'}">Cards</button><button type="button" data-ex="layout" data-layout="table" aria-pressed="${ex.layout==='table'}">Table</button></div></div>
<div class="rule-tools"><label class="tool grow"><span>Search rules</span><input type="search" id="ex-search" placeholder="Feature, term, class or rule number" value="${esc(ex.search)}" autocomplete="off"></label><label class="tool"><span>Consequent</span><select id="ex-class"><option value="all">All classes</option>${classes.map(c=>`<option value="${esc(c)}" ${ex.klass===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label class="tool"><span>Sort by</span><select id="ex-sort">${Object.entries(SORTS).map(([k,[l]])=>`<option value="${k}" ${ex.sort===k?'selected':''}>${l}</option>`).join('')}</select></label></div>
<details class="stats-note"><summary>About the numbers and colours</summary><p>Condition chips take the colour of their term's position in the feature's partition (first term blue, second amber, third green), and the plot legend uses the same colours.</p><p><strong>Confidence</strong> and <strong>class support</strong> are statistics of the training rows only: how often the rule's consequent holds when its antecedent fires, and how much of the class the antecedent covers. ${d.learner==='FERL'?'FERL rules are tree paths and carry no weight: its votes use each rule\'s class probabilities.':d.learner==='RuleMineClassifier'||d.learner==='RuleFineTuneClassifier'?'The <strong>weight</strong> is the rule\'s dominance score, which this learner uses to weight rules when the strongest rule decides.':'The <strong>weight</strong> is exFuzzy\'s penalized certainty factor used in rule voting.'} None of these is a calibrated prediction probability for new rows.</p></details>
<div id="ex-rules">${ruleListHTML(d)}</div></section>`;
}
function ruleListHTML(d){
 if(!d.rules.length)return `<div class="ex-state small"><h3>No rules were selected in this experiment.</h3><p>The genetic selection kept no rule, so the classifier predicts the training majority class for every row. The fitted partitions are still available in the fuzzy set viewer. A larger rule budget or a different number of terms usually helps.</p></div>`;
 const list=visibleRules(d);const filtered=ex.search.trim()||ex.klass!=='all';
 const sel=selectedRule();const hidden=sel&&!list.includes(sel);
 const status=`<p class="rule-count" id="ex-count" role="status">Showing <strong>${list.length}</strong> of ${plural(d.rules.length,'rule')}${filtered?' matching your filters':''} · sorted by ${SORTS[ex.sort][2]}</p>`;
 const notice=hidden?`<div class="note warning ex-notice">${ruleLabel(sel.id)} is selected but hidden by the current search or class filter. <button type="button" class="link-button" data-ex="show-selected">Show it</button> or <button type="button" class="link-button" data-ex="clear-selection">clear the selection</button>.</div>`:'';
 if(!list.length)return status+notice+`<div class="ex-state small"><h3>No rule matches.</h3><p>Nothing matches “${esc(ex.search.trim())}”${ex.klass!=='all'?` with consequent “${esc(ex.klass)}”`:''}. Try a feature name, a term such as “High”, a class, or a rule number.</p><button type="button" class="button outline small" data-ex="reset-filters">Clear search and filters</button></div>`;
 return status+notice+(ex.layout==='table'?ruleTable(d,list):list.map(r=>ruleCard(d,r)).join(''));
}
function condButton(d,r,c){
 const v=exVariable(c.feature),i=termIndex(v,c.term),known=i>=0;const active=isActiveCond(r,c);
 return `<button type="button" class="cond${known?'':' unknown'}" data-ex="cond" data-rule="${r.id}" data-feature="${esc(c.feature)}" data-term="${esc(c.term)}" data-fk="cond:${r.id}:${esc(c.feature)}:${esc(c.term)}" style="--c:${known?termColor(i):'#6b7280'}" aria-pressed="${active}" title="${known?`Show the term ${esc(c.term)} on the ${esc(c.feature)} ${v.kind==='numeric'?'partition chart':'category view'}`:'This term was not found among the fitted partitions of the result'}"><span class="cond-feature">${esc(c.feature)}</span> <span class="cond-is">is</span> <span class="cond-term">${esc(c.term)}</span>${known?'':'<span class="cond-missing"> (not in fitted partitions)</span>'}</button>`;
}
function statement(d,r){
 return `<span class="kw">IF</span> `+r.conditions.map((c,i)=>(i?` <span class="kw">AND</span> `:'')+condButton(d,r,c)).join('')+` <span class="kw">THEN</span> <span class="consequent-chip">${esc(r.consequent)}</span>`;
}
function ruleLine(r){return `<p class="rule-meta"><span><strong title="Training confidence ${r.confidence}">${percent(r.confidence)}</strong> confidence</span></p>`;}
function ruleStats(r,withCount){
 return `<dl class="rule-stats"><div><dt>Confidence</dt><dd title="Training confidence ${r.confidence}">${percent(r.confidence)}</dd></div><div><dt>Class support</dt><dd title="Training class support ${r.support}">${percent(r.support)}</dd></div><div><dt>Weight</dt><dd title="${r.weight==null?'This learner does not use certainty-factor weights':'Certainty-factor weight '+r.weight}">${r.weight==null?'—':Number(r.weight).toFixed(3)}</dd></div>${withCount?`<div><dt>Conditions</dt><dd>${r.conditions.length}</dd></div>`:''}</dl>`;
}
function ruleCard(d,r){
 const sel=r.id===ex.selected;
 return `<article class="rule-card${sel?' selected':''}" data-rule-card="${r.id}" aria-current="${sel?'true':'false'}" aria-labelledby="rule-title-${r.id}"><div class="rule-top"><button type="button" class="rule-select" id="rule-title-${r.id}" data-ex="select" data-rule="${r.id}" data-fk="rule:${r.id}" aria-pressed="${sel}">${ruleLabel(r.id)}</button><span class="rule-cons-tag">predicts <strong>${esc(r.consequent)}</strong></span><span class="rule-ncond">${plural(r.conditions.length,'condition')}</span></div><p class="rule-text">${statement(d,r)}</p>${ruleLine(r)}</article>`;
}
function ruleTable(d,list){
 return `<div class="table-wrap"><table class="rule-table"><thead><tr><th scope="col">Rule</th><th scope="col">Statement</th><th scope="col"><abbr title="Training confidence">Conf.</abbr></th><th scope="col"><abbr title="Training class support">Support</abbr></th><th scope="col"><abbr title="Certainty-factor weight">Weight</abbr></th><th scope="col"><abbr title="Number of conditions">N</abbr></th></tr></thead><tbody>${list.map(r=>{const sel=r.id===ex.selected;return `<tr class="${sel?'selected':''}" data-rule-card="${r.id}" aria-current="${sel?'true':'false'}"><th scope="row"><button type="button" class="rule-select" data-ex="select" data-rule="${r.id}" data-fk="rule:${r.id}" aria-pressed="${sel}">${String(r.id).padStart(2,'0')}</button></th><td class="rule-text">${statement(d,r)}</td><td title="${r.confidence}">${percent(r.confidence)}</td><td title="${r.support}">${percent(r.support)}</td><td title="${r.weight==null?'No weight for this learner':r.weight}">${r.weight==null?'—':Number(r.weight).toFixed(3)}</td><td>${r.conditions.length}</td></tr>`;}).join('')}</tbody></table></div>`;
}

/* detail pane: selected rule + set viewer */
function detailPane(d){return `<section class="ex-pane pane-sets" id="pane-sets" aria-labelledby="sets-title">${selectedRuleHTML(d)}${setViewerHTML(d)}</section>`;}
function selectedRuleHTML(d){
 const r=selectedRule();
 if(!r)return `<p class="sel-empty" id="sel-title">${d.rules.length?'Select a rule to see it here with its statistics; its conditions light up the fuzzy sets below.':'This experiment has no rules. The fitted partitions are shown below.'}</p>`;
 return `<div class="sel-rule"><div class="sel-head"><h2 id="sel-title">${ruleLabel(r.id)} <span class="sel-cons">predicts <span class="consequent-chip">${esc(r.consequent)}</span></span></h2><button type="button" class="button subtle small" data-ex="clear-selection">Clear selection</button></div><p class="rule-text big">${statement(d,r)}</p>${ruleStats(r,true)}<p class="sel-hint">${r.conditions.length>1?'Select a condition to show its term on the set below. All conditions stay listed here so you can move between them.':'Select the condition to show its term on the set below.'}</p></div>`;
}
function featureChips(d){
 const q=ex.featureSearch.trim().toLowerCase();const shown=d.variables.filter(x=>x.name.toLowerCase().includes(q));
 if(!shown.length)return `<p class="ex-nomatch">No feature matches “${esc(ex.featureSearch.trim())}”. <button type="button" class="link-button" data-ex="clear-feature-search">Show all features</button></p>`;
 return shown.map(x=>`<button type="button" class="feature-chip" role="tab" data-ex="variable" data-variable="${esc(x.name)}" data-fk="feat:${esc(x.name)}" aria-selected="${x.name===ex.variable}" aria-pressed="${x.name===ex.variable}"><span class="chip-name">${esc(x.name)}</span><span class="chip-kind">${x.kind==='numeric'?plural(x.terms.length,'term'):plural(x.terms.length,'category')}</span></button>`).join('');
}
function setViewerHTML(d){
 const v=exVariable(ex.variable);
 const many=d.variables.length>8;
 const tabs=`<div class="feature-tabs"><h2 id="sets-title" class="sr-only">Fuzzy sets</h2>${many?`<label class="tool"><span class="sr-only">Find a feature</span><input type="search" id="ex-feature-search" placeholder="Find a feature" value="${esc(ex.featureSearch)}" autocomplete="off"></label>`:''}<div class="feature-chips" id="feature-chips" role="tablist" aria-label="Features">${featureChips(d)}</div></div>`;
 if(!v)return `<div class="set-viewer">${tabs}<div class="ex-state small"><p>This result contains no fitted variables to display.</p></div></div>`;
 const n=v.terms.length;
 const sub=v.kind==='numeric'?`Trapezoidal partition · ${plural(n,'term')} · sampled at ${v.x.length} points from ${fmtNum(v.x[0])} to ${fmtNum(v.x.at(-1))}`:`Categorical sets · ${plural(n,'crisp term')} · membership 1 for the matching category, 0 otherwise`;
 return `<div class="set-viewer" data-kind="${v.kind}">${tabs}<div class="viewer-head"><div><h3 id="var-title" tabindex="-1">${esc(v.name)}</h3><p class="viewer-sub">${sub}</p></div><div class="viewer-actions">${v.kind==='numeric'?`<button type="button" class="button subtle small" data-ex="expand">${icon('expand')}Expand</button>`:''}<button type="button" class="button subtle small" data-ex="svg">${icon('download')}SVG</button></div></div>${highlightLine(v)}${v.kind==='numeric'?numericViewer(v,'main'):categoricalViewer(v)}${preprocNote(d,v)}</div>`;
}
function highlightLine(v){
 if(!ex.term||termIndex(v,ex.term)>=0)return '';
 return `<p class="highlight-line" role="status">The term <strong>${esc(ex.term)}</strong> is not part of the fitted partition of ${esc(v.name)}. <button type="button" class="link-button" data-ex="clear-term">Show all terms</button></p>`;
}
function legendHTML(v,shape){
 return `<div class="legend" role="group" aria-label="Terms of ${esc(v.name)}" data-legend>${v.terms.map((t,i)=>{const on=t.name===ex.term,dim=ex.term&&!on;return `<button type="button" class="legend-term${dim?' dim':''}" data-ex="term" data-term="${esc(t.name)}" data-fk="term:${esc(t.name)}" aria-pressed="${on}" style="--c:${termColor(i)}" title="${on?'Show all terms':'Highlight '+esc(t.name)}">${shape==='line'?`<svg class="swatch" viewBox="0 0 30 10" aria-hidden="true"><line x1="1" x2="29" y1="5" y2="5" stroke="${termColor(i)}" stroke-width="3" stroke-dasharray="${termDash(i)}"/></svg>`:`<span class="swatch square" aria-hidden="true"></span>`}<span>${esc(t.name)}</span></button>`;}).join('')}</div>`;
}
function paramTable(v){
 const lens=new Set(v.terms.map(t=>(t.parameters||[]).length));const four=lens.size===1&&lens.has(4);
 const cols=four?['a','b','c','d']:null;
 return `<p class="param-caption" id="param-caption">Membership parameters as recorded in the result${four?' (trapezoid corners a, b, c, d)':''}</p><div class="table-wrap"><table class="param-table" aria-labelledby="param-caption"><thead><tr><th scope="col">Term</th>${cols?cols.map(c=>`<th scope="col">${c}</th>`).join(''):'<th scope="col">Parameters</th>'}</tr></thead><tbody>${v.terms.map((t,i)=>{const p=t.parameters||[];return `<tr class="${t.name===ex.term?'hl':''}"><th scope="row"><span class="term-dot" style="--c:${termColor(i)}" aria-hidden="true"></span>${esc(t.name)}</th>${cols?p.map(x=>`<td title="${x}">${fmtNum(x)}</td>`).join(''):`<td>${p.length?p.map(x=>`<span title="${x}">${fmtNum(x)}</span>`).join(', '):'<span class="missing">not recorded</span>'}</td>`}</tr>`;}).join('')}</tbody></table></div>`;
}
function chartDescription(v){
 const lo=fmtNum(v.x[0]),hi=fmtNum(v.x.at(-1));
 return `Membership functions of ${v.name}, sampled at ${v.x.length} points from ${lo} to ${hi}. Membership degree ranges from 0 to 1. ${v.terms.map(t=>`${t.name}${t.parameters?.length?` with parameters ${t.parameters.map(x=>fmtNum(x)).join(', ')}`:''}`).join('; ')}. Use the left and right arrow keys on the chart to read sampled membership values.`;
}
function numericViewer(v,id){
 return `<div class="chart-box" data-chart="${id}" data-variable="${esc(v.name)}"></div>${legendHTML(v,'line')}<p id="chart-desc-${id}" class="sr-only">${esc(chartDescription(v))}</p><p class="chart-note">Lines join the recorded x/y samples with straight segments. The crosshair reports the nearest recorded sample, not an evaluation at an arbitrary point.</p>${id==='main'?paramTable(v):''}`;
}
function categoricalViewer(v){
 const hl=ex.term,n=v.terms.length;const hlTerm=v.terms.find(t=>t.name===hl);
 const summary=hlTerm?`Term <strong>${esc(hlTerm.name)}</strong> has membership 1 for the category “${esc(hlTerm.category)}”${n>1?` and 0 for the other ${plural(n-1,'category')}`:''}.`:`${plural(n,'crisp term')}, one per training category. Select a term to highlight its column.`;
 return legendHTML(v,'square')+`<p class="cat-summary" role="status">${summary}</p><div class="table-wrap cat-wrap"><table class="cat-matrix"><caption class="sr-only">Membership of each category (rows) in each term (columns). 1 means the category equals the term, 0 otherwise.</caption><thead><tr><th scope="col" class="cat-corner"><span>Category ↓</span><span>Term →</span></th>${v.terms.map((t,i)=>`<th scope="col" class="${t.name===hl?'hl':''}" style="--c:${termColor(i)}"><span class="cat-head">${esc(t.name)}</span></th>`).join('')}</tr></thead><tbody>${v.terms.map(row=>`<tr><th scope="row" class="${row.name===hl?'hl':''}">${esc(row.category??row.name)}</th>${v.terms.map((t,ci)=>{const one=(t.category??t.name)===(row.category??row.name);return `<td class="${one?'one':'zero'}${t.name===hl?' hl':''}" style="--c:${termColor(ci)}" title="${esc(row.category??row.name)} in ${esc(t.name)}: ${one?1:0}"><span>${one?'1':'0'}</span></td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function preprocNote(d,v){
 const p=d.preprocessing?.find(x=>x.name===v.name);if(!p)return '';
 if(v.kind==='numeric')return `<p class="preproc-note">Missing values in <strong>${esc(v.name)}</strong> were imputed with the training median ${p.median==null?'<span class="missing">(not recorded)</span>':`<strong title="${p.median}">${fmtNum(p.median)}</strong>`}.</p>`;
 return `<p class="preproc-note">${plural(p.categories?.length??v.terms.length,'training category')}. Unseen test categories: <strong>${p.unseen_test??'not recorded'}</strong>; an unseen category fires no term.</p>`;
}

/* ---------- numeric chart (straight segments through the recorded samples) ---------- */
function niceTicks(lo,hi,count){
 const span=hi-lo;if(!(span>0))return {ticks:[lo],step:1};
 const raw=span/count,mag=10**Math.floor(Math.log10(raw)),norm=raw/mag;
 const step=(norm<1.5?1:norm<3.5?2:norm<7.5?5:10)*mag;const ticks=[];
 for(let t=Math.ceil(lo/step-1e-9)*step;t<=hi+step*1e-9;t+=step)ticks.push(Number(t.toFixed(10)));
 return {ticks,step};
}
function peakCenter(v,t){const max=Math.max(...t.y);let s=0,n=0;t.y.forEach((y,j)=>{if(y>=max-1e-9){s+=v.x[j];n++;}});return n?s/n:v.x[0];}
function numericChartSVG(v,o){
 const W=o.width,L=66,R=22,T=o.legend?58:26,B=60,PH=o.plotHeight,H=PH+T+B,PW=W-L-R;
 const lo=v.x[0],hi=v.x.at(-1),span=(hi-lo)||1;
 const X=x=>L+(x-lo)/span*PW,Y=y=>T+PH-y*PH;
 const ink='#24382f',muted='#53624e',grid='#d8e0d1';
 const {ticks,step}=niceTicks(lo,hi,Math.max(3,Math.min(8,Math.floor(PW/90))));
 const dec=Math.max(0,-Math.floor(Math.log10(step)));
 const xt=ticks.filter(t=>t>=lo-1e-9&&t<=hi+1e-9).map(t=>({x:t,l:t.toFixed(dec)}));
 for(const edge of[lo,hi]){if(!xt.some(t=>Math.abs(t.x-edge)<span*.045))xt.push({x:edge,l:fmtNum(edge,5)});}
 xt.sort((a,b)=>a.x-b.x);
 const hl=o.highlight,hlKnown=hl!=null&&termIndex(v,hl)>=0;
 const xAxis=xt.map(t=>`<line x1="${X(t.x).toFixed(1)}" x2="${X(t.x).toFixed(1)}" y1="${T+PH}" y2="${T+PH+6}" stroke="${muted}"/><text x="${X(t.x).toFixed(1)}" y="${T+PH+22}" text-anchor="middle" fill="${ink}" font-size="12.5">${esc(t.l)}</text>`).join('');
 const yAxis=[0,.25,.5,.75,1].map(y=>`<line x1="${L}" x2="${L+PW}" y1="${Y(y)}" y2="${Y(y)}" stroke="${grid}" ${y===0||y===1?'':'stroke-dasharray="3 4"'}/><text x="${L-10}" y="${Y(y)+4.5}" text-anchor="end" fill="${ink}" font-size="12.5">${y}</text>`).join('');
 const series=v.terms.map((t,i)=>{
  const on=!hlKnown||t.name===hl,focus=hlKnown&&t.name===hl,c=termColor(i);
  const pts=v.x.map((x,j)=>`${X(x).toFixed(1)},${Y(t.y[j]).toFixed(1)}`).join(' ');
  return `<g data-term="${esc(t.name)}" opacity="${on?1:.28}"><polygon points="${X(lo).toFixed(1)},${Y(0)} ${pts} ${X(hi).toFixed(1)},${Y(0)}" fill="${c}" opacity="${focus?.2:(hlKnown?.04:.09)}"/>${focus?`<polyline points="${pts}" fill="none" stroke="#fff" stroke-width="7" stroke-linejoin="round" opacity=".9"/>`:''}<polyline points="${pts}" fill="none" stroke="${c}" stroke-width="${focus?3.6:2.3}" stroke-linejoin="round" stroke-linecap="round" ${termDash(i)?`stroke-dasharray="${termDash(i)}"`:''}/></g>`;
 }).join('');
 const labels=PW<Math.max(360,v.terms.reduce((n,t)=>n+t.name.length*8+40,0))?'':v.terms.map((t,i)=>{const on=!hlKnown||t.name===hl;const cx=Math.min(L+PW-30,Math.max(L+30,X(peakCenter(v,t))));return `<g opacity="${on?1:.4}"><line x1="${(cx-14-t.name.length*3.6).toFixed(1)}" x2="${(cx-t.name.length*3.6-2).toFixed(1)}" y1="${T-9}" y2="${T-9}" stroke="${termColor(i)}" stroke-width="3" ${termDash(i)?`stroke-dasharray="${termDash(i)}"`:''}/><text x="${(cx+6).toFixed(1)}" y="${T-5}" text-anchor="middle" fill="${ink}" font-size="13" font-weight="${on&&hlKnown?700:600}">${esc(t.name)}</text></g>`;}).join('');
 const legend=o.legend?(()=>{let x=L;return v.terms.map((t,i)=>{const s=`<line x1="${x}" x2="${x+28}" y1="${T-36}" y2="${T-36}" stroke="${termColor(i)}" stroke-width="3" ${termDash(i)?`stroke-dasharray="${termDash(i)}"`:''}/><text x="${x+34}" y="${T-31}" fill="${ink}" font-size="13">${esc(t.name)}</text>`;x+=34+t.name.length*7.6+22;return s;}).join('');})():'';
 const title=o.title?`<text x="${L}" y="20" fill="${ink}" font-size="15" font-weight="700">${esc(o.title)}</text>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="t1-chart" role="group" tabindex="0" aria-label="Membership chart for ${esc(v.name)}. Use the arrow keys to read sampled values." ${o.descId?`aria-describedby="${o.descId}"`:''} data-n="${v.x.length}" data-l="${L}" data-pw="${PW}" data-t="${T}" data-ph="${PH}" data-lo="${lo}" data-hi="${hi}" font-family="'DM Sans',Helvetica,Arial,sans-serif"><title>Membership functions for ${esc(v.name)}</title><desc>${esc(chartDescription(v))}</desc>${o.standalone?`<rect width="100%" height="100%" fill="#ffffff"/>`:''}${title}${legend}<rect x="${L}" y="${T}" width="${PW}" height="${PH}" fill="#fbfcf8" stroke="${grid}"/>${yAxis}<line x1="${L}" x2="${L}" y1="${T}" y2="${T+PH}" stroke="${muted}"/><line x1="${L}" x2="${L+PW}" y1="${T+PH}" y2="${T+PH}" stroke="${muted}"/>${xAxis}${series}${labels}<text x="${(L+PW/2).toFixed(1)}" y="${T+PH+46}" text-anchor="middle" fill="${ink}" font-size="13.5" font-weight="600">${esc(v.name)}</text><text transform="translate(16 ${(T+PH/2).toFixed(1)}) rotate(-90)" text-anchor="middle" fill="${ink}" font-size="13.5" font-weight="600">Membership degree μ(x)</text><g data-cursor=""></g></svg>`;
}
let drawQueued=false;
const chartObserver=new ResizeObserver(entries=>{for(const e of entries){const w=Math.round(e.contentRect.width);if(w>0&&w!==Number(e.target.dataset.drawnWidth))scheduleDraw();}});
function scheduleDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(()=>{drawQueued=false;drawCharts();});}
function drawCharts(){
 document.querySelectorAll('.chart-box[data-chart]').forEach(box=>{
  chartObserver.observe(box);
  const v=exVariable(box.dataset.variable);if(!v||v.kind!=='numeric')return;
  const width=Math.round(box.clientWidth);if(!width)return;
  if(Number(box.dataset.drawnWidth)===width&&box.dataset.term===String(ex.term)&&box.querySelector('svg'))return;
  const expanded=box.dataset.chart==='expanded';
  const plotHeight=expanded?Math.max(360,Math.min(600,Math.round(window.innerHeight*.55))):320;
  box.dataset.drawnWidth=width;box.dataset.term=String(ex.term);
  box.innerHTML=numericChartSVG(v,{width:Math.max(300,width),plotHeight,highlight:ex.term,descId:'chart-desc-'+box.dataset.chart})+`<div class="chart-tip" hidden></div><div class="sr-only" aria-live="polite" data-live></div>`;
  if(ex.cursor!=null)updateCursor(box,ex.cursor,false);
 });
}
function updateCursor(box,i,announce){
 const svg=box.querySelector('svg.t1-chart'),v=exVariable(box.dataset.variable);if(!svg||!v)return;
 const g=svg.querySelector('[data-cursor]'),tip=box.querySelector('.chart-tip');
 if(i==null){g.innerHTML='';tip.hidden=true;return;}
 const n=v.x.length;i=Math.max(0,Math.min(n-1,i));
 const L=+svg.dataset.l,PW=+svg.dataset.pw,T=+svg.dataset.t,PH=+svg.dataset.ph,lo=+svg.dataset.lo,hi=+svg.dataset.hi,span=(hi-lo)||1;
 const x=L+(v.x[i]-lo)/span*PW;
 g.innerHTML=`<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${T}" y2="${T+PH}" stroke="#24382f" stroke-dasharray="4 3" opacity=".75"/>`+v.terms.map((t,k)=>`<circle cx="${x.toFixed(1)}" cy="${(T+PH-t.y[i]*PH).toFixed(1)}" r="5" fill="${termColor(k)}" stroke="#fff" stroke-width="2"/>`).join('');
 tip.innerHTML=`<strong>Sampled x = ${fmtNum(v.x[i])}</strong><ul>${v.terms.map((t,k)=>`<li><i style="--c:${termColor(k)}"></i><span>${esc(t.name)}</span><b title="${t.y[i]}">${Number(t.y[i]).toFixed(3)}</b></li>`).join('')}</ul><small>Nearest recorded sample ${i+1} of ${n}</small>`;
 tip.hidden=false;
 const tw=tip.offsetWidth,left=x+16+tw>box.clientWidth?x-16-tw:x+16;
 tip.style.left=Math.max(0,left)+'px';tip.style.top=(T+6)+'px';
 if(announce){const live=box.querySelector('[data-live]');if(live)live.textContent=`Sampled x = ${fmtNum(v.x[i])}: `+v.terms.map(t=>`${t.name} ${Number(t.y[i]).toFixed(3)}`).join(', ');}
}
function setCursor(i,announce){ex.cursor=i;document.querySelectorAll('.chart-box[data-chart]').forEach(box=>updateCursor(box,i,announce));}
function cursorFromPointer(svg,clientX){const r=svg.getBoundingClientRect();const n=+svg.dataset.n,L=+svg.dataset.l,PW=+svg.dataset.pw;const frac=(clientX-r.left-L)/PW;return Math.max(0,Math.min(n-1,Math.round(frac*(n-1))));}

/* ---------- categorical SVG (for download) ---------- */
function wrapLabel(s,max){const words=String(s).split(/\s+/),lines=[];let cur='';for(const w of words){if((cur+' '+w).trim().length>max&&cur){lines.push(cur);cur=w;}else cur=(cur+' '+w).trim();}if(cur)lines.push(cur);while(lines.length>3){const last=lines.pop();lines[2]+=' '+last;}return lines;}
function categoricalSVG(v,o){
 const terms=v.terms,n=terms.length,cell=40,ink='#24382f',muted='#53624e';
 const labels=terms.map(t=>wrapLabel(t.category??t.name,22));
 const labW=Math.min(230,Math.max(100,Math.max(...labels.flat().map(l=>l.length))*7.4+16));
 const headH=Math.min(150,Math.max(60,Math.max(...terms.map(t=>t.name.length))*6.2+20));
 const L=16+labW,T=56+headH,W=L+n*cell+24,H=T+n*cell+40;
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="'DM Sans',Helvetica,Arial,sans-serif" role="img" aria-label="Crisp membership matrix for ${esc(v.name)}"><title>Categorical sets for ${esc(v.name)}</title><rect width="100%" height="100%" fill="#ffffff"/><text x="16" y="24" fill="${ink}" font-size="15" font-weight="700">${esc(o.title||v.name)}</text><text x="16" y="42" fill="${muted}" font-size="12">Rows: categories · Columns: terms · 1 = equal, 0 = otherwise${o.highlight?` · highlighted term: ${esc(o.highlight)}`:''}</text>`;
 terms.forEach((t,c)=>{const x=L+c*cell+cell/2;s+=`<text transform="translate(${x} ${T-8}) rotate(-55)" fill="${ink}" font-size="12.5" font-weight="${t.name===o.highlight?700:500}">${esc(t.name)}</text>`;});
 terms.forEach((row,r)=>{
  const y=T+r*cell;
  labels[r].forEach((line,k)=>{s+=`<text x="${L-10}" y="${y+cell/2+4+(k-(labels[r].length-1)/2)*13}" text-anchor="end" fill="${ink}" font-size="12.5">${esc(line)}</text>`;});
  terms.forEach((t,c)=>{const one=(t.category??t.name)===(row.category??row.name),hl=t.name===o.highlight,col=termColor(c);
   s+=`<rect x="${L+c*cell+3}" y="${y+3}" width="${cell-6}" height="${cell-6}" rx="5" fill="${one?col:(hl?'#f1f5ec':'#ffffff')}" stroke="${hl?col:'#d8e0d1'}" stroke-width="${hl?2:1}"/><text x="${L+c*cell+cell/2}" y="${y+cell/2+5}" text-anchor="middle" fill="${one?'#ffffff':muted}" font-size="13" font-weight="600">${one?1:0}</text>`;});
 });
 return s+`<text x="${L+n*cell/2}" y="${H-12}" text-anchor="middle" fill="${ink}" font-size="13" font-weight="600">${esc(v.name)} terms</text></svg>`;
}
function downloadSVG(){
 const d=exData(),v=exVariable(ex.variable);if(!d||!v)return;
 const title=`${v.name} — ${v.kind==='numeric'?'membership functions':'categorical sets'} (${d.name||'experiment'}, exFuzzy ${d.version||'3.3.0'})`;
 const svg=v.kind==='numeric'?numericChartSVG(v,{width:960,plotHeight:400,highlight:ex.term,legend:true,standalone:true,title}):categoricalSVG(v,{highlight:ex.term,title});
 download(`exfuzzy-${slug(d.name||'experiment')}-${slug(v.name)}-sets.svg`,'<?xml version="1.0" encoding="UTF-8"?>\n'+svg.replace(' tabindex="0"',''),'image/svg+xml');
 toast(`SVG downloaded for ${v.name}, with axis labels and legend.`);
}

/* ---------- state changes with focus preservation ---------- */
function keepFocus(fn){
 const a=document.activeElement;const key=a?.dataset?.fk,id=a?.id;
 fn();
 if(!a||a===document.body)return;
 const el=key?document.querySelector(`[data-fk="${CSS.escape(key)}"]`):id?document.getElementById(id):null;
 if(el&&!el.isConnected===false)el.focus({preventScroll:true});
}
function updateRules(){const d=exData();if(!d)return;keepFocus(()=>{$('#ex-rules').innerHTML=ruleListHTML(d);});}
function updateDetail(){
 const d=exData();if(!d)return;
 keepFocus(()=>{const pane=$('#pane-sets');if(pane){pane.outerHTML=detailPane(d);}icons();drawCharts();if($('#modal').open&&$('#modal').classList.contains('wide'))expandedBody(true);});
}
function syncConditions(){
 const d=exData();if(!d)return;
 document.querySelectorAll('[data-rule-card]').forEach(el=>{const sel=Number(el.dataset.ruleCard)===ex.selected;el.classList.toggle('selected',sel);el.setAttribute('aria-current',sel?'true':'false');});
 document.querySelectorAll('.rule-select').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.rule)===ex.selected)));
 document.querySelectorAll('.cond').forEach(b=>b.setAttribute('aria-pressed',String(ex.selected===Number(b.dataset.rule)&&ex.variable===b.dataset.feature&&ex.term===b.dataset.term)));
 const sel=selectedRule(),hidden=sel&&!visibleRules(d).includes(sel),notice=$('#ex-rules .ex-notice');
 if(!!notice!==!!hidden)updateRules();
}
function selectRule(id){
 ex.selected=id;const r=selectedRule();
 if(r&&r.conditions.length){const c=r.conditions.find(x=>x.feature===ex.variable)||r.conditions[0];ex.variable=c.feature;ex.term=c.term;ex.cursor=null;}
 syncConditions();updateDetail();
}
function focusCondition(id,feature,term){
 ex.selected=id;ex.variable=feature;ex.term=term;ex.cursor=null;
 if(!exVariable(feature)){toast(`The feature ${feature} is not part of the fitted partitions of this result.`,true);}
 syncConditions();updateDetail();
 const target=$('#var-title');
 if(window.innerWidth<1100&&target)target.scrollIntoView({behavior:reducedMotion()?'auto':'smooth',block:'start'});
}
function setSplit(pct){ex.split=Math.round(Math.max(30,Math.min(65,pct)));const body=$('.ex-body');if(body)body.style.setProperty('--split',ex.split);const div=$('.ex-divider');if(div)div.setAttribute('aria-valuenow',ex.split);scheduleDraw();}
function expandedBody(refresh){
 const v=exVariable(ex.variable);if(!v||v.kind!=='numeric')return;
 const html=`<div class="eyebrow"><span></span>EXPANDED PLOT</div><h2 class="modal-title">${esc(v.name)}</h2><p class="modal-description">Membership functions sampled at ${v.x.length} points. Press Escape to return to the explorer.</p>${highlightLine(v)}${numericViewer(v,'expanded')}<div class="modal-actions"><button type="button" class="button outline" data-ex="svg">${icon('download')}Download SVG</button><button type="button" class="button primary" data-action="close-modal">Close</button></div>`;
 if(refresh){keepFocus(()=>{$('#modal-body').innerHTML=html;icons();drawCharts();});}
 else{$('#modal').classList.add('wide');modal(html);drawCharts();}
}
$('#modal').addEventListener('close',()=>{$('#modal').classList.remove('wide');});

/* ---------- events ---------- */
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-ex]');
 if(el){
  const a=el.dataset.ex,d=exData();
  if(a==='back')closeExplorer();
  else if(a==='select')selectRule(Number(el.dataset.rule));
  else if(a==='cond')focusCondition(Number(el.dataset.rule),el.dataset.feature,el.dataset.term);
  else if(a==='clear-selection'){ex.selected=null;syncConditions();updateDetail();}
  else if(a==='show-selected'){ex.search='';ex.klass='all';const s=$('#ex-search'),c=$('#ex-class');if(s)s.value='';if(c)c.value='all';updateRules();$(`[data-rule-card="${ex.selected}"]`)?.scrollIntoView({behavior:reducedMotion()?'auto':'smooth',block:'nearest'});}
  else if(a==='reset-filters'){ex.search='';ex.klass='all';const s=$('#ex-search'),c=$('#ex-class');if(s)s.value='';if(c)c.value='all';updateRules();s?.focus();}
  else if(a==='layout'){ex.layout=el.dataset.layout;document.querySelectorAll('[data-ex="layout"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.layout===ex.layout)));updateRules();}
  else if(a==='variable'){ex.variable=el.dataset.variable;ex.term=null;ex.cursor=null;syncConditions();updateDetail();}
  else if(a==='term'){ex.term=ex.term===el.dataset.term?null:el.dataset.term;syncConditions();updateDetail();}
  else if(a==='clear-term'){ex.term=null;syncConditions();updateDetail();}
  else if(a==='clear-feature-search'){ex.featureSearch='';const i=$('#ex-feature-search');if(i)i.value='';$('#feature-chips').innerHTML=featureChips(d);}
  else if(a==='expand')expandedBody(false);
  else if(a==='svg')downloadSVG();
  else if(a==='rules-txt'&&d)download('exfuzzy-rules.txt',d.rules_text||d.rules.map(ruleText).join('\n'));
  return;
 }
 if(state.view!=='explorer')return;
 const card=e.target.closest('[data-rule-card]');
 if(card&&!e.target.closest('button,a,input,select,summary'))selectRule(Number(card.dataset.ruleCard));
});
document.addEventListener('input',e=>{
 if(e.target.id==='ex-search'){ex.search=e.target.value;updateRules();}
 else if(e.target.id==='ex-feature-search'){ex.featureSearch=e.target.value;const d=exData();if(d)$('#feature-chips').innerHTML=featureChips(d);}
});
document.addEventListener('change',e=>{
 if(e.target.id==='ex-class'){ex.klass=e.target.value;updateRules();}
 else if(e.target.id==='ex-sort'){ex.sort=e.target.value;updateRules();}
});
document.addEventListener('keydown',e=>{
 const t=e.target;
 if(t.classList?.contains('rule-select')&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
  const all=[...document.querySelectorAll('#ex-rules .rule-select')],i=all.indexOf(t);if(i<0)return;e.preventDefault();
  const next=e.key==='ArrowDown'?all[Math.min(all.length-1,i+1)]:e.key==='ArrowUp'?all[Math.max(0,i-1)]:e.key==='Home'?all[0]:all.at(-1);next?.focus();
 } else if(t.classList?.contains('ex-divider')){
  const map={ArrowLeft:-2,ArrowRight:2};
  if(e.key in map){e.preventDefault();setSplit(ex.split+map[e.key]);}else if(e.key==='Home'){e.preventDefault();setSplit(30);}else if(e.key==='End'){e.preventDefault();setSplit(65);}
 } else if(t.classList?.contains('t1-chart')){
  const n=+t.dataset.n,cur=ex.cursor??(e.key==='ArrowLeft'||e.key==='End'?n:-1);let next=null;
  if(e.key==='ArrowRight')next=Math.min(n-1,cur+(e.shiftKey?10:1));else if(e.key==='ArrowLeft')next=Math.max(0,cur-(e.shiftKey?10:1));
  else if(e.key==='Home')next=0;else if(e.key==='End')next=n-1;else if(e.key==='PageUp')next=Math.min(n-1,Math.max(0,cur)+10);else if(e.key==='PageDown')next=Math.max(0,cur-10);
  else if(e.key==='Escape'){setCursor(null,false);return;}
  if(next!=null){e.preventDefault();setCursor(next,true);}
 }
});
document.addEventListener('pointermove',e=>{const svg=e.target.closest?.('svg.t1-chart');if(svg)setCursor(cursorFromPointer(svg,e.clientX),false);});
document.addEventListener('pointerleave',e=>{if(e.target.matches?.('svg.t1-chart')&&document.activeElement!==e.target)setCursor(null,false);},true);
document.addEventListener('pointerdown',e=>{
 const div=e.target.closest?.('.ex-divider');if(!div)return;
 e.preventDefault();div.setPointerCapture(e.pointerId);div.classList.add('dragging');
 const body=$('.ex-body'),rect=body.getBoundingClientRect();
 const move=ev=>setSplit((ev.clientX-rect.left)/rect.width*100);
 const up=()=>{div.classList.remove('dragging');div.removeEventListener('pointermove',move);div.removeEventListener('pointerup',up);div.removeEventListener('pointercancel',up);};
 div.addEventListener('pointermove',move);div.addEventListener('pointerup',up);div.addEventListener('pointercancel',up);
});
document.addEventListener('dblclick',e=>{if(e.target.closest?.('.ex-divider'))setSplit(44);});
window.addEventListener('resize',scheduleDraw);

/* Development preview: ?example=materials or ?example=iris opens a stored, clearly labelled result fixture. */
{const p=new URLSearchParams(location.search).get('example');if(p&&EXAMPLES[p])openExplorer({kind:'fixture',name:p});}
