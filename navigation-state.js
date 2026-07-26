const STORAGE_KEY = 'p5r-view-v8';
const LEGACY_KEYS = ['p5r-view-v7', 'p5r-view-v6', 'p5r-view-v5'];
const BUTTONS = {
  confidants: '.navButton[data-view="confidants"]',
  class: '.navButton[data-view="class"]',
  quiz: '#quizNav',
  shadows: '#shadowsNav',
  negotiation: '#negotiationNav',
  fusion: '#fusionNav',
};

function readInitialView() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (BUTTONS[current]) return current;

    for (const key of LEGACY_KEYS) {
      const legacy = localStorage.getItem(key);
      if (BUTTONS[legacy]) return legacy;
    }
  } catch {}
  return 'confidants';
}

function clearLegacyState() {
  try { LEGACY_KEYS.forEach(key => localStorage.removeItem(key)); } catch {}
}

const initialView = readInitialView();
clearLegacyState();

requestAnimationFrame(() => {
  const button = document.querySelector(BUTTONS[initialView]);
  if (!button) return;
  const active = button.classList.contains('active');
  if (!active || initialView !== 'confidants') button.click();
});
