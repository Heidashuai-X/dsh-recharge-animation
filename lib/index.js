/**
 * dsh-recharge-animation — Host half.
 *
 * The Host half owns exactly one thing: it republishes this package's Config over a
 * same-origin route. A packaged (non-dynamic) client bundle has no `host.call`
 * closure, so HTTP is the only channel from the browser half back to this half.
 *
 * @module dsh-recharge-animation
 */

import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Same-origin route read by the client half. Keep in sync with src/client.template.js. */
const CONFIG_ROUTE = '/recharge-animation/config'

/** Effective defaults. The client half carries the same table for fetch failures. */
const DEFAULTS = {
	enabled: true,
	duration: 1800,
	minDuration: 1100,
	skippable: true,
	progressMode: 'real',
	openTopUp: true,
	platformTop: 40,
}

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

/** Plugin config face; absent when the runtime supplies no schema library. */
export const Config = schema
	? schema.object({
		enabled: schema.boolean().default(DEFAULTS.enabled).description('总开关：关闭后侧边栏不显示充值入口。'),
		duration: schema.natural().min(600).max(8000).default(DEFAULTS.duration).description('最长显示时长（毫秒）：到点必定收场，防止卡在中途。'),
		minDuration: schema.natural().min(0).max(8000).default(DEFAULTS.minDuration).description('最短显示时长（毫秒）：加载再快也至少显示这么久，避免一闪而过。'),
		skippable: schema.boolean().default(DEFAULTS.skippable).description('是否允许点击或按键跳过动画。'),
		progressMode: schema.union(['real', 'fixed']).default(DEFAULTS.progressMode).description('real：跟进真实加载节点；fixed：纯按时间推进。'),
		openTopUp: schema.boolean().default(DEFAULTS.openTopUp).description('动画结束后是否自动打开官方充值页（platform.deepseek.com/top_up）。'),
		platformTop: schema.natural().min(0).max(320).default(DEFAULTS.platformTop).description('内置浏览器视图距窗口顶部的距离（像素）：调大可避让桌面端标题栏与工具栏，避免返回键与窗口按钮重叠误触。'),
	})
	: undefined

/**
 * The webserver publishes the config route. Cordis refuses to READ an undeclared
 * service (`cannot get property "webServer" without inject`), which is exactly what
 * left this plugin's fiber in the failed phase, so the dependency is declared here.
 */
export const inject = ['webServer']

/**
 * Publish the resolved configuration to the client half.
 * @param ctx - Host root context.
 * @param config - Validated plugin configuration.
 * @returns a disposer that removes the route.
 */
export function apply(ctx, config) {
	const resolved = { ...DEFAULTS, ...(config && typeof config === 'object' ? config : {}) }
	const disposers = []
	const webServer = ctx && ctx.webServer
	if (webServer && typeof webServer.register === 'function') {
		disposers.push(webServer.register({
			kind: 'exact',
			path: CONFIG_ROUTE,
			handler: (req, res) => {
				res.setHeader('Content-Type', 'application/json; charset=utf-8')
				res.setHeader('Cache-Control', 'no-store')
				res.end(JSON.stringify(resolved))
			},
		}))
	}
	return () => {
		for (const dispose of disposers) {
			try { dispose() } catch { /* route already released */ }
		}
	}
}
