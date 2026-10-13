/**
 * dsh-recharge-animation — Host half.
 *
 * The Host half owns this package's data: the panel configuration and every
 * imported image or sound live under the DSH home, and both are republished over
 * same-origin routes. A packaged (non-dynamic) client bundle has no `host.call`
 * closure, so HTTP is the only channel from the browser half back to this half.
 *
 * Routes (all `exact`, all under `/recharge-animation`):
 *   GET    /config       -> stored configuration, asset index, limits
 *   PUT    /config       -> replace it (validated and normalised)
 *   POST   /config       -> same as PUT
 *   GET    /assets?...   -> one stored file, by index lookup only
 *   POST   /assets?...   -> store a raw upload (binary body, no base64 detour)
 *   DELETE /assets?...   -> drop a stored file and clear every reference to it
 *   POST   /import-url   -> pull a file from a URL, then store it
 *
 * @module dsh-recharge-animation
 */

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
	accessSync,
	constants,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from 'node:fs'

/** Same-origin routes read by the client half. Keep in sync with src/client.template.js. */
const ROUTE_CONFIG = '/recharge-animation/config'
const ROUTE_ASSETS = '/recharge-animation/assets'
const ROUTE_IMPORT = '/recharge-animation/import-url'

/** Data layout under the DSH home. */
const DATA_DIRNAME = 'recharge-animation'
const CONFIG_NAME = 'config.json'
const ICON_DIRNAME = 'icons'
const AUDIO_DIRNAME = 'audio'

/** Upload ceilings, mirrored by the client half for its pre-flight hints. */
const LIMITS = { icon: 4 * 1024 * 1024, audio: 8 * 1024 * 1024 }

/** URL import guards. */
const URL_TIMEOUT_MS = 15000
const URL_MAX_REDIRECTS = 5

/** Label ceilings; the panel shows the same numbers as counters. */
const LABEL_MAX = { button: 24, skipHint: 40 }
const PRESET_NAME_MAX = 24
const ASSET_NAME_MAX = 80
const MAX_PRESETS = 40

/** Behavior defaults; also the seed for a first run. */
const BEHAVIOR_DEFAULTS = {
	duration: 1800,
	minDuration: 1100,
	skippable: true,
	progressMode: 'real',
	openTopUp: true,
	platformTop: 40,
}

/** One shipped preset, so the panel always has something to select. */
const DEFAULT_PRESET = {
	id: 'p-default',
	name: '默认',
	iconId: null,
	slots: { intro: null, bgm: null, outro: null },
	volumes: { intro: 100, bgm: 60, outro: 100 },
}

