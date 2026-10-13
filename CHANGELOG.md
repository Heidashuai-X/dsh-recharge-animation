# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.2.0] - 2026-10-13

设置面板：右键侧边栏的「充值」按钮打开，动画、图标、音效、文案都能在这里改。

### Added

- **设置面板**（`shell.overlay` 座位，深蓝实心按钮风格）：右键入口按钮唤出，改动先落在草稿上，点「保存」才写入；底栏为「取消 / 恢复默认 / 保存」。
- **图标库**：导入自己的开场面图，动画中央不再固定用内置 Logo；缩略图网格点选切换，右上角可删除。
- **三种导入方式**：文件选择器、把文件**拖进面板**（按 MIME 分派到图标或音频）、**URL 导入**（由 Host 半下载，绕过浏览器 CORS）。
- **音效三槽位**：开场一声、背景循环（收尾淡出、跳过即截断）、收尾一声；每个槽位独立音量（0–100）与「试听」。
- **全局静音**：一键关掉全部音效，试听按钮同步禁用。
- **文案可改**：侧栏按钮名与「点击跳过」提示。
- **动画参数**：总时长、最短时长、顶部偏移、进度模式、可跳过、结束后是否打开充值页（原管理器里的 6 项搬进面板）。
- **预设**：图标 + 三个音效 + 三个音量打包成一套；「另存为」新建、点击即切换（立即生效）、可重命名与删除。预设不含文案与行为参数，切预设不会悄悄改行为。
- **资源管理**：列出全部已导入素材（缩略图、文件名、体积、总计），逐项删除时自动清掉所有引用。
- **Host 半新增三条路由**：`GET|PUT /recharge-animation/config`、`GET|POST|DELETE /recharge-animation/assets`、`POST /recharge-animation/import-url`。
- 素材与配置落在 `$DSH_HOME/recharge-animation/`（`config.json` + `icons/` + `audio/`）。

### Changed

- **插件管理器里的 Config 只剩 `enabled`**（总开关）；其余 6 项行为参数改在设置面板里改，旧配置在首次读取时自动迁移成面板的初始值。
- 素材上传走 **raw 二进制 body**（不经 base64），比 data URI 小约 1/3；格式与体积由 Host 半按**文件魔数**判定（图标 ≤ 4MB：png/jpg/webp/gif；音频 ≤ 8MB：mp3/wav/ogg/m4a）。
- `preview.html` 升级为「带假 Host 的完整预览」：内置内存版 Host 半（含素材服务），脱离 DSH 也能试完整个面板与动画。

### Notes

- 打开面板前会先交还原生平台视图：原生子视图永远盖在 DOM 之上，不交还的话面板根本看不见。
- URL 导入由 Host 半发起，带四道闸：只允许 http/https、以响应 `Content-Type` 判类型、体积上限、15 秒超时与 5 次重定向上限。

## [0.1.0] - 2026-10-12

首个版本。

### Added

- 侧边栏底部「充值」入口（`sidebar.footer.action` 座位，窄栏自动收成图标）。
- 满屏毛玻璃开场动画（`shell.overlay` 座位）：品牌 Logo + 真实进度条，四个真实信号把进度顶到 96%、时间兜底同时给出下限与上限；可点遮罩、`Esc`、空格、回车跳过。
- 动画收尾时用 DSH **内置平台视图**（Electron `WebContentsView`）打开官方充值页 `platform.deepseek.com/top_up`，并在动画落幕后由下向上滑入。
- 预热机制：点击入口时先把原生视图开在窗口外加载，动画播完只做位移动画，消除交接延迟。
- 配置 7 项：`enabled`、`duration`、`minDuration`、`skippable`、`progressMode`、`openTopUp`、`platformTop`。
- 三层降级：桥不存在 → `window.open`；宿主拒绝打开视图 → `window.open`；弹窗被拦 → 隐藏 `<a target="_blank">` 点击兜底。
- `preview.html`：脱离 DSH 的独立预览页。

### Notes

- 与 [`dsh-startup-animation`](https://github.com/Heidashuai-X/dsh-startup-animation) 同源，两个插件可以共存。
- 原生视图聚焦时键盘输入不经过渲染进程，**视图内按 `Esc` 无法关闭**，退出走顶部「← 返回」。
