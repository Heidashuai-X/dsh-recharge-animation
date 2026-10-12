# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与[语义化版本](https://semver.org/lang/zh-CN/)。

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
