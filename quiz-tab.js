import { tvQuiz } from './data/quiz.js?v=6';

const SOURCE_URL = 'https://megamitensei.fandom.com/wiki/Quiz';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const quizButton = $('#quizNav');
const searchInput = $('#searchInput');
let scheduleMode = 'quiz';

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function splitDate(value = '') {
  const [month = '', day = ''] = String(value).split(/\s+/);
  return { month, day };
}

function setQuizActive(active) {
  document.body.dataset.guideView = active ? 'quiz' : '';
  quizButton?.classList.toggle('active', active);
  if (active) $$('.navButton').forEach(button => button.classList.remove('active'));
}

function renderFilterChips() {
  const root = $('#filterChips');
  if (!root) return;
  const filters = [
    { id: 'quiz', label: '11 Quiz Dates' },
    { id: 'schedule', label: 'Full Thursday Schedule' }
  ];
  root.innerHTML = '';
  filters.forEach(filter => {
    const button = document.createElement('button');
    button.className = `chip${scheduleMode === filter.id ? ' active' : ''}`;
    button.textContent = filter.label;
    button.onclick = () => {
      scheduleMode = filter.id;
      renderQuiz();
      requestAnimationFrame(() => root.querySelector('.chip.active')?.scrollIntoView({
        behavior: 'smooth', inline: 'center', block: 'nearest'
      }));
    };
    root.appendChild(button);
  });
}

function quizCard(entry) {
  const { month, day } = splitDate(entry.date);
  if (entry.event) {
    return `<article class="quizCard quizEvent searchable" data-month="${escapeHtml(month)}">
      <span class="quizDate"><small>${escapeHtml(month.slice(0, 3))}</small><strong>${escapeHtml(day)}</strong></span>
      <span class="quizEventBody"><strong>Event Day</strong><small>The TV Quiz is unavailable on this Thursday.</small></span>
    </article>`;
  }

  const options = entry.options.map((option, index) => {
    const letter = index === 0 ? 'A' : 'B';
    const correct = letter === entry.correct;
    return `<div class="quizOption${correct ? ' correct' : ''}">
      <span class="quizLetter">${letter}</span>
      <span>${escapeHtml(option)}</span>
      ${correct ? '<b>Correct</b>' : ''}
    </div>`;
  }).join('');

  return `<article class="quizCard searchable" data-month="${escapeHtml(month)}">
    <span class="quizDate"><small>${escapeHtml(month.slice(0, 3))}</small><strong>${escapeHtml(day)}</strong></span>
    <span class="quizBody">
      <strong class="quizQuestion">${escapeHtml(entry.question)}</strong>
      <span class="quizOptions">${options}</span>
    </span>
  </article>`;
}

function applyQuizSearch() {
  if (document.body.dataset.guideView !== 'quiz') return;
  const query = searchInput?.value.trim().toLowerCase() || '';
  $$('.quizCard').forEach(card => {
    card.classList.toggle('hidden', Boolean(query) && !card.textContent.toLowerCase().includes(query));
  });
  $$('.quizMonth').forEach(heading => {
    let sibling = heading.nextElementSibling;
    let visible = false;
    while (sibling && !sibling.classList.contains('quizMonth')) {
      if (sibling.classList.contains('quizCard') && !sibling.classList.contains('hidden')) visible = true;
      sibling = sibling.nextElementSibling;
    }
    heading.classList.toggle('hidden', !visible);
  });
}

function renderQuiz() {
  setQuizActive(true);
  try { localStorage.setItem('p5r-view-v6', 'quiz'); } catch {}

  $('#heroTitle').textContent = 'TV Quiz Guide';
  $('#heroText').textContent = 'Check the correct answer before watching the Thursday quiz show in Café Leblanc.';
  searchInput.placeholder = 'Search date, question or answer…';
  $('#panelTitle').textContent = scheduleMode === 'quiz' ? 'All TV Quiz Answers' : 'TV Quiz Thursday Schedule';
  $('#panelMeta').textContent = 'Persona 5 / Royal · repository data';
  $('#sourceLink').href = SOURCE_URL;
  $('#rankJumps').innerHTML = '';

  const entries = scheduleMode === 'quiz' ? tvQuiz.filter(entry => !entry.event) : tvQuiz;
  const months = [...new Set(entries.map(entry => splitDate(entry.date).month))];
  let content = `<h1>TV Quiz Show</h1>
    <div class="notice">The quiz appears on selected Thursdays. A correct answer grants Knowledge +1 and watching does not consume an in-game time slot.</div>`;
  months.forEach(month => {
    const rows = entries.filter(entry => splitDate(entry.date).month === month);
    content += `<h2 class="quizMonth">${escapeHtml(month)}</h2>${rows.map(quizCard).join('')}`;
  });
  $('#content').innerHTML = content;
  renderFilterChips();
  applyQuizSearch();
}

quizButton?.addEventListener('click', () => {
  searchInput.value = '';
  renderQuiz();
});

$$('.navButton').forEach(button => button.addEventListener('click', () => {
  setQuizActive(false);
  try { localStorage.setItem('p5r-view-v6', button.dataset.view || 'confidants'); } catch {}
}));

searchInput?.addEventListener('input', applyQuizSearch);

try {
  if (localStorage.getItem('p5r-view-v6') === 'quiz') renderQuiz();
} catch {}
