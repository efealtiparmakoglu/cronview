// Cron expression parsing, validation, human description and next-run
// calculation. Zero dependencies; Node's built-in timezone handling.

export interface CronExpr {
  minute: number[]; // 0-59, -1 = *
  hour: number[];
  dom: number[]; // day of month 1-31
  month: number[];
  dow: number[]; // 0-6 (0=Sunday), 7 normalized to 0
}

export interface ParseResult {
  ok: boolean;
  expr?: CronExpr;
  error?: string;
}

const DOM_LIMIT = 31;
const DOW_LIMIT = 6;

function parseField(
  field: string,
  min: number,
  max: number,
  names?: Map<string, number>,
): number[] {
  const out = new Set<number>();
  for (const part of field.split(",")) {
    const [rangePart, stepRaw] = part.split("/");
    const step = stepRaw ? parseInt(stepRaw, 10) : 1;
    if (!Number.isFinite(step) || step < 1) throw new Error(`bad step in "${part}"`);
    let lo: number, hi: number;
    if (rangePart === "*") {
      lo = min;
      hi = max;
    } else if (rangePart.includes("-")) {
      const [a, b] = rangePart.split("-");
      lo = names ? (names.get(a.toLowerCase()) ?? parseInt(a, 10)) : parseInt(a, 10);
      hi = names ? (names.get(b.toLowerCase()) ?? parseInt(b, 10)) : parseInt(b, 10);
    } else {
      lo = names ? (names.get(rangePart.toLowerCase()) ?? parseInt(rangePart, 10)) : parseInt(rangePart, 10);
      hi = lo;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new Error(`bad value in "${part}"`);
    if (lo < min || hi > max || lo > hi) {
      throw new Error(`range ${lo}-${hi} outside ${min}-${max}`);
    }
    for (let v = lo; v <= hi; v += step) {
      out.add(v);
    }
  }
  const list = [...out].sort((a, b) => a - b);
  return list;
}

const MONTH_NAMES = new Map(
  ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].map(
    (m, i) => [m, i + 1],
  ),
);
const DOW_NAMES = new Map(
  ["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d, i) => [d, i]),
);

export function parse(expr: string): ParseResult {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    return { ok: false, error: `need 5 fields, got ${fields.length}` };
  }
  try {
    const minute = parseField(fields[0], 0, 59);
    const hour = parseField(fields[1], 0, 23);
    const dom = parseField(fields[2], 1, DOM_LIMIT);
    const month = parseField(fields[3], 1, 12, MONTH_NAMES);
    const dowRaw = parseField(fields[4], 0, 7, DOW_NAMES);
    // normalize 7 -> 0 (Sunday) and dedupe; "*" yields exactly 7 entries
    const dow = [...new Set(dowRaw.map((d) => (d === 7 ? 0 : d)))].sort((a, b) => a - b);
    return {
      ok: true,
      expr: {
        minute,
        hour,
        dom,
        month,
        dow,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function joinOr(list: number[], label: (n: number) => string): string {
  if (list.length > 1) return list.map(label).join(", ");
  return label(list[0]);
}

function humanTime(minutes: number[], hours: number[]): string {
  if (minutes.length === 60 && hours.length === 24) return "every minute";
  const times = hours.flatMap((h) => minutes.map((m) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`));
  if (times.length <= 6) return `at ${times.join(", ")}`;
  return `at ${times.slice(0, 6).join(", ")} … (${times.length} times/day)`;
}

function humanDayPart(expr: CronExpr): string {
  const domAll = expr.dom.length === DOM_LIMIT;
  const dowAll = expr.dow.length === 7;
  const monthAll = expr.month.length === 12;
  if (domAll && dowAll && monthAll) return "every day";
  const parts: string[] = [];
  if (!monthAll) {
    parts.push(`in ${joinOr([...expr.month].sort((a, b) => a - b), (m) => MONTHS[m - 1])}`);
  }
  if (domAll && dowAll) {
    // nothing
  } else if (domAll) {
    parts.push(`on ${joinOr(expr.dow, (d) => WEEKDAYS[d])}`);
  } else if (dowAll) {
    parts.push(`on day ${joinOr(expr.dom, String)} of the month`);
  } else {
    parts.push(`on day ${joinOr(expr.dom, String)} or ${joinOr(expr.dow, (d) => WEEKDAYS[d])}`);
  }
  return parts.join(" ");
}

export function describe(expr: CronExpr): string {
  return `${humanTime(expr.minute, expr.hour)}, ${humanDayPart(expr)}`;
}

function matchesDay(d: Date, expr: CronExpr): boolean {
  const monthOk = expr.month.includes(d.getMonth() + 1);
  const domOk = expr.dom.includes(d.getDate());
  const dowOk = expr.dow.includes(d.getDay());
  // standard cron semantics: if both DOM and DOW are restricted, either may match
  const domRestricted = expr.dom.length !== DOM_LIMIT;
  const dowRestricted = expr.dow.length !== 7;
  if (domRestricted && dowRestricted) return monthOk && (domOk || dowOk);
  return monthOk && domOk && dowOk;
}

export function nextRuns(expr: CronExpr, count: number, from = new Date()): Date[] {
  const out: Date[] = [];
  // round up to the next minute
  const d = new Date(from.getTime());
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  let guard = 0;
  while (out.length < count && guard < 5_000_000) {
    guard++;
    if (!expr.month.includes(d.getMonth() + 1)) {
      d.setMonth(d.getMonth() + 1, 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!matchesDay(d, expr)) {
      d.setDate(d.getDate() + 1);
      d.setHours(0, 0, 0, 0);
      continue;
    }
    if (!expr.hour.includes(d.getHours())) {
      // jump to the next valid hour today
      const nextHour = expr.hour.find((h) => h > d.getHours());
      if (nextHour === undefined) {
        d.setDate(d.getDate() + 1);
        d.setHours(0, 0, 0, 0);
      } else {
        d.setHours(nextHour);
        d.setMinutes(expr.minute[0]);
      }
      continue;
    }
    if (!expr.minute.includes(d.getMinutes())) {
      const nextMin = expr.minute.find((m) => m > d.getMinutes());
      if (nextMin === undefined) {
        d.setHours(d.getHours() + 1);
        d.setMinutes(0);
      } else {
        d.setMinutes(nextMin);
      }
      continue;
    }
    out.push(new Date(d.getTime()));
    d.setMinutes(d.getMinutes() + 1);
  }
  return out;
}

export function explainLine(line: string): { line: string; desc?: string; next?: string[]; error?: string } {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return { line: trimmed };
  const parsed = parse(trimmed);
  if (!parsed.ok || !parsed.expr) {
    return { line: trimmed, error: parsed.error };
  }
  const next = nextRuns(parsed.expr, 5).map((d) => d.toString());
  return { line: trimmed, desc: describe(parsed.expr), next };
}
