#!/usr/bin/env python3
"""Build repository-local Confidant dialogue prompts from Megami Tensei Wiki.

The existing structured dataset contains answer groups but not the dialogue line that
precedes each group. This script downloads the Persona 5 Royal dialogue tables,
extracts prompt/answer groupings, and writes an ES module consumed by the site.
"""

from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "dialogue-prompts.js"
REPORT = ROOT / "data" / "dialogue-prompts-report.json"

SOURCES: list[tuple[str, list[str]]] = [
    ("Ann Takamaki", ["Confidant/Ann Takamaki"]),
    ("Ryuji Sakamoto", ["Confidant/Ryuji Sakamoto"]),
    ("Makoto Niijima", ["Confidant/Makoto Niijima"]),
    ("Yusuke Kitagawa", ["Confidant/Yusuke Kitagawa"]),
    ("Futaba Sakura", ["Confidant/Futaba Sakura"]),
    ("Haru Okumura", ["Confidant/Haru Okumura"]),
    ("Kasumi Yoshizawa", ["Confidant/Sumire Yoshizawa", "Confidant/Kasumi Yoshizawa"]),
    ("Goro Akechi", ["Confidant/Goro Akechi"]),
    ("Sadayo Kawakami", ["Confidant/Sadayo Kawakami"]),
    ("Tae Takemi", ["Confidant/Tae Takemi"]),
    ("Ichiko Ohya", ["Confidant/Ichiko Ohya"]),
    ("Shinya Oda", ["Confidant/Shinya Oda"]),
    ("Sojiro Sakura", ["Confidant/Sojiro Sakura"]),
    ("Hifumi Togo", ["Confidant/Hifumi Togo"]),
    ("Toranosuke Yoshida", ["Confidant/Toranosuke Yoshida"]),
    ("Chihaya Mifune", ["Confidant/Chihaya Mifune"]),
    ("Munehisa Iwai", ["Confidant/Munehisa Iwai"]),
    ("Yuuki Mishima", ["Confidant/Yuuki Mishima"]),
    ("Takuto Maruki", ["Confidant/Takuto Maruki"]),
]

API = "https://megamitensei.fandom.com/api.php"
USER_AGENT = "Persona-5-Wiki dialogue context sync/1.2 (GitHub Pages data build)"


def fetch_wikitext(page_candidates: list[str]) -> tuple[str, str]:
    last_error: Exception | None = None
    for page in page_candidates:
        params = urllib.parse.urlencode(
            {
                "action": "parse",
                "page": page,
                "prop": "wikitext",
                "format": "json",
                "formatversion": 2,
                "origin": "*",
            }
        )
        url = f"{API}?{params}"
        for attempt in range(3):
            try:
                request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(request, timeout=60) as response:
                    payload = json.load(response)
                if "error" in payload:
                    raise RuntimeError(str(payload["error"]))
                return page, payload["parse"]["wikitext"]
            except (urllib.error.URLError, TimeoutError, RuntimeError, KeyError) as exc:
                last_error = exc
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Unable to download {page_candidates}: {last_error}")


def replace_templates(value: str) -> str:
    pattern = re.compile(r"\{\{([^{}]*)\}\}")
    for _ in range(12):
        match = pattern.search(value)
        if not match:
            break
        parts = [part.strip() for part in match.group(1).split("|")]
        name = parts[0].lower() if parts else ""
        replacement = ""
        if len(parts) > 1:
            if name in {"tt", "tooltip", "color", "nowrap", "small", "nobr"}:
                replacement = parts[1]
            elif name in {"p5r", "royal"}:
                replacement = "Persona 5 Royal"
            elif len(parts[-1]) < 240 and "=" not in parts[-1]:
                replacement = parts[-1]
        value = value[: match.start()] + replacement + value[match.end() :]
    return value


