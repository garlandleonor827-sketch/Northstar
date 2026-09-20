# Known limitations

## 当前已验证

- Windows 10.0.26200 / Node `v24.14.1` / npm `11.9.0`：TypeScript 类型检查、Vite 生产构建、15 个本地领域/Provider 测试通过。
- 交接包参考规则：`node --test tests/contract.test.mjs` 的 45 个测试通过。
- 本地浏览器中已检查 Today、任务记录、深浅主题、战略与计划页和容量调整入口；Core 正常路径显示 WebGL 程序化几何，减少动效/渲染失败显示对应静态 PNG。
- Windows 原生开发依赖：WebView2 `153.0.4234.32`、Visual Studio Community 2026、Rust MSVC `1.98.1`、Cargo `1.98.1`；`cargo test --manifest-path src-tauri/Cargo.toml` 的 1 个 Rust 幂等测试通过。
- `npm run tauri:dev` 已在 Windows 上完成首次编译并启动 `target\debug\northstar.exe`，开发窗口启动日志见 `qa/logs/windows-tauri-dev.log`；本轮没有执行打包。

## 未验证 / BLOCKED

- Tauri 原生窗口已验证能编译和启动；SQLite 迁移、Windows 凭据库（CredWriteW）、系统 DPI/帧率、屏幕阅读器和多尺寸原生窗口仍为 **BLOCKED / 未验证**。
- 没有真实 Provider API Key；真实端点、服务商兼容性、TLS/重定向实测、SSE 供应商差异均为 **BLOCKED / 未验证**。Provider 只用本地 mock fetch 测试。
- 当前 Vite 开发版使用浏览器本地存储作为无 Rust 时的可运行开发后端；它不是 SQLite 一致性快照，也不声称整库加密。Tauri/Rust 落地前不应把它当生产数据层。
- 尚未完成真实 Windows 机器上的 1600×1000、1280×800、1024×720、125%/150% DPI、帧率和屏幕阅读器验收；CSS 已提供相应布局断点与焦点样式。
- 未制作安装包、自动更新、账号、云同步、外部平台集成，符合本轮范围。