/** Formats accepted for each kind, recognised by content rather than by name. */
const SIGNATURES = {
	icon: [
		{ ext: 'png', mime: 'image/png', test: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
		{ ext: 'jpg', mime: 'image/jpeg', test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
		{ ext: 'gif', mime: 'image/gif', test: (b) => b.length > 6 && b.subarray(0, 4).toString('latin1') === 'GIF8' },
		{
			ext: 'webp',
			mime: 'image/webp',
			test: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
		},
	],
	audio: [
		{
			ext: 'wav',
			mime: 'audio/wav',
			test: (b) => b.length > 12 && b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WAVE',
		},
		{
			ext: 'mp3',
			mime: 'audio/mpeg',
			test: (b) => b.length > 4 && (b.subarray(0, 3).toString('latin1') === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)),
		},
		{ ext: 'ogg', mime: 'audio/ogg', test: (b) => b.length > 4 && b.subarray(0, 4).toString('latin1') === 'OggS' },
		{ ext: 'm4a', mime: 'audio/mp4', test: (b) => b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp' },
	],
}

/** Extension -> MIME, used when a stored file is served back. */
const MIME_BY_EXT = {
	png: 'image/png',
	jpg: 'image/jpeg',
	gif: 'image/gif',
	webp: 'image/webp',
	wav: 'audio/wav',
	mp3: 'audio/mpeg',
	ogg: 'audio/ogg',
	m4a: 'audio/mp4',
}

/** Human wording for the two kinds, used in errors the panel shows verbatim. */
const KIND_LABEL = { icon: '图片', audio: '音频' }
const KIND_FORMATS = { icon: 'png / jpg / webp / gif', audio: 'mp3 / wav / ogg / m4a' }

/**
 * Bases the host schema library is looked up from. Schemastery is a host package
 * that this bundle deliberately does not depend on, so a plain ancestor walk is
 * not enough: a `link:` install reaches this file through a junction into the
 * source checkout, which carries no node_modules of its own. The DSH home below
 * always holds it, and a registry install resolves on the first base anyway.
 *
 * @returns candidate require bases, most specific first.
 */
function schemaLookupBases() {
	const bases = [import.meta.url]
	const home = process.env.DSH_HOME || join(homedir(), '.dsh')
	bases.push(pathToFileURL(join(home, 'profiles', 'package.json')).href)
	if (process.env.DSH_PROFILE_DIR) {
		bases.push(pathToFileURL(join(process.env.DSH_PROFILE_DIR, 'package.json')).href)
	}
	try {
		bases.push(pathToFileURL(join(process.cwd(), 'package.json')).href)
	} catch { /* cwd unavailable */ }
	return bases
}

/** The host schema library, or null when this runtime cannot supply one. */
const schema = (() => {
	for (const base of schemaLookupBases()) {
		try {
			const mod = createRequire(base)('@deepseek-ai/schemastery')
			const candidate = (mod && mod.default) || mod
			if (candidate && typeof candidate.object === 'function') return candidate
		} catch { /* try the next base */ }
	}
	return null
})()

/**
 * Plugin config face. The panel owns every behaviour knob, so the only key left
 * here is the one that decides whether the panel can be reached at all: the entry
 * button. A disabled entry cannot be right-clicked, which is exactly why this key
 * stays out of the panel.
 */
export const Config = schema
	? schema.object({
		enabled: schema.boolean().default(true).description('总开关：关闭后侧边栏不显示充值入口（配置面板随之不可达）。'),
	})
	: undefined

/**
 * The webserver publishes the routes. Cordis refuses to READ an undeclared
 * service (`cannot get property "webServer" without inject`), which is exactly what
 * left this plugin's fiber in the failed phase, so the dependency is declared here.
 */
export const inject = ['webServer']

/** @returns candidate data directories, most desirable first. */
function dataDirCandidates() {
	const out = []
	const home = process.env.DSH_HOME || join(homedir(), '.dsh')
	out.push(join(home, DATA_DIRNAME))
	if (process.env.DSH_PROFILE_DIR) out.push(join(process.env.DSH_PROFILE_DIR, DATA_DIRNAME))
	try {
		out.push(join(process.cwd(), '.' + DATA_DIRNAME))
	} catch { /* cwd unavailable */ }
	return out
}

/** The first candidate directory that can be created and written to. */
function pickDataDir() {
	const candidates = dataDirCandidates()
	for (const dir of candidates) {
		try {
			mkdirSync(dir, { recursive: true })
			accessSync(dir, constants.W_OK)
			return dir
		} catch { /* try the next candidate */ }
	}
	return candidates[0]
}

/** Resolved data paths for one run, creating the layout on the way. */
function paths() {
	const dir = pickDataDir()
	const icons = join(dir, ICON_DIRNAME)
	const audio = join(dir, AUDIO_DIRNAME)
	for (const sub of [icons, audio]) {
		try { mkdirSync(sub, { recursive: true }) } catch { /* handled on write */ }
	}
	return { dir, icons, audio, config: join(dir, CONFIG_NAME) }
}

/** Default configuration for a first run. */
function defaultConfig() {
	return {
		version: 1,
		muted: false,
		labels: { button: '充值', skipHint: '点击跳过' },
		behavior: { ...BEHAVIOR_DEFAULTS },
		assets: { icons: [], audio: [] },
		presets: [{ ...DEFAULT_PRESET, slots: { ...DEFAULT_PRESET.slots }, volumes: { ...DEFAULT_PRESET.volumes } }],
		activePresetId: DEFAULT_PRESET.id,
	}
}

/** Clamp a possibly non-numeric option into a usable integer range. */
function clampInt(value, low, high, fallback) {
	const n = Number(value)
	if (!Number.isFinite(n)) return fallback
	return Math.min(high, Math.max(low, Math.round(n)))
}

/** Collapse whitespace and cap the length of a user-visible string. */
function cleanText(value, fallback, max) {
	if (typeof value !== 'string') return fallback
	const text = value.replace(/\s+/g, ' ').trim()
	if (text === '') return fallback
	return text.slice(0, max)
}

/** Keep a string only when it looks like one of our ids. */
function cleanId(value) {
	return typeof value === 'string' && /^[a-z0-9-]{1,64}$/i.test(value) ? value : null
}

/** A fresh asset id: kind prefix + time + randomness, stable and file-safe. */
function makeAssetId(prefix) {
	return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
}

/** Read a file as text, or null when it is missing or unreadable. */
function readTextFile(file) {
	try {
		return readFileSync(file, 'utf8')
	} catch {
		return null
	}
}

/** Write JSON atomically: a temp file next to the target, then a rename. */
function writeJsonAtomic(file, value) {
	const temp = file + '.tmp'
	writeFileSync(temp, JSON.stringify(value, null, '\t'), 'utf8')
	renameSync(temp, file)
}

/** One stored file, matched by content rather than by its original name. */
function detectFormat(buffer, kind) {
	const table = SIGNATURES[kind] || []
	for (const entry of table) {
		try {
			if (entry.test(buffer)) return { ext: entry.ext, mime: entry.mime }
		} catch { /* malformed buffer; keep looking */ }
	}
	return null
}

/** Copy just the fields an index entry is allowed to carry. */
function bareEntry(entry) {
	if (!entry || typeof entry !== 'object') return null
	const id = cleanId(entry.id)
	const file = typeof entry.file === 'string' ? entry.file : ''
	if (id === null || file === '') return null
	if (file.includes('/') || file.includes('\\')) return null
	const out = { id, file, bytes: clampInt(entry.bytes, 0, 64 * 1024 * 1024, 0) }
	const name = cleanText(entry.name, '', ASSET_NAME_MAX)
	if (name !== '') out.name = name
	if (Number.isFinite(Number(entry.ms))) out.ms = clampInt(entry.ms, 0, 3600000, 0)
	return out
}

/** Drop index entries whose file vanished, so the panel never renders a dead row. */
function pruneAssets(config, dirs) {
	const keep = (entry, dir) => existsSync(join(dir, entry.file))
	config.assets.icons = config.assets.icons.filter((entry) => keep(entry, dirs.icons))
	config.assets.audio = config.assets.audio.filter((entry) => keep(entry, dirs.audio))
}

/** Attach the same-origin URL the browser half should load each asset from. */
function publishAssets(config) {
	const decorate = (entry, kind) => ({
		id: entry.id,
		file: entry.file,
		bytes: entry.bytes,
		name: entry.name,
		ms: entry.ms,
		url: ROUTE_ASSETS + '?kind=' + kind + '&id=' + encodeURIComponent(entry.id),
	})
	config.assets.icons = config.assets.icons.map((entry) => decorate(entry, 'icon'))
	config.assets.audio = config.assets.audio.map((entry) => decorate(entry, 'audio'))
}

/**
 * Validate and normalise a configuration coming from the panel. Anything unknown
 * is dropped, every number is clamped, and every preset reference is resolved
 * against the asset index that will actually exist on disk.
 *
 * The asset index itself is never taken from the caller: it is carried over from
 * `base` (the index on disk), so only the upload and delete routes can change it.
 *
 * @param input - candidate configuration (usually parsed JSON from the panel).
 * @param base - the configuration to fall back to, field by field.
 * @returns a clean configuration object.
 */
function normalizeConfig(input, base) {
	const source = input && typeof input === 'object' ? input : {}
	const previous = base && typeof base === 'object' ? base : defaultConfig()
	const was = { ...BEHAVIOR_DEFAULTS, ...(previous.behavior || {}) }
	const next = defaultConfig()

	// --- labels ---------------------------------------------------------------
	const labels = source.labels && typeof source.labels === 'object' ? source.labels : {}
	next.labels.button = cleanText(labels.button, previous.labels.button || next.labels.button, LABEL_MAX.button)
	next.labels.skipHint = cleanText(labels.skipHint, previous.labels.skipHint || next.labels.skipHint, LABEL_MAX.skipHint)

	// --- behavior -------------------------------------------------------------
	const behavior = source.behavior && typeof source.behavior === 'object' ? source.behavior : {}
	next.behavior.duration = clampInt(behavior.duration, 600, 8000, was.duration)
	next.behavior.minDuration = clampInt(behavior.minDuration, 0, next.behavior.duration, was.minDuration)
	next.behavior.skippable = typeof behavior.skippable === 'boolean' ? behavior.skippable : was.skippable
	next.behavior.progressMode = behavior.progressMode === 'fixed' ? 'fixed' : behavior.progressMode === 'real' ? 'real' : was.progressMode
	next.behavior.openTopUp = typeof behavior.openTopUp === 'boolean' ? behavior.openTopUp : was.openTopUp
	next.behavior.platformTop = clampInt(behavior.platformTop, 0, 320, was.platformTop)

	// --- global mute ----------------------------------------------------------
	next.muted = typeof source.muted === 'boolean' ? source.muted : previous.muted === true

	// --- assets (carried over, never taken from the caller) -------------------
	next.assets.icons = (previous.assets.icons || []).map(bareEntry).filter(Boolean)
	next.assets.audio = (previous.assets.audio || []).map(bareEntry).filter(Boolean)

	// --- presets --------------------------------------------------------------
	const iconIds = new Set(next.assets.icons.map((entry) => entry.id))
	const audioIds = new Set(next.assets.audio.map((entry) => entry.id))
	const volume = (value, fallback) => clampInt(value, 0, 100, fallback)
	const incoming = Array.isArray(source.presets) ? source.presets : []
	const presets = []
	const seen = new Set()
	for (const raw of incoming) {
		if (presets.length >= MAX_PRESETS) break
		if (!raw || typeof raw !== 'object') continue
		let id = cleanId(raw.id)
		if (id === null || seen.has(id)) id = 'p-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6)
		seen.add(id)
		const slots = raw.slots && typeof raw.slots === 'object' ? raw.slots : {}
		const volumes = raw.volumes && typeof raw.volumes === 'object' ? raw.volumes : {}
		const iconId = cleanId(raw.iconId)
		const slot = (name) => {
			const value = cleanId(slots[name])
			return value !== null && audioIds.has(value) ? value : null
		}
		presets.push({
			id,
			name: cleanText(raw.name, '未命名预设', PRESET_NAME_MAX),
			iconId: iconId !== null && iconIds.has(iconId) ? iconId : null,
			slots: { intro: slot('intro'), bgm: slot('bgm'), outro: slot('outro') },
			volumes: {
				intro: volume(volumes.intro, DEFAULT_PRESET.volumes.intro),
				bgm: volume(volumes.bgm, DEFAULT_PRESET.volumes.bgm),
				outro: volume(volumes.outro, DEFAULT_PRESET.volumes.outro),
			},
		})
	}
	if (presets.length === 0) {
		presets.push({ ...DEFAULT_PRESET, slots: { ...DEFAULT_PRESET.slots }, volumes: { ...DEFAULT_PRESET.volumes } })
	}
	next.presets = presets
	const active = cleanId(source.activePresetId)
	next.activePresetId = active !== null && presets.some((preset) => preset.id === active) ? active : presets[0].id

	return next
}

/**
 * Read the stored configuration. A missing file is seeded from the plugin manager
 * config, so an install that predates the panel keeps its tuned behaviour.
 *
 * @param dirs - resolved data paths.
 * @param hostConfig - the plugin manager config, used only for the first-run seed.
 * @returns the stored configuration, cleaned and pruned.
 */
function loadConfig(dirs, hostConfig) {
	const raw = readTextFile(dirs.config)
	const base = defaultConfig()
	let parsed = null
	if (raw !== null) {
		try {
			parsed = JSON.parse(raw)
		} catch { /* a corrupt file is rebuilt from defaults below */ }
	}
	if (parsed && parsed.assets && typeof parsed.assets === 'object') {
		// The index on disk is the whitelist for this pass.
		if (Array.isArray(parsed.assets.icons)) base.assets.icons = parsed.assets.icons
		if (Array.isArray(parsed.assets.audio)) base.assets.audio = parsed.assets.audio
	}
	if (parsed === null) {
		const was = hostConfig && typeof hostConfig === 'object' ? hostConfig : {}
		base.behavior.duration = clampInt(was.duration, 600, 8000, BEHAVIOR_DEFAULTS.duration)
		base.behavior.minDuration = clampInt(was.minDuration, 0, base.behavior.duration, BEHAVIOR_DEFAULTS.minDuration)
		base.behavior.skippable = typeof was.skippable === 'boolean' ? was.skippable : BEHAVIOR_DEFAULTS.skippable
		base.behavior.progressMode = was.progressMode === 'fixed' ? 'fixed' : BEHAVIOR_DEFAULTS.progressMode
		base.behavior.openTopUp = typeof was.openTopUp === 'boolean' ? was.openTopUp : BEHAVIOR_DEFAULTS.openTopUp
		base.behavior.platformTop = clampInt(was.platformTop, 0, 320, BEHAVIOR_DEFAULTS.platformTop)
	}
	const clean = normalizeConfig(parsed, base)
	pruneAssets(clean, dirs)
	// Only touch the disk when the read actually changed something; a GET must stay
	// a read.
	if (raw === null || JSON.stringify(clean) !== JSON.stringify(parsed)) {
		try { writeJsonAtomic(dirs.config, clean) } catch { /* read-only home; stay in memory */ }
	}
	return clean
}

/** Persist a configuration, returning the cleaned object that was written. */
function saveConfig(dirs, candidate, base) {
	const clean = normalizeConfig(candidate, base)
	pruneAssets(clean, dirs)
	writeJsonAtomic(dirs.config, clean)
	return clean
}

/** The payload every route answers with, so the panel can resync in one round trip. */
function configPayload(config, enabled) {
	const copy = JSON.parse(JSON.stringify(config))
	publishAssets(copy)
	return {
		ok: true,
		enabled: enabled !== false,
		config: copy,
		limits: { icon: LIMITS.icon, audio: LIMITS.audio },
		formats: { icon: KIND_FORMATS.icon, audio: KIND_FORMATS.audio },
		labelMax: LABEL_MAX,
		presetNameMax: PRESET_NAME_MAX,
		assetNameMax: ASSET_NAME_MAX,
	}
}

/** Send a JSON body. */
function sendJson(res, code, payload) {
	res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
	res.end(JSON.stringify(payload))
}

/** Send a failure the panel can show as-is. */
function fail(res, code, message) {
	sendJson(res, code, { ok: false, error: message })
}

/**
 * Read a request body with a hard ceiling. Past the ceiling the rest of the body
 * is drained and dropped rather than destroying the socket: the caller still has
 * to receive the "too large" answer, and an aborted socket would hide it.
 */
function readBody(req, maxBytes) {
	return new Promise((resolve, reject) => {
		const chunks = []
		let size = 0
		let overflow = false
		req.on('data', (chunk) => {
			size += chunk.length
			if (size > maxBytes) {
				overflow = true
				chunks.length = 0
				return
			}
			if (!overflow) chunks.push(chunk)
		})
		req.on('end', () => {
			if (overflow) reject(new Error('body too large'))
			else resolve(Buffer.concat(chunks))
		})
		req.on('error', reject)
	})
}

/** Parse a JSON request body, capped so a bad caller cannot buffer forever. */
async function readJson(req, maxBytes = 256 * 1024) {
	const buffer = await readBody(req, maxBytes)
	const text = buffer.toString('utf8')
	if (text.trim() === '') return {}
	return JSON.parse(text)
}

/** Pull the query object off a request URL without throwing on malformed input. */
function queryOf(req) {
	try {
		return new URL(String(req.url || ''), 'http://localhost').searchParams
	} catch {
		return new URLSearchParams()
	}
}

/** Store one buffer as an asset of the given kind. */
function storeAsset(dirs, config, kind, buffer, name) {
	const limit = kind === 'icon' ? LIMITS.icon : LIMITS.audio
	const format = detectFormat(buffer, kind)
	if (format === null) {
		return { error: `这不是可用的${KIND_LABEL[kind]}（支持 ${KIND_FORMATS[kind]}）` }
	}
	if (buffer.length > limit) {
		return { error: `${KIND_LABEL[kind]}超过上限 ${Math.round(limit / 1024 / 1024)}MB（当前 ${(buffer.length / 1024 / 1024).toFixed(1)}MB）` }
	}
	if (buffer.length < 16) return { error: `${KIND_LABEL[kind]}文件太小，可能没有下载完整` }
	const dir = kind === 'icon' ? dirs.icons : dirs.audio
	const id = makeAssetId(kind === 'icon' ? 'i' : 'a')
	const file = id + '.' + format.ext
	try {
		writeFileSync(join(dir, file), buffer)
	} catch (error) {
		return { error: `写入失败：${String((error && error.message) || error).slice(0, 120)}` }
	}
	const entry = { id, file, bytes: buffer.length }
	const cleanName = cleanText(name, '', ASSET_NAME_MAX)
	if (cleanName !== '') entry.name = cleanName
	const list = kind === 'icon' ? config.assets.icons : config.assets.audio
	list.push(entry)
	return { entry }
}

/** Remove an asset and every preset reference to it. */
function dropAsset(dirs, config, kind, id) {
	const list = kind === 'icon' ? config.assets.icons : config.assets.audio
	const entry = list.find((candidate) => candidate.id === id)
	if (!entry) return false
	const dir = kind === 'icon' ? dirs.icons : dirs.audio
	try {
		unlinkSync(join(dir, entry.file))
	} catch { /* already gone; the index is what matters */ }
	const rest = list.filter((candidate) => candidate.id !== id)
	if (kind === 'icon') config.assets.icons = rest
	else config.assets.audio = rest
	for (const preset of config.presets) {
		if (kind === 'icon' && preset.iconId === id) preset.iconId = null
		if (kind === 'audio') {
			for (const slot of ['intro', 'bgm', 'outro']) {
				if (preset.slots[slot] === id) preset.slots[slot] = null
			}
		}
	}
	return true
}

/** Read a response body with a ceiling, aborting as soon as it is crossed. */
async function readLimited(response, maxBytes) {
	const body = response.body
	if (!body || typeof body.getReader !== 'function') {
		const buffer = Buffer.from(await response.arrayBuffer())
		if (buffer.length > maxBytes) throw new Error(`远程文件超过上限 ${Math.round(maxBytes / 1024 / 1024)}MB`)
		return buffer
	}
	const reader = body.getReader()
	const chunks = []
	let size = 0
	for (;;) {
		const step = await reader.read()
		if (step.done) break
		const chunk = Buffer.from(step.value)
		size += chunk.length
		if (size > maxBytes) {
			try { await reader.cancel() } catch { /* stream already gone */ }
			throw new Error(`远程文件超过上限 ${Math.round(maxBytes / 1024 / 1024)}MB`)
		}
		chunks.push(chunk)
	}
	return Buffer.concat(chunks)
}

/** Download a URL into memory, following a bounded number of redirects. */
async function download(urlText, kind) {
	const limit = kind === 'icon' ? LIMITS.icon : LIMITS.audio
	let current = urlText
	for (let hop = 0; hop <= URL_MAX_REDIRECTS; hop++) {
		let parsed
		try {
			parsed = new URL(current)
		} catch {
			throw new Error('不是有效的 URL')
		}
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error('只支持 http / https 链接')
		}
		const controller = new AbortController()
		const timer = setTimeout(() => controller.abort(), URL_TIMEOUT_MS)
		let response
		try {
			response = await fetch(parsed.href, { redirect: 'manual', signal: controller.signal })
		} catch (error) {
			clearTimeout(timer)
			const message = String((error && error.message) || error)
			throw new Error(/abort/i.test(message) ? '拉取超时（15 秒）' : `拉取失败：${message.slice(0, 120)}`)
		}
		try {
			if (response.status >= 300 && response.status < 400) {
				const location = response.headers.get('location')
				if (!location) throw new Error('重定向没有给出目标地址')
				current = new URL(location, parsed.href).href
				continue
			}
			if (!response.ok) throw new Error(`远端返回 HTTP ${response.status}`)
			const buffer = await readLimited(response, limit)
			return { buffer, contentType: String(response.headers.get('content-type') || '') }
		} finally {
			clearTimeout(timer)
		}
	}
	throw new Error(`重定向次数超过 ${URL_MAX_REDIRECTS} 次`)
}

/**
 * Publish every route this half owns.
 *
 * @param ctx - Host root context.
 * @param hostConfig - validated plugin configuration (only `enabled` is ours).
 * @returns a disposer that removes every route.
 */
export function apply(ctx, hostConfig) {
	const disposers = []
	const webServer = ctx && ctx.webServer
	const isEnabled = !(hostConfig && hostConfig.enabled === false)
	if (!webServer || typeof webServer.register !== 'function') return () => {}

	const register = (path, handler) => {
		try {
			disposers.push(webServer.register({ kind: 'exact', path, handler }))
		} catch { /* route already claimed by another install */ }
	}

	register(ROUTE_CONFIG, async (req, res) => {
		try {
			const dirs = paths()
			if (req.method === 'PUT' || req.method === 'POST') {
				const body = await readJson(req)
				const current = loadConfig(dirs, hostConfig)
				const candidate = body && body.config ? body.config : body
				const saved = saveConfig(dirs, candidate, current)
				sendJson(res, 200, configPayload(saved, isEnabled))
				return
			}
			const config = loadConfig(dirs, hostConfig)
			sendJson(res, 200, configPayload(config, isEnabled))
		} catch (error) {
			fail(res, 500, String((error && error.message) || error).slice(0, 200))
		}
	})

	register(ROUTE_ASSETS, async (req, res) => {
		try {
			const dirs = paths()
			const query = queryOf(req)
			const kind = query.get('kind') === 'audio' ? 'audio' : 'icon'
			const id = cleanId(query.get('id'))

			if (req.method === 'GET' || req.method === 'HEAD') {
				if (id === null) {
					fail(res, 400, '缺少素材 id')
					return
				}
				const config = loadConfig(dirs, hostConfig)
				const entry = findAsset(config, kind, id)
				if (entry === null) {
					fail(res, 404, '素材不存在')
					return
				}
				const dir = kind === 'icon' ? dirs.icons : dirs.audio
				let buffer
				try {
					buffer = readFileSync(join(dir, entry.file))
				} catch {
					fail(res, 404, '素材文件已丢失')
					return
				}
				const ext = String(entry.file).split('.').pop().toLowerCase()
				res.writeHead(200, {
					'Content-Type': MIME_BY_EXT[ext] || 'application/octet-stream',
					'Content-Length': buffer.length,
					'Cache-Control': 'public, max-age=31536000, immutable',
				})
				if (req.method === 'HEAD') res.end()
				else res.end(buffer)
				return
			}

			if (req.method === 'DELETE') {
				if (id === null) {
					fail(res, 400, '缺少素材 id')
					return
				}
				const current = loadConfig(dirs, hostConfig)
				if (!dropAsset(dirs, current, kind, id)) {
					fail(res, 404, '素材不存在')
					return
				}
				sendJson(res, 200, configPayload(saveConfig(dirs, current, current), isEnabled))
				return
			}

			if (req.method === 'POST') {
				const limit = kind === 'icon' ? LIMITS.icon : LIMITS.audio
				let buffer
				try {
					buffer = await readBody(req, limit + 4096)
				} catch {
					fail(res, 413, `${KIND_LABEL[kind]}超过上限 ${Math.round(limit / 1024 / 1024)}MB`)
					return
				}
				const name = query.get('name') || ''
				const current = loadConfig(dirs, hostConfig)
				const stored = storeAsset(dirs, current, kind, buffer, name)
				if (stored.error) {
					fail(res, 400, stored.error)
					return
				}
				sendJson(res, 200, configPayload(saveConfig(dirs, current, current), isEnabled))
				return
			}

			fail(res, 405, '不支持的方法')
		} catch (error) {
			fail(res, 500, String((error && error.message) || error).slice(0, 200))
		}
	})

	register(ROUTE_IMPORT, async (req, res) => {
		try {
			if (req.method !== 'POST') {
				fail(res, 405, '只接受 POST')
				return
			}
			const body = await readJson(req)
			const kind = body.kind === 'audio' ? 'audio' : 'icon'
			const url = typeof body.url === 'string' ? body.url.trim() : ''
			if (url === '') {
				fail(res, 400, '请填写链接')
				return
			}
			const dirs = paths()
			let pulled
			try {
				pulled = await download(url, kind)
			} catch (error) {
				fail(res, 400, String((error && error.message) || error).slice(0, 200))
				return
			}
			const current = loadConfig(dirs, hostConfig)
			const fromName = url.split('/').pop() || ''
			const stored = storeAsset(dirs, current, kind, pulled.buffer, fromName)
			if (stored.error) {
				const hint = pulled.contentType ? `（远端 Content-Type：${pulled.contentType.slice(0, 60)}）` : ''
				fail(res, 400, stored.error + hint)
				return
			}
			sendJson(res, 200, configPayload(saveConfig(dirs, current, current), isEnabled))
		} catch (error) {
			fail(res, 500, String((error && error.message) || error).slice(0, 200))
		}
	})

	return () => {
		for (const dispose of disposers) {
			try { dispose() } catch { /* route already released */ }
		}
	}
}

/** Find one entry inside a config asset list. */
function findAsset(config, kind, id) {
	const list = kind === 'icon' ? config.assets.icons : config.assets.audio
	for (const entry of list) {
		if (entry.id === id) return entry
	}
	return null
}
