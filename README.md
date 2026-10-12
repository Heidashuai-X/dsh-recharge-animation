# dsh-recharge-animation

**点侧边栏的「充值」，看一段毛玻璃开场，动画还没播完，官方充值页已经在下面打开了。**

## 极简介绍

- **是什么**：给 DSH 侧边栏加一个「充值」入口，点它播一段满屏毛玻璃的开场动画（品牌 Logo + 真实进度条，1.8 秒），动画收尾时用 DSH **内置的平台视图**打开官方充值页 `platform.deepseek.com/top_up`。
- **为什么这样做**：插件只负责「开场」和「引路」，不自己画充值面板、也不去改 DSH 自带界面。钱、金额、登录态全在官方页面上走，不经过插件。
- **怎么用**：一条命令安装 + 完全重启 DSH；不动安装包，卸载同样是 `dsh plugin ... remove` 一条命令。配置（时长、可跳过、是否自动打开充值页等）在插件管理器里改。
- **和 `dsh-startup-animation`**：同一套座位与动画写法，两个插件可以共存。

## 行为

1. 侧边栏底部、设置按钮旁边多出一个「充值」入口（钱包图标 + 文字，窄栏自动收成图标）。
2. 点击后播放一次开场动画：
   - 满屏毛玻璃：`backdrop-filter: blur(72px) saturate(1.9)`，叠一层品牌色径向光晕，跟随 DSH 亮/暗主题（`color-mix` + `--dsw-*` 变量）。
   - 中央一块玻璃卡片，里面是品牌 Logo 与进度条。
   - 进度条是**混合语义**：四个真实信号（插件配置路由、Logo 解码、交接目标就绪、字体就绪）把进度顶到 96%，时间兜底同时提供下限与上限，最后补到 100% —— 加载慢时不会假满，加载快时也不会一闪而过。
   - 可跳过：点遮罩、`Esc`、空格、回车。
3. 进度到 100% 时，**在玻璃还盖着画面的时候**就切到内置平台视图打开充值页，随后玻璃淡出 —— 用户看到的正好是支付表单。
4. 随时可以再点一次入口重播；在平台视图里点顶部「← 返回」交还视图。

视图默认从窗口顶部**下移 40px**（配置项 `platformTop`），因为原生子视图永远盖在页面 DOM 之上、无法被样式压到下面去。留出这条带子，返回栏就不会压住桌面端的窗口按钮和工具栏，那条带子里的东西也点不到，不会误触。觉得仍然挤或留白太多，直接改 `platformTop` 即可。

## 安装

克隆仓库，再让 `link:` 指向克隆下来的目录：

```bash
git clone https://github.com/Heidashuai-X/dsh-recharge-animation.git
dsh plugin --profile desktop add "link:<你 clone 下来的绝对路径>"
# Windows 例子：dsh plugin --profile desktop add link:D:/code/dsh-recharge-animation
```

也可以省掉手动 clone，用 pnpm 的 git 简写（这条路本机没实测过，不通就用上面的 `link:`）：

```bash
dsh plugin --profile desktop add github:Heidashuai-X/dsh-recharge-animation
```

装完**完全退出 DSH 再启动**。`cordis.patch.yml` 是唯一需要 DSH 读取的接入文件，浏览器半部由 `package.json` 的 `dsh.client` 清单声明。

卸载：

```bash
dsh plugin --profile desktop remove dsh-recharge-animation
```

## 配置

配置直接来自插件自己的 Config Schema，在**插件管理器**里改即可（Host 半 `lib/index.js` 的 `Config`）：

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 总开关：关闭后侧边栏不显示充值入口。 |
| `duration` | number | `1800` | 最长显示时长（毫秒），到点必定收场。 |
| `minDuration` | number | `1100` | 最短显示时长（毫秒），避免一闪而过。 |
| `skippable` | boolean | `true` | 是否允许点击/按键跳过。 |
| `progressMode` | `real` \| `fixed` | `real` | `real` 跟进真实加载节点；`fixed` 纯按时间推进。 |
| `openTopUp` | boolean | `true` | 动画结束后是否自动打开官方充值页（`platform.deepseek.com/top_up`）。 |
| `platformTop` | number | `40` | 内置视图距窗口顶部的像素距离（0–320）。调大可把整个界面下移，避开桌面端标题栏与工具栏。 |

