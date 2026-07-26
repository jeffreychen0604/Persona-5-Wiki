import { aqiuP5rPersonas } from './data/aqiu-p5r-personas.js?v=8';
import { aqiuP5rSkills } from './data/aqiu-p5r-skills.js?v=8';
import { aqiuP5rEnemies } from './data/aqiu-p5r-enemies.js?v=8';
import { aqiuP5rFusion } from './data/aqiu-p5r-fusion.js?v=8';

const SOURCE_ROOT = 'https://aqiu384.github.io/megaten-fusion-tool/p5r';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const searchInput = $('#searchInput');
const fusionButton = $('#fusionNav');
const SUBVIEWS = [
  ['personas', 'Personas'],
  ['skills', 'Skills'],
  ['chart', 'Fusion Chart'],
  ['enemies', 'Enemy Shadows'],
  ['recipes', 'Recipes'],
  ['settings', 'Settings'],
];
const RESIST_ELEMENTS = aqiuP5rFusion.resistElements;
const RESIST_NAMES = { phy: 'Phys', gun: 'Gun', fir: 'Fire', ice: 'Ice', ele: 'Elec', win: 'Wind', psy: 'Psy', nuk: 'Nuke', ble: 'Bless', cur: 'Curse' };
const RESIST_LABELS = { wk: 'Weak', no: 'Normal', rs: 'Resist', nu: 'Null', rp: 'Repel', dr: 'Drain' };
const ELEMENT_NAMES = { phy:'Phys', gun:'Gun', fir:'Fire', ice:'Ice', ele:'Elec', win:'Wind', psy:'Psy', nuk:'Nuke', ble:'Bless', cur:'Curse', alm:'Almighty', ail:'Ailment', rec:'Recovery', sup:'Support', pas:'Passive', tra:'Trait' };
const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });

const state = {
  active: false,
  subview: 'personas',
  personaType: 'all',
  skillElement: 'all',
  enemyArea: 'all',
  personaLimit: 60,
  skillLimit: 80,
  enemyLimit: 60,
  recipeTarget: '',
  chartA: aqiuP5rFusion.arcana[0],
  chartB: aqiuP5rFusion.arcana[1],
  settings: loadSettings(),
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('p5r-fusion-settings-v8') || '{}');
    return {
      includeDlc: Boolean(saved.includeDlc),
      includeLocked: saved.includeLocked !== false,
      showParty: saved.showParty !== false,
    };
  } catch {
    return { includeDlc: false, includeLocked: true, showParty: true };
  }
}

function saveSettings() {
  try { localStorage.setItem('p5r-fusion-settings-v8', JSON.stringify(state.settings)); } catch {}
}

function activeQuery() {
  return searchInput?.value.trim().toLowerCase() || '';
}

function setActive(active) {
  state.active = active;
  if (active) {
    document.body.dataset.guideView = 'fusion';
    $$('.bottomNav button').forEach(button => button.classList.remove('active'));
    fusionButton?.classList.add('active');
    fusionButton?.scrollIntoView({ inline: 'center', block: 'nearest' });
    try { localStorage.setItem('p5r-view-v8', 'fusion'); } catch {}
  } else {
    fusionButton?.classList.remove('active');
  }
}

function setSource(path = '') {
  $('#sourceLink').href = `${SOURCE_ROOT}${path}`;
}

function setHeader(title, text, panelTitle, panelMeta, sourcePath = '') {
  $('#heroTitle').textContent = title;
  $('#heroText').textContent = text;
  $('#panelTitle').textContent = panelTitle;
  $('#panelMeta').textContent = panelMeta;
  setSource(sourcePath);
  $('#rankJumps').innerHTML = '';
}

