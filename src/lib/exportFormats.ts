// Pure builders for the files you can download (no network), so they are easy to test.

export type Row = Record<string, unknown>;

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV with a BOM so Excel shows Arabic correctly. */
export function toCsv(rows: Row[], columns: { key: string; label: string }[]): string {
  const lines = [columns.map((c) => cell(c.label)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => cell(r[c.key])).join(","));
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Lines longer than 75 characters must be folded (RFC 5545).
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

const compact = (isoDate: string) => isoDate.replace(/-/g, "");
function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type IcsDeadline = { id: string; title: string; kind: string; due_date: string; course: string };

/** All-day events with a reminder the day before. */
export function buildIcs(deadlines: IcsDeadline[], now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ritual//Deadlines//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Ritual deadlines"];
  for (const d of deadlines) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(d.due_date)) continue;
    const day = d.due_date.slice(0, 10);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${d.id}@ritual`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(day)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(day))}`,
      `SUMMARY:${icsEscape(`${d.course}: ${d.title}`)}`,
      `DESCRIPTION:${icsEscape(`${d.kind} for ${d.course}`)}`,
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(`${d.title} is due tomorrow`)}`,
      "TRIGGER:-P1D",
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function buildBackupJson(tables: Record<string, Row[]>, errors: Record<string, string>, now = new Date()): string {
  return JSON.stringify({ app: "Ritual", exportedAt: now.toISOString(), version: 1, tables, errors }, null, 2);
}
