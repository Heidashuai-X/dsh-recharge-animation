# dsh-recharge-animation 交接档案

> 面向"接手继续优化"的人（包括未来的 AI agent）。这份文档只讲**怎么改、改哪里、别踩什么**，
> 用户手册在 [README.md](./README.md)，版本历史在 [CHANGELOG.md](./CHANGELOG.md)。

---

## 0. 一分钟速览

| 项目 | 值 |
|---|---|
| 包名 | `dsh-recharge-animation` |
| 当前版本 | `0.2.2`（`package.json:3`） |
| 这是什么 | DSH 侧边栏「充值」按钮 + 满屏毛玻璃开场动画 + 动画结束用宿主原生视图打开官方充值页；**0.2.0 新增右键唤出的配置面板**（图标 / 三槽位音效 / 文案 / 行为参数 / 素材管理 / 多套预设 / 全局静音） |
| 0.2.1 修了什么 | 路由注册失败改成 warning 日志（原为静默 `catch {}`）、`readBody`/`readJson` 的 400 语义、控制面请求全部加超时（开场 1.5s / 保存 20s / 上传 60s / 删除 10s / 导入 30s）、URL 导入失败原因归一（`describeFetchError`）、回归测试从 `.backup/` 迁进 `tools/tests/`（详见 §7.3 与 `CHANGELOG.md` 的 0.2.1 节） |
| 0.2.2 修了什么 | **动画里那行文字一次都没显示过**：淡入延迟写死 `700ms`，而总时长可以设到 `600ms`，动画在提示淡入之前就结束了；现在延迟 =「总时长的 30%，上限 700ms、下限 140ms」。该字段同时改名「动画内显示文字」、允许留空（留空＝不渲染文字节点），并与「可跳过」解耦（见 §10-⑬） |
| 代码规模 | `lib/index.js` 899 行（Host 半）、`src/client.template.js` 2093 行（Client 半源码）、`lib/client.js` 251712 字节（生成物）；`tools/tests/*.mjs` 共 601 行 |
| 仓库 | https://github.com/Heidashuai-X/dsh-recharge-animation |
| 已发布 | GitHub tag 与 Release 有 `v0.1.0`、`v0.2.0`（Release 挂 0.1.0 / 0.2.0 的 tgz 资产） |
| npm 状态 | npm 上仍是 **0.1.0**；0.2.0 曾被 2FA 拦下，用户随后决定**不再发布 npm**，桌面 profile 改为 link 本地目录 |
| 本机安装方式 | `C:\Users\heida\.dsh\profiles\desktop` 的依赖是 `link:D:/下载/heidashuai/dsh-recharge-animation`，`node_modules\dsh-recharge-animation` 是指向本仓库的 Junction |
| 改代码后的生效方式 | link 模式下**只需重启 DSH**；不需要重新安装（但不要在插件管理器里"升级"回 npm 版，那会退回 0.1.0） |

---

## 1. 架构总览

一个 DSH 插件包同时包含两半，靠 `package.json` 的 `dsh` 字段声明：

```json
"dsh": {
  "bundle": { "patch": "./cordis.patch.yml" },   // 启动时把插件注入 profile
  "client": { "platform": "web", "immediately": true }  // 客户端 bundle 立即加载
}
```

```
                      ┌──────────────────────────────────────────────┐
   浏览器（DSH Web UI）│  lib/client.js  (= __ModuleLoader__ 包装)     │
                      │                                              │
   座位 sidebar.footer.action ──► RechargeButton（充值按钮）          │
   座位 shell.overlay (order …3000) ──► RechargeStage ──► Show（毛玻璃动画）
   座位 shell.overlay (order …3001) ──► PlatformView（原生视图的 DOM 占位框）
   座位 shell.overlay (order …3002) ──► SettingsPanel（右键唤出的设置面板）
                      └───────────────┬──────────────────────────────┘
                                      │  fetch 同源 REST
                      ┌───────────────▼──────────────────────────────┐
   Node（DSH 主进程） │  lib/index.js                                │
                      │  GET/PUT /recharge-animation/config          │
                      │  GET/DELETE/POST /recharge-animation/assets  │
                      │  POST /recharge-animation/import-url         │
                      │         │                                    │
                      │         ▼                                    │
                      │  $DSH_HOME/recharge-animation/               │
                      │    config.json                               │
                      │    icons/<id>.<ext>                          │
                      │    audio/<id>.<ext>                          │
                      └──────────────────────────────────────────────┘
```

要点：

- **Host 半是唯一权威**。面板把配置 PUT 回 Host，Host 校验、夹紧、落盘，再把清理后的结果返回；客户端只渲染返回的东西。
- **素材索引不接受客户端提交**。`normalizeConfig(input, base)` 里 `assets` 永远从磁盘上的 `base` 继承（`lib/index.js:347-349`），只有上传/删除路由能改变它。所以面板无法凭空造条目，也无法把 preset 指向不存在的素材（悬空引用会被置 `null`，见 `lib/index.js:352-388`）。
- **客户端 bundle 是包装过的**：`window.__ModuleLoader__.load({ id, factory })`，factory 是 React + `dsh` 的注入形式，返回值挂 `apply` / `inject`。

---

## 2. 文件地图

