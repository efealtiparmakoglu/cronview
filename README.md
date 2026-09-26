# cronview

**Crontab lines to human language with next-run calculation, validation and a tiny web demo — TypeScript, Node's native type stripping, zero dependencies.**

[![CI](https://github.com/efealtiparmakoglu/cronview/actions/workflows/ci.yml/badge.svg)](https://github.com/efealtiparmakoglu/cronview/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.18-green.svg)](https://nodejs.org)

```
$ curl 'localhost:8787/api/explain?lines=0 9 * * 1-5'
{"results":[{"line":"0 9 * * 1-5",
  "desc":"at 09:00, on Monday, Tuesday, Wednesday, Thursday, Friday",
  "next":["Mon Jan 05 2026 09:00:00 ...", ...]}]}
```

Paste a crontab, get plain-language descriptions and the next five
runs per line. A stdlib-only HTTP server serves the demo page and the
JSON API.

## Why cronview

- **Full field grammar.** `*`, lists, ranges (`1-5`), steps (`*/15`,
  `1-30/5`), month/day names (`jan`, `mon`), and the 7 = Sunday
  normalization with deduplication.
- **Next-run engine.** Minute-exact scan with fast skips (month → day →
  hour → minute), bounded iterations.
- **Human descriptions.** "every minute", "at 09:00, on Monday,
  Tuesday, Wednesday, Thursday, Friday", "on day 1 of the month" —
  with truncation for absurd lists.
- **Validation with precise errors.** "range 60-70 outside 0-59",
  "need 5 fields, got 6".
- **Zero dependencies.** Native TypeScript stripping (no tsc), `node:http`.

## Usage

```sh
npm start                       # demo server on :8787
node --test test/               # test suite
```

Library API: `parse(expr)`, `describe(expr)`, `nextRuns(expr, count)`,
`explainLine(line)`.

## Known limitations

- No @-macros (`@daily`, `@reboot`) or seconds field (vixie cron
  extension).
- Next-run calculation ignores timezone changes inside the window and
  DST gaps (times are local-wallclock).

## Development

```sh
node --test test/
```

12 tests cover field parsing (ranges/steps/names/rejects), Sunday
normalization, human descriptions for classic schedules, next-run
sequences across day/month boundaries and the explain API mapping.