def clean_wiki(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"<ref\b[^>]*>.*?</ref>|<ref\b[^>]*/>", "", value, flags=re.I | re.S)
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = value.replace("<protagonist>", "Joker")
    value = replace_templates(value)
    value = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", value)
    value = re.sub(r"\[https?://[^\s\]]+\s*([^\]]*)\]", r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("'''", "").replace("''", "")
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def canonical_rank(label: str) -> str:
    upper = label.upper().replace("–", "-").replace("—", "-")
    if "MAX" in upper or re.search(r"\b10\b", upper):
        return "MAX"
    number = re.search(r"\d+(?:\.\d+)?", upper)
    return number.group(0) if number else upper.strip()


def extract_royal_section(wikitext: str) -> str:
    dialogue_match = re.search(r"(?mi)^==\s*Dialogue Options\s*==\s*$", wikitext)
    if not dialogue_match:
        raise ValueError("Dialogue Options section not found")
    dialogue = wikitext[dialogue_match.end() :]
    royal = re.search(
        r"(?mi)^={2,5}\s*''?\s*Persona 5 Royal\s*''?\s*={2,5}\s*$",
        dialogue,
    )
    # Royal-only pages and some Fandom tab layouts do not expose a dedicated
    # Royal heading in raw wikitext. In those cases, parse the entire Dialogue
    # Options section; answer-text matching in app.js selects the correct variant.
    section = dialogue[royal.end() :] if royal else dialogue
    next_major = re.search(r"(?m)^==[^=].*?==\s*$", section)
    return section[: next_major.start()] if next_major else section


def cell_value(line: str) -> str:
    value = line[1:].strip()
    if "|" in value and (
        value.startswith("style=")
        or value.startswith("class=")
        or value.startswith("scope=")
        or value.startswith("align=")
    ):
        value = value.split("|", 1)[1]
    return clean_wiki(value)


def extract_groups(block: str) -> list[dict[str, object]]:
    groups: list[dict[str, object]] = []
    prompt: str | None = None
    answers: list[str] = []
    row_cells: list[str] = []

    def finish_row() -> None:
        nonlocal row_cells, answers
        if prompt and row_cells:
            first = clean_wiki(row_cells[0])
            if first and first.lower() not in {"response", "points (w)", "points (w/o)"}:
                answers.append(first)
        row_cells = []

    def finish_group() -> None:
        nonlocal prompt, answers
        finish_row()
        if prompt and answers:
            groups.append({"prompt": prompt, "answers": answers})
        prompt = None
        answers = []

    prompt_pattern = re.compile(
        r'^\|\s*colspan\s*=\s*"?3"?[^|]*background(?:-color)?\s*:\s*#[0-9a-f]{3,6}[^|]*\|(.*)$',
        re.I,
    )

    for raw_line in block.splitlines():
        line = raw_line.strip()
        prompt_match = prompt_pattern.match(line)
        if prompt_match:
            finish_group()
            prompt = clean_wiki(prompt_match.group(1))
            continue
        if line == "|-":
            finish_row()
            continue
        if line.startswith("|}") or line.startswith("{|") or line.startswith("!"):
            finish_row()
            continue
        if not line.startswith("|") or line.startswith("|colspan=") or line.startswith("|rowspan="):
            continue
        value = cell_value(line)
        if value:
            row_cells.append(value)

    finish_group()
    return groups


def parse_page(wikitext: str) -> list[dict[str, object]]:
    section = extract_royal_section(wikitext)
    rank_matches = list(re.finditer(r"(?m)^;\s*Rank\s+(.+?)\s*$", section))
    records: list[dict[str, object]] = []
    for index, match in enumerate(rank_matches):
        end = rank_matches[index + 1].start() if index + 1 < len(rank_matches) else len(section)
        raw_label = clean_wiki(match.group(1))
        groups = extract_groups(section[match.end() : end])
        if groups:
            records.append(
                {
                    "rank": canonical_rank(raw_label),
                    "sourceLabel": raw_label,
                    "groups": groups,
                }
            )
    return records


def main() -> None:
    data: dict[str, list[dict[str, object]]] = {}
    report: dict[str, object] = {
        "source": "Megami Tensei Wiki / Fandom MediaWiki API",
        "characters": {},
        "errors": {},
    }
    total_groups = 0

    for name, candidates in SOURCES:
        try:
            page, wikitext = fetch_wikitext(candidates)
            records = parse_page(wikitext)
            group_count = sum(len(record["groups"]) for record in records)
            if not group_count:
                raise RuntimeError(f"No dialogue groups extracted from {page}")
            data[name] = records
            report["characters"][name] = {
                "page": page,
                "rankRecords": len(records),
                "dialogueGroups": group_count,
                "status": "ok" if group_count >= 5 else "low-coverage",
            }
            total_groups += group_count
            print(f"{name}: {len(records)} rank records, {group_count} dialogue groups")
        except Exception as exc:
            report["errors"][name] = str(exc)
            print(f"ERROR {name}: {exc}")
        time.sleep(0.35)

    if total_groups == 0:
        raise RuntimeError("No dialogue groups could be extracted")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    module = (
        "// Generated by scripts/sync_dialogue_prompts.py. Do not edit manually.\n"
        "// Dialogue context is stored in this repository and is not fetched by the website.\n"
        "export const dialoguePrompts = "
        + json.dumps(data, ensure_ascii=False, indent=2)
        + ";\n"
    )
    OUTPUT.write_text(module, encoding="utf-8")
    report["totalDialogueGroups"] = total_groups
    report["successfulCharacters"] = len(data)
    report["failedCharacters"] = len(report["errors"])
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT} with {total_groups} dialogue groups across {len(data)} characters")


if __name__ == "__main__":
    main()