| 文件 | 作用 | 备注 |
|---|---|---|
| `package.json` | 71 行，插件清单 | `files` 白名单**不含** `HANDOVER.md`、`assets/logo.png`、`dsh-recharge-animation-*.tgz` |
| `cordis.patch.yml` | 10 行，把插件注册进 profile | 只有 `- id: dsh-recharge-animation` / `disabled: false` |
| `lib/index.js` | **Host 半（源码即产物，手写）**，792 行 | 三条路由、配置与素材服务 |
| `src/client.template.js` | **Client 半源码**，2079 行 | 唯一占位符 `__LOGO_DATA_URI__`（第 11 行） |
| `lib/client.js` | **生成物**，由 `tools/prepare.py` 内联 Logo 得到 | 不要手改；改 `src/client.template.js` 后重新生成 |
| `preview.html` | 独立预览页，内含**内存版假 Host** | 桌面端 profile 被 Electron 独占，靠它做快速迭代 |
| `tools/prepare.py` | 42 行，把 `assets/logo-384.png` 变成 data URI 塞进模板 | 见 §7 |
| `tools/build-assets.py` | 50 行，从 `assets/logo.png` 生成 `logo-384.png` / `icon.png` | 只在换品牌图时用 |
| `assets/logo-384.png` | 128339 字节，构建期内联进 client bundle 的图 | 384×384 |
| `assets/icon.png` | 128339 字节，插件管理器里的图标 | |
| `assets/logo.png` | 255988 字节，GitHub 仓库用的高清原图 | **不在 npm 包里** |
| `README.md` | 用户手册（236+ 行，含设置面板与 Host 路由章节） | |
| `CHANGELOG.md` | 版本日志 | |
| `LICENSE` / `PROVENANCE.md` | 非 MIT 的自定义许可 + 素材出处 | Logo 取自 `dsh-whale-widget` 的 `assets/DSniang1.png` |
| `HANDOVER.md` | 本文件 | 新增，未被 git 追踪（见文末） |

---

## 3. Host 半详解（`lib/index.js`）

### 3.1 常量

| 常量 | 值 | 行 |
|---|---|---|
| `ROUTE_CONFIG` | `/recharge-animation/config` | :37 |
| `ROUTE_ASSETS` | `/recharge-animation/assets` | :38 |
| `ROUTE_IMPORT` | `/recharge-animation/import-url` | :39 |
| `DATA_DIRNAME` / `CONFIG_NAME` | `recharge-animation` / `config.json` | :42-43 |
| `ICON_DIRNAME` / `AUDIO_DIRNAME` | `icons` / `audio` | :44-45 |
| `LIMITS` | `{ icon: 4MiB, audio: 8MiB }` | :48 |
| `URL_TIMEOUT_MS` / `URL_MAX_REDIRECTS` | `15000` / `5` | :51-52 |
| `LABEL_MAX` | `{ button: 24, skipHint: 40 }` | :55 |
| `PRESET_NAME_MAX` / `ASSET_NAME_MAX` / `MAX_PRESETS` | `24` / `80` / `40` | :56-58 |
| `BEHAVIOR_DEFAULTS` | `duration 1800, minDuration 1100, skippable true, progressMode 'real', openTopUp true, platformTop 40` | :61-70 |
| `DEFAULT_PRESET` | `id 'p-default'`、`name 默认`、三槽位空、`volumes 100/60/100` | :71-79 |
| `SIGNATURES` | 按**魔数**识别：icon = png/jpg/gif/webp；audio = wav/mp3/ogg/m4a | :80-107 |
| `MIME_BY_EXT` | 扩展名 → Content-Type | :108-119 |
| `KIND_LABEL` / `KIND_FORMATS` | 给错误文案与面板提示用的中文名 | :120-121 |

判定格式**只看内容不看扩展名**（`detectFormat` :267），所以把 `.txt` 改名成 `.png` 也会被拒。

### 3.2 数据目录解析

`dataDirCandidates()` (:177) → `pickDataDir()` (:189) 按顺序取**第一个可写**的：

1. `$DSH_HOME/recharge-animation`
2. `$DSH_PROFILE_DIR/recharge-animation`
3. `<cwd>/.recharge-animation`

`paths()` (:202) 返回 `{ dir, icons, audio, config }`。

