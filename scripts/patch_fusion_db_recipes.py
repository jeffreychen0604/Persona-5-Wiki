#!/usr/bin/env python3
"""Apply idempotent correctness guards to the local Fusion DB controller."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "fusion-db.js"

text = PATH.read_text(encoding="utf-8")

anchor = "const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });\n"
insert = anchor + """const SPECIAL_PAIR_KEYS = new Set(
  Object.values(aqiuP5rFusion.specialRecipes)
    .filter(recipe => recipe.length === 2)
    .map(recipe => recipe.slice().sort((a, b) => a.localeCompare(b)).join('\\u0000'))
);

function recipePairKey(nameA, nameB) {
  return [nameA, nameB].sort((a, b) => a.localeCompare(b)).join('\\u0000');
}
"""
if "const SPECIAL_PAIR_KEYS = new Set(" not in text:
    if anchor not in text:
        raise RuntimeError("Unable to locate Fusion DB constant anchor")
    text = text.replace(anchor, insert, 1)

old_recipe = "if (minSum < sum && sum <= maxSum) recipes.push([a.name, b.name, 'Normal']);"
new_recipe = "if (minSum < sum && sum <= maxSum && !SPECIAL_PAIR_KEYS.has(recipePairKey(a.name, b.name))) recipes.push([a.name, b.name, 'Normal']);"
if old_recipe in text:
    text = text.replace(old_recipe, new_recipe, 1)
elif new_recipe not in text:
    raise RuntimeError("Unable to locate normal recipe insertion point")

old_target = """  const filteredOptions = query ? targetOptions.filter(persona => [persona.name, persona.arcana].join(' ').toLowerCase().includes(query)) : targetOptions;
  if (!state.recipeTarget || !targetOptions.some(persona => persona.name === state.recipeTarget)) state.recipeTarget = targetOptions[0]?.name || '';
  const target = targetOptions.find(persona => persona.name === state.recipeTarget);"""
new_target = """  const filteredOptions = query ? targetOptions.filter(persona => [persona.name, persona.arcana].join(' ').toLowerCase().includes(query)) : targetOptions;
  const selectableOptions = query ? filteredOptions : targetOptions;
  if (!state.recipeTarget || !selectableOptions.some(persona => persona.name === state.recipeTarget)) state.recipeTarget = selectableOptions[0]?.name || '';
  const target = targetOptions.find(persona => persona.name === state.recipeTarget);"""
if old_target in text:
    text = text.replace(old_target, new_target, 1)
elif new_target not in text:
    raise RuntimeError("Unable to locate recipe target selection block")

PATH.write_text(text, encoding="utf-8")
print("Fusion DB recipe guards are present.")