Host 半把生效配置发布在 `GET /recharge-animation/config`；浏览器半读不到时使用内置默认值，**永远不会因为路由不可达而卡住开场**。

## 包结构

```
dsh-recharge-animation/
├── cordis.patch.yml         # DSH 加载入口（insert 一条 bundle 记录）
├── package.json             # dsh.bundle.patch + dsh.client 清单
├── lib/
│   ├── index.js             # Host 半：Config Schema + 配置路由
│   └── client.js            # 浏览器半（由 src/client.template.js 生成）
├── src/client.template.js   # 浏览器半的可读源码
├── tools/
│   ├── prepare.py           # 把 Logo 内联成 data URI，生成 lib/client.js
│   └── build-assets.py      # 从 assets/logo.png 派生 384px 图标
├── assets/                  # logo.png（母版）+ logo-384.png + icon.png
├── preview.html             # 脱离 DSH 的独立预览页
└── README.md
```

改完 `src/client.template.js` 后必须重新生成产物：

```bash
python tools/prepare.py
```

## 换 Logo

`assets/logo.png` 是母版（RGBA，带透明通道）。替换后：

```bash
python tools/build-assets.py   # 裁掉透明边、缩到 384px，写出 logo-384.png 与 icon.png
python tools/prepare.py        # 重新内联进 lib/client.js
```

然后重启 DSH。

> **别用调色板量化导出 Logo**（`Image.convert("P")`、部分在线压缩工具、某些「PNG 瘦身」选项）。那会把 alpha 通道整个压平，透明区域变成不透明纯黑，动画里就是一块黑底。脚本已显式保留 RGBA。

## 「充值」用的是什么视图

动画收尾后打开的不是外部浏览器，而是 **DSH 桌面端自己的原生平台视图**（Electron `WebContentsView`）——也就是宿主官方充值按钮用的那个内置浏览器。

宿主里的机制（`@deepseek-ai/dsh-client-ui-settings-account`）：

```js
const nativePlatform = globalThis.dshPlatform;   // preload 注入的桥
bridge.open(page, bounds)                        // page = "top-up" | "usage"
bridge.setBounds(bounds)                         // ResizeObserver 跟随
bridge.close()
```

真正的 `WebContentsView` 由 **Electron 主进程**持有，插件侧只交出一个矩形（`{x, y, width, height}`）；远端页面与登录凭据都不进入渲染进程。宿主自己的注释写得很直白：

> the Desktop host owns a **single** WebContentsView and its `open` destroys whatever was showing before

本插件的做法：在 `shell.overlay` 上除了动画层，再注册一个 `PlatformView` —— 顶部一条可拖拽的返回栏，下面一块空 viewport，原生视图就贴在这块 viewport 的矩形上，`ResizeObserver` 跟随窗口尺寸变化。

**降级链**：桥不存在时（Web 构建，或未来版本撤掉 `dshPlatform`）自动退回 `window.open(TOPUP_URL, "_blank")`；再被弹窗策略拦下时用隐藏的 `<a target="_blank">` 点击兜底。

> ⚠️ 宿主只有**一个** `WebContentsView`，插件与官方账户页共用它：如果同时打开「用量」或设置里的官方账户页，后来者会接管视图。点顶部「← 返回」交还即可。

### 关于 Esc：为什么视图里按不了

原生视图一出现，焦点就在它自己的 `webContents` 里，而这条链上没有任何一环能把那次按键送到插件手里：

1. **页面收不到**：`keydown` 发生在另一个 `webContents`，不会冒泡到宿主页面。
2. **原生键盘通道也收不到**：`window.dshDesktop.keyboard.subscribe()` 只转发**主进程认得出的已注册快捷键**（判定原句 `if (!priority && (main || !match)) return;`），`Escape` 默认没有注册。
3. **平台视图根本没接这条线**：主进程用 `attachInput(window, contents, guestName)` 挂监听，只对主窗口与 `iframe` / `webview` 来宾生效，`WebContentsView` 不在其中。