> 本机实际落在 `C:\Users\heida\.dsh\recharge-animation\`。该目录**不在** profile 里，是插件自己造的。

### 3.3 三条路由的契约

#### `GET | PUT | POST /recharge-animation/config`

- GET → `200 { ok: true, enabled, config, limits, formats, labelMax, presetNameMax, assetNameMax }`
- PUT/POST → body 可以是 `{ config: {...} }` 或裸 config 对象；返回同样的 payload（config 为**清理后**的结果）
- 失败 → `500` + 截断到 200 字符的错误文本（客户端原样显示）
- **注意**：`enabled` 不在这里改，它属于插件管理器（见 §7）。

#### `GET | HEAD | DELETE | POST /recharge-animation/assets`

- 查询串：`?kind=icon|audio`（缺省 icon）、`?id=<assetId>`，POST 另加 `&name=<原文件名>`
- GET/HEAD → 文件字节，`Content-Type` 由扩展名推，`Cache-Control: public, max-age=31536000, immutable`
  - 未知 id → `404 素材不存在`；索引有但文件没了 → `404 素材文件已丢失`
- DELETE → 删文件 + 删索引 + 清掉所有 preset 里指向它的引用；返回新 payload
- POST → **raw 二进制 body**（不是 base64，省 33%），上限 `LIMITS[kind] + 4096`
  - 超限 → `413 图片/音频超过上限 4MB/8MB`
  - 格式不符 → `400 这不是可用的图片（支持 png / jpg / webp / gif）`（音频同构）
- 其他方法 → `405 不支持的方法`

#### `POST /recharge-animation/import-url`

- body `{ kind, url }`；`url` 为空 → `400 请填写链接`
- 下载失败 → `400` + 具体原因（`只支持 http / https 链接` / `远端返回 HTTP 404` / `拉取超时（15 秒）` / `重定向次数超过 5 次` / `拉取失败：<原因>`）
- 内容不是该 kind 的素材 → `400 <格式错误>（远端 Content-Type：xxx）`，把远端声称的类型回显给用户便于排查
- 成功 → 返回新 payload

### 3.4 关键实现细节

| 函数 | 行 | 行为 |
|---|---|---|
| `normalizeConfig(input, base)` | :324 | 未知字段丢弃；所有数字 `clampInt` 夹紧（`duration 600-8000`、`minDuration 0-duration`、`platformTop 0-320`、音量 `0-100`）；`progressMode` 只认 `real`/`fixed`；`assets` **继承 base**；preset 引用逐个对索引校验；至少保留 1 个 preset |
| `loadConfig(dirs, hostConfig)` | :401 | 文件缺失时用 `hostConfig`（旧版管理器里的 6 个字段）**做首次种子**，让老安装保留原有手感；清理后**仅当与磁盘内容不同**才写回（GET 保持只读语义） |
| `saveConfig` | :435 | 清理 + 剪枝 + 原子写 |
| `writeJsonAtomic` | :260 | 写 `config.json.tmp` 再 `rename` ⚠️ 临时名固定，见 §10-② |
| `pruneAssets` | :292 | 索引里有、磁盘上没有的条目直接剔除，面板不会渲染死行 |
| `publishAssets` | :299 | 给每个条目补上同源 `url`，客户端只认这个字段 |
| `readBody(req, maxBytes)` | :474 | **超限后继续 drain 再 reject，不 destroy socket**——否则客户端拿到的是 ECONNRESET 而不是 413（这个坑踩过一次，见 §10-①） |
| `readLimited(response, maxBytes)` | :564 | 流式累计，超限即 `cancel()` 并抛错（不信任 Content-Length） |
| `download(urlText, kind)` | :589 | 协议白名单 → `redirect: 'manual'` 最多 5 跳 → `AbortController` 15s → 非 2xx 报 `远端返回 HTTP n` |
| `register`（内嵌） | :642 | 注册失败**静默**（`catch { }`），见 §10-③ |

---

## 4. Client 半详解（`src/client.template.js`）

### 4.1 常量与座位

| 名称 | 值 / 行 |
|---|---|
| `LOGO` | `__LOGO_DATA_URI__` 占位（:11，构建期替换） |
| `CONFIG_URL` | `/recharge-animation/config`（:14） |
| `TOPUP_URL` | `https://platform.deepseek.com/top_up`（:17） |
| `PLATFORM_PAGE` | `"top-up"`（:23） |
| `PLATFORM_BRIDGE` | `globalThis.dshPlatform`（:30） |
| `KEYBOARD_BRIDGE` | `window.dshDesktop.keyboard`（:39） |
| `PLATFORM_TOP` | `40`（:60） |
| `wantsTopUp` | `true`（:64）⚠️ 见 §10-④ |
| `SEAT_BUTTON` | `"sidebar.footer.action"`（:78） |
| `SEAT_OVERLAY` | `"shell.overlay"`（:80） |
| `APPLIED` | `"__dshRechargeAnimationApplied"` 单次安装守卫（:83） |
| `READY` | `96`（真实信号推到 96% 后交给时间兜底） |
| `ROUTE_ASSETS` / `ROUTE_IMPORT` | :233-234 |

四个座位注册在 `apply()`（:2014-2073），id 与 order 依次为：

| id | 组件 | order |
|---|---|---|
| `dsh-recharge-animation` | `RechargeButton` | 座位默认 |
| `dsh-recharge-animation` | `RechargeStage` | 2147483000 |
| `dsh-recharge-animation-platform` | `PlatformView` | 2147483001 |
| `dsh-recharge-animation-settings` | `SettingsPanel` | 2147483002 |

### 4.2 配置 store（客户端唯一缓存）

- `DEFAULT_CONFIG`（:352）/ `DEFAULT_STATE`（:362）——两个常量必须与 Host 的默认值保持一致，不一致会表现为"打开面板瞬间跳一下"。
- `store = { state, listeners, loaded, inflight }`（:373）
- 读：`loadState(force)`（:481）带 inflight 合并（多个组件同时挂载只发一次请求）、`requestJson(url, options, timeoutMs)`（:436）**永不 reject**，统一返回 `{status, ok, body}` 或 `null`。
- 写：`apiSave`（:530）、`apiUpload`（:539，raw body 直传 `File`）、`apiDelete`（:551）、`apiImport`（:557）。
- 兼容：`resolveState(json)`（:404）同时接受 0.2 的嵌套 payload 与 0.1.x 的扁平对象——旧 Host 半在场时页面不会白屏。
- 订阅：`useStore()`（:716）＝ `useState(store.state)` + 首次挂载触发 `loadState` + `subscribeStore`。

**所有写入都走 Host**：面板不本地落盘，保存后用的是 Host 返回的 config（`adopt()` 里 `setStore`）。

### 4.3 组件

| 组件 | 行 | 说明 |
|---|---|---|
| `WalletIcon` | :728 | 内联 SVG 钱包图标（无外部资源） |
| `RechargeButton` | :744 | 文案取 `labels.button`；`title` 为「X（左键播放动画，右键设置）」；`onContextMenu` → `openSettings()` |
| `RechargeStage` | :774 | 按 run 计数，`key=run` 让每次播放都是全新挂载（effect 干净起步） |
| `Show` | :793 | 一次毛玻璃演出：取 store 快照 → 播放三槽位音效 → 四个真实信号（config / logo decode / 220ms / fonts.ready）把进度推到 `READY` → `finish()` 先 `requestPlatform("reveal")` 再淡出 |
| `Field` / `Section` | :1074 / :1082 | 面板的行与分组外壳 |
| `kindFromDataTransfer` | :1093 | 拖入文件按 MIME 分派（`audio/*` → audio，其余 → icon） |
| `AUDIO_SLOTS` | :1106 | `intro 开场 / bgm 背景 / outro 收尾` |
| `SettingsPanel` / `SettingsPanelBody` | :1113 / :1128 | 面板本体（**本项目最大的一块**，约 700 行） |
| `PlatformView` | :1821 | 原生视图的 DOM 占位：`frame()/offstage()` 算矩形，`preload` 时以 offstage 打开，`reveal` 时 420ms 滑入；`ResizeObserver` 跟随；收到 `stage === "close"` 时 `setClaim(0)` + `PLATFORM_BRIDGE.close()` |
| `apply` | :2014 | **改造入口**：加座位/改行为都在这里挂 |

