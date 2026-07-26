import { confidants } from './data/confidants.js?v=3';
import { answers } from './data/answers.js?v=3';
import { extraConfidants } from './data/extras.js?v=3';

const RPG='https://www.rpgsite.net';
const guideMeta=[
  ['lovers','Ann Takamaki','Lovers','VI',`${RPG}/feature/5473-persona-5-confidant-guide-ann-takamaki-lovers`],
  ['chariot','Ryuji Sakamoto','Chariot','VII',`${RPG}/feature/5478-persona-5-confidant-guide-ryuji-sakamoto-chariot`],
  ['priestess','Makoto Niijima','Priestess','II',`${RPG}/feature/5483-persona-5-confidant-guide-makoto-niijima-priestess`],
  ['emperor','Yusuke Kitagawa','Emperor','IV',`${RPG}/feature/5480-persona-5-confidant-guide-yusuke-kitagawa-emperor`],
  ['hermit','Futaba Sakura','Hermit','IX',`${RPG}/feature/5482-persona-5-confidant-guide-futaba-sakura-hermit`],
  ['empress','Haru Okumura','Empress','III',`${RPG}/feature/5481-persona-5-confidant-guide-haru-okumura-empress`],
  ['faith','Kasumi Yoshizawa','Faith','XXI',`${RPG}/feature/9630-persona-5-royal-kasumi-yoshizawa-faith-confidant-guide`],
  ['justice','Goro Akechi','Justice','VIII',`${RPG}/feature/9631-persona-5-royal-goro-akechi-justice-confidant-guide`],
  ['strength','Caroline & Justine','Strength','XI',`${RPG}/feature/5486-persona-5-royal-strength-confidant-fusion-solutions-guide`],
  ['temperance','Sadayo Kawakami','Temperance','XIV',`${RPG}/feature/5488-persona-5-confidant-guide-sadayo-kawakami-temperance`],
  ['death','Tae Takemi','Death','XIII',`${RPG}/feature/5489-persona-5-confidant-guide-tae-takemi-death`],
  ['devil','Ichiko Ohya','Devil','XV',`${RPG}/feature/5491-persona-5-confidant-guide-ichiko-ohya-devil`],
  ['tower','Shinya Oda','Tower','XVI',`${RPG}/feature/5493-persona-5-confidant-guide-shinya-oda-tower`],
  ['hierophant','Sojiro Sakura','Hierophant','V',`${RPG}/feature/5477-persona-5-confidant-guide-sojiro-sakura-hierophant`],
  ['star','Hifumi Togo','Star','XVII',`${RPG}/feature/5487-persona-5-confidant-guide-hifumi-togo-star`],
  ['sun','Toranosuke Yoshida','Sun','XIX',`${RPG}/feature/5490-persona-5-confidant-guide-toranosuke-yoshida-sun`],
  ['fortune','Chihaya Mifune','Fortune','X',`${RPG}/feature/5485-persona-5-confidant-guide-chihaya-mifune-fortune`],
  ['hanged','Munehisa Iwai','Hanged Man','XII',`${RPG}/feature/5492-persona-5-confidant-guide-munehisa-iwai-hanged-man`],
  ['moon','Yuuki Mishima','Moon','XVIII',`${RPG}/feature/5476-persona-5-confidant-guide-yuuki-mishima-moon`],
  ['councillor','Takuto Maruki','Councillor','1R',`${RPG}/feature/9629-persona-5-royal-takuto-maruki-councillor-confidant-guide`],
  ['automatic','Igor, Morgana & Sae','Automatic','0/I/XX',`${RPG}/feature/5469-persona-5-confidant-choices-unlocks-for-fool-magician-judgement-igor-morgana-sae`]
].map(([id,name,arcana,symbol,url])=>({id,name,arcana,symbol,url}));
const classSource=`${RPG}/feature/9602-persona-5-royal-exam-answers-class-test-solutions`;
const months=['April','May','June','July','September','October','November','December','January'];
const allConfidants=[...confidants,...extraConfidants];
const byName=new Map(allConfidants.map(item=>[item.name.toLowerCase(),item]));
const $=selector=>document.querySelector(selector);
const $$=selector=>[...document.querySelectorAll(selector)];
const state={view:'confidants',selected:guideMeta[0],month:'All',query:''};