`dshPlatform` 也只暴露 `open` / `setBounds` / `close`，没有输入回调。所以这个视图**只用顶部「← 返回」退出**，没有 Esc 支持。（曾试过在视图下方留一条常驻关闭条，后来去掉了——不想为它牺牲一块屏幕。）

> 早期版本试过另外两条路，都走不通，留个记录：① 顺着 React fiber 去拿设置面板的 store actions（`ctx.slots.inject` 的回调**不接收 owner props**，而 `sidebar.settings` 是 single 座位，无法旁听）；② 单纯开新窗口——那会跳到外部浏览器，不是想要的形态。

## 与 dsh-startup-animation 的关系

两个插件同源（同一套座位、进度、主题变量写法），可以共存：

- `dsh-startup-animation`：DSH 启动时自动播一次开场。
- `dsh-recharge-animation`：由侧边栏入口手动触发，收尾用内置平台视图打开充值页。

## 兼容性

- `engines.dsh >= 0.1.5-rc.1`（从 `dsh.client.platform` 与 `exports["./client"]` 这两个硬校验字段起就有）。
- 依赖的座位：`sidebar.footer.action`（list）、`shell.overlay`（list）。
- 浏览器半部只声明 `inject = ["slots"]`，主题走 CSS 变量（`--dsw-*` + 兜底色），缺主题服务时自动退化，不会被 park 住。
- Host 半部声明 `inject = ["webServer"]`：配置路由挂在 webServer 上，而 cordis 不允许读未声明的服务（见「排错」）。

## 排错

**插件列表里显示「启动失败」**：那来自 cordis 的 fiber 阶段，只说明 **Host 半**的 `apply` 抛了异常，浏览器半部的按钮与动画可能完全正常。

本项目踩过一次：早期版本在 `apply` 里直接读 `ctx.webServer` 而 `inject` 为空。cordis 的 `ctx` 是 Proxy，**读未声明的服务会直接抛**：

```
Error: cannot get property "webServer" without inject
```

修法：

```js
export const inject = ['webServer']
```

复现办法是用 CLI 起 profile（桌面端 profile 由 Electron 独占，只能拿 `web` profile 当对照组）：

```sh
dsh web --profile web --port 19399 --no-open
```

`dsh: warning: N entry did not activate` 的下一行会给出失败原因与行号。

## 制作

- **作者**：[Heidashuai-X](https://github.com/Heidashuai-X)
- **AI 协作**：本项目由作者与 **DSH（DeepSeek Harness）里的 AI agent** 协作完成。座位勘察（读 DSH 与 Electron 打包产物，定位 `shell.overlay`、`sidebar.footer.action` 与原生平台视图协议）、Host 半与浏览器半代码、毛玻璃动画与样式，以及本 README / `CHANGELOG.md` / `PROVENANCE.md`，都在与该 agent 的会话中共同产出。软件按 [`LICENSE`](LICENSE) 里的开放声明提供（**不适用 MIT**），最终成品与后续维护由作者负责。

## 素材与许可

- **不适用 MIT**：本插件既不用 MIT，也不用任何标准开源许可证。任何人都可以**使用、修改、二次创作与再分发**（含商业用途），无需申请授权、无需署名。见 [`LICENSE`](LICENSE)。
- **Logo 图片**：`assets/logo.png` 取自第三方插件 [`dsh-whale-widget`](https://www.npmjs.com/package/dsh-whale-widget) 的 `assets/DSniang1.png`（与本插件这份逐字节相同）。上游标注该图为 **AI 生成、原始出处不可考**，其 `assets/**` 不在 MIT 范围内、也不授予再许可。**本仓库不主张这张图的权利，也不对它另加限制** —— 你可以像对待代码一样二创它。
- 逐项来源与 takedown 承诺见 [`PROVENANCE.md`](PROVENANCE.md)。