### 4.4 播放链路（一次左键点击发生了什么）

```
RechargeButton.onClick
  ├─ if (wantsTopUp) requestPlatform("preload")   // 预热宿主唯一的原生视图
  └─ requestPlay()                                // 本地 emitter，跨座位
        └─ RechargeStage 收到 → run+1 → 挂载新的 Show
              ├─ 取 store 快照（本次播放期间不受后续保存影响）
              ├─ sound.play(intro, volumes.intro, loop=false)
              ├─ 220ms 后 sound.play(bgm, volumes.bgm, loop=true)   // 全局静音则跳过
              ├─ 进度条按 progressMode 推进；四个真实信号把进度顶到 96%
              ├─ finish()
              │    ├─ sound.fade(bgm, 400ms) + sound.play(outro, volumes.outro)
              │    ├─ if (openTopUp) requestPlatform("reveal")
              │    └─ 130ms 加 .dra-out → 320ms 后 setDone
              └─ cleanup: sound.release(true)   // 保留尾音、停掉循环
```

- 点击任意处 / `Escape` / `Space` / `Enter` 可跳过（受 `behavior.skippable` 控制）。
- `sound.release(keepTail)`：`loop` 一定停，`keepTail=true` 时让非循环的尾音自然播完（`makeSoundtrack()` :642）。

### 4.5 设置面板（`SettingsPanelBody`）

草稿式编辑：打开时 `draft = clone(state.config)`，改动只进 `draft`，底部三键：

- **取消** → 丢弃草稿并关闭
- **恢复默认** → 恢复 `DEFAULT_CONFIG`（**保留已导入的素材**），仍需点保存才落盘
- **保存** → `apiSave(draft)`，成功提示「已保存」，失败显示 Host 的错误原文

分组与顺序：`全局静音` → `图标`（选择文件 / URL 导入 / 拖入热区 / 缩略图网格，点选＝设为当前图标，× 删除）→ `音效`（三槽位各两行：下拉 + 音量 + 试听，另有「导入音频」与拖入热区）→ `文案`（按钮名 / 动画内显示文字，`maxLength` 取 Host 下发的 `labelMax`；该栏留空则动画里不渲染文字节点）→ `动画参数`（总时长 / 最短时长 / 顶部偏移 / 进度模式 / 可跳过 / 结束后打开充值页）→ `预设`（chip 点击立即 `usePreset`，另有另存为 / 重命名 / 删除）→ `资源管理`（全部素材：预览 / 类型 / 名称 / 体积 / 删除，标题显示「N 项 · 总体积」）。

拖拽：`onDragOver/onDragLeave/onDrop` 都 `preventDefault + stopPropagation`，且**只在面板打开时接管**，避免抢 DSH 聊天输入框的文件拖放。拖入文本时若像 `http(s)` 链接则走 URL 导入，否则报错。

CSS 全部内联在 `PANEL_CSS`，类名统一 `drp-` 前缀，配色**固定**（不跟随 `--dsw-*` 主题），主色 `#203170`（照抄 `dsh-whale-widget` 的深蓝实心按钮风格）：

| 用途 | 值 |
|---|---|
| 主按钮底 / 字 | `#203170` / `#fff` |
| 次级按钮 | `#2f4488`、`#3a56a8` |
| 描边 / 分隔 | `#9fb0d9`、`#dbe4f5` |
| 面板底 | `#f6f8fd`、`#f3f5fb` |
| 成功 / 危险 | `#2fa24c` / `#e0433f` |

---

## 5. 数据结构：`config.json`

```jsonc
{
  "version": 1,
  "muted": false,                             // 全局静音：三槽位都不出声，试听按钮禁用
  "labels": { "button": "充值", "skipHint": "点击跳过" },
  "behavior": {
    "duration": 1800,                         // 600 - 8000 ms
    "minDuration": 1100,                      // 0 - duration
    "skippable": true,
    "progressMode": "real",                   // "real" | "fixed"
    "openTopUp": true,
    "platformTop": 40                         // 0 - 320 px
  },
  "assets": {
    "icons": [ { "id": "i-…", "file": "i-….png", "bytes": 128339, "name": "logo-384.png", "url": "/recharge-animation/assets?kind=icon&id=i-…" } ],
    "audio": [ { "id": "a-…", "file": "a-….wav", "bytes": …, "name": "x.mp3", "ms": 1234, "url": "…" } ]
  },
  "presets": [
    { "id": "p-default", "name": "默认", "iconId": null,
      "slots":   { "intro": null, "bgm": null, "outro": null },
      "volumes": { "intro": 100, "bgm": 60, "outro": 100 } }
  ],
  "activePresetId": "p-default"
}
```

约定（改动前请先读这一节）：

