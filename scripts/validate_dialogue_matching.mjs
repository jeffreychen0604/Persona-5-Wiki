import fs from 'node:fs';
import { confidants } from '../data/confidants.js';
import { dialoguePrompts } from '../data/dialogue-prompts.js';
import { dialogueOverrides } from '../data/dialogue-overrides.js';

function canonicalRank(label = '') {
  const value = String(label).toUpperCase().replace(/[–—]/g, '-');
  if (value.includes('MAX') || /\b10\b/.test(value)) return 'MAX';
  return value.match(/\d+(?:\.\d+)?/)?.[0] || value.trim();
}

function normalizeChoice(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[’‘]/g, "'")
    .replace(/\+\s*\d+/g, '')
    .replace(/\((?:ROMANCE|FRIENDSHIP|PLATONIC)\)/gi, '')
    .replace(/\b(?:ROMANCE|FRIENDSHIP|PLATONIC|END)\b/gi, '')
    .replace(/<protagonist>/gi, 'joker')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toLowerCase();
}

function promptScore(group, candidate, groupIndex) {
  const current = group.map(normalizeChoice).filter(Boolean);
  const source = (candidate.answers || []).map(normalizeChoice).filter(Boolean);
  let exact = 0;
  let partial = 0;
  current.forEach(answer => {
    if (source.includes(answer)) {
      exact += 1;
      return;
    }
    if (answer.length > 7 && source.some(item => item.includes(answer) || answer.includes(item))) partial += 1;
  });
  return { score: exact * 100 + partial * 20 - Math.abs(groupIndex - candidate.groupIndex) * 2, exact, partial };
}

const report = {
  generatedAt: new Date().toISOString(),
  totals: { answerGroups: 0, directMatches: 0, manualOverrides: 0, positionalFallbacks: 0, missing: 0 },
  characters: {},
  unresolved: [],
};

for (const confidant of confidants) {
  const sourceRecords = dialoguePrompts[confidant.name];
  if (!sourceRecords) continue;
  const stats = { answerGroups: 0, directMatches: 0, manualOverrides: 0, positionalFallbacks: 0, missing: 0 };

  for (const rank of confidant.conversations || []) {
    const responseGroups = rank.responses || [];
    const key = canonicalRank(rank.label);
    const overrides = dialogueOverrides[confidant.name]?.[key] || [];
    const candidates = sourceRecords
      .filter(record => record.rank === key)
      .flatMap((record, recordIndex) => (record.groups || []).map((group, groupIndex) => ({ ...group, recordIndex, groupIndex, sourceLabel: record.sourceLabel })));
    const used = new Set();

    responseGroups.forEach((group, groupIndex) => {
      stats.answerGroups += 1;
      report.totals.answerGroups += 1;

      if (overrides[groupIndex]) {
        stats.manualOverrides += 1;
        report.totals.manualOverrides += 1;
        return;
      }

      let bestIndex = -1;
      let best = { score: -Infinity, exact: 0, partial: 0 };
      candidates.forEach((candidate, index) => {
        if (used.has(index)) return;
        const result = promptScore(group, candidate, groupIndex);
        if (result.score > best.score) {
          best = result;
          bestIndex = index;
        }
      });

      if (bestIndex >= 0 && best.score >= 80) {
        used.add(bestIndex);
        stats.directMatches += 1;
        report.totals.directMatches += 1;
        return;
      }

      const positional = candidates.findIndex((candidate, index) => !used.has(index) && candidate.groupIndex === groupIndex);
      const diagnostic = {
        character: confidant.name,
        rank: rank.label,
        canonicalRank: key,
        group: groupIndex + 1,
        answers: group,
        bestScore: Number.isFinite(best.score) ? best.score : null,
        bestCandidate: bestIndex >= 0 ? {
          prompt: candidates[bestIndex].prompt,
          answers: candidates[bestIndex].answers,
          sourceLabel: candidates[bestIndex].sourceLabel,
          sourceGroup: candidates[bestIndex].groupIndex + 1,
        } : null,
        positionalCandidate: positional >= 0 ? {
          prompt: candidates[positional].prompt,
          answers: candidates[positional].answers,
          sourceLabel: candidates[positional].sourceLabel,
          sourceGroup: candidates[positional].groupIndex + 1,
        } : null,
      };

      if (positional >= 0) {
        used.add(positional);
        stats.positionalFallbacks += 1;
        report.totals.positionalFallbacks += 1;
        report.unresolved.push({ ...diagnostic, mode: 'positional' });
      } else {
        stats.missing += 1;
        report.totals.missing += 1;
        report.unresolved.push({ ...diagnostic, mode: 'missing' });
      }
    });
  }
  report.characters[confidant.name] = stats;
}

const covered = report.totals.directMatches + report.totals.manualOverrides;
report.totals.directCoverage = Number((report.totals.directMatches / report.totals.answerGroups * 100).toFixed(2));
report.totals.effectiveCoverage = Number((covered / report.totals.answerGroups * 100).toFixed(2));
fs.writeFileSync('data/dialogue-match-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.totals, null, 2));

if (report.totals.missing > 0 || report.totals.positionalFallbacks > 0) process.exitCode = 2;
