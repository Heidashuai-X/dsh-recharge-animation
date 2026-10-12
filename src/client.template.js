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
		/** Whether the entry should warm the native view before the glass ends. */
		var wantsTopUp = true;

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
			if (tag.textContent !== CSS) tag.textContent = CSS;
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

		/**
		 * Read this package's configuration from its Host half. Resolves with null
		 * rather than rejecting: an unreachable route must never hold up the show.
		 * @param cb - receives the parsed configuration or null.
		 */
		function requestConfig(cb) {
			var settled = false;
			var done = function (json) {
				if (settled) return;
				settled = true;
				cb(json);
			};
			var timer = setTimeout(function () { done(null); }, 900);
			var pending;
			try {
				pending = fetch(CONFIG_URL, { cache: "no-store" });
			} catch (error) {
				clearTimeout(timer);
				done(null);
				return;
			}
			if (!pending || typeof pending.then !== "function") {
				clearTimeout(timer);
				done(null);
				return;
			}
			pending.then(function (response) {
				if (!response || response.ok !== true) return null;
				return response.json();
			}).then(function (json) {
				clearTimeout(timer);
				done(json === undefined ? null : json);
			}, function () {
				clearTimeout(timer);
				done(null);
			});
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
		 * The sidebar entry: one click queues a show.
		 * @param props - seat owner props; `wide` collapses the label.
		 */
		function RechargeButton(props) {
			var wide = !props || props.wide !== false;
			return React.createElement("button", {
				type: "button",
				className: "dra-btn" + (wide ? "" : " dra-btn-compact"),
				title: "充值",
				"aria-label": "充值",
				onClick: function () {
					// Warm the native view while the glass still plays, so the hand-over
					// lands on a loaded page instead of a blank one.
					if (wantsTopUp) requestPlatform("preload");
					requestPlay();
				}
			},
				React.createElement(WalletIcon, null),
				React.createElement("span", { className: "dra-btn-label" }, "充值")
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

			React.useEffect(function () {
				var root = rootRef.current;
				var fill = fillRef.current;
				var hint = hintRef.current;
				if (root === null || fill === null) {
					setDone(true);
					return undefined;
				}

				var cfg = {};
				for (var key in DEFAULTS) cfg[key] = DEFAULTS[key];
				var preset = window.__DSH_RECHARGE_ANIMATION__;
				if (preset && typeof preset === "object") {
					for (var p in preset) cfg[p] = preset[p];
				}

				var maxDur = clamp(cfg.duration, 600, 8000);
				var minDur = clamp(cfg.minDuration, 0, maxDur);
				var skippable = cfg.skippable !== false;
				var real = cfg.progressMode !== "fixed";
				var openTopUp = cfg.openTopUp !== false;
				platformTop = clamp(cfg.platformTop, 0, 320);
				wantsTopUp = openTopUp;

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

				var applyRemote = function (json) {
					if (!json || typeof json !== "object") return;
					if (json.enabled === false) {
						finish();
						return;
					}
					var dur = Number(json.duration);
					var min = Number(json.minDuration);
					if (isFinite(dur)) maxDur = clamp(dur, 600, 8000);
					if (isFinite(min)) minDur = clamp(min, 0, maxDur);
					if (typeof json.skippable === "boolean") skippable = json.skippable;
					if (json.progressMode === "fixed") real = false;
					if (typeof json.openTopUp === "boolean") {
						openTopUp = json.openTopUp;
						wantsTopUp = openTopUp;
					}
					if (isFinite(Number(json.platformTop))) platformTop = clamp(json.platformTop, 0, 320);
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

				if (skippable && hint !== null) {
					later(function () {
						if (skippable) hint.classList.add("dra-show");
					}, 700);
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
				};
			}, []);

			if (done) return null;
			return React.createElement("div", { className: "dra-root", ref: rootRef },
				React.createElement("div", { className: "dra-card" },
					React.createElement("img", { className: "dra-logo", src: LOGO, alt: "", draggable: false }),
					React.createElement("div", { className: "dra-bar" },
						React.createElement("div", { className: "dra-bar-fill", ref: fillRef })
					)
				),
				React.createElement("div", { className: "dra-hint", ref: hintRef }, "点击跳过")
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