1. **`assets` 是磁盘索引，不是用户输入**。`url` 字段由 Host 在返回前补上，客户端只认它；`file` 里不允许出现 `/` 或 `\`（`bareEntry` :278 会拒绝）。
2. **素材 id 只允许 `^[a-z0-9-]{1,64}$`**（`cleanId` :241），文件名由 `makeAssetId` 生成（`i-` / `a-` 前缀 + 时间戳36进制 + 4 位随机）。
3. **预设只含「图标 + 三个音效 + 三个音量」**，不含文案、行为参数、`muted`。这是刻意的：一键切预设不应该悄悄改掉别人的播放行为。
4. **`muted` 是顶层字段**，不进预设。
5. **`enabled` 不在 config.json 里**，它属于插件管理器（`ctx` 传入的 `hostConfig`），面板只显示一句提示。

### 为什么 Config 只剩 `enabled`

0.1.x 有 6 个字段（`duration/minDuration/skippable/progressMode/openTopUp/platformTop`）由插件的 schemastery schema 渲染成管理器表单。0.2.0 把这些搬进面板统一管理，`Config` 只留总开关，理由：

- 两处能改同一批参数必然不一致；
- 管理器的表单是纯文本控件，做不到音量滑块、试听、素材预览；
- 旧值不会丢：`config.json` 首次生成时用 `hostConfig` 里的旧字段做种子（`loadConfig` :415-423）。

### 加一个配置项：端到端清单

顺序照着走，一处漏掉就会出现"面板里改了但没生效"：

1. **Host 半**（`lib/index.js`）：若属于播放行为，加进 `BEHAVIOR_DEFAULTS`（:61）；在 `normalizeConfig` 里写夹紧/白名单规则（:336-345）；若属于顶层字段（像 `muted`）照 :345 那行的写法。
2. **Client 半**（`src/client.template.js`）：同步改 `DEFAULT_CONFIG`（:352）；面板里加控件（现成的行构造器见 `SettingsPanelBody` 里的 `rangeRow` / 开关行 / 下拉行，:1620 附近有 `顶部偏移` 的例子）；在 `Show` 的 effect 快照里消费它（:840-850 一带）。
3. **测试**：`host-smoke.mjs` 加一条断言（尤其夹紧边界）；面板交互用 `shot.mjs` 探针复查。
4. **文档**：`README.md` 的配置表、`CHANGELOG.md`、必要时升 `package.json` 版本。
5. 客户端改完别忘了 `prepare.py` 重新生成 `lib/client.js`。

### 加一条新路由：端到端清单

1. 在 `lib/index.js` 顶部加 `ROUTE_XXX` 常量，用 `register(ROUTE_XXX, handler)` 挂上（`webServer.register` 的参数是 `{ kind: 'exact', path, handler }`，handler 拿到的是**原生 `req`/`res`**，body 没被别人读过）；
2. 客户端加一个 `apiXxx()` 包装（照 `apiImport` :557 的写法，超时值按操作性质给）；
3. **`preview.html` 的假 Host 也要实现这条**（`handleHost()` :216），否则预览里会莫名其妙报错；
4. 错误返回保持中文短句——面板会把 Host 的错因原样展示给用户。

---

## 6. 客户端 bundle 的生成

```bash
# 1) 改源码
#    src/client.template.js          ← 所有客户端逻辑
# 2) 重新内联 Logo 生成产物
python tools/prepare.py            # → lib/client.js
```

- 唯一被生成的部分是 `__LOGO_DATA_URI__` → `assets/logo-384.png` 的 base64（`tools/prepare.py:32`）。
- **本机 PATH 里的 `python` 是 Microsoft Store 别名，不可用**。要用 DSH 自带运行时：

```powershell
& "C:\Users\heida\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" tools/prepare.py
```

- 生成后建议做一次语法自检（`node --check lib/client.js` 对包装文件无效，用 `node -e "require('vm')…"` 或直接跑 `preview.html`）。
- 改了 `lib/index.js`（Host 半）不需要任何构建步骤，它是手写源码。

---

## 7. 本地开发与验证工具箱

### 7.1 `preview.html`（首选，最快）

自包含 HTML，内含**内存版假 Host**：覆盖 `window.fetch`，实现 `/config`（GET/PUT）、`/assets`（POST/DELETE）、`/import-url`（返回 CORS 说明），payload 形状与真 Host 一致。素材用 `URL.createObjectURL`，配置持久化到 `localStorage["dsh-recharge-animation-preview"]`，刷新时清空素材索引（blob 不跨会话）。

```powershell
# 直接用浏览器打开
start dsh-recharge-animation\preview.html
# 打开并自动弹出设置面板（给截图/CI 用）
start "dsh-recharge-animation\preview.html?panel=1"
```

注意：

- React/ReactDOM 由页面末尾的加载器按顺序取：本地 `vendor/`（把 `react.production.min.js` 与 `react-dom.production.min.js` 放进去即可完全离线）→ `unpkg` → `jsDelivr`，每级都有超时（vendor 2s、CDN 各 8s）。主逻辑挂在 `window.__bootPreview__`，等 React 就绪后才启动，最后再注入 `./lib/client.js`；全部源都失败时底部写明原因并给出「重试」按钮，不再永远停在「正在加载…」。
- `?panel=1` 会向 `#seat-footer` 里**最后一个** `button` 派发 `contextmenu`（座位里第一个是宿主自己的 ⚙）。
- 假 Host 不能替代真机：真 Host 才有魔数校验、体积上限、URL 拉取、跨会话持久化。

### 7.2 CDP 无头截图/探针 `shot.mjs`

位于工作区 `D:\下载\heidashuai\.backup\shot.mjs`（无依赖，用 Node 内置 `fetch` + `WebSocket`）：

```powershell
# 1) 起一个带调试端口的无头 Edge（必须在完整权限下跑，沙箱里 crashpad 起不来）
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --no-sandbox --disable-gpu `
  --disable-crash-reporter --remote-debugging-port=9222 --remote-allow-origins=* `
  --user-data-dir="D:\下载\heidashuai\.backup\edge-profile" about:blank

# 2) 截图 / 跑探针（probe 是任意 JS 表达式，会在页面里求值并打印）
node "tools\tests\shot.mjs" "file:///D:/下载/heidashuai/dsh-recharge-animation/preview.html?panel=1" "out.png" 15000 "(async function(){ … })()"
```

这套工具用来验证面板交互（拖拽导入、静音、恢复默认、预设另存……），也是这次 0.2.0 主要靠的回归手段。

### 7.3 Host 半冒烟测试

