# Northstar acceptance report

日期：2026-09-20  
验证环境：Windows 10.0.26200 主机；Node/Vite 开发版；Rust MSVC、Cargo、WebView2 和 Visual Studio C++ 工具链可用；未提供真实 Provider Key。

状态只使用 `PASS / FAIL / BLOCKED`。`BLOCKED` 表示当前缺少 Tauri/Rust、真实端点或完整原生验收条件，不把 mock 或浏览器开发版冒充成已完成验收。

| ID | 状态 | 证据 / 边界 |
|---|---|---|
| A01 | BLOCKED | Today 可记录任务、复盘提案并使用本地持久化；初始化向导、确认季度主线和重启后的完整端到端路径未完整实现/验证。 |
| A02 | PASS | `tests/domain.test.ts` 验证容量降到 240 分钟、软排程受限且任务定义保留；UI 提供 4h 快捷入口。 |
| A03 | BLOCKED | 锁定事项/硬截止冲突由领域层保护；恢复模式暂停可选行动尚未接入完整流程。 |
| A04 | BLOCKED | 当前 demo 只有一个主线和责任任务；多主线审批与维护/停车场分类尚未完成全流程。 |
| A05 | BLOCKED | 周变更命令白名单会拒绝越权字段；年度目标、财务、过去耗时和权限的完整 Rust 命令面尚未接入。 |
| A06 | PASS | 领域测试覆盖同 requestId 重放、同 ID 不同内容拒绝、旧版本拒绝和撤销版本冲突。 |
| A07 | BLOCKED | 批处理 clone 回滚和撤销已测；SQLite 崩溃注入与原子事务尚未在 Rust/SQLite 环境验证。 |
| A08 | BLOCKED | 灵感默认 14 天冷却和状态模型已实现；提前升级的替代主线确认 UI 尚未完成。 |
| A09 | BLOCKED | 缺失记录返回未知、覆盖度测试通过；恢复周与全部下降证据链尚未完成。 |
| A10 | BLOCKED | 候选记忆确认/删除和来源字段已实现；检索索引排除及旧备份提醒尚未完整接入。 |
| A11 | PASS | 成长事件确认、去重、周期封顶、撤销和最高阶段不下降由 `NorthstarStore` 与测试覆盖。 |
| A12 | PASS | 两类 Chat Completions mock、候选结构严格校验、手填 model、能力降级和有限重试单测通过；真实 Provider 未测。 |
| A13 | BLOCKED | 401、5xx、非法 JSON 和基础拒绝路径已测；429、超时、取消、SSE 截断的完整组合尚未形成 E2E 报告。 |
| A14 | BLOCKED | `/v1`、自定义 root、HTTPS 和环回限制已测；真实重定向跨主机防泄露尚未联调。 |
| A15 | BLOCKED | 开发版 AppState 不含 Key，Provider 适配器只在请求内持有凭据；Windows 凭据库、Tauri capabilities 实际运行和前端持久缓存审计未验证。 |
| A16 | BLOCKED | JSON 导出/导入结构拒绝已测；SQLite 一致性备份、旧库迁移和原子替换未验证。 |
| A17 | BLOCKED | 深浅主题、响应式 CSS、参考浏览器截图通过；125%/150% DPI 和三种原生窗口尺寸未在 Windows Tauri 实测。 |
| A18 | PASS | 浏览器 AX 显示“实时程序化核心”；Three.js WebGL 几何、减动效/渲染失败 PNG 降级和页面隐藏暂停代码已实现并人工观察。 |
| A19 | BLOCKED | 焦点样式、可读标签、取消/空/失败基础状态已提供；完整键盘遍历、屏幕阅读器和动画跳过验收未完成。 |
| A20 | BLOCKED | ISO 周起点和本地时区字段存在；跨午夜、DST、重启专注计时及独立实际耗时尚未实现完整测试。 |
| A21 | BLOCKED | 当前未提供财务快照页面；不做交易/理财，但该交付项仍未完成。 |
| A22 | PASS | 无 Provider 时核心规划、任务记录、复盘、灵感、记忆和导出不依赖网络；服务商失败不自动切换。SQLite/Tauri 运行边界另见 A23。 |
| A23 | BLOCKED | Tauri 开发窗口已在 Windows 上编译并启动，Rust 幂等单测通过；Windows CredWriteW、SQLite 迁移、系统 DPI/帧率和完整原生窗口验收仍未完成。 |
| A24 | BLOCKED | 未提供真实 Key；mock 不能计作真实端点联调。 |

## 阶段结果

- **P0：PASS（开发版范围）** — Today 深浅主题、真实 DOM 交互、Three.js 程序化 Core、静态降级、无 Key 演示。
- **P1：PASS（领域服务/开发版范围）** — 任务、记录、容量、停车场、记忆、成长、审计/撤销和导入导出边界；SQLite 原生层 BLOCKED。
- **P2：PASS（mock 范围）** — Provider endpoint、上下文授权、候选 schema、401/5xx/流式解析代码与 mock 测试；真实 API BLOCKED。
- **P3：BLOCKED** — 复盘提案和成长规则有最小实现；财务快照、完整备份恢复和记忆索引未完成。
- **P4：BLOCKED** — Windows Tauri 开发窗口已启动并保存日志；完整 DPI/性能/无障碍验收、SQLite/CredWriteW 和真实 API 仍缺少实现或凭据。

## 命令日志

- `qa/logs/p0-typecheck.log`
- `qa/logs/p0-build.log`
- `qa/logs/p0-browser.md`
- `qa/logs/p1-p3-vitest.log`
- `qa/logs/reference-contract.log`
- `qa/logs/bundle-integrity.log`
- `qa/logs/final-typecheck.log`
- `qa/logs/final-build.log`
- `qa/logs/final-vitest.log`
- `qa/logs/final-contract.log`
- `qa/logs/final-bundle.log`
- `qa/logs/windows-tauri-info.log`
- `qa/logs/windows-cargo-test.log`
- `qa/logs/windows-tauri-dev.log`
