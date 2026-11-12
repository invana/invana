/**
 * Serve the built spec site (`scripts/specs/site/build/`) for the end-to-end specs — a static file server in plain
 * Node, so it runs the same on every OS. Build the app and the site first (see the site's README).
 *
 *     node e2e/serve.mjs [port]
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../build");
const PORT = Number(process.argv[2] ?? 8792);
const TYPES = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".json": "application/json",
	".svg": "image/svg+xml",
	".png": "image/png",
	".woff2": "font/woff2",
};

createServer((req, res) => {
	const url = new URL(req.url ?? "/", "http://localhost");
	let file = normalize(join(ROOT, decodeURIComponent(url.pathname)));
	if (!file.startsWith(ROOT)) {
		res.writeHead(403).end();
		return;
	}
	if (existsSync(file) && statSync(file).isDirectory())
		file = join(file, "index.html");
	if (!existsSync(file)) {
		res.writeHead(404).end("not found");
		return;
	}
	res.writeHead(200, {
		"Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
	});
	createReadStream(file).pipe(res);
}).listen(PORT, "127.0.0.1");