- `tools/tests/host-smoke.mjs`（421 行）：起真 `node:http` 服务器 + mock `webServer`，`DSH_HOME` 指向临时目录，**20 项断言**覆盖三条路由（默认配置、上传真 PNG 并核对字节、未知 id 404、文本冒充图片 400、超限被拒、非法 JSON 400、超长 body 400 且原因可读、PUT 夹紧数值、PUT 不能凭空加素材、两次并发保存都落地且不留 `.tmp`、302 重定向拉图、拉 HTML 报错带 Content-Type、`file://` 被拒、DELETE 清引用、重新 import 后数据仍在、dispose 后路由清空、注册被拒时写 warning、动画内文字可清空保存）。
- `tools/tests/url-smoke.mjs`（95 行）：从**已安装**的包里 import，打真网络验证 URL 导入（含 `unpkg` 成功样例与本地 fixture）。
- 跑法：`npm test`（= `npm run test:host`）、`npm run test:url`；两者在 0.2.1 已纳入 git，是当前唯一的回归网。旧副本仍留在 `..\.backup\`（工作区，未纳入 git）。

### 7.4 真机验证

桌面端 profile 被 Electron 独占，没有热加载，只能：

```powershell
# 改完代码 → 重启 DSH（link 安装，无需重装）
```

重启后验证清单：侧边栏「充值」→ 左键播动画 → 右键出面板 → 导入图标 → 保存 → 再播放看是否换图 →
导入音频三槽位试听 → 保存 → 播放听声音。

排错入口：`C:\Users\heida\.dsh\profiles\desktop\.plugin-manager\logs\operation-*\pnpm.log`。

---

## 8. 环境依赖（本机已确认）

| 用途 | 路径 / 版本 |
|---|---|
| DSH 运行时 node | `C:\Users\heida\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe`（v24.21.0） |
| 系统 node / npm | `D:\nodejs`（npm 11.19.0）；`node` 在 PATH 可用（v24.20.0） |
| DSH 用的 pnpm | `D:\deepseekharness\resources\runtime\pnpm\bin\pnpm.mjs`（v11.7.0，由 `DeepSeek Harness.exe --expose-internals` 拉起） |
| dsh CLI | `D:\deepseekharness\resources\runtime\cli\bin\dsh.cmd` |
| Python（构建） | `…\dsh-primary-runtime\dependencies\python\python.exe`（3.12.14）⚠️ PATH 里的 `python` 是商店别名，不可用 |
| git | `D:\Git\cmd\git.exe`（**不在 DSH 进程的 PATH 里**，命令里请写全路径） |
| 无头浏览器 | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`（Edg/155） |
| PowerShell | 工具链实际执行的是 **Windows PowerShell 5.1**（无 `utf8NoBOM` 之类枚举；写 UTF-8 无 BOM 用 `[System.IO.File]::WriteAllText($p,$s,(New-Object System.Text.UTF8Encoding($false)))`） |

---

## 9. 发布流程

### 9.1 GitHub（当前唯一渠道）

```powershell
& "D:\Git\cmd\git.exe" -C dsh-recharge-animation add -A
& "D:\Git\cmd\git.exe" -C dsh-recharge-animation commit -F ..\.backup\commit-0.2.0.txt
& "D:\Git\cmd\git.exe" -C dsh-recharge-animation tag -a v0.2.0 -F ..\.backup\tag-v0.2.0-message.txt
& "D:\Git\cmd\git.exe" -C dsh-recharge-animation push origin main
& "D:\Git\cmd\git.exe" -C dsh-recharge-animation push origin v0.2.0
```

- Release 通过 GitHub API 创建（`POST /repos/Heidashuai-X/dsh-recharge-animation/releases`），资产用 `uploads.github.com/.../assets?name=…` 上传。
- 这批 API 调用在本机的可行姿势：完整权限 + `curl --ssl-no-revoke`（本机做不了证书吊销检查，会报 `CRYPT_E_NO_REVOCATION_CHECK`）。
- 参考数据：`v0.2.0` → commit `6b953d4`，tag 对象 `eb8b1df`；Release 资产 `dsh-recharge-animation-0.2.0.tgz` 459407 字节，sha256 `bddd26ac12f065faa79969d2d951c95f1118a4f998d6c7ae77a728834928c735`。
- `v0.2.1`（2026-10-13）：commit `1da16ab`（CI 断言修复 `9010a62`），tag 对象 `95a92e2`，Release id `411553909`；资产 `dsh-recharge-animation-0.2.1.tgz` 471821 字节，sha256 `E5A8A782D615F9D95F00D3159370A6DAF9DFA5BC826E292A0E43FF0C80E2D1CB`，17 个文件。（同一版本本地曾先 pack 出 469816 字节的副本，发布前已重新打包，以 471821 字节的资产为准。）
- `v0.2.2`（2026-10-13）：commit `da5007a`，tag 对象 `5de79ee5`，**Release 由 CI 的 `release` 作业自动创建**（id `411574004`，`gh release create <tag> <tgz> --generate-notes`）；资产 `dsh-recharge-animation-0.2.2.tgz` 473601 字节，shasum `e7a863cb1a21c969cab577ad85fee24b8a12a1c1`，sha256 `B81A3072168CFD72F1559DBEBC5C2F8CC8927FF4E53121D15562A95B6E9D39BB`（已把 CI 上传的资产下载回来比对，与该 sha 逐字节一致——CI 的 `npm pack` 与本地可复现地打出同一个包），17 个文件。**注意**：推 tag 会触发 CI 重新 `npm pack` 并由 CI 上传资产——本地 tgz 与 CI 资产字节数相同，但如果手工先建了 Release，CI 不会覆盖已有同名资产（见 §11-10 的说明），所以想统一 sha 就不要手工上传。

### 9.2 npm（已暂停）

- 现状：npm 上只有 `0.1.0`（`latest`）。
- 当初卡点：账号的 `two-factor auth = auth-and-writes`，`npm publish` 要一次性密码；npm 回显的认证 URL 与 authId 都被打码成 `***`，无法代取。
- 若将来要恢复：在终端里跑 `npm publish` 并当场输入 OTP 即可，包本身已通过 `--dry-run` 检查（14 个文件、459.4 kB、shasum `b35e7465e0fad3d4351261a343c8554e408b2a2d`）。
- **注意**：桌面 profile 现在是 link 安装。如果哪天把 0.2.0 发上 npm 并"升级"，profile 会从本地目录切回 npm 包，本地改动即失效。

