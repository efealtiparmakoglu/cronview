import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, describe, nextRuns, explainLine } from "../src/cron.ts";

test("parse simple fields", () => {
  const r = parse("*/15 * * * *");
  assert.ok(r.ok);
  assert.deepEqual(r.expr!.minute, [0, 15, 30, 45]);
  assert.deepEqual(r.expr!.hour, Array.from({ length: 24 }, (_, i) => i));
});

test("parse month names and dow names", () => {
  const r = parse("0 0 1 jan mon");
  assert.ok(r.ok);
  assert.deepEqual(r.expr!.month, [1]);
  assert.deepEqual(r.expr!.dow, [1]); // mon
});

test("parse rejects out-of-range", () => {
  assert.equal(parse("60 * * * *").ok, false);
  assert.equal(parse("* 25 * * *").ok, false);
  assert.equal(parse("* * 32 * *").ok, false);
  assert.equal(parse("* * * 13 *").ok, false);
  assert.equal(parse("* * * * 8").ok, false);
});

test("parse rejects wrong field count", () => {
  assert.equal(parse("* * * *").ok, false);
  assert.equal(parse("* * * * * *").ok, false);
});

test("dow 7 normalizes to sunday", () => {
  const r = parse("0 0 * * 7");
  assert.deepEqual(r.expr!.dow, [0]);
});

test("describe every minute", () => {
  assert.equal(describe(parse("* * * * *").expr!), "every minute, every day");
});

test("describe weekday mornings", () => {
  assert.equal(describe(parse("0 9 * * 1-5").expr!), "at 09:00, on Monday, Tuesday, Wednesday, Thursday, Friday");
});

test("describe monthly", () => {
  assert.equal(describe(parse("30 2 1 * *").expr!), "at 02:30, on day 1 of the month");
});

test("nextRuns daily produces consecutive days", () => {
  const r = parse("30 2 * * *").expr!;
  const runs = nextRuns(r, 3, new Date("2026-01-01T10:00:00"));
  assert.equal(runs.length, 3);
  assert.equal(runs[0].getDate(), 2); // after 02:30 on Jan 1 → Jan 2
  assert.equal(runs[0].getHours(), 2);
  assert.equal(runs[1].getDate(), 3);
  assert.equal(runs[2].getDate(), 4);
});

test("nextRuns respects month boundary", () => {
  const r = parse("0 0 1 * *").expr!; // 1st of every month at midnight
  const runs = nextRuns(r, 2, new Date("2026-01-15T00:00:00"));
  assert.equal(runs[0].getMonth(), 1); // Feb (index 1)
  assert.equal(runs[0].getDate(), 1);
  assert.equal(runs[1].getMonth(), 2); // Mar
});

test("nextRuns every-5-minutes", () => {
  const r = parse("*/5 * * * *").expr!;
  const runs = nextRuns(r, 3, new Date("2026-01-01T00:02:00"));
  assert.equal(runs[0].getMinutes(), 5);
  assert.equal(runs[1].getMinutes(), 10);
  assert.equal(runs[2].getMinutes(), 15);
});

test("explainLine handles comments and errors", () => {
  assert.deepEqual(explainLine("# comment"), { line: "# comment" });
  assert.ok(explainLine("99 * * * *").error);
  const good = explainLine("0 12 * * 1");
  assert.ok(good.desc!.includes("at 12:00"));
});