function renderSubviewChips() {
  const root = $('#filterChips');
  root.innerHTML = '';
  SUBVIEWS.forEach(([id, label]) => {
    const button = document.createElement('button');
    button.className = `chip${state.subview === id ? ' active' : ''}`;
    button.textContent = label;
    button.onclick = () => {
      state.subview = id;
      searchInput.value = '';
      resetLimits();
      renderFusion();
      requestAnimationFrame(() => root.querySelector('.chip.active')?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
    };
    root.appendChild(button);
  });
}

function resetLimits() {
  state.personaLimit = 60;
  state.skillLimit = 80;
  state.enemyLimit = 60;
}

function personaAllowed(persona) {
  if (!state.settings.includeDlc && persona.dlc) return false;
  if (!state.settings.includeLocked && persona.unlockCondition && persona.unlockCategory !== 'Recruitment') return false;
  if (!state.settings.showParty && persona.party) return false;
  return true;
}

function ingredientAllowed(persona) {
  return !persona.party && persona.fusionType !== 'treasure' && personaAllowed(persona);
}

function resultAllowed(persona) {
  return ingredientAllowed(persona) && persona.fusionType !== 'special';
}

function inlineFilters(entries, selected, onSelect) {
  return `<div class="fusionInlineFilters">${entries.map(([id, label]) => `<button type="button" data-filter="${escapeHtml(id)}" class="${id === selected ? 'active' : ''}">${escapeHtml(label)}</button>`).join('')}</div>`;
}

function bindInlineFilters(onSelect) {
  $$('.fusionInlineFilters button').forEach(button => button.onclick = () => onSelect(button.dataset.filter));
}

function resistGrid(resists = {}) {
  return `<div class="resistGrid">${RESIST_ELEMENTS.map(element => {
    const value = resists[element] || 'no';
    return `<span class="resist ${escapeHtml(value)}"><small>${escapeHtml(RESIST_NAMES[element] || element)}</small><strong>${escapeHtml(RESIST_LABELS[value] || value)}</strong></span>`;
  }).join('')}</div>`;
}

function statGrid(stats = {}, maxStats = null) {
  return `<div class="statGrid">${Object.entries(stats).map(([name, value]) => `<span><small>${escapeHtml(name)}</small><strong>${escapeHtml(value)}</strong>${maxStats?.[name] != null ? `<em>Max ${escapeHtml(maxStats[name])}</em>` : ''}</span>`).join('')}</div>`;
}

function skillLevel(level) {
  if (typeof level === 'number' && level > 0 && level < 1) return 'Innate';
  if (level === 0) return 'Trait';
  if (level >= 3500) return 'Evolution';
  return `Lv ${level}`;
}

function personaCard(persona) {
  const badges = [
    persona.party ? '<b class="dbBadge party">Party</b>' : '',
    persona.dlc ? '<b class="dbBadge dlc">DLC</b>' : '',
    persona.fusionType === 'special' ? '<b class="dbBadge special">Special</b>' : '',
    persona.fusionType === 'treasure' ? '<b class="dbBadge treasure">Treasure</b>' : '',
  ].join('');
  const recipe = persona.recipe?.length ? `<div class="dbRecipe"><small>Special fusion</small><strong>${persona.recipe.map(escapeHtml).join(' × ')}</strong></div>` : '';
  const unlock = persona.unlockCondition ? `<div class="dbUnlock"><small>${escapeHtml(persona.unlockCategory)}</small><strong>${escapeHtml(persona.unlockCondition)}</strong></div>` : '';
  const items = persona.item || persona.itemRoyal ? `<div class="dbItems"><span><small>Itemize</small><strong>${escapeHtml(persona.item || '—')}</strong></span><span><small>Alarm</small><strong>${escapeHtml(persona.itemRoyal || '—')}</strong></span></div>` : '';
  const skills = persona.skills.map(skill => `<div class="dbSkillRow"><span>${escapeHtml(skill.name)}</span><b>${escapeHtml(skillLevel(skill.level))}</b></div>`).join('');
  return `<details class="personaDbCard searchable">
    <summary>
      <span class="dbLevel"><small>LV</small><strong>${escapeHtml(persona.level)}</strong></span>
      <span class="dbSummary"><strong>${escapeHtml(persona.name)}</strong><small>${escapeHtml(persona.arcana)} · ${escapeHtml(persona.inherits || 'No inheritance')}</small><span>${badges}</span></span>
    </summary>
    <div class="dbCardBody">
      ${persona.trait ? `<div class="dbTrait"><small>Trait</small><strong>${escapeHtml(persona.trait)}</strong></div>` : ''}
      ${persona.party ? '' : `<div class="dbPrice"><small>Summon price</small><strong>${escapeHtml(yen.format(persona.price))}</strong></div>`}
      <h4>Stats</h4>${statGrid(persona.stats, persona.maxStats)}
      <h4>Resistances</h4>${resistGrid(persona.resists)}
      ${persona.secondResists ? `<h4>Awakened Resistances</h4>${resistGrid(persona.secondResists)}` : ''}
      <h4>Learned Skills</h4><div class="dbSkillList">${skills}</div>
      ${items}${recipe}${unlock}
    </div>
  </details>`;
}

function renderPersonas() {
  setHeader('Fusion DB', 'Browse every Persona, trait, skill, resistance and itemization result in Persona 5 Royal.', 'Persona List', `${aqiuP5rPersonas.length} repository records`, '/personas');
  searchInput.placeholder = 'Search Persona, Arcana, trait or skill…';
  const typeFilters = [['all','All'],['normal','Normal'],['special','Special'],['dlc','DLC'],['party','Party'],['treasure','Treasure']];
  const query = activeQuery();
  const rows = aqiuP5rPersonas.filter(persona => {
    if (!personaAllowed(persona) && state.personaType !== 'dlc') return false;
    if (state.personaType === 'normal' && (persona.party || persona.dlc || persona.fusionType !== 'normal')) return false;
    if (state.personaType === 'special' && persona.fusionType !== 'special') return false;
    if (state.personaType === 'dlc' && !persona.dlc) return false;
    if (state.personaType === 'party' && !persona.party) return false;
    if (state.personaType === 'treasure' && persona.fusionType !== 'treasure') return false;
    if (!query) return true;
    return [persona.name, persona.arcana, persona.trait, persona.inherits, persona.unlockCondition, ...persona.skills.map(skill => skill.name)].join(' ').toLowerCase().includes(query);
  });
  const visible = rows.slice(0, query ? rows.length : state.personaLimit);
  const remaining = rows.length - visible.length;
  $('#content').innerHTML = `<h1>Persona List</h1>
    <div class="notice">Open a card for the same stats, resistances, learned skills, trait, itemization and recipe information exposed by the individual <code>/personas/&lt;name&gt;</code> pages.</div>
    ${inlineFilters(typeFilters, state.personaType)}
    <div class="resultCount">${rows.length} matching Personas</div>
    <div class="personaDbList">${visible.map(personaCard).join('')}</div>
    ${remaining > 0 ? `<button class="loadMore" id="fusionLoadMore">Show ${Math.min(60, remaining)} more</button>` : ''}
    ${rows.length ? '' : '<div class="empty">No Personas match the current filters.</div>'}`;
  bindInlineFilters(id => { state.personaType = id; state.personaLimit = 60; renderPersonas(); });
  $('#fusionLoadMore')?.addEventListener('click', () => { state.personaLimit += 60; renderPersonas(); });
}

function skillCard(skill) {
  const learners = skill.learnedBy.slice(0, 12).map(entry => `<span>${escapeHtml(entry.name)} <b>${escapeHtml(skillLevel(entry.level))}</b></span>`).join('');
  const more = skill.learnedBy.length > 12 ? `<span>+${skill.learnedBy.length - 12} more</span>` : '';
  return `<details class="skillDbCard searchable">
    <summary><span class="skillElem ${escapeHtml(skill.element)}">${escapeHtml(ELEMENT_NAMES[skill.element] || skill.element)}</span><span><strong>${escapeHtml(skill.name)}</strong><small>${escapeHtml(skill.cost)} · ${escapeHtml(skill.target)} · Rank ${escapeHtml(skill.rank)}</small></span></summary>
    <div class="dbCardBody"><p class="skillEffect">${escapeHtml(skill.effect)}</p>${skill.card ? `<div class="dbUnlock"><small>Skill card</small><strong>${escapeHtml(skill.card)}</strong></div>` : ''}<h4>Learned by</h4><div class="learnerTags">${learners}${more || (!learners ? '<span>No listed learner</span>' : '')}</div></div>
  </details>`;
}

function renderSkills() {
  setHeader('Fusion DB', 'Search the complete Royal skill catalogue and see who learns each skill.', 'Skill List', `${aqiuP5rSkills.length} skills · repository data`, '/skills');
  searchInput.placeholder = 'Search skill, effect, element or learner…';
  const elements = [['all','All'], ...[...new Set(aqiuP5rSkills.map(skill => skill.element))].map(element => [element, ELEMENT_NAMES[element] || element])];
  const query = activeQuery();
  const rows = aqiuP5rSkills.filter(skill => {
    if (state.skillElement !== 'all' && skill.element !== state.skillElement) return false;
    if (!query) return true;
    return [skill.name, skill.effect, skill.element, skill.target, skill.card, ...skill.learnedBy.map(entry => entry.name)].join(' ').toLowerCase().includes(query);
  });
  const visible = rows.slice(0, query ? rows.length : state.skillLimit);
  const remaining = rows.length - visible.length;
  $('#content').innerHTML = `<h1>Skill List</h1>${inlineFilters(elements, state.skillElement)}<div class="resultCount">${rows.length} matching skills</div><div class="skillDbList">${visible.map(skillCard).join('')}</div>${remaining > 0 ? `<button class="loadMore" id="fusionLoadMore">Show ${Math.min(80, remaining)} more</button>` : ''}${rows.length ? '' : '<div class="empty">No skills match the current filters.</div>'}`;
  bindInlineFilters(id => { state.skillElement = id; state.skillLimit = 80; renderSkills(); });
  $('#fusionLoadMore')?.addEventListener('click', () => { state.skillLimit += 80; renderSkills(); });
}

function chartResult(arcanaA, arcanaB) {
  const races = aqiuP5rFusion.arcana;
  const a = races.indexOf(arcanaA);
  const b = races.indexOf(arcanaB);
  if (a < 0 || b < 0) return '—';
  const row = Math.max(a, b);
  const column = Math.min(a, b);
  return aqiuP5rFusion.normalChart[row]?.[column] || '—';
}

function chartSelect(id, value) {
  return `<select id="${id}">${aqiuP5rFusion.arcana.map(arcana => `<option${arcana === value ? ' selected' : ''}>${escapeHtml(arcana)}</option>`).join('')}</select>`;
}

function renderChart() {
  setHeader('Fusion DB', 'Check Arcana results and Treasure Demon level shifts without leaving the guide.', 'Fusion Chart', `${aqiuP5rFusion.arcana.length} Arcana · repository data`, '/chart');
  searchInput.placeholder = 'Search is not required on this screen';
  const result = chartResult(state.chartA, state.chartB);
  const header = aqiuP5rFusion.arcana.map(arcana => `<th>${escapeHtml(arcana.slice(0, 4))}</th>`).join('');
  const body = aqiuP5rFusion.arcana.map((arcana, row) => `<tr><th>${escapeHtml(arcana)}</th>${aqiuP5rFusion.arcana.map((_, column) => `<td>${escapeHtml(column <= row ? (aqiuP5rFusion.normalChart[row]?.[column] || '—').slice(0, 4) : '')}</td>`).join('')}</tr>`).join('');
  const treasureHeader = aqiuP5rFusion.treasureDemons.map(name => `<th>${escapeHtml(name)}</th>`).join('');
  const treasureBody = aqiuP5rFusion.elementArcana.map((arcana, row) => `<tr><th>${escapeHtml(arcana)}</th>${aqiuP5rFusion.elementModifiers[row].map(offset => `<td>${offset > 0 ? '+' : ''}${escapeHtml(offset)}</td>`).join('')}</tr>`).join('');
  $('#content').innerHTML = `<h1>Fusion Chart</h1>
    <div class="chartPicker"><label>Ingredient Arcana${chartSelect('chartArcanaA', state.chartA)}</label><span>×</span><label>Ingredient Arcana${chartSelect('chartArcanaB', state.chartB)}</label><strong>${escapeHtml(result)}</strong></div>
    <h2>Normal Fusion Chart</h2><div class="chartScroll"><table class="fusionChart"><thead><tr><th>Arcana</th>${header}</tr></thead><tbody>${body}</tbody></table></div>
    <h2>Treasure Demon Modifiers</h2><div class="notice">The number shifts the result up or down within the ingredient Persona’s Arcana.</div><div class="chartScroll"><table class="fusionChart treasureChart"><thead><tr><th>Arcana</th>${treasureHeader}</tr></thead><tbody>${treasureBody}</tbody></table></div>`;
  $('#chartArcanaA').onchange = event => { state.chartA = event.target.value; renderChart(); };
  $('#chartArcanaB').onchange = event => { state.chartB = event.target.value; renderChart(); };
}

function enemyCard(enemy) {
  const drops = enemy.drops.length ? enemy.drops.map(drop => `<span>${escapeHtml(drop)}</span>`).join('') : '<span>None</span>';
  return `<details class="enemyDbCard searchable"><summary><span class="dbLevel"><small>LV</small><strong>${escapeHtml(enemy.level)}</strong></span><span class="dbSummary"><strong>${escapeHtml(enemy.name)}</strong><small>${escapeHtml(enemy.persona)} · ${escapeHtml(enemy.arcana)} · ${escapeHtml(enemy.area)}</small></span></summary><div class="dbCardBody"><div class="enemyNumbers"><span><small>HP</small><strong>${escapeHtml(enemy.hp)}</strong></span><span><small>MP</small><strong>${escapeHtml(enemy.mp)}</strong></span><span><small>EXP</small><strong>${escapeHtml(enemy.exp)}</strong></span><span><small>Yen</small><strong>${escapeHtml(yen.format(enemy.yen))}</strong></span></div><h4>Resistances</h4>${resistGrid(enemy.resists)}<h4>Skills</h4><div class="learnerTags">${enemy.skills.map(skill => `<span>${escapeHtml(skill)}</span>`).join('')}</div><h4>Drops</h4><div class="learnerTags">${drops}</div></div></details>`;
}

function renderEnemies() {
  const areas = [...new Set(aqiuP5rEnemies.map(enemy => enemy.area).filter(Boolean))].sort();
  setHeader('Fusion DB', 'Inspect the full enemy-only Shadow database with battle stats, drops and affinities.', 'Enemy Shadow List', `${aqiuP5rEnemies.length} enemies · repository data`, '/shadows');
  searchInput.placeholder = 'Search enemy, Persona, area, drop or skill…';
  const query = activeQuery();
  const rows = aqiuP5rEnemies.filter(enemy => {
    if (state.enemyArea !== 'all' && enemy.area !== state.enemyArea) return false;
    if (!query) return true;
    return [enemy.name, enemy.persona, enemy.arcana, enemy.personality, enemy.area, ...enemy.skills, ...enemy.drops].join(' ').toLowerCase().includes(query);
  });
  const visible = rows.slice(0, query ? rows.length : state.enemyLimit);
  const remaining = rows.length - visible.length;
  const areaOptions = `<select id="enemyArea"><option value="all">All areas</option>${areas.map(area => `<option value="${escapeHtml(area)}"${area === state.enemyArea ? ' selected' : ''}>${escapeHtml(area)}</option>`).join('')}</select>`;
  $('#content').innerHTML = `<h1>Enemy Shadow List</h1><div class="dbSelectFilter"><label>Encounter area${areaOptions}</label></div><div class="resultCount">${rows.length} matching enemies</div><div class="enemyDbList">${visible.map(enemyCard).join('')}</div>${remaining > 0 ? `<button class="loadMore" id="fusionLoadMore">Show ${Math.min(60, remaining)} more</button>` : ''}${rows.length ? '' : '<div class="empty">No enemies match the current filters.</div>'}`;
  $('#enemyArea').onchange = event => { state.enemyArea = event.target.value; state.enemyLimit = 60; renderEnemies(); };
  $('#fusionLoadMore')?.addEventListener('click', () => { state.enemyLimit += 60; renderEnemies(); });
}

function activeFusionPersonas() {
  return aqiuP5rPersonas.filter(ingredientAllowed);
}

function resultLevelsByArcana() {
  const map = new Map();
  aqiuP5rPersonas.filter(resultAllowed).forEach(persona => {
    if (!map.has(persona.arcana)) map.set(persona.arcana, []);
    map.get(persona.arcana).push(persona);
  });
  map.forEach(rows => rows.sort((a, b) => a.level - b.level));
  return map;
}

function racePairsForResult(targetArcana) {
  const races = aqiuP5rFusion.arcana;
  const pairs = [];
  for (let row = 0; row < races.length; row += 1) {
    for (let column = 0; column <= row; column += 1) {
      if (aqiuP5rFusion.normalChart[row]?.[column] === targetArcana && row !== column) pairs.push([races[column], races[row]]);
    }
  }
  return pairs;
}

function normalRecipes(target) {
  if (!target || target.fusionType !== 'normal') return [];
  const levels = resultLevelsByArcana().get(target.arcana) || [];
  const targetIndex = levels.findIndex(persona => persona.name === target.name);
  if (targetIndex < 0) return [];
  const previous = levels[targetIndex - 1];
  const next = levels[targetIndex + 1];
  const minSum = previous ? 2 * (previous.level - aqiuP5rFusion.levelModifier) : 0;
  const maxSum = next ? 2 * (target.level - aqiuP5rFusion.levelModifier) : 200;
  const ingredients = activeFusionPersonas();
  const byArcana = new Map();
  ingredients.forEach(persona => {
    if (!byArcana.has(persona.arcana)) byArcana.set(persona.arcana, []);
    byArcana.get(persona.arcana).push(persona);
  });
  const recipes = [];
  racePairsForResult(target.arcana).forEach(([arcanaA, arcanaB]) => {
    const aRows = byArcana.get(arcanaA) || [];
    const bRows = byArcana.get(arcanaB) || [];
    aRows.forEach(a => bRows.forEach(b => {
      const sum = a.level + b.level;
      if (minSum < sum && sum <= maxSum) recipes.push([a.name, b.name, 'Normal']);
    }));
  });
  return recipes;
}

function treasureRecipes(target) {
  if (!target || target.fusionType !== 'normal') return [];
  const raceIndex = aqiuP5rFusion.elementArcana.indexOf(target.arcana);
  if (raceIndex < 0) return [];
  const resultRows = (resultLevelsByArcana().get(target.arcana) || []).slice();
  const recipes = [];
  activeFusionPersonas().filter(persona => persona.arcana === target.arcana).forEach(ingredient => {
    const levels = [0, 0, ...resultRows.map(row => row.level), 100, 100];
    if (!levels.includes(ingredient.level)) levels.push(ingredient.level);
    levels.sort((a, b) => a - b);
    const ingredientIndex = levels.indexOf(ingredient.level);
    aqiuP5rFusion.treasureDemons.forEach((treasure, treasureIndex) => {
      const offset = aqiuP5rFusion.elementModifiers[raceIndex]?.[treasureIndex] || 0;
      if (levels[ingredientIndex + offset] === target.level) recipes.push([ingredient.name, treasure, 'Treasure']);
    });
  });
  return recipes;
}

function renderRecipes() {
  setHeader('Fusion DB', 'Select a target Persona to calculate normal, Treasure Demon and special recipes locally.', 'Recipe Generator', 'Local calculator · repository data', '/recipes');
  searchInput.placeholder = 'Filter the target Persona list…';
  const targetOptions = aqiuP5rPersonas.filter(persona => !persona.party && personaAllowed(persona)).sort((a,b) => a.level - b.level || a.name.localeCompare(b.name));
  const query = activeQuery();
  const filteredOptions = query ? targetOptions.filter(persona => [persona.name, persona.arcana].join(' ').toLowerCase().includes(query)) : targetOptions;
  if (!state.recipeTarget || !targetOptions.some(persona => persona.name === state.recipeTarget)) state.recipeTarget = targetOptions[0]?.name || '';
  const target = targetOptions.find(persona => persona.name === state.recipeTarget);
  const special = target?.recipe?.length ? [[...target.recipe, target.name]] : [];
  const pairs = [...normalRecipes(target), ...treasureRecipes(target)];
  const pairRows = pairs.slice(0, 180).map(([a,b,type]) => `<div class="recipePair"><span>${escapeHtml(a)}</span><b>×</b><span>${escapeHtml(b)}</span><strong>${escapeHtml(type)}</strong></div>`).join('');
  const specialRow = special.length ? `<div class="specialRecipeResult"><small>Special fusion</small><strong>${special[0].slice(0,-1).map(escapeHtml).join(' × ')}</strong><b>= ${escapeHtml(target.name)}</b></div>` : '';
  const targetSelect = `<select id="recipeTarget">${filteredOptions.map(persona => `<option value="${escapeHtml(persona.name)}"${persona.name === state.recipeTarget ? ' selected' : ''}>Lv ${escapeHtml(persona.level)} · ${escapeHtml(persona.arcana)} · ${escapeHtml(persona.name)}</option>`).join('')}</select>`;
  let unavailable = '';
  if (target?.fusionType === 'treasure') unavailable = '<div class="notice">Treasure Demons are obtained through recruitment or fusion accidents; use the Treasure Demon modifier table to see how they alter other Personas.</div>';
  else if (target?.fusionType === 'special') unavailable = '<div class="notice">This Persona uses its fixed special fusion recipe rather than normal Arcana fusion.</div>';
  $('#content').innerHTML = `<h1>Recipe Generator</h1><div class="dbSelectFilter"><label>Target Persona${targetSelect}</label></div>${target ? `<div class="recipeTargetCard"><span class="dbLevel"><small>LV</small><strong>${escapeHtml(target.level)}</strong></span><span><strong>${escapeHtml(target.name)}</strong><small>${escapeHtml(target.arcana)} · ${escapeHtml(target.trait || target.fusionType)}</small></span></div>` : ''}${specialRow}${unavailable}<div class="resultCount">${pairs.length} calculated two-Persona recipes${pairs.length > 180 ? ' · showing first 180' : ''}</div><div class="recipePairList">${pairRows}</div>${!pairs.length && !special.length ? '<div class="empty">No available recipe under the current Fusion Settings.</div>' : ''}`;
  $('#recipeTarget').onchange = event => { state.recipeTarget = event.target.value; renderRecipes(); };
}

function settingToggle(key, title, description) {
  return `<label class="fusionSetting"><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-setting="${escapeHtml(key)}"${state.settings[key] ? ' checked' : ''}><i></i></label>`;
}

function renderSettings() {
  setHeader('Fusion DB', 'Control DLC and unlock assumptions used by the local Persona and recipe views.', 'Fusion Settings', `${aqiuP5rFusion.unlockGroups.length} unlock groups · repository data`, '/settings');
  searchInput.placeholder = 'Search is not required on this screen';
  const groups = aqiuP5rFusion.unlockGroups.map(group => `<details class="unlockGroup"><summary>${escapeHtml(group.category)} <small>${Object.keys(group.conditions).reduce((count,names)=>count+names.split(',').length,0)} Personas</small></summary><div>${Object.entries(group.conditions).map(([names, condition]) => `<p><strong>${escapeHtml(names.split(',').join(', '))}</strong><span>${escapeHtml(condition)}</span></p>`).join('')}</div></details>`).join('');
  $('#content').innerHTML = `<h1>Fusion Settings</h1><div class="fusionSettings">${settingToggle('includeDlc','Include DLC Personas','Off by default, matching the source calculator’s normal setup.')}${settingToggle('includeLocked','Include story and Confidant unlocks','When disabled, locked Personas are removed from normal recipe ingredients and results.')}${settingToggle('showParty','Show party Personas','Controls whether evolved party Personas appear in the Persona List.')}</div><button class="resetSettings" id="resetFusionSettings">Reset Fusion Settings</button><h2>Unlock Conditions</h2><div class="unlockGroups">${groups}</div>`;
  $$('[data-setting]').forEach(input => input.onchange = () => { state.settings[input.dataset.setting] = input.checked; saveSettings(); renderSettings(); });
  $('#resetFusionSettings').onclick = () => { state.settings = { includeDlc:false, includeLocked:true, showParty:true }; saveSettings(); renderSettings(); };
}

function renderFusion() {
  setActive(true);
  renderSubviewChips();
  if (state.subview === 'personas') renderPersonas();
  if (state.subview === 'skills') renderSkills();
  if (state.subview === 'chart') renderChart();
  if (state.subview === 'enemies') renderEnemies();
  if (state.subview === 'recipes') renderRecipes();
  if (state.subview === 'settings') renderSettings();
}

fusionButton?.addEventListener('click', () => {
  searchInput.value = '';
  resetLimits();
  renderFusion();
});

$$('.navButton, #quizNav, #shadowsNav, #negotiationNav').forEach(button => button.addEventListener('click', () => {
  setActive(false);
  try { localStorage.setItem('p5r-view-v8', button.id === 'quizNav' ? 'quiz' : button.id === 'shadowsNav' ? 'shadows' : button.id === 'negotiationNav' ? 'negotiation' : (button.dataset.view || 'confidants')); } catch {}
}));

searchInput?.addEventListener('input', () => {
  if (!state.active) return;
  resetLimits();
  if (state.subview === 'personas') renderPersonas();
  if (state.subview === 'skills') renderSkills();
  if (state.subview === 'enemies') renderEnemies();
  if (state.subview === 'recipes') renderRecipes();
});

try {
  if (localStorage.getItem('p5r-view-v8') === 'fusion') renderFusion();
} catch {}
