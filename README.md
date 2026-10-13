# dsh-recharge-animation

**点侧边栏的「充值」，看一段毛玻璃开场，动画还没播完，官方充值页已经在下面打开了。** 图标、音效、文案都能右键改。

👉 **[下载最新版](https://github.com/Heidashuai-X/dsh-recharge-animation/releases/latest)** · 一条命令安装见下方「[下载与安装](#下载与安装)」。

## 极简介绍

- **是什么**：给 DSH 侧边栏加一个「充值」入口，点它播一段满屏毛玻璃的开场动画（品牌 Logo + 真实进度条，1.8 秒），动画收尾时用 DSH **内置的平台视图**打开官方充值页 `platform.deepseek.com/top_up`。
- **为什么这样做**：插件只负责「开场」和「引路」，不自己画充值面板、也不去改 DSH 自带界面。钱、金额、登录态全在官方页面上走，不经过插件。
- **怎么用**：一条命令安装 + 完全重启 DSH；不动安装包，卸载同样是 `dsh plugin ... remove` 一条命令。**右键**侧边栏的「充值」按钮打开设置面板 —— 换开场图标、配三段音效、改按钮文案、调动画参数都在那里；插件管理器里只剩一个总开关 `enabled`。
- **和 `dsh-startup-animation`**：同一套座位与动画写法，两个插件可以共存。

## 行为

1. 侧边栏底部、设置按钮旁边多出一个「充值」入口（钱包图标 + 文字，窄栏自动收成图标）。
2. 点击后播放一次开场动画：
   - 满屏毛玻璃：`backdrop-filter: blur(72px) saturate(1.9)`，叠一层品牌色径向光晕，跟随 DSH 亮/暗主题（`color-mix` + `--dsw-*` 变量）。
   - 中央一块玻璃卡片，里面是开场图标与进度条（图标可以在设置面板里换成自己的图）。
   - 进度条是**混合语义**：四个真实信号（插件配置路由、Logo 解码、交接目标就绪、字体就绪）把进度顶到 96%，时间兜底同时提供下限与上限，最后补到 100% —— 加载慢时不会假满，加载快时也不会一闪而过。
   - 可跳过：点遮罩、`Esc`、空格、回车。
3. 进度到 100% 时，**在玻璃还盖着画面的时候**就切到内置平台视图打开充值页，随后玻璃淡出 —— 用户看到的正好是支付表单。
4. 随时可以再点一次入口重播；在平台视图里点顶部「← 返回」交还视图。
5. **右键**入口按钮打开设置面板（左键仍然是播放动画）：图标、音效、文案、动画参数、预设都在这块面板里改，详见下方「[设置面板](#设置面板)」。

视图默认从窗口顶部**下移 40px**（设置面板里的「顶部偏移」），因为原生子视图永远盖在页面 DOM 之上、无法被样式压到下面去。留出这条带子，返回栏就不会压住桌面端的窗口按钮和工具栏，那条带子里的东西也点不到，不会误触。觉得仍然挤或留白太多，直接改这个值即可。

## 下载与安装

三种拿法，任选其一：

**① 直接从 GitHub 安装**（最省事）：

```bash
dsh plugin --profile desktop add github:Heidashuai-X/dsh-recharge-animation
```

> 这条路走 pnpm 的 git 简写，本机没实测过；不通就用 ② 或 ③。

**② 克隆源码再 link**（要改代码就用这个，改完重启即生效）：

```bash
git clone https://github.com/Heidashuai-X/dsh-recharge-animation.git
dsh plugin --profile desktop add "link:<你 clone 下来的绝对路径>"
# Windows 例子：dsh plugin --profile desktop add link:D:/code/dsh-recharge-animation
```

**③ 下载 zip**：到 [Releases](https://github.com/Heidashuai-X/dsh-recharge-animation/releases/latest) 页，在 **Assets** 里点 `Source code (zip)` 或 `Source code (tar.gz)`，解压后按 ② 的 `link:` 方式安装（`link:` 指向解压出来的目录）。

装完**完全退出 DSH 再启动**。`cordis.patch.yml` 是唯一需要 DSH 读取的接入文件，浏览器半部由 `package.json` 的 `dsh.client` 清单声明。

卸载：

```bash
dsh plugin --profile desktop remove dsh-recharge-animation
```

## 配置

配置分两处，各管一段。

**① 插件管理器**（来自 Host 半 `lib/index.js` 的 Config Schema）：

| 键 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | 总开关：关闭后侧边栏不显示充值入口，设置面板也随之打不开。 |

**② 设置面板**（右键入口按钮唤出）：动画参数、图标、音效、文案、预设全在这里。面板里的改动**先落在草稿上**，点底栏「保存」才写入磁盘；「取消」丢弃草稿，「恢复默认」把当前草稿重置回默认值。

> 0.1.x 的 6 个配置项（`duration`、`minDuration`、`skippable`、`progressMode`、`openTopUp`、`platformTop`）已搬进设置面板的「动画参数」分组；升级后第一次读取时会用旧配置当初始值，行为不会突变。

## 设置面板

右键侧边栏的「充值」按钮打开（左键仍然是播放动画）。面板挂在 `shell.overlay` 上，深蓝实心按钮的配色照抄 [`dsh-whale-widget`](https://www.npmjs.com/package/dsh-whale-widget) 的设置面板。

| 分组 | 能改什么 |
| --- | --- |
| 全局静音 | 一键关掉全部音效；开启后「试听」同步禁用。 |
| 图标 | 开场卡片中央的那张大图；没导入时用包内置的 Logo。 |
| 音效 | 三个槽位：**开场**一声、**背景循环**（收尾淡出、跳过即截断）、**收尾**一声；每个槽位独立音量（0–100）与试听。 |
| 文案 | 侧栏按钮名、「点击跳过」提示。 |
| 动画参数 | 总时长、最短时长、顶部偏移、进度模式、可跳过、结束后是否打开充值页。 |
| 资源管理 | 已导入素材的缩略图、文件名、体积与总计，逐项可删。 |
| 预设 | 图标 + 三个音效 + 三个音量打包成一套：可另存、切换（立即生效）、重命名、删除。 |

**导入素材有三种方式**：

1. **文件选择器**；
2. **拖进面板** —— 按文件类型自动分派到图标库或音频库；面板只在打开时接管拖放，且不让事件冒泡，免得跟聊天输入框的文件拖放进附件行为打架；
3. **URL 导入** —— 由 Host 半去下载（浏览器侧 `fetch` 会因为图床不发 CORS 头而必然失败）。

格式与体积由 Host 半按**文件魔数**判定，不看扩展名：图标 ≤ 4MB（png / jpg / webp / gif），音频 ≤ 8MB（mp3 / wav / ogg / m4a）。URL 导入另有四道闸：只允许 `http` / `https`、以响应 `Content-Type` 判类型、体积上限、15 秒超时 + 5 次重定向上限。

### 数据放哪

```
$DSH_HOME/recharge-animation/
├── config.json     # 文案、行为参数、静音、素材索引、预设
├── icons/<id>.<ext>
└── audio/<id>.<ext>
```

`$DSH_HOME` 默认 `~/.dsh`（取不到时依次退到 `$DSH_PROFILE_DIR`、当前工作目录）。整个目录删掉等于恢复出厂。

### Host 半的路由

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| `GET` / `PUT` | `/recharge-animation/config` | 读 / 写 `config.json`；写入时夹紧数值、丢弃索引里不存在的素材引用。 |
| `GET` | `/recharge-animation/assets?kind=&id=` | 取素材（`Cache-Control: immutable`）。 |
| `POST` | `/recharge-animation/assets?kind=&name=` | 上传素材（raw 二进制 body，不走 base64）。 |
| `DELETE` | `/recharge-animation/assets?kind=&id=` | 删素材，同时清掉预设与图标里对它的引用。 |
| `POST` | `/recharge-animation/import-url` | 由 Host 下载远端文件并入库。 |

浏览器半读不到配置时使用内置默认值，**永远不会因为路由不可达而卡住开场**。

## 包结构

```
dsh-recharge-animation/
├── cordis.patch.yml         # DSH 加载入口（insert 一条 bundle 记录）
├── package.json             # dsh.bundle.patch + dsh.client 清单
├── lib/
│   ├── index.js             # Host 半：Config + 配置 / 素材 / URL 导入路由
│   └── client.js            # 浏览器半（由 src/client.template.js 生成）
├── src/client.template.js   # 浏览器半的可读源码（入口按钮、动画、设置面板）
├── tools/
│   ├── prepare.py           # 把 Logo 内联成 data URI，生成 lib/client.js
│   └── build-assets.py      # 从 assets/logo.png 派生 384px 图标
├── assets/                  # logo.png（母版）+ logo-384.png + icon.png
├── preview.html             # 脱离 DSH 的独立预览页（自带假 Host，面板也能试）
└── README.md
```

改完 `src/client.template.js` 后必须重新生成产物：

```bash
python tools/prepare.py
```

## 换 Logo

**只影响自己这台机器**：右键「充值」→ 设置面板 → 图标 → 导入即可，不用改代码、也不用重启。下面这条是**改内置默认图**（跟着包发布出去、给别人用）：

> npm 包里只带派生出来的 `logo-384.png` 与 `icon.png`，母版 `logo.png` 在 GitHub 仓库里；要换图请用 clone 下来的源码目录。

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