function escapeHtml(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function scoreOf(text){const m=String(text).match(/\+(\d+)/);return m?Number(m[1]):0;}
function decorateAnswer(text){return escapeHtml(text).replace(/\+(\d+)/g,'<span class="points">+$1</span>');}
function safeSave(){try{localStorage.setItem('p5r-view-v3',state.view);localStorage.setItem('p5r-selected-v3',state.selected.id);}catch{}}
function findConfidant(meta){return byName.get(meta.name.toLowerCase())||allConfidants.find(x=>String(x.id).toLowerCase()===meta.arcana.toLowerCase());}

function renderChips(){
  const root=$('#filterChips');root.innerHTML='';
  const entries=state.view==='confidants'?guideMeta:[{name:'All dates',id:'all'},...months.map(m=>({name:m,id:m.toLowerCase()}))];
  entries.forEach(entry=>{
    const active=state.view==='confidants'?entry.id===state.selected.id:(entry.name==='All dates'?state.month==='All':entry.name===state.month);
    const button=document.createElement('button');
    button.className=`chip${active?' active':''}`;
    button.textContent=entry.name;
    button.onclick=()=>{
      $('#searchInput').value='';state.query='';
      if(state.view==='confidants'){state.selected=entry;safeSave();renderConfidant();}
      else{state.month=entry.name==='All dates'?'All':entry.name;renderClassAnswers();}
      renderChips();
      requestAnimationFrame(()=>root.querySelector('.chip.active')?.scrollIntoView({behavior:'smooth',inline:'center',block:'nearest'}));
    };
    root.appendChild(button);
  });
}

function renderAbilities(items=[]){
  if(!items.length)return '';
  return `<h2>Abilities & Benefits</h2><div class="abilities">${items.map(item=>`<div class="ability searchable"><span class="abilityRank">${escapeHtml(item.rank)}</span><span><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.description)}</p></span></div>`).join('')}</div>`;
}
function renderAvailability(items=[]){
  if(!items.length)return '';
  return `<h2>Availability</h2><div class="availability">${items.map(item=>`<span class="${item[2]?'on':''}">${escapeHtml(item[0])}<br><strong>${escapeHtml(item[1])}</strong></span>`).join('')}</div>`;
}
function renderRanks(items=[]){
  if(!items.length)return '<div class="empty">No manual rank choices are required for this entry.</div>';
  return `<h2>Ranks & Answers</h2>${items.map((rank,index)=>{
    const groups=(rank.responses||[]).map(group=>{
      const scores=group.map(scoreOf),max=scores.length?Math.max(...scores):0;
      return `<div class="answerGroup">${group.map((answer,i)=>`<div class="answer searchable${max>0&&scores[i]===max?' best':''}">${decorateAnswer(answer)}</div>`).join('')}</div>`;
    }).join('');
    return `<details class="rank searchable" id="rank-${index}"${index===0?' open':''}><summary>${escapeHtml(rank.label)}</summary><div class="rankBody">${rank.note?`<div class="rankNote">${escapeHtml(rank.note)}</div>`:''}${groups||'<div class="empty">This rank advances automatically.</div>'}</div></details>`;
  }).join('')}`;
}
function buildRankJumps(){
  const root=$('#rankJumps');root.innerHTML='';
  $$('.rank').forEach((rank,index)=>{
    const button=document.createElement('button');button.className='rankChip';button.textContent=rank.querySelector('summary')?.textContent||`Rank ${index+1}`;
    button.onclick=()=>{rank.open=true;rank.scrollIntoView({behavior:'smooth',block:'start'});};root.appendChild(button);
  });
}
function applySearch(){
  const q=state.query.trim().toLowerCase();
  $$('.rank').forEach(card=>card.classList.toggle('hidden',Boolean(q)&&!card.textContent.toLowerCase().includes(q)));
  $$('.ability').forEach(card=>card.classList.toggle('hidden',Boolean(q)&&!card.textContent.toLowerCase().includes(q)));
  $$('.classAnswer').forEach(card=>card.classList.toggle('hidden',Boolean(q)&&!card.textContent.toLowerCase().includes(q)));
}

