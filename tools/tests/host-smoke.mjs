// Host-half smoke test for dsh-recharge-animation.
//
// The plugin's real routes run behind a real HTTP server against a throwaway
// DSH_HOME, so these checks drive the Host half the way the Host itself does.
// No dependencies beyond Node: fetch, http and assert are enough.
//
//     node tools/tests/host-smoke.mjs
//
// The first failed assertion rejects the top-level await, so the process exits
// non-zero with the message on stderr.

import { createServer } from 'node:http'
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

// The plugin root sits two levels above this file, so the checkout may live
// anywhere the runner likes.
const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/[\\/]+$/, '')
const ENTRY = pathToFileURL(ROOT + '/lib/index.js').href
const home = mkdtempSync(join(tmpdir(), 'dra-home-'))
process.env.DSH_HOME = home

const mod = await import(ENTRY)
assert.equal(typeof mod.apply, 'function')
assert.deepEqual(mod.inject, ['webServer'])
assert.ok(mod.Config, 'Config schema expected')

const routes = new Map()
const ctx = {
	webServer: {
		register(route) {
			routes.set(route.path, route.handler)
			return () => routes.delete(route.path)
		},
	},
}
const dispose = mod.apply(ctx, { enabled: true })
assert.equal(routes.size, 3, 'three routes expected: ' + [...routes.keys()].join(', '))

const server = createServer((req, res) => {
	const url = new URL(req.url, 'http://localhost')
	const handler = routes.get(url.pathname)
	if (!handler) {
		res.writeHead(404)
		res.end('no route')
		return
	}
	handler(req, res)
})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const base = 'http://127.0.0.1:' + server.address().port

// A second server serves fixtures for the URL importer.
const png = readFileSync(ROOT + '/assets/logo-384.png')
const fixtures = createServer((req, res) => {
	if (req.url === '/logo.png') {
		res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': png.length })
		res.end(png)
		return
	}
	if (req.url === '/page.html') {
		const body = Buffer.from('<html><body>not an image</body></html>', 'utf8')
		res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': body.length })
		res.end(body)
		return
	}
	if (req.url === '/hop') {
		res.writeHead(302, { Location: '/logo.png' })
		res.end()
		return
	}
	res.writeHead(404)
	res.end('nope')
})
await new Promise((resolve) => fixtures.listen(0, '127.0.0.1', resolve))
const fixturesBase = 'http://127.0.0.1:' + fixtures.address().port

const steps = []
const step = async (name, work) => {
	await work()
	steps.push('  ok  ' + name)
}
const getConfig = async () => {
	const response = await fetch(base + '/recharge-animation/config')
	assert.equal(response.status, 200)
	return response.json()
}
const putConfig = async (config) => {
	const response = await fetch(base + '/recharge-animation/config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ config }),
	})
	return { status: response.status, body: await response.json() }
}

let wav = Buffer.alloc(64)
wav.write('RIFF', 0, 'latin1')
wav.writeUInt32LE(56, 4)
wav.write('WAVEfmt ', 8, 'latin1')

await step('GET config returns defaults', async () => {
	const payload = await getConfig()
	assert.equal(payload.ok, true)
	assert.equal(payload.enabled, true)
	assert.equal(payload.config.labels.button, '充值')
	assert.equal(payload.config.behavior.duration, 1800)
	assert.equal(payload.config.behavior.openTopUp, true)
	assert.equal(payload.config.presets.length, 1)
	assert.equal(payload.config.activePresetId, 'p-default')
	assert.equal(payload.limits.icon, 4 * 1024 * 1024)
	assert.deepEqual(payload.config.assets, { icons: [], audio: [] })
})

let iconId = null
await step('POST /assets stores a real PNG and publishes a url', async () => {
	const response = await fetch(base + '/recharge-animation/assets?kind=icon&name=' + encodeURIComponent('logo.png'), {
		method: 'POST',
		headers: { 'Content-Type': 'image/png' },
		body: png,
	})
	assert.equal(response.status, 200)
	const payload = await response.json()
	assert.equal(payload.ok, true)
	assert.equal(payload.config.assets.icons.length, 1)
	const entry = payload.config.assets.icons[0]
	assert.equal(entry.bytes, png.length)
	assert.equal(entry.name, 'logo.png')
	assert.equal(entry.file.endsWith('.png'), true)
	iconId = entry.id
	assert.equal(entry.url, '/recharge-animation/assets?kind=icon&id=' + iconId)
})

await step('GET /assets serves the exact bytes back', async () => {
	const response = await fetch(base + '/recharge-animation/assets?kind=icon&id=' + iconId)
	assert.equal(response.status, 200)
	assert.equal(response.headers.get('content-type'), 'image/png')
	const back = Buffer.from(await response.arrayBuffer())
	assert.equal(back.length, png.length)
	assert.equal(back.equals(png), true)
})

