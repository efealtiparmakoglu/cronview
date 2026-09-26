// cronview web demo server — serves public/index.html and a JSON API.

import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { explainLine } from "./cron.ts";

const PORT = Number(process.env.PORT ?? 8787);

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname === "/api/explain") {
    const lines = (url.searchParams.get("lines") ?? "").split("\n");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ results: lines.map(explainLine) }));
    return;
  }
  const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  const full = path.join("public", path.basename(file));
  if (existsSync(full)) {
    const type = full.endsWith(".html") ? "text/html" : "text/plain";
    res.writeHead(200, { "content-type": `${type}; charset=utf-8` });
    res.end(readFileSync(full));
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`cronview demo: http://localhost:${PORT}`);
});
