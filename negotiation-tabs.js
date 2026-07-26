import { royalShadows } from './data/shadows-royal.js?v=7';
import { royalNegotiations } from './data/negotiation-royal.js?v=7';

const SHADOW_SOURCE = 'https://joyceychen.com/persona5-negotiation/shadows_royal';
const NEGOTIATION_SOURCE = 'https://joyceychen.com/persona5-negotiation/royal';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const searchInput = $('#searchInput');
const shadowsButton = $('#shadowsNav');
const negotiationButton = $('#negotiationNav');
const PERSONALITIES = ['gloomy', 'irritable', 'timid', 'upbeat'];

const state = {
  view: '',
  shadowFilter: 'all',
  personality: 'all',
  negotiationLimit: 60,
};

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function activeQuery() {
  return searchInput?.value.trim().toLowerCase() || '';
}

function setNavigationActive(view) {
  document.body.dataset.guideView = view;
  $$('.bottomNav button').forEach(button => button.classList.remove('active'));
  if (view === 'shadows') shadowsButton?.classList.add('active');
  if (view === 'negotiation') negotiationButton?.classList.add('active');
  document.querySelector('.bottomNav .active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  try { localStorage.setItem('p5r-view-v7', view); } catch {}
}

function clearPanelJumps() {
  $('#rankJumps').innerHTML = '';
}

function renderFilterChips(entries, selected, onSelect) {
  const root = $('#filterChips');
  root.innerHTML = '';
  entries.forEach(entry => {
    const button = document.createElement('button');
    button.className = `chip${entry.id === selected ? ' active' : ''}`;
    button.textContent = entry.label;
    button.onclick = () => {
      onSelect(entry.id);
      requestAnimationFrame(() => root.querySelector('.chip.active')?.scrollIntoView({
        behavior: 'smooth', inline: 'center', block: 'nearest'
      }));
    };
    root.appendChild(button);
  });
}

function shadowMatchesFilter(row) {
  if (state.shadowFilter === 'palaces') return row.category === 'Palace' || row.category === 'Qliphoth';
  if (state.shadowFilter === 'mementos') return row.category === 'Mementos';
  if (state.shadowFilter === 'royal') return Boolean(row.royal);
  if (state.shadowFilter === 'treasure') return Boolean(row.treasure);
  return true;
}

function shadowCard(row) {
  const area = row.areas ? `<span><small>Areas</small><strong>${escapeHtml(row.areas)}</strong></span>` : '';
  return `<article class="shadowCard searchable">
    <div class="shadowLevel"><small>LV</small><strong>${escapeHtml(row.level)}</strong></div>
    <div class="shadowMain">
      <div class="shadowTitle"><strong>${escapeHtml(row.persona)}</strong>${row.royal ? '<b>Royal</b>' : ''}</div>
      <p>${escapeHtml(row.shadow)}</p>
      <div class="shadowFacts">
        <span><small>Arcana</small><strong>${escapeHtml(row.arcana)}</strong></span>
        <span><small>Personality</small><strong>${escapeHtml(row.personality)}</strong></span>
        <span><small>Weakness</small><strong>${escapeHtml(row.weakness || 'None')}</strong></span>
        ${area}
      </div>
      <div class="shadowLocation">${escapeHtml(row.location)}</div>
    </div>
  </article>`;
}

function renderShadows() {
  state.view = 'shadows';
  setNavigationActive('shadows');
  clearPanelJumps();
  $('#heroTitle').textContent = 'Royal Shadows';
  $('#heroText').textContent = 'Find a Shadow by Palace, Mementos path, personality, Arcana or weakness.';
  searchInput.placeholder = 'Search Persona, Shadow, location, Arcana…';
  $('#panelTitle').textContent = 'Persona 5 Royal Shadow Index';
  $('#panelMeta').textContent = `${royalShadows.length} location records · repository data`;
  $('#sourceLink').href = SHADOW_SOURCE;

  renderFilterChips([
    { id: 'all', label: 'All Shadows' },
    { id: 'palaces', label: 'Palaces' },
    { id: 'mementos', label: 'Mementos' },
    { id: 'royal', label: 'Royal Content' },
    { id: 'treasure', label: 'Treasure Demons' },
  ], state.shadowFilter, id => {
    state.shadowFilter = id;
    renderShadows();
  });

  const query = activeQuery();
  const rows = royalShadows.filter(row => {
    if (!shadowMatchesFilter(row)) return false;
    if (!query) return true;
    return Object.values(row).join(' ').toLowerCase().includes(query);
  });

  $('#content').innerHTML = `<h1>Royal Shadow Guide</h1>
    <div class="notice">Each card combines the Persona name, in-battle Shadow name, Arcana, personality, weakness and encounter location. Duplicate Personas are retained when their location or Mementos area differs.</div>
    <div class="resultCount">${rows.length} matching records</div>
    <div class="shadowList">${rows.map(shadowCard).join('')}</div>
    ${rows.length ? '' : '<div class="empty">No Shadows match the current filter.</div>'}`;
}

function reactionClass(value, confirmed) {
  const normalized = String(value || '-').toLowerCase();
  return `reaction ${normalized === '-' ? 'unknown' : normalized}${confirmed ? '' : ' unconfirmed'}`;
}

function compactReaction(label, reaction) {
  return `<span class="reactionCell">
    <small>${label}</small>
    <b class="${reactionClass(reaction.value, reaction.confirmed)}">${escapeHtml(reaction.value || '-')}</b>
  </span>`;
}

function answerRow(answer) {
  if (state.personality !== 'all') {
    const reaction = answer.reactions[state.personality] || { value: '-', confirmed: true };
    return `<div class="negotiationAnswer">
      <span>${escapeHtml(answer.text)}</span>
      <b class="${reactionClass(reaction.value, reaction.confirmed)}">${escapeHtml(reaction.value || '-')}${reaction.confirmed ? '' : ' ?'}</b>
    </div>`;
  }

  return `<div class="negotiationAnswer allPersonalities">
    <span>${escapeHtml(answer.text)}</span>
    <div class="reactionGrid">
      ${compactReaction('Glo', answer.reactions.gloomy)}
      ${compactReaction('Irr', answer.reactions.irritable)}
      ${compactReaction('Tim', answer.reactions.timid)}
      ${compactReaction('Upb', answer.reactions.upbeat)}
    </div>
  </div>`;
}

function negotiationCard(item) {
  const visibleShadows = item.shadows.slice(0, 5);
  const overflow = item.shadows.length - visibleShadows.length;
  const tags = visibleShadows.length
    ? visibleShadows.map(shadow => `<span>${escapeHtml(shadow)}</span>`).join('') + (overflow > 0 ? `<span>+${overflow}</span>` : '')
    : '<span>Uncategorized</span>';
  return `<article class="negotiationCard searchable">
    <div class="shadowTags">${tags}</div>
    <h3>${escapeHtml(item.question)}</h3>
    <div class="negotiationAnswers">${item.answers.map(answerRow).join('')}</div>
  </article>`;
}

function negotiationMatches(item, query) {
  if (!query) return true;
  const haystack = [item.question, ...item.shadows, ...item.answers.map(answer => answer.text)].join(' ').toLowerCase();
  return haystack.includes(query);
}

function renderNegotiations({ resetLimit = false } = {}) {
  state.view = 'negotiation';
  if (resetLimit) state.negotiationLimit = 60;
  setNavigationActive('negotiation');
  clearPanelJumps();
  $('#heroTitle').textContent = 'Royal Negotiation';
  $('#heroText').textContent = 'Search the question or Shadow, then choose the best response for its personality.';
  searchInput.placeholder = 'Search question, response or Shadow…';
  $('#panelTitle').textContent = 'Persona 5 Royal Negotiation Answers';
  $('#panelMeta').textContent = `${royalNegotiations.length} questions · repository data`;
  $('#sourceLink').href = NEGOTIATION_SOURCE;

  renderFilterChips([
    { id: 'all', label: 'All Personalities' },
    { id: 'gloomy', label: 'Gloomy' },
    { id: 'irritable', label: 'Irritable' },
    { id: 'timid', label: 'Timid' },
    { id: 'upbeat', label: 'Upbeat' },
  ], state.personality, id => {
    state.personality = id;
    renderNegotiations({ resetLimit: true });
  });

  const query = activeQuery();
  const matches = royalNegotiations.filter(item => negotiationMatches(item, query));
  const visible = matches.slice(0, query ? matches.length : state.negotiationLimit);
  const remaining = matches.length - visible.length;

  $('#content').innerHTML = `<h1>Royal Negotiation Guide</h1>
    <div class="notice">GOOD is the preferred reaction, OK is neutral, BAD is unfavorable, and “-” means the source lacks data. A question mark marks an unconfirmed result inherited from the original-game dataset.</div>
    <div class="resultCount">${matches.length} matching questions</div>
    <div class="negotiationList">${visible.map(negotiationCard).join('')}</div>
    ${remaining > 0 ? `<button class="loadMore" id="loadMoreNegotiations">Show ${Math.min(60, remaining)} more</button>` : ''}
    ${matches.length ? '' : '<div class="empty">No negotiation questions match the current search.</div>'}`;

  $('#loadMoreNegotiations')?.addEventListener('click', () => {
    state.negotiationLimit += 60;
    renderNegotiations();
  });
}

shadowsButton?.addEventListener('click', () => {
  searchInput.value = '';
  renderShadows();
});

negotiationButton?.addEventListener('click', () => {
  searchInput.value = '';
  renderNegotiations({ resetLimit: true });
});

$$('.navButton, #quizNav').forEach(button => button.addEventListener('click', () => {
  state.view = '';
  shadowsButton?.classList.remove('active');
  negotiationButton?.classList.remove('active');
  document.body.dataset.guideView = button.id === 'quizNav' ? 'quiz' : '';
  try { localStorage.setItem('p5r-view-v7', button.id === 'quizNav' ? 'quiz' : (button.dataset.view || 'confidants')); } catch {}
}));

searchInput?.addEventListener('input', () => {
  if (state.view === 'shadows') renderShadows();
  if (state.view === 'negotiation') renderNegotiations({ resetLimit: true });
});

try {
  const saved = localStorage.getItem('p5r-view-v7');
  if (saved === 'shadows') renderShadows();
  if (saved === 'negotiation') renderNegotiations({ resetLimit: true });
} catch {}
