#!/usr/bin/env python3
"""Build repository-local Persona 5 / Royal TV Quiz data.

The source page is used only by the repository data workflow. The deployed site
imports the generated ES module and never fetches Fandom at runtime.
"""

from __future__ import annotations

import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "quiz.js"
REPORT = ROOT / "data" / "quiz-report.json"
API = "https://megamitensei.fandom.com/api.php"
USER_AGENT = "Persona-5-Wiki TV quiz sync/1.0 (GitHub Pages data build)"


def fetch_wikitext() -> str:
    params = urllib.parse.urlencode(
        {
            "action": "parse",
            "page": "Quiz",
            "prop": "wikitext",
            "format": "json",
            "formatversion": 2,
            "origin": "*",
        }
    )
    request = urllib.request.Request(
        f"{API}?{params}", headers={"User-Agent": USER_AGENT}
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = json.load(response)
    if "error" in payload:
        raise RuntimeError(str(payload["error"]))
    return payload["parse"]["wikitext"]


def replace_templates(value: str) -> str:
    pattern = re.compile(r"\{\{([^{}]*)\}\}")
    for _ in range(12):
        match = pattern.search(value)
        if not match:
            break
        parts = [part.strip() for part in match.group(1).split("|")]
        replacement = parts[1] if len(parts) > 1 else ""
        value = value[: match.start()] + replacement + value[match.end() :]
    return value


def clean_wiki(value: str) -> str:
    value = html.unescape(value)
    value = re.sub(r"<ref\b[^>]*>.*?</ref>|<ref\b[^>]*/>", "", value, flags=re.I | re.S)
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = replace_templates(value)
    value = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", value)
    value = re.sub(r"\[https?://[^\s\]]+\s*([^\]]*)\]", r"\1", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = value.replace("'''", "").replace("''", "")
    value = re.sub(r"<!--.*?-->", "", value, flags=re.S)
    return re.sub(r"\s+", " ", value).strip()


def cell_value(line: str) -> str:
    value = line[1:].strip()
    if "|" in value and re.match(r"^(?:style|class|scope|align|rowspan|colspan)=", value, re.I):
        value = value.split("|", 1)[1]
    return clean_wiki(value)


def extract_profile_section(wikitext: str) -> str:
    profile = re.search(r"(?mi)^==\s*Profile\s*==\s*$", wikitext)
    if not profile:
        raise ValueError("Profile section not found")
    section = wikitext[profile.end() :]
    p5 = re.search(r"(?mi)^===\s*Persona 5\s*/\s*Royal\s*===\s*$", section)
    if not p5:
        raise ValueError("Persona 5 / Royal subsection not found")
    section = section[p5.end() :]
    next_heading = re.search(r"(?m)^={2,3}[^=].*?={2,3}\s*$", section)
    return section[: next_heading.start()] if next_heading else section


def first_table(section: str) -> str:
    start = section.find("{|")
    if start < 0:
        raise ValueError("Quiz table not found")
    depth = 0
    for match in re.finditer(r"\{\||\|\}", section[start:]):
        token = match.group(0)
        depth += 1 if token == "{|" else -1
        if depth == 0:
            return section[start : start + match.end()]
    raise ValueError("Quiz table is not balanced")


def parse_rows(table: str) -> list[list[str]]:
    rows: list[list[str]] = []
    current: list[str] = []

    def finish() -> None:
        nonlocal current
        cleaned = [cell for cell in current if cell]
        if cleaned:
            rows.append(cleaned)
        current = []

    for raw in table.splitlines():
        line = raw.strip()
        if line == "|-" or line.startswith("|- "):
            finish()
            continue
        if not line.startswith("|") or line.startswith("|}"):
            continue
        if line.startswith("||"):
            current.extend(clean_wiki(part) for part in line[2:].split("||"))
            continue
        current.append(cell_value(line))
    finish()
    return rows


def build_entries(rows: list[list[str]]) -> list[dict[str, object]]:
    entries: list[dict[str, object]] = []
    for cells in rows:
        if not cells or cells[0].lower() == "date":
            continue
        date = cells[0]
        if len(cells) >= 5:
            question, answer_a, answer_b, correct = cells[1:5]
            correct = correct.strip().upper()[:1]
            if correct not in {"A", "B"}:
                raise ValueError(f"Unexpected correct-answer marker for {date}: {correct!r}")
            entries.append(
                {
                    "date": date,
                    "question": question,
                    "options": [answer_a, answer_b],
                    "correct": correct,
                    "correctAnswer": answer_a if correct == "A" else answer_b,
                    "event": False,
                }
            )
        elif len(cells) >= 2 and "event day" in cells[1].lower():
            entries.append(
                {
                    "date": date,
                    "question": "Event Day",
                    "options": [],
                    "correct": "",
                    "correctAnswer": "",
                    "event": True,
                }
            )
    return entries


def main() -> None:
    wikitext = fetch_wikitext()
    section = extract_profile_section(wikitext)
    table = first_table(section)
    rows = parse_rows(table)
    entries = build_entries(rows)
    quiz_count = sum(not entry["event"] for entry in entries)
    event_count = sum(bool(entry["event"]) for entry in entries)
    if quiz_count < 11:
        raise RuntimeError(f"Expected at least 11 quiz questions, extracted {quiz_count}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(
        "// Generated by scripts/sync_tv_quiz.py. Do not edit manually.\n"
        "// The deployed website reads this repository-local data only.\n"
        "export const tvQuiz = "
        + json.dumps(entries, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    REPORT.write_text(
        json.dumps(
            {
                "source": "Megami Tensei Wiki / Quiz",
                "totalRows": len(entries),
                "quizQuestions": quiz_count,
                "eventDays": event_count,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {quiz_count} quiz questions and {event_count} event days")


if __name__ == "__main__":
    main()