await step('GET /assets rejects an unknown id', async () => {
	const response = await fetch(base + '/recharge-animation/assets?kind=icon&id=i-nope')
	assert.equal(response.status, 404)
})

await step('POST /assets rejects a text file as an image', async () => {
	const response = await fetch(base + '/recharge-animation/assets?kind=icon&name=notes.txt', {
		method: 'POST',
		headers: { 'Content-Type': 'text/plain' },
		body: Buffer.from('this is definitely not an image at all', 'utf8'),
	})
	assert.equal(response.status, 400)
	const payload = await response.json()
	assert.match(payload.error, /不是可用的图片/)
})

await step('POST /assets enforces the size ceiling', async () => {
	const huge = Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)])
	const response = await fetch(base + '/recharge-animation/assets?kind=icon&name=huge.png', {
		method: 'POST',
		headers: { 'Content-Type': 'image/png' },
		body: huge,
	})
	assert.equal(response.status, 413)
})

let audioId = null
await step('POST /assets stores a WAV', async () => {
	const response = await fetch(base + '/recharge-animation/assets?kind=audio&name=click.wav', {
		method: 'POST',
		headers: { 'Content-Type': 'audio/wav' },
		body: wav,
	})
	assert.equal(response.status, 200)
	const payload = await response.json()
	assert.equal(payload.config.assets.audio.length, 1)
	audioId = payload.config.assets.audio[0].id
	assert.equal(payload.config.assets.audio[0].file.endsWith('.wav'), true)
})

await step('PUT config clamps numbers and keeps the asset index', async () => {
	const current = (await getConfig()).config
	const next = JSON.parse(JSON.stringify(current))
	next.labels = { button: '  充值中心  ', skipHint: '点我跳过' }
	next.behavior.duration = 999999
	next.behavior.minDuration = -5
	next.behavior.platformTop = 999
	next.behavior.progressMode = 'nonsense'
	next.muted = true
	next.presets[0].iconId = iconId
	next.presets[0].slots.intro = audioId
	next.presets[0].volumes.bgm = 250
	const result = await putConfig(next)
	assert.equal(result.status, 200)
	const saved = result.body.config
	assert.equal(saved.labels.button, '充值中心')
	assert.equal(saved.labels.skipHint, '点我跳过')
	assert.equal(saved.behavior.duration, 8000)
	assert.equal(saved.behavior.minDuration, 0)
	assert.equal(saved.behavior.platformTop, 320)
	assert.equal(saved.behavior.progressMode, 'real')
	assert.equal(saved.muted, true)
	assert.equal(saved.presets[0].iconId, iconId)
	assert.equal(saved.presets[0].slots.intro, audioId)
	assert.equal(saved.presets[0].volumes.bgm, 100)
	assert.equal(saved.assets.icons.length, 1, 'asset index must survive a config save')
	assert.equal(saved.assets.audio.length, 1)
})

await step('PUT config cannot add asset entries that do not exist', async () => {
	const current = (await getConfig()).config
	const next = JSON.parse(JSON.stringify(current))
	next.assets.icons.push({ id: 'i-fake', file: 'i-fake.png', bytes: 10 })
	next.presets[0].iconId = 'i-fake'
	const result = await putConfig(next)
	const saved = result.body.config
	assert.equal(saved.assets.icons.length, 1, 'the on-disk index is authoritative')
	assert.equal(saved.presets[0].iconId, null, 'a dangling preset reference is cleared, not resurrected')
	// The panel would now re-pick a real icon; put the good reference back so the
	// later persistence check still proves a valid reference survives a reload.
	const restore = JSON.parse(JSON.stringify(saved))
	restore.presets[0].iconId = iconId
	const again = await putConfig(restore)
	assert.equal(again.body.config.presets[0].iconId, iconId)
})

await step('PUT config blames the caller for a body that is not JSON', async () => {
	const response = await fetch(base + '/recharge-animation/config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: '{ "config": oops }',
	})
	assert.equal(response.status, 400, 'a bad body is a caller error, not a 500')
	const payload = await response.json()
	assert.equal(payload.ok, false)
	// The panel prints this text verbatim, so it has to be readable.
	assert.match(payload.error, /JSON/)
	assert.doesNotMatch(payload.error, /Unexpected token|position \d+/)
})

await step('PUT config rejects a body past the ceiling with a readable reason', async () => {
	const response = await fetch(base + '/recharge-animation/config', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ config: { pad: 'x'.repeat(300 * 1024) } }),
	})
	assert.equal(response.status, 400)
	const payload = await response.json()
	assert.match(payload.error, /超过上限/)
})

