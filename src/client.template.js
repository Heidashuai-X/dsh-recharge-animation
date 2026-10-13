window.__ModuleLoader__.load({
	id: "dsh-recharge-animation",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		var React = require("react");

		/** Inline brand mark. Regenerate with `python tools/prepare.py`. */
		var LOGO = "__LOGO_DATA_URI__";

		/** Same-origin route owned by this package's Host half (lib/index.js). */
		var CONFIG_URL = "/recharge-animation/config";

		/** Official DeepSeek top-up page — the same target DSH's account page uses. */
		var TOPUP_URL = "https://platform.deepseek.com/top_up";

		/**
		 * Native Platform page name understood by the Desktop host. The shipped
		 * account feature requests the same page through the same bridge.
		 */
		var PLATFORM_PAGE = "top-up";

		/**
		 * Electron preload bridge for the host-owned WebContentsView. Present only in
		 * the Desktop build; the browser build leaves it undefined and the hand-over
		 * stays a plain new window.
		 */
		var PLATFORM_BRIDGE = typeof globalThis !== "undefined" && globalThis.dshPlatform ? globalThis.dshPlatform : null;

		/**
		 * The Desktop preload's native keyboard channel. It only ever delivers a key
		 * the main process matched against a *registered* shortcut, and the Platform
		 * view is not wired into it at all, so Escape pressed inside the view never
		 * arrives. Subscribed for browser-build parity and for the window before
		 * focus moves into the view; the way out of the view is its own back button.
		 */
		var KEYBOARD_BRIDGE = typeof window !== "undefined" && window.dshDesktop && window.dshDesktop.keyboard
			? window.dshDesktop.keyboard
			: null;

		/**
		 * Whether a native input record is an Escape press.
		 * @param input - one record from the native keyboard channel.
		 * @returns true for Escape.
		 */
		function isEscapeInput(input) {
			if (!input || typeof input !== "object") return false;
			if (input.kind !== "keyboard" && input.kind !== "webview" && input.kind !== "iframe") return false;
			return input.code === "Escape" || input.key === "Escape";
		}

		/**
		 * How far below the window top the native view starts. The Desktop shell keeps
		 * its own title bar and toolbar in that band, and a native child view always
		 * paints above DOM, so the viewport is pushed clear of it instead of trying to
		 * cover it.
		 */
		var PLATFORM_TOP = 40;
		/** Effective offset; the Host config can move it. */
		var platformTop = PLATFORM_TOP;
		/** Mirrors lib/index.js DEFAULTS; used when that route is unreachable. */
		var DEFAULTS = {
			enabled: true,
			duration: 1800,
			minDuration: 1100,
			skippable: true,
			progressMode: "real",
			openTopUp: true,
			platformTop: PLATFORM_TOP
		};

		/** Sidebar foot seat, beside the Settings button. */
		var SEAT_BUTTON = "sidebar.footer.action";
		/** Frame-wide floating layer, above every column. */
		var SEAT_OVERLAY = "shell.overlay";

		/** Page-lifetime guard: seats are claimed once per document load. */
		var APPLIED = "__dshRechargeAnimationApplied";
		/** Real signals top out below 100 so the final tween stays honest. */
		var READY = 96;

		var CSS = [
			// --- glass stage -----------------------------------------------------
			".dra-root{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;",
			"opacity:0;transition:opacity .28s ease;pointer-events:auto;",
			"-webkit-user-select:none;user-select:none;cursor:default;",
			"background-color:rgba(14,14,18,.55);",
			"background-color:color-mix(in srgb,var(--dsw-alias-bg-base,#0e0e12) 52%,transparent);",
			"background-image:radial-gradient(120% 95% at 50% 36%,color-mix(in srgb,var(--dsw-alias-brand-primary,#4d6bfe) 22%,transparent) 0,transparent 58%);",
			"-webkit-backdrop-filter:blur(72px) saturate(1.9);backdrop-filter:blur(72px) saturate(1.9)}",
			".dra-root.dra-in{opacity:1}",
			".dra-root.dra-out{opacity:0}",
			// --- glass card ------------------------------------------------------
			".dra-card{display:flex;flex-direction:column;align-items:center;gap:26px;padding:46px 54px;border-radius:26px;",
			"background-color:rgba(22,22,28,.36);",
			"background-color:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#16161c) 34%,transparent);",
			"border:1px solid color-mix(in srgb,var(--dsw-alias-border-l1,rgba(127,127,127,.22)) 72%,transparent);",
			"box-shadow:0 26px 84px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);",
			"opacity:0;transform:translateY(10px) scale(.97);",
			"transition:opacity .5s cubic-bezier(.22,.61,.36,1),transform .5s cubic-bezier(.22,.61,.36,1)}",
			".dra-root.dra-in .dra-card{opacity:1;transform:none}",
			// --- brand mark ------------------------------------------------------
			".dra-logo{display:block;width:112px;height:112px;object-fit:contain;",
			"filter:drop-shadow(0 10px 26px rgba(0,0,0,.45)) drop-shadow(0 2px 7px rgba(0,0,0,.3))}",
			// --- progress bar ----------------------------------------------------
			".dra-bar{width:216px;height:3px;border-radius:999px;overflow:hidden;",
			"background:var(--dsw-alias-border-l1,rgba(127,127,127,.28))}",
			".dra-bar-fill{width:0;height:100%;border-radius:999px;background:var(--dsw-alias-brand-primary,#4d6bfe)}",
			// --- skip hint -------------------------------------------------------
			".dra-hint{position:absolute;left:50%;bottom:36px;transform:translateX(-50%);",
			"font:400 12px/1.4 ui-sans-serif,system-ui,-apple-system,'Microsoft YaHei',sans-serif;",
			"color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.9));letter-spacing:.02em;",
			"opacity:0;transition:opacity .4s ease}",
			".dra-hint.dra-show{opacity:1}",
			// --- sidebar recharge button -----------------------------------------
			".dra-btn{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 10px;border:0;border-radius:10px;",
			"background:transparent;color:var(--dsw-alias-label-secondary,rgba(127,127,127,.95));cursor:pointer;",
			"font:400 13px/1 ui-sans-serif,system-ui,-apple-system,'Microsoft YaHei',sans-serif;",
			"transition:background .16s ease,color .16s ease}",
			".dra-btn:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#e6e6e6) 9%,transparent);",
			"color:var(--dsw-alias-label-primary,#e6e6e6)}",
			".dra-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:2px}",
			".dra-btn-ico{width:16px;height:16px;flex:none}",
			".dra-btn-label{white-space:nowrap}",
			".dra-btn-compact .dra-btn-label{display:none}",
			// --- native platform viewport ----------------------------------------
			".dra-plat{position:fixed;left:0;right:0;bottom:0;z-index:2147483001;display:flex;flex-direction:column;",
			"background:var(--dsw-alias-bg-base,#0e0e12)}",
			".dra-plat-bar{display:flex;align-items:center;gap:10px;height:44px;padding:0 12px;flex:none;",
			"-webkit-app-region:drag;border-bottom:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));",
			"background:var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#0e0e12))}",
			".dra-plat-back{-webkit-app-region:no-drag;display:inline-flex;align-items:center;gap:6px;",
			"height:28px;padding:0 10px;border:0;border-radius:8px;background:transparent;cursor:pointer;",
			"color:var(--dsw-alias-label-secondary,rgba(127,127,127,.95));",
			"font:400 13px/1 ui-sans-serif,system-ui,-apple-system,'Microsoft YaHei',sans-serif;",
			"transition:background .16s ease,color .16s ease}",
			".dra-plat-back:hover{background:color-mix(in srgb,var(--dsw-alias-label-primary,#e6e6e6) 9%,transparent);",
			"color:var(--dsw-alias-label-primary,#e6e6e6)}",
			".dra-plat-back:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:2px}",
			".dra-plat-state{font:400 12px/1 ui-sans-serif,system-ui,-apple-system,'Microsoft YaHei',sans-serif;",
			"color:var(--dsw-alias-label-tertiary,rgba(127,127,127,.9))}",
			".dra-plat-view{flex:1;position:relative;min-height:0}"
		].join("");

		/**
		 * The settings panel. It deliberately does not follow the shell's --dsw-*
		 * tokens: the palette is the deep-blue one the whale widget uses, so the
		 * panel looks the same in the light and the dark shell.
		 */
		var PANEL_CSS = [
			".drp-mask{position:fixed;inset:0;z-index:2147483002;display:flex;justify-content:flex-end;",
			"background:rgba(12,18,40,.34);",
			"font:400 13px/1.5 ui-sans-serif,system-ui,-apple-system,'Microsoft YaHei',sans-serif;color:#203170}",
			".drp{width:404px;max-width:94vw;height:100%;display:flex;flex-direction:column;",
			"background:#f6f8fd;border-left:1px solid #dbe4f5;box-shadow:-18px 0 48px rgba(20,32,80,.24)}",
			".drp-head{display:flex;align-items:center;gap:10px;flex:none;padding:13px 16px;border-bottom:1px solid #dbe4f5;background:#fff}",
			".drp-title{flex:1;font-weight:600;font-size:14px;color:#203170}",
			".drp-x{width:26px;height:26px;border:0;border-radius:8px;background:transparent;color:#536ba9;cursor:pointer;font-size:16px;line-height:1}",
			".drp-x:hover{background:#eef2fb;color:#203170}",
			".drp-body{flex:1;overflow:auto;padding:12px 14px 16px}",
			".drp-sec{margin:0 0 12px;border:1px solid #dbe4f5;border-radius:12px;background:#fff;overflow:hidden}",
			".drp-sec-h{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#eef2fb;border-bottom:1px solid #dbe4f5;",
			"font-weight:600;font-size:12.5px;color:#2f4488}",
			".drp-sec-h .drp-hint{flex:1;font-weight:400;font-size:11.5px;color:#536ba9;text-align:right}",
			".drp-sec-b{display:flex;flex-direction:column;gap:9px;padding:10px 12px}",
			".drp-fld{display:flex;align-items:center;gap:8px}",
			".drp-l{flex:none;width:74px;font-size:12.5px;color:#536ba9}",
			".drp-in,.drp-sel{flex:1;min-width:0;height:30px;padding:0 9px;border:1px solid #dbe4f5;border-radius:8px;",
			"background:#fff;color:#203170;font:inherit;font-size:12.5px;outline:none}",
			".drp-in:focus,.drp-sel:focus{border-color:#2f4488;box-shadow:0 0 0 2px rgba(47,68,136,.18)}",
			".drp-in:disabled,.drp-sel:disabled{background:#f3f5fb;color:#9fb0d9}",
			".drp-ck{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#2f4488;cursor:pointer}",
			".drp-btn{height:30px;padding:0 12px;border:1px solid #203170;border-radius:8px;background:#203170;color:#fff;",
			"cursor:pointer;font:inherit;font-size:12.5px;font-weight:500;white-space:nowrap}",
			".drp-btn:hover{background:#2f4488;border-color:#2f4488}",
			".drp-btn:disabled{opacity:.45;cursor:not-allowed}",
			".drp-btn.ghost{background:#fff;color:#2f4488;border-color:#9fb0d9}",
			".drp-btn.ghost:hover{background:#eef2fb}",
			".drp-btn.danger{background:#fff;color:#e0433f;border-color:#e0433f}",
			".drp-btn.danger:hover{background:#fdf1f0}",
			".drp-btn.mini{height:24px;padding:0 8px;font-size:11.5px}",
			".drp-range{flex:1;min-width:0;accent-color:#203170}",
			".drp-v{flex:none;width:34px;text-align:right;font-size:12px;color:#536ba9}",
			".drp-drop{border:1.5px dashed #9fb0d9;border-radius:10px;padding:9px;text-align:center;",
			"color:#536ba9;font-size:12px;background:#fbfcff}",
			".drp-drop.on{border-color:#203170;background:#eef2fb;color:#203170}",
			".drp-grid{display:flex;flex-wrap:wrap;gap:8px}",
			".drp-ico{position:relative;width:60px;height:60px;padding:4px;border:1px solid #dbe4f5;border-radius:10px;",
			"background:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}",
			".drp-ico:hover{border-color:#9fb0d9}",
			".drp-ico.on{border-color:#203170;box-shadow:0 0 0 2px rgba(32,49,112,.18)}",
			".drp-ico img{max-width:100%;max-height:100%;object-fit:contain;display:block}",
			".drp-ico-x{position:absolute;top:-7px;right:-7px;width:18px;height:18px;border:1px solid #dbe4f5;border-radius:50%;",
			"background:#fff;color:#e0433f;cursor:pointer;font-size:11px;line-height:1;padding:0}",
			".drp-ico-x:hover{background:#fdf1f0}",
			".drp-list{display:flex;flex-direction:column;gap:6px}",
			".drp-item{display:flex;align-items:center;gap:8px;padding:5px 7px;border:1px solid #e8ecf7;border-radius:8px;",
			"background:#fbfcff;font-size:12px}",
			".drp-item-n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".drp-item-s{flex:none;color:#536ba9;font-size:11.5px}",
			".drp-item-t{flex:none;padding:0 5px;border-radius:6px;background:#eef2fb;color:#2f4488;font-size:11px}",
			".drp-pv{display:flex;flex-wrap:wrap;gap:6px}",
			".drp-pv-i{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid #dbe4f5;border-radius:999px;",
			"background:#fff;cursor:pointer;font-size:12px;color:#2f4488}",
			".drp-pv-i.on{background:#203170;border-color:#203170;color:#fff}",
			".drp-err{margin:0 0 10px;padding:8px 10px;border:1px solid #e0433f;border-radius:8px;background:#fdf1f0;",
			"color:#c0392b;font-size:12px;word-break:break-word}",
			".drp-ok{margin:0 0 10px;padding:8px 10px;border:1px solid #2fa24c;border-radius:8px;background:#f1faf3;",
			"color:#2fa24c;font-size:12px}",
			".drp-note{color:#536ba9;font-size:11.5px;line-height:1.45}",
			".drp-mute{display:flex;align-items:center;gap:9px;margin:0 0 12px;padding:10px 12px;border:1px solid #dbe4f5;",
			"border-radius:12px;background:#fff;font-size:12.5px;font-weight:500;color:#2f4488}",
			".drp-mute input{accent-color:#203170}",
			".drp-foot{display:flex;gap:8px;flex:none;padding:11px 14px;border-top:1px solid #dbe4f5;background:#fff}",
			".drp-foot .drp-btn{flex:1;height:34px;font-size:13px}",
			".drp-veil{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;",
			"background:rgba(246,248,253,.72);color:#2f4488;font-size:13px;border-radius:12px;z-index:2}",
			".drp-rel{position:relative}",
			".drp-flex{flex:1;min-width:0;display:flex;gap:8px}",
			".drp-rowbtns{display:flex;gap:6px;flex:none}",
			".drp-slot{display:flex;flex-direction:column;gap:6px;padding-bottom:7px;border-bottom:1px dashed #e8ecf7}",
			".drp-preview{width:26px;height:26px;border:1px solid #dbe4f5;border-radius:6px;background:#fff;",
			"display:flex;align-items:center;justify-content:center;flex:none}",
			".drp-preview img{max-width:100%;max-height:100%;object-fit:contain;display:block}"
		].join("");

		/** Same-origin routes owned by the Host half. */
		var ROUTE_ASSETS = "/recharge-animation/assets";
		var ROUTE_IMPORT = "/recharge-animation/import-url";

		// --- native platform requests -----------------------------------------
		// The stage finishes in one seat and the native viewport lives in another, so
		// the hand-over travels over its own tiny emitter.

		var platformRequesters = [];

		/** @returns an unsubscribe function. */
		function onPlatformRequest(fn) {
			platformRequesters.push(fn);
			return function () {
				var at = platformRequesters.indexOf(fn);
				if (at >= 0) platformRequesters.splice(at, 1);
			};
		}

		/**
		 * Ask for the top-up hand-over. The platform host claims the native view when
		 * the Desktop bridge exists, and opens a plain window when it does not.
		 * @param stage - "preload" warms the view off-screen; anything else reveals it.
		 */
		function requestPlatform(stage) {
			var copy = platformRequesters.slice();
			for (var i = 0; i < copy.length; i++) {
				try { copy[i](platformTop, stage); } catch (error) { /* listener is gone */ }
			}
			if (copy.length === 0 && stage !== "preload") openTopUpPage();
		}

		/**
		 * Install the overlay stylesheet once and keep it installed. A packed client
		 * bundle has no `styles.insert`, so the sheet is owned directly, and the
		 * fiber teardown that removes it is compensated by the wrapping effect.
		 * @returns the style element.
		 */
		function ensureStyle() {
			var tag = document.querySelector('style[data-plugin="dsh-recharge-animation"]');
			if (tag === null) {
				tag = document.createElement("style");
				tag.setAttribute("data-plugin", "dsh-recharge-animation");
				document.head.appendChild(tag);
			}
			var sheet = CSS + PANEL_CSS;
			if (tag.textContent !== sheet) tag.textContent = sheet;
			return tag;
		}

		/**
		 * Clamp a possibly non-numeric option into a usable range.
		 */
		function clamp(value, low, high) {
			var n = typeof value === "number" ? value : Number(value);
			if (!isFinite(n)) return low;
			if (n < low) return low;
			if (n > high) return high;
			return n;
		}

		// --- play requests ----------------------------------------------------
		// The button lives in one seat and the stage in another, so the two sides
		// talk over a tiny local emitter instead of lifting state into the frame.

		var requesters = [];

		/** @returns an unsubscribe function. */
		function onPlayRequest(fn) {
			requesters.push(fn);
			return function () {
				var at = requesters.indexOf(fn);
				if (at >= 0) requesters.splice(at, 1);
			};
		}

		/** Ask the stage to run one show. */
		function requestPlay() {
			var copy = requesters.slice();
			for (var i = 0; i < copy.length; i++) {
				try { copy[i](); } catch (error) { /* a dead listener must not block */ }
			}
		}

		// --- handing over to the official top-up page -------------------------
		// DSH's own account page links to this URL with a plain
		// `<a href={topUpUrl} target="_blank" rel="noreferrer">`, and only prefers an
		// in-app platform view when that private surface happens to exist. A packed
		// third-party bundle cannot reach that view, so it opens the same URL the
		// same way the shipped button falls back to.

		/**
		 * Open the official DeepSeek top-up page in a new window.
		 * @returns true when something was actually invoked.
		 */
		function openTopUpPage() {
			try {
				var opened = window.open(TOPUP_URL, "_blank", "noopener,noreferrer");
				if (opened) return true;
			} catch (error) { /* popup blocked; fall through to the anchor */ }
			try {
				var anchor = document.createElement("a");
				anchor.href = TOPUP_URL;
				anchor.target = "_blank";
				anchor.rel = "noreferrer";
				anchor.style.display = "none";
				document.body.appendChild(anchor);
				anchor.click();
				anchor.remove();
				return true;
			} catch (error) {
				return false;
			}
		}

		// --- configuration store ----------------------------------------------
		// The Host half owns the file; the panel and the show both read one cached
		// copy of it. Every write goes back through the Host, which is the only
		// authority on what is actually stored.

		var DEFAULT_CONFIG = {
			version: 1,
			muted: false,
			labels: { button: "充值", skipHint: "点击跳过" },
			behavior: { duration: 1800, minDuration: 1100, skippable: true, progressMode: "real", openTopUp: true, platformTop: PLATFORM_TOP },
			assets: { icons: [], audio: [] },
			presets: [{ id: "p-default", name: "默认", iconId: null, slots: { intro: null, bgm: null, outro: null }, volumes: { intro: 100, bgm: 60, outro: 100 } }],
			activePresetId: "p-default"
		};

		var DEFAULT_STATE = {
			ok: false,
			enabled: true,
			config: DEFAULT_CONFIG,
			limits: { icon: 4 * 1024 * 1024, audio: 8 * 1024 * 1024 },
			formats: { icon: "png / jpg / webp / gif", audio: "mp3 / wav / ogg / m4a" },
			labelMax: { button: 24, skipHint: 40 },
			presetNameMax: 24,
			assetNameMax: 80
		};

		var store = { state: DEFAULT_STATE, listeners: [], loaded: false, inflight: null };

		/** Deep copy through JSON: every value in a config is JSON-safe. */
		function clone(value) { return JSON.parse(JSON.stringify(value)); }

		function notifyStore() {
			var copy = store.listeners.slice();
			for (var i = 0; i < copy.length; i++) {
				try { copy[i](store.state); } catch (error) { /* a dead listener */ }
			}
		}

		function subscribeStore(fn) {
			store.listeners.push(fn);
			return function () {
				var at = store.listeners.indexOf(fn);
				if (at >= 0) store.listeners.splice(at, 1);
			};
		}

		function setStore(next) {
			store.state = next;
			notifyStore();
		}

		/**
		 * Normalise whatever the Host answered. Both shapes are accepted: the 0.2
		 * payload ({ ok, enabled, config, limits }) and the flat 0.1.x object, so a
		 * profile that still has the old Host half loaded keeps working.
		 * @returns the state, or null when the answer is unusable.
		 */
		function resolveState(json) {
			if (!json || typeof json !== "object") return null;
			var next = clone(DEFAULT_STATE);
			next.ok = true;
			next.enabled = json.enabled !== false;
			if (json.config && typeof json.config === "object") {
				next.config = json.config;
				if (json.limits && typeof json.limits === "object") next.limits = json.limits;
				if (json.formats && typeof json.formats === "object") next.formats = json.formats;
				if (json.labelMax && typeof json.labelMax === "object") next.labelMax = json.labelMax;
				if (isFinite(Number(json.presetNameMax))) next.presetNameMax = Number(json.presetNameMax);
				if (isFinite(Number(json.assetNameMax))) next.assetNameMax = Number(json.assetNameMax);
				return next;
			}
			var behavior = next.config.behavior;
			if (isFinite(Number(json.duration))) behavior.duration = clamp(Number(json.duration), 600, 8000);
			if (isFinite(Number(json.minDuration))) behavior.minDuration = clamp(Number(json.minDuration), 0, behavior.duration);
			if (typeof json.skippable === "boolean") behavior.skippable = json.skippable;
			if (json.progressMode === "fixed") behavior.progressMode = "fixed";
			if (typeof json.openTopUp === "boolean") behavior.openTopUp = json.openTopUp;
			if (isFinite(Number(json.platformTop))) behavior.platformTop = clamp(Number(json.platformTop), 0, 320);
			return next;
		}

		/**
		 * One JSON round-trip against the Host half. It never rejects: a null answer
		 * means the route did not answer in time, and callers decide what that means.
		 * @param url - same-origin route.
		 * @param options - fetch options.
		 * @param timeoutMs - give up after this long.
		 * @returns a promise for { status, ok, body }, for { failure: "timeout" | "network" }
		 *          when the request never reached the Host half, or null when the answer
		 *          carried no usable payload.
		 */
		function requestJson(url, options, timeoutMs) {
			var settled = false;
			return new Promise(function (resolve) {
				var done = function (value) {
					if (settled) return;
					settled = true;
					resolve(value);
				};
				var timer = setTimeout(function () { done({ failure: "timeout" }); }, timeoutMs || 10000);
				var pending;
				try {
					pending = fetch(url, options);
				} catch (error) {
					clearTimeout(timer);
					done({ failure: "network" });
					return;
				}
				if (!pending || typeof pending.then !== "function") {
					clearTimeout(timer);
					done({ failure: "network" });
					return;
				}
				pending.then(function (response) {
					if (!response) return null;
					var meta = { status: response.status, ok: response.ok === true, body: null };
					if (typeof response.json !== "function") return meta;
					return response.json().then(function (body) {
						meta.body = body;
						return meta;
					}, function () { return meta; });
				}).then(function (result) {
					clearTimeout(timer);
					done(result);
				}, function () {
					clearTimeout(timer);
					done({ failure: "network" });
				});
			});
		}

		/**
		 * Read the configuration once and cache it. Concurrent callers share a single
		 * request; a failure resolves with null and leaves the cache untouched.
		 * @param force - refresh even when a copy is already cached.
		 */
		function loadState(force) {
			if (store.loaded && !force) return Promise.resolve(store.state);
			if (store.inflight !== null) return store.inflight;
			// Short fuse: the show starts on defaults rather than waiting for this.
			store.inflight = requestJson(CONFIG_URL, { cache: "no-store" }, 1500).then(function (result) {
				store.inflight = null;
				if (!result || result.failure || result.body === null || result.body === undefined) return null;
				var next = resolveState(result.body);
				if (next === null) return null;
				store.loaded = true;
				setStore(next);
				return next;
			});
			return store.inflight;
		}

		/**
		 * Read this package's configuration from its Host half. Resolves with null
		 * rather than rejecting: an unreachable route must never hold up the show.
		 * @param cb - receives the resolved state or null.
		 */
		function requestConfig(cb) {
			loadState(false).then(function (state) {
				cb(state === undefined ? null : state);
			}, function () { cb(null); });
		}

		/** Human-readable failure text straight from the Host half. */
		function messageOf(result, fallback) {
			if (result && result.body && typeof result.body.error === "string" && result.body.error !== "") return result.body.error;
			if (result && result.status) return fallback + "（HTTP " + result.status + "）";
			return fallback;
		}

		/** One sentence for a request that never reached the Host half. */
		function unreachable(result) {
			return result && result.failure === "timeout"
				? "插件后台响应超时（Host 未响应）"
				: "无法连接插件后台（Host 未响应）";
		}

		/** Take the state out of a Host answer, refreshing the cache when it fits. */
		function adopt(result, fallback) {
			if (result === null || (result && result.failure)) return { error: unreachable(result) };
			if (result.ok && result.body) {
				var next = resolveState(result.body);
				if (next !== null) {
					store.loaded = true;
					setStore(next);
					return { state: next };
				}
			}
			return { error: messageOf(result, fallback) };
		}

		/** Persist the whole configuration. */
		function apiSave(config) {
			return requestJson(CONFIG_URL, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ config: config })
			}, 20000).then(function (result) { return adopt(result, "保存失败"); });
		}

		/** Upload one file straight from a File/Blob: no base64 on the wire. */
		function apiUpload(kind, file) {
			var name = encodeURIComponent(file && file.name ? file.name : "asset");
			var url = ROUTE_ASSETS + "?kind=" + kind + "&name=" + name;
			var type = file && file.type ? file.type : "application/octet-stream";
			return requestJson(url, {
				method: "POST",
				headers: { "Content-Type": type },
				body: file
			}, 60000).then(function (result) { return adopt(result, "上传失败"); });
		}

		/** Drop one stored asset, and with it every reference to it. */
		function apiDelete(kind, id) {
			var url = ROUTE_ASSETS + "?kind=" + kind + "&id=" + encodeURIComponent(id);
			return requestJson(url, { method: "DELETE" }, 10000).then(function (result) { return adopt(result, "删除失败"); });
		}

		/** Let the Host half fetch a remote file: the browser cannot, thanks to CORS. */
		function apiImport(kind, url) {
			return requestJson(ROUTE_IMPORT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ kind: kind, url: url })
			}, 30000).then(function (result) { return adopt(result, "拉取失败"); });
		}

		/** The preset a configuration is currently pointed at. */
		function presetOf(config) {
			var list = config.presets && config.presets.length > 0 ? config.presets : DEFAULT_CONFIG.presets;
			for (var i = 0; i < list.length; i++) {
				if (list[i].id === config.activePresetId) return list[i];
			}
			return list[0];
		}

		/** The preset both the panel and the show work from. */
		function activePreset(state) { return presetOf(state.config); }

		function findAssetInConfig(config, kind, id) {
			if (!id || !config) return null;
			var list = kind === "audio" ? config.assets.audio : config.assets.icons;
			for (var i = 0; i < list.length; i++) {
				if (list[i].id === id) return list[i];
			}
			return null;
		}

		function findAsset(state, kind, id) { return findAssetInConfig(state.config, kind, id); }

		/**
		 * Absolute URL for one stored asset. Routine answers carry it already; an
		 * entry without one is simply not renderable, which is safer than guessing a
		 * route the Host half might not serve.
		 */
		function assetUrl(entry) {
			if (!entry || !entry.id || !entry.url) return "";
			return entry.url;
		}

		/** Byte counts a person can read. */
		function formatBytes(bytes) {
			var n = Number(bytes);
			if (!isFinite(n) || n < 0) return "?";
			if (n < 1024) return n + " B";
			if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
			return (n / 1024 / 1024).toFixed(2) + " MB";
		}

		// --- settings panel requests ------------------------------------------
		// The button lives in the sidebar seat and the panel in the overlay seat.

		var panelRequesters = [];

		/** @returns an unsubscribe function. */
		function onPanelRequest(fn) {
			panelRequesters.push(fn);
			return function () {
				var at = panelRequesters.indexOf(fn);
				if (at >= 0) panelRequesters.splice(at, 1);
			};
		}

		function requestPanel(open) {
			var copy = panelRequesters.slice();
			for (var i = 0; i < copy.length; i++) {
				try { copy[i](open); } catch (error) { /* a dead listener */ }
			}
		}

		/**
		 * Show the settings panel. A native Platform view always paints above DOM, so
		 * it has to be handed back before the panel can be seen at all.
		 */
		function openSettings() {
			if (PLATFORM_BRIDGE !== null) requestPlatform("close");
			requestPanel(true);
		}

		// --- soundtrack -------------------------------------------------------
		/**
		 * One show's audio. Every node is tracked so the release path can stop it: a
		 * looped track outliving the curtain is the bug this exists to prevent.
		 */
		function makeSoundtrack() {
			var players = [];
			var timers = [];

			/**
			 * @param entry - a stored audio asset.
			 * @param volume - 0..100.
			 * @param loop - repeat until released.
			 */
			var play = function (entry, volume, loop) {
				if (!entry || !entry.id) return null;
				var node;
				try {
					node = new Audio(assetUrl(entry));
				} catch (error) {
					return null;
				}
				node.loop = !!loop;
				var level = clamp(volume, 0, 100) / 100;
				node.volume = level;
				try {
					var started = node.play();
					if (started && typeof started.catch === "function") started.catch(function () { /* autoplay refused */ });
				} catch (error) { /* no audio in this shell */ }
				players.push({ node: node, level: level });
				return node;
			};

			var stop = function (node) {
				if (!node) return;
				try {
					node.pause();
					node.currentTime = 0;
				} catch (error) { /* already gone */ }
			};

			/** Slide a track down to silence, then stop it. */
			var fade = function (node, ms) {
				if (!node) return;
				var steps = 12;
				var at = 0;
				var id = setInterval(function () {
					at += 1;
					try { node.volume = Math.max(0, node.volume * (1 - 1 / (steps - at + 1))); } catch (error) { /* gone */ }
					if (at >= steps) {
						clearInterval(id);
						stop(node);
					}
				}, Math.max(16, (ms || 400) / steps));
				timers.push(id);
			};

			/**
			 * Stop every node. Non-looped nodes are kept when `keepTail` is set, so a
			 * closing clip may finish; a looping track is never left running.
			 */
			var release = function (keepTail) {
				for (var j = 0; j < players.length; j++) {
					var player = players[j];
					if (keepTail === true && player.node.loop !== true) continue;
					stop(player.node);
				}
				players.length = 0;
				for (var i = 0; i < timers.length; i++) clearInterval(timers[i]);
				timers.length = 0;
			};

			return { play: play, fade: fade, stop: stop, release: release };
		}

		/**
		 * Subscribe a component to the cached configuration. It also kicks off the
		 * first read, so a shell that never plays a show still shows real labels.
		 */
		function useStore() {
			var pair = React.useState(store.state);
			var state = pair[0];
			var setState = pair[1];
			React.useEffect(function () {
				if (store.loaded !== true) loadState(false);
				return subscribeStore(setState);
			}, []);
			return state;
		}

		/** Wallet glyph for the sidebar entry. */
		function WalletIcon() {
			return React.createElement("svg", {
				className: "dra-btn-ico", viewBox: "0 0 24 24", fill: "none",
				stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round",
				strokeLinejoin: "round", "aria-hidden": "true"
			},
				React.createElement("rect", { x: 2.5, y: 5.5, width: 19, height: 13.5, rx: 3.2 }),
				React.createElement("path", { d: "M2.5 10.2h19" }),
				React.createElement("path", { d: "M16.6 14.6h2.1" })
			);
		}

		/**
		 * The sidebar entry: left click queues a show, right click opens the panel.
		 * @param props - seat owner props; `wide` collapses the label.
		 */
		function RechargeButton(props) {
			var wide = !props || props.wide !== false;
			var state = useStore();
			var label = state.config.labels.button || "充值";
			return React.createElement("button", {
				type: "button",
				className: "dra-btn" + (wide ? "" : " dra-btn-compact"),
				title: label + "（左键播放动画，右键设置）",
				"aria-label": label,
				onClick: function () {
					// Warm the native view while the glass still plays, so the hand-over
					// lands on a loaded page instead of a blank one. Decide from the store,
					// not from a module-level flag: before the first load the store already
					// carries the default (open), and afterwards it holds what the user
					// actually saved. A module-level flag went stale and warmed the view
					// even with "open after" switched off.
					if (state.config.behavior.openTopUp !== false) requestPlatform("preload");
					requestPlay();
				},
				onContextMenu: function (event) {
					event.preventDefault();
					event.stopPropagation();
					openSettings();
				}
			},
				React.createElement(WalletIcon, null),
				React.createElement("span", { className: "dra-btn-label" }, label)
			);
		}

		/**
		 * Residency for the stage. It renders nothing until a show is requested, and
		 * a fresh stage is mounted per run so its effect starts from a clean slate.
		 */
		function RechargeStage() {
			var state = React.useState(0);
			var run = state[0];
			var setRun = state[1];

			React.useEffect(function () {
				return onPlayRequest(function () {
					setRun(function (n) { return n + 1; });
				});
			}, []);

			if (run === 0) return null;
			return React.createElement(Show, { key: run });
		}

		/**
		 * One showing of the glass curtain: brand mark, progress bar, skip hint.
		 * @returns the curtain element, or null once it has left the stage.
		 */
		function Show() {
			var state = React.useState(false);
			var done = state[0];
			var setDone = state[1];
			var rootRef = React.useRef(null);
			var fillRef = React.useRef(null);
			var hintRef = React.useRef(null);

			// Values for this render pass. The effect below takes its own snapshot, so a
			// save made while the curtain is up cannot rewrite the run already playing.
			var live = useStore();
			var livePreset = activePreset(live);
			var iconUrl = assetUrl(findAsset(live, "icon", livePreset.iconId)) || LOGO;
			// A blank value is deliberate: the field means "text shown inside the
			// animation", so empty means show nothing at all.
			var skipHint = live.config.labels.skipHint || "";

			React.useEffect(function () {
				var root = rootRef.current;
				var fill = fillRef.current;
				var hint = hintRef.current;
				if (root === null || fill === null) {
					setDone(true);
					return undefined;
				}

				// Snapshot: this run plays the configuration as it stood when the curtain
				// went up, so a save made mid-show cannot rewrite a running animation.
				// window.__DSH_RECHARGE_ANIMATION__ stays supported as a flat override
				// for the preview harness and for hand-testing.
				var snapshot = clone(store.state.config);
				var override = window.__DSH_RECHARGE_ANIMATION__;
				if (override && typeof override === "object") {
					for (var p in override) {
						if (p === "muted") snapshot.muted = override.muted === true;
						else if (p === "enabled") snapshot.enabled = override.enabled;
						else snapshot.behavior[p] = override[p];
					}
				}
				var behavior = snapshot.behavior;
				var preset = activePreset({ config: snapshot });
				var slots = preset.slots || {};
				var volumes = preset.volumes || {};
				var muted = snapshot.muted === true;
				var sound = makeSoundtrack();
				var bgm = null;

				var maxDur = clamp(behavior.duration, 600, 8000);
				var minDur = clamp(behavior.minDuration, 0, maxDur);
				var skippable = behavior.skippable !== false;
				var real = behavior.progressMode !== "fixed";
				var openTopUp = behavior.openTopUp !== false;
				platformTop = clamp(behavior.platformTop, 0, 320);

				var target = 8;
				var shown = 0;
				var startTs = performance.now();
				var rafId = 0;
				var settled = false;
				var timers = [];
				var disposers = [];
				var pendingSignals = 4;

				var later = function (fn, ms) {
					var id = setTimeout(fn, ms);
					timers.push(id);
					return id;
				};

				var mark = function (value) {
					if (value > target) target = value;
				};

				// --- soundtrack ------------------------------------------------------
				// The Host half stores the audio; the preset only points at it. An
				// unknown or missing id simply plays nothing.
				var entryIntro = findAsset(store.state, "audio", slots.intro);
				var entryBgm = findAsset(store.state, "audio", slots.bgm);
				var entryOutro = findAsset(store.state, "audio", slots.outro);
				if (!muted) sound.play(entryIntro, volumes.intro, false);

				var release = function () {
					if (rafId !== 0) {
						cancelAnimationFrame(rafId);
						rafId = 0;
					}
					for (var i = 0; i < timers.length; i++) clearTimeout(timers[i]);
					timers.length = 0;
					for (var j = 0; j < disposers.length; j++) {
						try { disposers[j](); } catch (error) { /* already gone */ }
					}
					disposers.length = 0;
				};

				var detach = function () {
					root.removeEventListener("click", skip);
					window.removeEventListener("keydown", onKey, true);
				};

				var finish = function () {
					if (settled) return;
					settled = true;
					release();
					detach();
					shown = 100;
					fill.style.width = "100%";
					// The tail: the loop slides away while the closing clip comes in. A
					// muted run has nothing to fade, so the whole soundtrack is dropped.
					if (muted) {
						sound.release(false);
					} else {
						if (bgm !== null) sound.fade(bgm, 400);
						if (entryOutro) sound.play(entryOutro, volumes.outro, false);
					}
					// Hand over to the top-up page while the glass still covers the frame,
					// so the reveal lands on the payment form.
					if (openTopUp) requestPlatform("reveal");
					later(function () {
						root.classList.remove("dra-in");
						root.classList.add("dra-out");
						later(function () { setDone(true); }, 320);
					}, 130);
				};

				var skip = function () {
					if (skippable) finish();
				};

				var onKey = function (event) {
					var name = event.key;
					if (name === "Escape" || name === " " || name === "Spacebar" || name === "Enter") skip();
				};

				/** One of the four observable signals has landed. */
				var signal = function () {
					pendingSignals -= 1;
					if (pendingSignals <= 0) mark(READY);
				};

				var applyRemote = function (next) {
					if (!next || typeof next !== "object") return;
					if (next.enabled === false) {
						finish();
						return;
					}
					var remote = next.config.behavior;
					var dur = Number(remote.duration);
					var min = Number(remote.minDuration);
					if (isFinite(dur)) maxDur = clamp(dur, 600, 8000);
					if (isFinite(min)) minDur = clamp(min, 0, maxDur);
					if (typeof remote.skippable === "boolean") skippable = remote.skippable;
					if (remote.progressMode === "fixed") real = false;
					if (typeof remote.openTopUp === "boolean") {
						openTopUp = remote.openTopUp;
					}
					if (isFinite(Number(remote.platformTop))) platformTop = clamp(remote.platformTop, 0, 320);
					if (next.config.muted === true) muted = true;
				};

				// --- real progress signals -----------------------------------------
				requestConfig(function (json) {
					applyRemote(json);
					if (!real) { mark(32); pendingSignals -= 1; return; }
					mark(32);
					signal();
				});

				var logo = root.querySelector("img.dra-logo");
				if (logo && typeof logo.decode === "function") {
					logo.decode().then(function () {
						if (real) { mark(58); signal(); }
					}, function () {
						if (real) { mark(58); signal(); }
					});
				} else if (real) {
					mark(58);
					signal();
				}

				if (real) {
					// The hand-over target is a plain URL the browser already knows, so
					// there is nothing to wait for; this milestone only paces the bar
					// against the window that is about to be opened.
					later(function () { mark(76); signal(); }, 220);

					try {
						if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === "function") {
							document.fonts.ready.then(function () { mark(90); signal(); }, function () { mark(90); signal(); });
							later(function () { mark(90); signal(); }, 1500);
						} else {
							mark(90);
							signal();
						}
					} catch (error) {
						mark(90);
						signal();
					}
				}

				// --- presentation ---------------------------------------------------
				requestAnimationFrame(function () {
					requestAnimationFrame(function () {
						root.classList.add("dra-in");
					});
				});

				// The hint is no longer tied to skippable: the field is literally "text
				// shown inside the animation", so non-empty text always appears. The
				// reveal also has to fit inside the shortest run (600 ms), which a fixed
				// 700 ms delay never did — that is why the text never showed up.
				var hintDelay = Math.min(700, Math.max(140, maxDur * 0.3));
				if (hint !== null && skipHint !== "") {
					later(function () { hint.classList.add("dra-show"); }, hintDelay);
				}

				// Background loop: it starts just after the opening clip so the two do
				// not stack on the same beat.
				if (!muted && entryBgm) {
					later(function () {
						if (settled || muted) return;
						if (bgm === null) bgm = sound.play(entryBgm, volumes.bgm, true);
					}, 220);
				}

				root.addEventListener("click", skip);
				window.addEventListener("keydown", onKey, true);

				var paint = function (pct) {
					fill.style.width = pct.toFixed(2) + "%";
				};

				var tick = function (now) {
					if (settled) return;
					var elapsed = now - startTs;

					if (!real) {
						target = Math.min(READY, (elapsed / Math.max(1, maxDur * 0.72)) * READY);
					}

					// Time pressure: a floor that keeps the bar moving even before the
					// first real signal lands, and a ceiling that ends the show on time.
					var floorPct = Math.min(94, (elapsed / Math.max(1, minDur)) * 94);
					var want = Math.max(target, floorPct);
					if (elapsed >= maxDur || (target >= READY && elapsed >= minDur)) want = 100;

					var step = 1.45;
					var delta = want - shown;
					if (delta > step) delta = step;
					if (delta < 0) delta = 0;
					shown += delta;
					if (shown > 100) shown = 100;
					paint(shown);

					if (want >= 100 && shown >= 99.5) {
						finish();
						return;
					}
					rafId = requestAnimationFrame(tick);
				};

				rafId = requestAnimationFrame(tick);

				return function () {
					release();
					detach();
					// Keep the closing clip: it is not looped, so it ends on its own,
					// while the background loop is stopped here no matter what.
					sound.release(true);
				};
			}, []);

			if (done) return null;
			return React.createElement("div", { className: "dra-root", ref: rootRef },
				React.createElement("div", { className: "dra-card" },
					React.createElement("img", { className: "dra-logo", src: iconUrl, alt: "", draggable: false }),
					React.createElement("div", { className: "dra-bar" },
						React.createElement("div", { className: "dra-bar-fill", ref: fillRef })
					)
				),
				skipHint === "" ? null : React.createElement("div", { className: "dra-hint", ref: hintRef }, skipHint)
			);
		}

		/** A labelled row inside a panel section. */
		function Field(props) {
			return React.createElement("label", { className: "drp-fld" },
				React.createElement("span", { className: "drp-l" }, props.label),
				props.children
			);
		}

		/** One titled group of controls. */
		function Section(props) {
			return React.createElement("div", { className: "drp-sec" },
				React.createElement("div", { className: "drp-sec-h" },
					React.createElement("span", null, props.title),
					props.hint ? React.createElement("span", { className: "drp-hint" }, props.hint) : null
				),
				React.createElement("div", { className: "drp-sec-b" }, props.children)
			);
		}

		/** Which asset kind a drag payload looks like. */
		function kindFromDataTransfer(transfer) {
			var type = "";
			try {
				var items = transfer && transfer.items ? transfer.items : null;
				if (items && items.length > 0 && items[0].type) type = items[0].type;
				if (type === "" && transfer && transfer.files && transfer.files.length > 0 && transfer.files[0].type) {
					type = transfer.files[0].type;
				}
			} catch (error) { /* the payload is not readable this early */ }
			return type.indexOf("audio") === 0 ? "audio" : "icon";
		}

		/** Audio slots, in the order the panel shows them. */
		var AUDIO_SLOTS = [
			{ key: "intro", label: "开场" },
			{ key: "bgm", label: "背景" },
			{ key: "outro", label: "收尾" }
		];

		/** The panel entry: it renders nothing until something asks it to open. */
		function SettingsPanel() {
			var pair = React.useState(false);
			var open = pair[0];
			var setOpen = pair[1];
			React.useEffect(function () {
				return onPanelRequest(function (next) { setOpen(next === true); });
			}, []);
			if (!open) return null;
			return React.createElement(SettingsPanelBody, { onClose: function () { setOpen(false); } });
		}

		/**
		 * The body of the settings panel. Every edit lands on a draft copy and only
		 * 保存 writes it back, so 取消 really cancels.
		 */
		function SettingsPanelBody(props) {
			var state = useStore();
			var draftPair = React.useState(function () { return clone(state.config); });
			var draft = draftPair[0];
			var setDraft = draftPair[1];
			var busyPair = React.useState("");
			var busy = busyPair[0];
			var setBusy = busyPair[1];
			var notePair = React.useState(null);
			var note = notePair[0];
			var setNote = notePair[1];
			var stalePair = React.useState(false);
			var stale = stalePair[0];
			var setStale = stalePair[1];
			var urlPair = React.useState({ icon: false, audio: false });
			var urlOpen = urlPair[0];
			var setUrlOpen = urlPair[1];
			var urlTextPair = React.useState({ icon: "", audio: "" });
			var urlText = urlTextPair[0];
			var setUrlText = urlTextPair[1];
			var dragPair = React.useState(null);
			var dragKind = dragPair[0];
			var setDragKind = dragPair[1];
			var namePair = React.useState("");
			var newName = namePair[0];
			var setNewName = namePair[1];
			var renamePair = React.useState(null);
			var renaming = renamePair[0];
			var setRenaming = renamePair[1];
			var fileRef = React.useRef(null);
			var pickKind = React.useRef("icon");
			var synced = React.useRef(false);

			// Kick off the first read, and mirror the stored configuration into the
			// draft once it has actually arrived.
			React.useEffect(function () {
				if (!store.loaded) loadState(false);
				var id = setTimeout(function () { if (!store.loaded) setStale(true); }, 1600);
				return function () { clearTimeout(id); };
			}, [state.ok]);
			React.useEffect(function () {
				if (!synced.current && state.ok && store.loaded) {
					synced.current = true;
					setDraft(clone(state.config));
				}
			}, [state.ok, state.config]);

			var preset = presetOf(draft);
			var allAssets = [];
			var totalBytes = 0;
			var i;
			for (i = 0; i < draft.assets.icons.length; i++) {
				allAssets.push({ kind: "icon", entry: draft.assets.icons[i] });
				totalBytes += Number(draft.assets.icons[i].bytes) || 0;
			}
			for (i = 0; i < draft.assets.audio.length; i++) {
				allAssets.push({ kind: "audio", entry: draft.assets.audio[i] });
				totalBytes += Number(draft.assets.audio[i].bytes) || 0;
			}

			/** Apply a change to the draft. */
			var edit = function (change) {
				setDraft(function (current) {
					var next = clone(current);
					change(next);
					return next;
				});
			};

			var busyWith = function (token) { setBusy(token); setNote(null); };

			/** Take the fresh asset index (and a first pick) out of a Host answer. */
			var adoptAssets = function (kind, result) {
				var latest = result.state.config.assets;
				edit(function (next) {
					next.assets = clone(latest);
					var list = kind === "icon" ? next.assets.icons : next.assets.audio;
					var added = list.length > 0 ? list[list.length - 1] : null;
					if (added === null) return;
					var current = presetOf(next);
					if (kind === "icon") {
						if (!current.iconId || next.assets.icons.length === 1) current.iconId = added.id;
						return;
					}
					if (!current.slots.intro) current.slots.intro = added.id;
					else if (!current.slots.bgm) current.slots.bgm = added.id;
					else if (!current.slots.outro) current.slots.outro = added.id;
				});
			};

			var save = function () {
				busyWith("save");
				apiSave(draft).then(function (result) {
					setBusy("");
					if (result.error) {
						setNote({ kind: "err", text: result.error });
						return;
					}
					synced.current = true;
					setDraft(clone(result.state.config));
					setNote({ kind: "ok", text: "已保存" });
				});
			};

			var resetDefaults = function () {
				var next = clone(DEFAULT_CONFIG);
				// Stored files are data, not settings: resetting the look must not
				// silently orphan everything the user imported.
				next.assets = clone(draft.assets);
				setDraft(next);
				setNote({ kind: "ok", text: "已恢复默认值（已导入的素材保留），点保存写入" });
			};

			var choose = function (kind) {
				var input = fileRef.current;
				pickKind.current = kind;
				if (input === null) return;
				input.value = "";
				input.accept = kind === "icon"
					? "image/png,image/jpeg,image/webp,image/gif"
					: "audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a,.mp3,.wav,.ogg,.m4a";
				input.click();
			};

			var upload = function (kind, fileList) {
				var files = [];
				var i;
				for (i = 0; i < fileList.length; i++) files.push(fileList[i]);
				if (files.length === 0) return;
				busyWith("upload");
				var done = [];
				var failed = [];
				var chain = Promise.resolve();
				for (i = 0; i < files.length; i++) {
					(function (file) {
						chain = chain.then(function () {
							return apiUpload(kind, file).then(function (result) {
								if (result.error) failed.push(file.name + "：" + result.error);
								else {
									done.push(file.name);
									adoptAssets(kind, result);
								}
							});
						});
					})(files[i]);
				}
				chain.then(function () {
					setBusy("");
					if (failed.length > 0) setNote({ kind: "err", text: failed.join("；") });
					else if (done.length > 0) setNote({ kind: "ok", text: "已导入 " + done.length + " 个文件，点保存写入" });
				});
			};

			var importUrl = function (kind, provided) {
				var url = (provided === undefined ? urlText[kind] : provided) || "";
				url = url.trim();
				if (url === "") {
					setNote({ kind: "err", text: "请先填写链接" });
					return;
				}
				busyWith("url:" + kind);
				apiImport(kind, url).then(function (result) {
					setBusy("");
					if (result.error) {
						setNote({ kind: "err", text: result.error });
						return;
					}
					adoptAssets(kind, result);
					setUrlText(function (current) {
						var next = { icon: current.icon, audio: current.audio };
						next[kind] = "";
						return next;
					});
					setNote({ kind: "ok", text: "已从链接导入，点保存写入" });
				});
			};

			var drop = function (kind, id) {
				busyWith("del:" + id);
				apiDelete(kind, id).then(function (result) {
					setBusy("");
					if (result.error) {
						setNote({ kind: "err", text: result.error });
						return;
					}
					edit(function (next) {
						next.assets = clone(result.state.config.assets);
						for (var p = 0; p < next.presets.length; p++) {
							var item = next.presets[p];
							if (item.iconId === id) item.iconId = null;
							for (var s = 0; s < AUDIO_SLOTS.length; s++) {
								if (item.slots[AUDIO_SLOTS[s].key] === id) item.slots[AUDIO_SLOTS[s].key] = null;
							}
						}
					});
					setNote({ kind: "ok", text: "已删除素材" });
				});
			};

			var previewSlot = function (slot) {
				if (draft.muted === true) {
					setNote({ kind: "err", text: "已全局静音，试听不会发声" });
					return;
				}
				var entry = findAssetInConfig(draft, "audio", preset.slots[slot]);
				if (entry === null) {
					setNote({ kind: "err", text: "这个槽位还没有音效" });
					return;
				}
				try {
					var node = new Audio(assetUrl(entry));
					node.volume = clamp(preset.volumes[slot], 0, 100) / 100;
					var started = node.play();
					if (started && typeof started.catch === "function") started.catch(function () { /* refused */ });
				} catch (error) {
					setNote({ kind: "err", text: "试听失败" });
				}
			};

			var usePreset = function (id) {
				var next = clone(draft);
				next.activePresetId = id;
				busyWith("preset");
				apiSave(next).then(function (result) {
					setBusy("");
					if (result.error) {
						setNote({ kind: "err", text: result.error });
						return;
					}
					synced.current = true;
					setDraft(clone(result.state.config));
					setNote({ kind: "ok", text: "已切换到该预设" });
				});
			};

			var saveAsPreset = function () {
				var name = newName.trim();
				if (name === "") {
					setNote({ kind: "err", text: "请先填写预设名称" });
					return;
				}
				var source = presetOf(draft);
				var item = {
					id: "p-" + Date.now().toString(36),
					name: name.slice(0, state.presetNameMax),
					iconId: source.iconId,
					slots: clone(source.slots),
					volumes: clone(source.volumes)
				};
				edit(function (next) {
					next.presets.push(item);
					next.activePresetId = item.id;
				});
				setNewName("");
				setNote({ kind: "ok", text: "已新建预设「" + item.name + "」，点保存写入" });
			};

			var removePreset = function (id) {
				edit(function (next) {
					var kept = [];
					for (var p = 0; p < next.presets.length; p++) {
						if (next.presets[p].id !== id) kept.push(next.presets[p]);
					}
					next.presets = kept;
					if (next.activePresetId === id && kept.length > 0) next.activePresetId = kept[0].id;
				});
				setNote({ kind: "ok", text: "已删除预设，点保存写入" });
			};

			var commitRename = function () {
				if (renaming === null) return;
				var name = renaming.name.trim();
				if (name === "") {
					setNote({ kind: "err", text: "预设名称不能为空" });
					return;
				}
				var target = renaming.id;
				edit(function (next) {
					for (var p = 0; p < next.presets.length; p++) {
						if (next.presets[p].id === target) next.presets[p].name = name.slice(0, state.presetNameMax);
					}
				});
				setRenaming(null);
				setNote({ kind: "ok", text: "已重命名，点保存写入" });
			};

			var onDragOver = function (event) {
				event.preventDefault();
				event.stopPropagation();
				setDragKind(kindFromDataTransfer(event.dataTransfer));
			};
			var onDragLeave = function (event) {
				event.preventDefault();
				setDragKind(null);
			};
			var onDrop = function (event) {
				event.preventDefault();
				event.stopPropagation();
				setDragKind(null);
				var kind = kindFromDataTransfer(event.dataTransfer);
				var files = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files : null;
				if (files && files.length > 0) {
					upload(kind, files);
					return;
				}
				var text = "";
				try {
					text = event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain") || "";
				} catch (error) { /* nothing readable */ }
				text = text.split("\n")[0].trim();
				if (/^https?:\/\//i.test(text)) importUrl(kind, text);
				else setNote({ kind: "err", text: "拖入的内容既不是文件，也不是 http/https 链接" });
			};

			// --- sections -----------------------------------------------------

			var urlRow = function (kind) {
				if (!urlOpen[kind]) return null;
				return React.createElement("div", { className: "drp-fld" },
					React.createElement("input", {
						className: "drp-in",
						type: "text",
						placeholder: kind === "icon" ? "https://…/logo.png" : "https://…/click.mp3",
						value: urlText[kind],
						onChange: function (event) {
							var value = event.target.value;
							setUrlText(function (current) {
								var next = { icon: current.icon, audio: current.audio };
								next[kind] = value;
								return next;
							});
						}
					}),
					React.createElement("button", {
						className: "drp-btn",
						disabled: busy !== "",
						onClick: function () { importUrl(kind); }
					}, "拉取")
				);
			};

			var iconSection = React.createElement(Section, { title: "图标", hint: "开场中央的大图" },
				React.createElement("div", { className: "drp-rowbtns" },
					React.createElement("button", { className: "drp-btn", disabled: busy !== "", onClick: function () { choose("icon"); } }, "选择文件"),
					React.createElement("button", {
						className: "drp-btn ghost",
						onClick: function () {
							setUrlOpen(function (current) {
								return { icon: !current.icon, audio: current.audio };
							});
						}
					}, "URL 导入")
				),
				urlRow("icon"),
				React.createElement("div", { className: dragKind === "icon" ? "drp-drop on" : "drp-drop" },
					"把 " + state.formats.icon + " 拖到这里（≤ " + formatBytes(state.limits.icon) + "）"
				),
				draft.assets.icons.length === 0
					? React.createElement("div", { className: "drp-note" }, "还没有导入图标，当前使用内置 Logo。")
					: React.createElement("div", { className: "drp-grid" },
						draft.assets.icons.map(function (entry) {
							return React.createElement("div", {
								key: entry.id,
								className: "drp-ico" + (preset.iconId === entry.id ? " on" : ""),
								title: entry.name + " · " + formatBytes(entry.bytes),
								onClick: function () {
									edit(function (next) { presetOf(next).iconId = entry.id; });
								}
							},
								React.createElement("img", { src: assetUrl(entry), alt: entry.name, draggable: false }),
								React.createElement("button", {
									className: "drp-ico-x",
									title: "删除",
									disabled: busy !== "",
									onClick: function (event) {
										event.stopPropagation();
										drop("icon", entry.id);
									}
								}, "×")
							);
						})
					)
			);

			var audioSection = React.createElement(Section, { title: "音效", hint: "开场 / 背景循环 / 收尾" },
				AUDIO_SLOTS.map(function (slot) {
					var options = [React.createElement("option", { key: "", value: "" }, "（无）")];
					for (var a = 0; a < draft.assets.audio.length; a++) {
						var entry = draft.assets.audio[a];
						options.push(React.createElement("option", { key: entry.id, value: entry.id }, entry.name));
					}
					return React.createElement("div", { key: slot.key, className: "drp-slot" },
						React.createElement("div", { className: "drp-fld" },
							React.createElement("span", { className: "drp-l" }, slot.label),
							React.createElement("select", {
								className: "drp-sel",
								value: preset.slots[slot.key] || "",
								onChange: function (event) {
									var value = event.target.value === "" ? null : event.target.value;
									edit(function (next) { presetOf(next).slots[slot.key] = value; });
								}
							}, options),
							React.createElement("button", {
								className: "drp-btn ghost mini",
								disabled: draft.muted === true || !preset.slots[slot.key],
								onClick: function () { previewSlot(slot.key); }
							}, "试听")
						),
						React.createElement("div", { className: "drp-fld" },
							React.createElement("span", { className: "drp-l" }, "音量"),
							React.createElement("input", {
								className: "drp-range",
								type: "range",
								min: 0,
								max: 100,
								value: preset.volumes[slot.key],
								disabled: draft.muted === true,
								onChange: function (event) {
									var value = Number(event.target.value);
									edit(function (next) { presetOf(next).volumes[slot.key] = value; });
								}
							}),
							React.createElement("span", { className: "drp-v" }, String(preset.volumes[slot.key]))
						)
					);
				}),
				React.createElement("div", { className: "drp-rowbtns" },
					React.createElement("button", { className: "drp-btn", disabled: busy !== "", onClick: function () { choose("audio"); } }, "导入音频"),
					React.createElement("button", {
						className: "drp-btn ghost",
						onClick: function () {
							setUrlOpen(function (current) {
								return { icon: current.icon, audio: !current.audio };
							});
						}
					}, "URL 导入")
				),
				urlRow("audio"),
				React.createElement("div", { className: dragKind === "audio" ? "drp-drop on" : "drp-drop" },
					"把 " + state.formats.audio + " 拖到这里（≤ " + formatBytes(state.limits.audio) + "）"
				)
			);

			var labelSection = React.createElement(Section, { title: "文案", hint: "侧栏按钮名与动画内文字" },
				React.createElement(Field, { label: "按钮名" },
					React.createElement("input", {
						className: "drp-in",
						type: "text",
						maxLength: state.labelMax.button,
						value: draft.labels.button,
						onChange: function (event) {
							var value = event.target.value;
							edit(function (next) { next.labels.button = value; });
						}
					})
				),
				React.createElement(Field, { label: "动画内显示文字" },
					React.createElement("input", {
						className: "drp-in",
						type: "text",
						maxLength: state.labelMax.skipHint,
						placeholder: "留空则不显示",
						value: draft.labels.skipHint,
						onChange: function (event) {
							var value = event.target.value;
							edit(function (next) { next.labels.skipHint = value; });
						}
					})
				)
			);

			var rangeRow = function (label, key, min, max, step, suffix) {
				return React.createElement("div", { className: "drp-fld" },
					React.createElement("span", { className: "drp-l" }, label),
					React.createElement("input", {
						className: "drp-range",
						type: "range",
						min: min,
						max: max,
						step: step,
						value: draft.behavior[key],
						onChange: function (event) {
							var value = Number(event.target.value);
							edit(function (next) { next.behavior[key] = value; });
						}
					}),
					React.createElement("span", { className: "drp-v" }, suffix(draft.behavior[key]))
				);
			};

			var behaviorSection = React.createElement(Section, { title: "动画参数", hint: "时长与行为" },
				rangeRow("总时长", "duration", 600, 8000, 100, function (value) { return (value / 1000).toFixed(1) + "s"; }),
				rangeRow("最短时长", "minDuration", 0, 8000, 100, function (value) { return (value / 1000).toFixed(1) + "s"; }),
				rangeRow("顶部偏移", "platformTop", 0, 320, 4, function (value) { return value + "px"; }),
				React.createElement(Field, { label: "进度模式" },
					React.createElement("select", {
						className: "drp-sel",
						value: draft.behavior.progressMode,
						onChange: function (event) {
							var value = event.target.value;
							edit(function (next) { next.behavior.progressMode = value; });
						}
					},
						React.createElement("option", { value: "real" }, "真实信号（推荐）"),
						React.createElement("option", { value: "fixed" }, "固定节奏")
					)
				),
				React.createElement("label", { className: "drp-ck" },
					React.createElement("input", {
						type: "checkbox",
						checked: draft.behavior.skippable !== false,
						onChange: function (event) {
							var value = event.target.checked;
							edit(function (next) { next.behavior.skippable = value; });
						}
					}),
					"允许点击或按键跳过"
				),
				React.createElement("label", { className: "drp-ck" },
					React.createElement("input", {
						type: "checkbox",
						checked: draft.behavior.openTopUp !== false,
						onChange: function (event) {
							var value = event.target.checked;
							edit(function (next) { next.behavior.openTopUp = value; });
						}
					}),
					"动画结束后打开官方充值页"
				),
				React.createElement("div", { className: "drp-note" }, "总开关在插件配置里（enabled）：关闭后侧栏不显示入口。")
			);

			var presetSection = React.createElement(Section, { title: "预设", hint: "图标 + 三个音效 + 音量" },
				React.createElement("div", { className: "drp-pv" },
					draft.presets.map(function (item) {
						return React.createElement("span", {
							key: item.id,
							className: "drp-pv-i" + (item.id === draft.activePresetId ? " on" : ""),
							title: "点击立即使用",
							onClick: function () {
								if (busy === "") usePreset(item.id);
							}
						}, item.name);
					})
				),
				React.createElement("div", { className: "drp-fld" },
					React.createElement("input", {
						className: "drp-in",
						type: "text",
						placeholder: "新预设名称",
						maxLength: state.presetNameMax,
						value: newName,
						onChange: function (event) { setNewName(event.target.value); }
					}),
					React.createElement("button", { className: "drp-btn", disabled: busy !== "", onClick: saveAsPreset }, "另存为")
				),
				React.createElement("div", { className: "drp-list" },
					draft.presets.map(function (item) {
						if (renaming !== null && renaming.id === item.id) {
							return React.createElement("div", { className: "drp-item", key: item.id },
								React.createElement("input", {
									className: "drp-in",
									type: "text",
									maxLength: state.presetNameMax,
									value: renaming.name,
									onChange: function (event) {
										var value = event.target.value;
										setRenaming(function (current) {
											return current === null ? null : { id: current.id, name: value };
										});
									}
								}),
								React.createElement("button", { className: "drp-btn mini", onClick: commitRename }, "确定"),
								React.createElement("button", { className: "drp-btn ghost mini", onClick: function () { setRenaming(null); } }, "取消")
							);
						}
						return React.createElement("div", { className: "drp-item", key: item.id },
							React.createElement("span", { className: "drp-item-n" },
								item.name + (item.id === draft.activePresetId ? "（当前）" : "")
							),
							React.createElement("button", {
								className: "drp-btn ghost mini",
								onClick: function () { setRenaming({ id: item.id, name: item.name }); }
							}, "重命名"),
							React.createElement("button", {
								className: "drp-btn danger mini",
								disabled: draft.presets.length <= 1,
								onClick: function () { removePreset(item.id); }
							}, "删除")
						);
					})
				)
			);

			var assetSection = React.createElement(Section, {
				title: "资源管理",
				hint: allAssets.length + " 项 · " + formatBytes(totalBytes)
			},
				allAssets.length === 0
					? React.createElement("div", { className: "drp-note" }, "还没有导入任何素材。")
					: React.createElement("div", { className: "drp-list" },
						allAssets.map(function (row) {
							return React.createElement("div", { className: "drp-item", key: row.kind + ":" + row.entry.id },
								row.kind === "icon"
									? React.createElement("span", { className: "drp-preview" },
										React.createElement("img", { src: assetUrl(row.entry), alt: "", draggable: false })
									)
									: React.createElement("span", { className: "drp-item-t" }, "音频"),
								React.createElement("span", { className: "drp-item-n" }, row.entry.name),
								React.createElement("span", { className: "drp-item-s" }, formatBytes(row.entry.bytes)),
								React.createElement("button", {
									className: "drp-btn danger mini",
									disabled: busy !== "",
									onClick: function () { drop(row.kind, row.entry.id); }
								}, "删除")
							);
						})
					)
			);

			var notice = null;
			if (note !== null) notice = React.createElement("div", { className: note.kind === "err" ? "drp-err" : "drp-ok" }, note.text);
			else if (stale && !store.loaded) notice = React.createElement("div", { className: "drp-err" }, "读不到插件后台（Host 未响应）：下面显示的是默认值，保存可能失败。");

			return React.createElement("div", {
				className: "drp-mask",
				onMouseDown: function (event) {
					if (event.target === event.currentTarget) props.onClose();
				}
			},
				React.createElement("div", {
					className: "drp",
					onMouseDown: function (event) { event.stopPropagation(); },
					onDragOver: onDragOver,
					onDragLeave: onDragLeave,
					onDrop: onDrop
				},
					React.createElement("div", { className: "drp-head" },
						React.createElement("span", { className: "drp-title" }, "充值动画设置"),
						React.createElement("button", { className: "drp-x", title: "关闭", onClick: props.onClose }, "×")
					),
					React.createElement("div", { className: "drp-body" },
						notice,
						React.createElement("label", { className: "drp-mute" },
							React.createElement("input", {
								type: "checkbox",
								checked: draft.muted === true,
								onChange: function (event) {
									var value = event.target.checked;
									edit(function (next) { next.muted = value; });
								}
							}),
							"全局静音（所有音效都不播放）"
						),
						iconSection,
						audioSection,
						labelSection,
						behaviorSection,
						presetSection,
						assetSection,
						React.createElement("input", {
							ref: fileRef,
							type: "file",
							multiple: true,
							style: { display: "none" },
							onChange: function (event) {
								var files = event.target.files;
								if (files && files.length > 0) upload(pickKind.current, files);
							}
						}),
						React.createElement("div", { className: "drp-note" }, "提示：右键侧栏的充值按钮可以再打开这个面板；保存前一切改动都只在面板里。")
					),
					React.createElement("div", { className: "drp-foot" },
						React.createElement("button", { className: "drp-btn ghost", onClick: props.onClose }, "取消"),
						React.createElement("button", { className: "drp-btn ghost", disabled: busy !== "", onClick: resetDefaults }, "恢复默认"),
						React.createElement("button", { className: "drp-btn", disabled: busy !== "", onClick: save }, busy === "save" ? "保存中…" : "保存")
					),
					dragKind !== null
						? React.createElement("div", { className: "drp-veil" }, "松开鼠标，导入" + (dragKind === "audio" ? "音频" : "图片"))
						: null
				)
			);
		}

		/** Required service: the UI slot registry. */
		var inject = ["slots"];

		/**
		 * The native Platform view, when the Desktop host exposes its bridge. The
		 * package only names a page and a rectangle: the child WebContentsView belongs
		 * to the host process, so remote content and credentials never enter this
		 * frame. Without the bridge the hand-over stays a plain new window.
		 * @returns the container, or null while no page is claimed.
		 */
		function PlatformView() {
			var claimState = React.useState(0);
			var counting = claimState[0];
			var setClaim = claimState[1];
			var statusState = React.useState("loading");
			var current = statusState[0];
			var setStatus = statusState[1];
			var topState = React.useState(PLATFORM_TOP);
			var top = topState[0];
			var setTop = topState[1];
			var viewport = React.useRef(null);
			var parked = React.useRef(false);

			/**
			 * The rectangle the native view should occupy. The toolbar row drawn by this
			 * package keeps the space above it: a native view always paints above DOM, so
			 * the bar cannot be stacked over the view — the view starts below the bar.
			 * @param offset - distance from the window top to the toolbar.
			 */
			var frame = function (offset) {
				var bar = 44;
				return {
					x: 0,
					y: offset + bar,
					width: window.innerWidth,
					height: Math.max(0, window.innerHeight - offset - bar)
				};
			};
			/** Rest below the window: fully loaded, but out of sight. */
			var offstage = function (offset) {
				var box = frame(offset);
				return { x: box.x, y: box.y + box.height + 60, width: box.width, height: box.height };
			};

			React.useEffect(function () {
				return onPlatformRequest(function (offset, stage) {
					var next = typeof offset === "number" && isFinite(offset) ? clamp(offset, 0, 320) : platformTop;
					if (stage === "close") {
						// The settings panel is about to open, and a native child view always
						// paints over every DOM layer: hand the view back to the host first.
						parked.current = false;
						if (PLATFORM_BRIDGE !== null) {
							try {
								var closed = PLATFORM_BRIDGE.close();
								if (closed && typeof closed.catch === "function") closed.catch(function () {});
							} catch (error) { /* the bridge was already idle */ }
						}
						setClaim(0);
						return;
					}
					if (PLATFORM_BRIDGE === null) {
						if (stage !== "preload") openTopUpPage();
						return;
					}
					if (stage === "preload") {
						if (parked.current) return;
						parked.current = true;
						try {
							var pending = PLATFORM_BRIDGE.open(PLATFORM_PAGE, offstage(next));
							if (pending && typeof pending.then === "function") {
								pending.then(function () {
									if (parked.current) setStatus("loaded");
								}, function () {
									// The host refused this page: give the URL to a window
									// rather than leaving an empty frame behind.
									parked.current = false;
									setClaim(0);
									openTopUpPage();
								});
							}
						} catch (error) {
							parked.current = false;
						}
						return;
					}
					setTop(next);
					setStatus("loading");
					setClaim(function (value) { return value + 1; });
				});
			}, []);

			React.useEffect(function () {
				if (counting === 0 || PLATFORM_BRIDGE === null) return undefined;
				var closed = false;
				var rafId = 0;
				var quiet = function (work) {
					try {
						var pending = work();
						if (pending && typeof pending.catch === "function") pending.catch(function () {});
					} catch (error) { /* bridge refused the call */ }
				};
				var box = frame(top);
				if (!parked.current) {
					// No warm-up happened (the config turned it off, or the open failed):
					// park the view, then slide it in like any other reveal.
					parked.current = true;
					quiet(function () { return PLATFORM_BRIDGE.open(PLATFORM_PAGE, offstage(top)); });
				}
				// A native child view always paints above every DOM layer, so "glass over
				// the page" cannot come from stacking order. It comes from sliding the
				// view up from below the window while the overlay fades out.
				var from = box.y + box.height + 60;
				var started = performance.now();
				var step = function (now) {
					if (closed) return;
					var progress = Math.min(1, (now - started) / 420);
					var eased = 1 - Math.pow(1 - progress, 3);
					var y = Math.round(from + (box.y - from) * eased);
					quiet(function () {
						return PLATFORM_BRIDGE.setBounds({ x: box.x, y: y, width: box.width, height: box.height });
					});
					if (progress < 1) {
						rafId = requestAnimationFrame(step);
					} else {
						quiet(function () { return PLATFORM_BRIDGE.setBounds(box); });
						if (!closed) setStatus("loaded");
					}
				};
				rafId = requestAnimationFrame(step);
				var observer = null;
				if (typeof ResizeObserver === "function") {
					observer = new ResizeObserver(function () {
						if (closed) return;
						quiet(function () { return PLATFORM_BRIDGE.setBounds(frame(top)); });
					});
					observer.observe(document.documentElement);
				}
				return function () {
					closed = true;
					if (rafId !== 0) cancelAnimationFrame(rafId);
					if (observer !== null) observer.disconnect();
					parked.current = false;
					quiet(function () { return PLATFORM_BRIDGE.close(); });
				};
			}, [counting, top]);

			// Escape dismisses the view. Focus sits inside the native view, so this page
			// hears nothing; the native channel hears it, and the DOM listener covers the
			// browser build and the moment before focus moves into the view.
			React.useEffect(function () {
				if (counting === 0) return undefined;
				var releaseNative = null;
				if (KEYBOARD_BRIDGE !== null && typeof KEYBOARD_BRIDGE.subscribe === "function") {
					try {
						releaseNative = KEYBOARD_BRIDGE.subscribe(function (input) {
							if (isEscapeInput(input)) setClaim(0);
						});
					} catch (error) { /* the channel is already closed */ }
				}
				var onKey = function (event) {
					if (event.key === "Escape" || event.keyCode === 27) {
						event.preventDefault();
						setClaim(0);
					}
				};
				window.addEventListener("keydown", onKey, true);
				return function () {
					window.removeEventListener("keydown", onKey, true);
					if (typeof releaseNative === "function") {
						try { releaseNative(); } catch (error) { /* already released */ }
					}
				};
			}, [counting]);

			if (counting === 0 || PLATFORM_BRIDGE === null) return null;

			var leave = function () { setClaim(0); };

			return React.createElement(
				"div",
				{ className: "dra-plat", style: { top: top + "px" } },
				React.createElement(
					"div",
					{ className: "dra-plat-bar", "data-window-drag": "true" },
					React.createElement(
						"button",
						{ type: "button", className: "dra-plat-back", onClick: leave },
						"\u2190 \u8fd4\u56de"
					),
					React.createElement(
						"span",
						{ className: "dra-plat-state" },
						current === "failed" ? "\u52a0\u8f7d\u5931\u8d25" : current === "loading" ? "\u52a0\u8f7d\u4e2d\u2026" : ""
					)
				),
				React.createElement("div", { ref: viewport, className: "dra-plat-view" })
			);
		}

		/**
		 * Claim the sidebar entry and the frame-wide stage.
		 * @param ctx - Client root context.
		 */
		function apply(ctx) {
			if (window[APPLIED]) return;
			if (!ctx || !ctx.slots || typeof ctx.slots.inject !== "function") return;
			window[APPLIED] = true;
			ensureStyle();

			var disposers = [];

			try {
				var dropButton = ctx.slots.inject(SEAT_BUTTON, function () {
					return ctx.slots.register(
						{ name: SEAT_BUTTON, id: "dsh-recharge-animation" },
						RechargeButton
					);
				});
				if (typeof dropButton === "function") disposers.push(dropButton);
			} catch (error) { /* seat not declared in this shell */ }

			try {
				var dropStage = ctx.slots.inject(SEAT_OVERLAY, function () {
					return ctx.slots.register(
						{ name: SEAT_OVERLAY, id: "dsh-recharge-animation", order: 2147483000 },
						RechargeStage
					);
				});
				if (typeof dropStage === "function") disposers.push(dropStage);
			} catch (error) { /* seat not declared in this shell */ }

			try {
				var dropPlatform = ctx.slots.inject(SEAT_OVERLAY, function () {
					return ctx.slots.register(
						{ name: SEAT_OVERLAY, id: "dsh-recharge-animation-platform", order: 2147483001 },
						PlatformView
					);
				});
				if (typeof dropPlatform === "function") disposers.push(dropPlatform);
			} catch (error) { /* seat not declared in this shell */ }

			try {
				var dropPanel = ctx.slots.inject(SEAT_OVERLAY, function () {
					return ctx.slots.register(
						{ name: SEAT_OVERLAY, id: "dsh-recharge-animation-settings", order: 2147483002 },
						SettingsPanel
					);
				});
				if (typeof dropPanel === "function") disposers.push(dropPanel);
			} catch (error) { /* seat not declared in this shell */ }

			if (typeof ctx.effect === "function") {
				ctx.effect(function () {
					ensureStyle();
					return function () {
						for (var i = 0; i < disposers.length; i++) {
							try { disposers[i](); } catch (error) { /* already released */ }
						}
						disposers.length = 0;
					};
				});
			}
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
