import { createServer } from "node:http";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
loadEnv(join(root, ".env"));
const port = Number.parseInt(process.env.PORT ?? "8000", 10) || 8000;
const mimeTypes = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".mjs", "text/javascript; charset=utf-8"], [".css", "text/css; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"], [".svg", "image/svg+xml"], [".webp", "image/webp"], [".ico", "image/x-icon"], [".mp3", "audio/mpeg"], [".woff2", "font/woff2"]]);

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1] in process.env) continue;
    let value = match[2] ?? "";
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, "");
    process.env[match[1]] = value;
  }
}

const server = createServer(async (request, response) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname); }
  catch { response.writeHead(400).end("Bad request"); return; }
  if (pathname.startsWith("/api/")) {
    if (request.method !== "GET") { response.writeHead(405, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Method not allowed" })); return; }
    const name = pathname.slice("/api/".length);
    if (!/^[a-z0-9-]+$/.test(name)) { response.writeHead(404).end("Not found"); return; }
    try {
      const moduleUrl = pathToFileURL(join(root, "api", `${name}.js`));
      const { default: handler } = await import(moduleUrl.href);
      const parsed = new URL(request.url ?? "/", "http://localhost");
      const query = Object.fromEntries(parsed.searchParams.entries());
      const req = { method: request.method, url: request.url, headers: request.headers, query };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        setHeader(key, value) { response.setHeader(key, value); return this; },
        json(body) { response.statusCode = this.statusCode; response.setHeader("Content-Type", "application/json; charset=utf-8"); response.end(JSON.stringify(body)); return this; },
      };
      await handler(req, res);
    } catch { if (!response.headersSent) response.writeHead(500, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Server error" })); }
    return;
  }

  let relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const top = relative.split(/[\\/]/)[0] ?? "";
  // Only the public folders are served; anything else falls back to the SPA entry point.
  const isPublic = relative === "index.html" || ["dist", "styles", "assets"].includes(top);
  if (!isPublic || relative.split(/[\\/]/).some((part) => part.startsWith("."))) relative = "";
  const candidate = resolve(root, relative || "index.html");
  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) { response.writeHead(403).end("Forbidden"); return; }
  const file = existsSync(candidate) && statSync(candidate).isFile() ? candidate : join(root, "index.html");
  response.setHeader("Content-Type", mimeTypes.get(extname(file).toLowerCase()) ?? "application/octet-stream");
  createReadStream(file).on("error", () => { if (!response.headersSent) response.writeHead(404); response.end("Not found"); }).pipe(response);
});

server.listen(port, () => process.stdout.write(`Tony Luk Music dev server: http://localhost:${port}\n`));