---

## 10. 已知坑与约束（改代码前务必读）

**① Host 读 body 超限时不要 `req.destroy()`。**
初版在超限时立刻 destroy socket，客户端拿到的是 `fetch failed / ECONNRESET` 而不是 `413`。现在的写法是：超限后继续 drain 丢弃，到 `'end'` 才 reject（`lib/index.js:474`）。改 `readBody` 时别退回去。

**② `writeJsonAtomic` 的临时文件名原本是固定的（0.2.1 已修）。**
旧写法 `const temp = file + '.tmp'`：两个并发保存会互踩同一个临时名，最坏写出被截断的配置。0.2.1 起临时名带上 pid 与随机后缀（`lib/index.js:273`），写失败时 unlink 掉临时文件再抛。测试里有一条「两次并发保存都落地且不留 `.tmp`」盯着这里。

**③ 路由注册失败曾经是静默的（0.2.1 已修，但约束仍在）。**
旧写法是 `register()` 里 `catch { }`：如果路由被别的安装或别的插件占住，插件会**能加载但接口 404**，日志里什么都没有。0.2.1 起每条路由独立注册、失败写一条 `[recharge-animation] 路由注册失败 <path>：<原因>` 的 warning（`warn()` 在 `lib/index.js`），但"注册失败"本身依旧不会让插件加载失败——排查接口 404 仍要去看日志或手动 `curl http://127.0.0.1:<port>/recharge-animation/config`。

**④ `wantsTopUp` 初值缺陷（0.2.1 已修）。**
旧代码 `var wantsTopUp = true;` 只在 `Show` 的 effect 里被 `wantsTopUp = openTopUp`（`:844`）覆盖，于是当用户把「结束后打开充值页」关掉时，**第一次点击仍然会 `requestPlatform("preload")`**（`:756`）去预热宿主唯一的 `WebContentsView`；而 preload 分支没有 close 出口，视图会停在窗口下方 60px 处。0.2.1 直接删掉了这个死变量，按钮改成从 `store.state.config.behavior.openTopUp` 读，缺陷与死代码一起消失。**改完客户端记得 `python tools/prepare.py`。**

**⑤ 宿主的原生视图永远盖在 DOM 之上。**
`PlatformView` 用的是 Electron `WebContentsView`，DOM 里只是一个占位矩形。所以**打开设置面板前必须先交还视图**——`openSettings()`（:632）里的 `requestPlatform("close")` 就是干这个的，别删。同理，面板不能"盖住"已 reveal 的充值页，只能先关掉它。

**⑥ 宿主的桥只有一份视图，且 `page` 只认 `"top-up" | "usage"`。**
`usage` 页目前没用上（可以作为后续功能）。

**⑦ 原生视图里收不到 Esc。**
三条原因（子视图不参与 DOM 事件、`keyboard` 桥在窗口失焦时收不到、宿主没转发）写在 README「关于 Esc」一节。想加"视图内退出"只能用 DOM 上的返回栏或桥消息。

**⑧ `preview.html` 的 `file://` 路径前缀陷阱。**
在 `file://` 页面里 `new URL('/recharge-animation/config', location.href).pathname` 会变成 `/D:/recharge-animation/config`（盘符混进路径），前缀匹配失败就会退到真 `fetch` 并报 `Failed to fetch`。preview 里现在用 `pathname.indexOf(ROUTE)` 取偏移（`preview.html:291` / `:297`）。新增假路由时保持这个写法。

**⑨ 本机网络对 `raw.githubusercontent.com` 时通时断。**
实测：`curl` 报 `Recv failure: Connection was reset`、`node fetch` 报 `Connect Timeout (185.199.x.x:443, 10s)`；但同一个域偶尔也能返回 404。所以 URL 导入功能**逻辑正确、但拿 GitHub raw 链接做测试会随机失败**。用 `unpkg` / 国内可达的图床做验证。`unpkg` 在本机是通的。

