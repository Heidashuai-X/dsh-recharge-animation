// Screenshot one URL through a headless Edge that is already listening on CDP.
// Node 24 has global fetch and WebSocket, so this needs no dependencies.
//
//   node tools/tests/shot.mjs <url> <out.png> [waitMs] [probeJs]
//
// The browser is expected to be started separately, for example:
//
//   msedge --headless=new --remote-debugging-port=9222 \
//          --user-data-dir=<profile> --no-first-run about:blank
//
// This is the regression tool behind the panel screenshots handed over with a
// release; it is not part of `npm test` because it needs that browser.

import { writeFileSync } from "node:fs";

const [, , url, out, waitArg, probe] = process.argv;
if (!url || !out) {
	console.error("usage: node tools/tests/shot.mjs <url> <out.png> [waitMs] [probeJs]");
	process.exit(2);
}
const waitMs = Number(waitArg || 4000);
const base = "http://127.0.0.1:9222";

const list = await (await fetch(base + "/json/list")).json();
const page = list.find((t) => t.type === "page");
if (!page) {
	console.error("no page target");
	process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

ws.addEventListener("message", (event) => {
	const msg = JSON.parse(event.data);
	if (msg.id && pending.has(msg.id)) {
		pending.get(msg.id)(msg);
		pending.delete(msg.id);
	}
});

const send = (method, params) =>
	new Promise((resolve, reject) => {
		const id = nextId++;
		pending.set(id, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
		ws.send(JSON.stringify({ id, method, params: params || {} }));
	});

await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));

await send("Page.enable");
await send("Runtime.enable");
await send("Page.navigate", { url });
await new Promise((resolve) => setTimeout(resolve, waitMs));

if (probe) {
	const result = await send("Runtime.evaluate", { expression: probe, returnByValue: true, awaitPromise: true });
	console.log("probe:", JSON.stringify(result.result && result.result.value));
}

const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync(out, Buffer.from(shot.data, "base64"));
console.log("wrote", out, Buffer.from(shot.data, "base64").length, "bytes");
ws.close();
process.exit(0);
