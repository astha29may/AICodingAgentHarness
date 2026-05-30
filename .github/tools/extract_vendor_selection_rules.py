from __future__ import annotations

import argparse
import json
import re
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable

from openpyxl import load_workbook


IMPORTANT_COLUMN_PATTERNS = (
    r"kg\s*agent\s*response",
    r"generated\s*sql",
    r"reference\s*query",
    r"weight",
    r"score",
    r"rule",
    r"lsp",
    r"vendor",
    r"profile",
)


@dataclass
class SheetSummary:
    name: str
    rows: int
    columns: int
    headers: list[str]
    important_columns: list[str]
    sampled_rows: list[dict[str, str]]


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def looks_important(header: str) -> bool:
    normalized = header.lower()
    return any(re.search(pattern, normalized) for pattern in IMPORTANT_COLUMN_PATTERNS)


def row_to_dict(headers: list[str], row_values: Iterable[object]) -> dict[str, str]:
    result: dict[str, str] = {}
    for header, value in zip(headers, row_values):
        if header:
            result[header] = normalize_text(value)
    return result


def collect_sheet_summary(sheet) -> SheetSummary:
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return SheetSummary(sheet.title, 0, 0, [], [], [])

    header_row_index = 0
    for index, row in enumerate(rows[:10]):
        values = [normalize_text(cell) for cell in row if normalize_text(cell)]
        if len(values) >= 2:
            header_row_index = index
            break

    headers = [normalize_text(cell) for cell in rows[header_row_index]]
    headers = [header or f"column_{index + 1}" for index, header in enumerate(headers)]
    important_columns = [header for header in headers if looks_important(header)]

    sampled_rows: list[dict[str, str]] = []
    for row in rows[header_row_index + 1 : header_row_index + 6]:
        mapped = row_to_dict(headers, row)
        if any(mapped.values()):
            sampled_rows.append(mapped)

    return SheetSummary(
        name=sheet.title,
        rows=max(len(rows) - header_row_index - 1, 0),
        columns=len(headers),
        headers=headers,
        important_columns=important_columns,
        sampled_rows=sampled_rows,
    )


def build_design_facts(workbook_path: Path) -> dict:
    workbook = load_workbook(workbook_path, data_only=False)
    summaries = [collect_sheet_summary(sheet) for sheet in workbook.worksheets]

    header_counts: Counter[str] = Counter()
    important_header_hits: defaultdict[str, list[str]] = defaultdict(list)
    for summary in summaries:
        for header in summary.headers:
            header_counts[header.lower()] += 1
            if looks_important(header):
                important_header_hits[header.lower()].append(summary.name)

    workbook_summary = {
        "workbook": workbook_path.name,
        "sheet_count": len(summaries),
        "sheets": [asdict(summary) for summary in summaries],
        "important_columns_across_sheets": sorted({header for summary in summaries for header in summary.important_columns}),
        "common_headers": [
            header for header, count in header_counts.items() if count > 1 and header
        ],
        "notes": [
            "This workbook reader is designed to surface the columns and row samples that influence architecture decisions.",
            "It intentionally preserves workbook text verbatim so rule wording can be reviewed by business owners.",
        ],
    }
    return workbook_summary


def render_markdown(summary: dict) -> str:
    lines: list[str] = []
    lines.append(f"# Workbook Extraction Summary - {summary['workbook']}")
    lines.append("")
    lines.append(f"- Sheet count: {summary['sheet_count']}")
    lines.append("")
    lines.append("## Design-Relevant Columns")
    important_columns = summary.get("important_columns_across_sheets", [])
    if important_columns:
        for column in important_columns:
            lines.append(f"- {column}")
    else:
        lines.append("- None identified by the current keyword scan.")
    lines.append("")
    lines.append("## Sheet Snapshots")
    for sheet in summary["sheets"]:
        lines.append(f"### {sheet['name']}")
        lines.append(f"- Rows: {sheet['rows']}")
        lines.append(f"- Columns: {sheet['columns']}")
        if sheet["important_columns"]:
            lines.append("- Important columns:")
            for column in sheet["important_columns"]:
                lines.append(f"  - {column}")
        if sheet["sampled_rows"]:
            lines.append("- Sample rows:")
            for sampled_row in sheet["sampled_rows"]:
                compact = "; ".join(f"{key}: {value}" for key, value in sampled_row.items() if value)
                lines.append(f"  - {compact}")
        lines.append("")
    lines.append("## Notes")
    for note in summary.get("notes", []):
        lines.append(f"- {note}")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract design-relevant facts from the vendor selection workbook.")
    parser.add_argument(
        "workbook",
        nargs="?",
        default=Path(".github") / "docs" / "Vendor_EquipmentSelectionAgentRules - MS_v3.xlsx",
        type=Path,
        help="Path to the workbook to read.",
    )
    parser.add_argument(
        "--json-out",
        type=Path,
        default=Path(".github") / "docs" / "Vendor_EquipmentSelectionAgentRules.summary.json",
        help="Path for the JSON summary output.",
    )
    parser.add_argument(
        "--markdown-out",
        type=Path,
        default=Path(".github") / "docs" / "Vendor_EquipmentSelectionAgentRules.summary.md",
        help="Path for the Markdown summary output.",
    )
    args = parser.parse_args()

    workbook_path = args.workbook
    if not workbook_path.exists():
        raise FileNotFoundError(f"Workbook not found: {workbook_path}")

    summary = build_design_facts(workbook_path)
    args.json_out.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    args.markdown_out.write_text(render_markdown(summary), encoding="utf-8")

    print(f"Wrote {args.json_out}")
    print(f"Wrote {args.markdown_out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())