function renderConfidant(){
  const meta=state.selected,item=findConfidant(meta);
  $('#panelTitle').textContent=meta.name;$('#panelMeta').textContent=`${meta.arcana} Arcana · repository data`;$('#sourceLink').href=meta.url;
  if(!item){$('#content').innerHTML='<div class="error">Local data for this Confidant is missing. Run the repository data sync workflow.</div>';$('#rankJumps').innerHTML='';return;}
  $('#content').innerHTML=`<h1>${escapeHtml(item.name)} — ${escapeHtml(item.id)}</h1><div class="notice">Structured choices, rank requirements and unlocks are loaded from files stored in this GitHub repository. No RPG Site page is fetched at runtime.</div>${renderAvailability(item.availabilities)}${renderAbilities(item.benefits)}${renderRanks(item.conversations)}`;
  buildRankJumps();applySearch();renderChips();
}
function renderClassAnswers(){
  const rows=answers.filter(row=>state.month==='All'||row[0]===state.month);
  $('#panelTitle').textContent=state.month==='All'?'All Class & Exam Answers':`${state.month} Answers`;
  $('#panelMeta').textContent='Persona 5 Royal · repository data';$('#sourceLink').href=classSource;
  const grouped=rows.reduce((out,row)=>{(out[row[0]]??=[]).push(row);return out;},{});
  let html='<h1>Class & Exam Answers</h1><div class="notice">The month filters use the local month field directly, so they do not depend on headings or formatting from an external article.</div>';
  months.forEach(month=>{if(!grouped[month])return;html+=`<h2 class="classMonth">${month}</h2>${grouped[month].map(row=>`<div class="classAnswer searchable"><span class="date">${month.slice(0,3)}<br>${escapeHtml(row[1])}</span><span class="answerPills">${row[2].map((answer,index)=>`<span class="answerPill">${row[2].length>1?`${index+1}. `:''}${escapeHtml(answer)}</span>`).join('')}</span></div>`).join('')}`;});
  $('#content').innerHTML=html;$('#rankJumps').innerHTML='';applySearch();renderChips();
}
function switchView(view){
  state.view=view;safeSave();
  $$('.navButton').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
  if(view==='confidants'){$('#heroTitle').textContent='Confidant Guide';$('#heroText').textContent='Switch characters instantly and keep every rank within thumb reach.';$('#searchInput').placeholder='Search rank, answer, ability or requirement…';renderConfidant();}
  else{$('#heroTitle').textContent='Class Answer Guide';$('#heroText').textContent='Filter by month and find every class or exam answer instantly.';$('#searchInput').placeholder='Search date or answer…';renderClassAnswers();}
}

$$('.navButton').forEach(button=>button.onclick=()=>{state.query='';$('#searchInput').value='';switchView(button.dataset.view);});
$('#searchInput').addEventListener('input',event=>{state.query=event.target.value;applySearch();});
$('#backTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
addEventListener('scroll',()=>$('#backTop').classList.toggle('visible',scrollY>520),{passive:true});
try{const id=localStorage.getItem('p5r-selected-v3');const saved=guideMeta.find(x=>x.id===id);if(saved)state.selected=saved;const view=localStorage.getItem('p5r-view-v3');if(view==='class')state.view='class';}catch{}
switchView(state.view);