await step('two concurrent saves both land and leave no temp file behind', async () => {
	const current = (await getConfig()).config
	const withDuration = (duration) => {
		const next = JSON.parse(JSON.stringify(current))
		next.behavior.duration = duration
		return next
	}
	const [first, second] = await Promise.all([putConfig(withDuration(2222)), putConfig(withDuration(3333))])
	assert.equal(first.status, 200)
	assert.equal(second.status, 200)
	const settled = (await getConfig()).config.behavior.duration
	assert.ok(settled === 2222 || settled === 3333, 'the last writer wins, got ' + settled)
	// writeJsonAtomic renames its temp file into place; a fixed temp name would let
	// one save steal the other's file, so nothing may be left over.
	const leftovers = []
	const walk = (dir) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name)
			if (entry.isDirectory()) walk(full)
			else if (entry.name.endsWith('.tmp')) leftovers.push(full)
		}
	}
	walk(home)
	assert.deepEqual(leftovers, [], 'temp files must be renamed into place, not abandoned')
})

await step('POST /import-url pulls a PNG through a redirect', async () => {
	const response = await fetch(base + '/recharge-animation/import-url', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind: 'icon', url: fixturesBase + '/hop' }),
	})
	assert.equal(response.status, 200)
	const payload = await response.json()
	assert.equal(payload.config.assets.icons.length, 2)
	assert.equal(payload.config.assets.icons[1].bytes, png.length)
})

await step('POST /import-url reports a web page instead of a picture', async () => {
	const response = await fetch(base + '/recharge-animation/import-url', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind: 'icon', url: fixturesBase + '/page.html' }),
	})
	assert.equal(response.status, 400)
	const payload = await response.json()
	assert.match(payload.error, /不是可用的图片/)
	assert.match(payload.error, /text\/html/)
})

await step('POST /import-url refuses non-http schemes and bad hosts', async () => {
	const bad = await fetch(base + '/recharge-animation/import-url', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ kind: 'icon', url: 'file:///C:/windows/win.ini' }),
	})
	assert.equal(bad.status, 400)
	assert.match((await bad.json()).error, /http/)

	const dead = await fetch(base + '/recharge-animation/import-url', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		// Port 1 is rejected by undici itself ("bad port"); a high port really refuses.
		body: JSON.stringify({ kind: 'audio', url: 'http://127.0.0.1:65500/none.wav' }),
	})
	assert.equal(dead.status, 400)
	const message = (await dead.json()).error
	// A refused connection has to reach the panel as advice, not as "fetch failed".
	assert.match(message, /不可达|不可用|拉取失败|超时/, 'unexpected error: ' + message)
})

await step('DELETE /assets drops the file and clears preset references', async () => {
	const response = await fetch(base + '/recharge-animation/assets?kind=audio&id=' + audioId, { method: 'DELETE' })
	assert.equal(response.status, 200)
	const payload = await response.json()
	assert.equal(payload.config.assets.audio.length, 0)
	assert.equal(payload.config.presets[0].slots.intro, null)
	const gone = await fetch(base + '/recharge-animation/assets?kind=audio&id=' + audioId)
	assert.equal(gone.status, 404)
})

await step('state survives a fresh module load', async () => {
	const reloaded = await import(ENTRY + '?v=2')
	const routes2 = new Map()
	reloaded.apply({ webServer: { register: (route) => (routes2.set(route.path, route.handler), () => {}) } }, { enabled: true })
	const server2 = createServer((req, res) => {
		const handler = routes2.get(new URL(req.url, 'http://localhost').pathname)
		if (!handler) {
			res.writeHead(404)
			res.end()
			return
		}
		handler(req, res)
	})
	await new Promise((resolve) => server2.listen(0, '127.0.0.1', resolve))
	const base2 = 'http://127.0.0.1:' + server2.address().port
	const payload = await (await fetch(base2 + '/recharge-animation/config')).json()
	assert.equal(payload.config.labels.button, '充值中心')
	assert.equal(payload.config.muted, true)
	assert.equal(payload.config.assets.icons.length, 2)
	assert.equal(payload.config.presets[0].iconId, iconId)
	server2.close()
})

await step('dispose removes every route', async () => {
	dispose()
	assert.equal(routes.size, 0)
})

await step('a refused route registration is reported, not swallowed', async () => {
	// The plugin must load even when the routes are taken, but a silent catch made
	// that state indistinguishable from a healthy install whose URLs 404.
	const warnings = []
	const refused = {
		webServer: { register() { throw new Error('route already claimed') } },
		logger: { warn: (line) => warnings.push(line) },
	}
	const teardown = mod.apply(refused, { enabled: true })
	assert.equal(typeof teardown, 'function')
	assert.equal(warnings.length, 3, 'one warning per refused route: ' + warnings.join(' | '))
	assert.match(warnings[0], /路由注册失败/)
	assert.match(warnings[0], /route already claimed/)
	teardown()
})

console.log('dsh-recharge-animation host smoke test')
console.log('DSH_HOME = ' + home)
for (const line of steps) console.log(line)
console.log('all ' + steps.length + ' checks passed')
server.close()
fixtures.close()
