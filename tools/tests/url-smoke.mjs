// End-to-end check of /import-url against the real network.
//
// Unlike host-smoke.mjs this one needs outbound HTTPS: it downloads a published
// logo from a CDN, so it is kept out of `npm test` and run by hand.
//
//     node tools/tests/url-smoke.mjs
//
// By default the plugin source in this checkout is exercised. To check an
// installed copy instead, point RECHARGE_TARGET at it:
//
//     $env:RECHARGE_TARGET = 'file:///D:/path/to/node_modules/dsh-recharge-animation/lib/index.js'

import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]+$/, '')
const target = process.env.RECHARGE_TARGET || pathToFileURL(ROOT + '/lib/index.js').href
const { apply } = await import(target)

const home = mkdtempSync(join(tmpdir(), 'recharge-url-'))
process.env.DSH_HOME = home

const routes = new Map()
const ctx = {
	webServer: {
		register({ path, handler }) {
			routes.set(path, handler)
			return () => routes.delete(path)
		}
	}
}
const dispose = apply(ctx, { enabled: true })

const server = createServer(async (req, res) => {
	const path = String(req.url || '').split('?')[0]
	const handler = routes.get(path)
	if (!handler) {
		res.statusCode = 404
		res.end('no route')
		return
	}
	try {
		await handler(req, res)
	} catch (error) {
		res.statusCode = 500
		res.end(String((error && error.message) || error))
	}
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`

const post = (body) => fetch(base + '/recharge-animation/import-url', {
	method: 'POST',
	headers: { 'content-type': 'application/json' },
	body: JSON.stringify(body)
}).then(async (res) => ({ status: res.status, body: await res.json() }))

const out = {}
out.target = target
// raw.githubusercontent.com is blocked on some networks (curl: Connection was
// reset / node: Connect Timeout), so a reachable CDN proves the download path
// itself. unpkg serves the published 0.1.0 asset.
const RAW = 'https://unpkg.com/dsh-recharge-animation@0.1.0'

const good = await post({ kind: 'icon', url: RAW + '/assets/logo-384.png' })
out.pngStatus = good.status
out.pngOk = good.body.ok
const icon = good.body.config && good.body.config.assets.icons[0]
out.pngId = icon && icon.id
out.pngBytes = icon && icon.bytes
out.pngName = icon && icon.name

if (icon) {
	const read = await fetch(base + `/recharge-animation/assets?kind=icon&id=${icon.id}`)
	const buf = Buffer.from(await read.arrayBuffer())
	out.readStatus = read.status
	out.readType = read.headers.get('content-type')
	out.readBytes = buf.length
	out.readMagic = buf.slice(0, 8).toString('hex')
}

const html = await post({ kind: 'icon', url: RAW + '/README.md' })
out.htmlStatus = html.status
out.htmlError = String(html.body.error || '').slice(0, 100)

const file = await post({ kind: 'icon', url: 'file:///C:/Windows/win.ini' })
out.fileStatus = file.status
out.fileError = String(file.body.error || '').slice(0, 100)

// A host that cannot be reached must come back as advice, not as the bare
// "fetch failed" the panel used to show. Port 1 is rejected by undici itself
// ("bad port") before a socket is ever opened, so use a high port that really
// gets refused.
const refused = await post({ kind: 'icon', url: 'http://127.0.0.1:65500/none.png' })
out.refusedStatus = refused.status
out.refusedError = String(refused.body.error || '').slice(0, 140)
out.refusedAdvice = /不可达|不可用/.test(out.refusedError)

const missing = await post({ kind: 'icon', url: RAW + '/assets/nope.png' })
out.missingStatus = missing.status
out.missingError = String(missing.body.error || '').slice(0, 100)

const empty = await post({ kind: 'icon', url: '   ' })
out.emptyStatus = empty.status
out.emptyError = String(empty.body.error || '').slice(0, 60)

console.log(JSON.stringify(out, null, 1))

server.close()
dispose()
rmSync(home, { recursive: true, force: true })