**⑩ pnpm 的供应链年龄策略会误伤安装。**
`pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 之外，pnpm 在**校验 lockfile** 阶段仍会拦 24 小时内的新包（本机撞到的是 `dsh-plugin-wps-office-next@0.8.2`）。一次性绕过：`pnpm add … --config.minimumReleaseAge=0`。**不要**为此改用户的策略文件。

**⑪ 这个仓库的 `.git` 曾经损坏过一次**（只剩 `objects/`、`refs/`、`ORIG_HEAD`，缺 `HEAD`/`config`/`index`，`git status` 报 not a git repository）。当时的修复是：整树备份 → `git init` → `git symbolic-ref HEAD refs/heads/main` → 重加 origin → `git reset` 重建索引。**如果哪天又出现"目录里有 .git 但 git 说不是仓库"，先备份再走这套流程，不要去 `git clone` 覆盖。**

**⑫ 权限与代理。**
本机所有涉及 `C:\Users\heida\.dsh` 或公网的命令都需要完整访问权限；沙箱内 `git credential fill`（GCM 报 Win32 error 5）、`ls-remote`（`SEC_E_NO_CREDENTIALS`）、无头 Edge（crashpad）、`curl`（`CRYPT_E_NO_REVOCATION_CHECK`）都会失败。IE 代理设置为空（`ProxyEnable=0`），环境变量里也没有 `HTTP(S)_PROXY`。

**⑬ 动画里那行文字的淡入延迟曾经写死 700ms（0.2.2 已修）。**
`.dra-hint` 原本是 CSS 里的 `transition: opacity .4s ease .7s`，而「总时长」可以设到 600ms（最短 200ms）：动画在提示开始淡入之前就 `dra-end` 并卸载了，于是**用户填的「跳过提示」文字一次都不会出现**（默认 0.6s 时长下 100% 复现）。0.2.2 起改为渲染时写 `style.transitionDelay`，「延迟 = min(700, max(140, 总时长 × 0.3))」，帧循环到 30% 时才加 `dra-show`。同一改动把该字段改名「动画内显示文字」、允许留空（留空时 `hint` 为 null、整块不渲染，只剩图标 + 进度条），并**与「可跳过」解耦**：以前文字只在 `skippable` 为真时显示，判定还写成 `previous.labels.skipHint ||`（把「用户清空」和「字段缺失」混为一谈，清空后又回退成默认文案）；现在文字只取决于文案本身是否为空，`skippable` 只管「点击跳过」这个行为。

---

## 11. 待优化清单（按建议顺序）

1. ~~**修 `wantsTopUp` 初值**（§10-④）~~ —— **0.2.1 已修**：死变量删除，按钮改为读配置。
2. ~~**给 URL 导入加网络诊断**~~ —— **0.2.1 已做**：`describeFetchError()` 把 `fetch` 的 `cause` 归一成超时 / 连接被重置 / DNS 失败 / 证书错误 / 地址本身不合法（`bad port`），客户端再叠一层「超时 vs 连不上」的区分。注意 `http://127.0.0.1:1` 这类端口会被 undici 判成 `bad port`（根本没开 socket），要测"连接被拒"请用高位端口（测试里统一用 `65500`）。
3. ~~**`preview.html` 的 React 依赖**~~ —— **0.2.1 已做**：页面末尾的加载器按「本地 `vendor/` → unpkg → jsDelivr」逐级尝试，每级带超时（2s / 8s / 8s），全部失败时在底栏写明原因并给「重试」按钮；主逻辑改挂在 `window.__bootPreview__`，React 就绪后才启动，所以不再有「静默等十几秒」。想彻底离线就把两个 React UMD 文件放进 `vendor/`（该目录不在 `files` 白名单里，可选）。
4. ~~**并发安全**（§10-②）与**注册失败可观测**（§10-③）~~ —— **0.2.1 已做**：路由注册失败改为 warning 日志；`writeJsonAtomic` 的临时名改成 `file.<pid>-<random>.tmp`（`lib/index.js:273`），并发保存不再互踩，写失败时 unlink 清理临时文件。（2026-10-13 勘误：本行原写「固定临时名仍在」，与代码不符。）
5. ~~**回归测试入库**~~ —— **0.2.1 已做**：迁到 `tools/tests/`，加了 `test` / `test:host` / `test:url` / `shot` 脚本，断言从 15 项扩到 19 项；**0.2.2 又加到 20 项**（新增「动画内文字可以清空保存」）。
6. **`prefers-reduced-motion`**：动画目前无降级；可跳过动画、直接 reveal。**（未做）**
7. **i18n**：面板与错误文案目前全是中文硬编码（Host 半的错误文案会被客户端原样显示，所以两半要一起改）。**（未做）**
8. **抽公共内核**：与 `dsh-startup-animation` 有不少同构代码（毛玻璃舞台、进度信号、座位注册、平台视图），可以考虑抽一个共享的 runtime 包。**（未做）**
9. **`usage` 页**：宿主的桥支持 `page: "usage"`，可以做成"用量"入口。**（未做）**
10. ~~**CI 自动发布**~~ —— **0.2.1 已做**：新增 `.github/workflows/ci.yml`。`verify` 作业（push / PR）跑 `python3 tools/prepare.py` 并用 `git diff --quiet -- lib/client.js` 卡住「模板改了但没重新生成」，装 `@deepseek-ai/schemastery`（宿主的可选依赖，装上 `Config` 断言才走真检查），再跑 `npm test`（`npm run test:url` 需要网络，`continue-on-error`）；`release` 作业只在 `v*` tag 上跑，先比对 tag 与 `package.json` 版本，再 `npm pack`；Release 不存在就 `gh release create --generate-notes`，**已存在且已有同名资产时保留现有字节流不覆盖**（避免同一个 tag 被手工发布与 CI 各打包一份、sha 不一致），缺该资产才 `gh release upload`。注意 Actions 里的 `python3` 是 runner 自带，仓库不需要额外配置。
11. ~~**动画里那行文字不显示**~~ —— **0.2.2 已修**（2026-10-13）：详见 §10-⑬。

---

## 12. 接手检查表

- [ ] 读 `README.md`（讲的是对外行为）→ 再读 `lib/index.js`（899 行，全是业务规则）→ 最后读 `src/client.template.js` 的 §4.2/§4.4/§4.5 三块。
- [ ] 确认本机 profile 仍是 link：`Select-String -Path "$env:USERPROFILE\.dsh\profiles\desktop\package.json" -Pattern recharge`，应看到 `link:D:/下载/heidashuai/dsh-recharge-animation`。
- [ ] 跑一遍 `npm test`，确认 20 项还是全绿（改 Host 半前后各跑一次）；动了 `import-url` 再跑 `npm run test:url`。
- [ ] 改客户端后：`python tools/prepare.py` → `npm run shot` 截图核对 → 重启 DSH 真机确认。
- [ ] 提交前把 `CHANGELOG.md` 与 `package.json` 的版本号一起改。

---

## 13. 本文件的状态

本文件是新增的，**不在 `package.json` 的 `files` 白名单里**（因此不会进 npm 包与 tgz）。0.2.1 这一轮（2026-10-13）更新过 §0 版本表、§7.1/§7.2/§7.3 工具箱说明、§10-③/④ 状态、§11 清单（第 1/2/3/5/10 项已做）与 §9.1 参考数据；**0.2.2（同日）**又更新了 §0 版本表与代码规模、§7.3 断言数、§10-④ 与新增 §10-⑬、§11 全表（含勘误第 4 项）、§12 检查表、§9.1 参考数据；其余小节仍是 0.2.0 时期的描述。若要入库：

```powershell
& "D:\Git\cmd\git.exe" -C dsh-recharge-animation add HANDOVER.md
& "D:\Git\cmd\git.exe" -C dsh-recharge-animation commit -m "docs: add handover notes for future work"
```
