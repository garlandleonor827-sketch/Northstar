# Northstar / 北辰 · 本地开发版

这是按交接合同实现的 Windows 优先本地开发版。当前可以用 Vite 在本机运行 Today 工作台，也可以用 Tauri 2/Rust 启动原生开发窗口；本轮不制作安装包。SQLite、Windows 凭据库和真实 Provider 仍属于后续验收范围。

## 运行

```powershell
npm install
npm run dev
```

打开 `http://127.0.0.1:4173/`。构建检查使用 `npm run build`，领域与 Provider 测试使用 `npm test`，交接包参考规则单独使用 `npm run test:contract`。

Windows 原生开发窗口需要 Rust MSVC、Visual Studio C++ 工具链和 WebView2。当前项目把 Rust 工具链放在项目盘，使用下面的命令启动；它只运行开发窗口，不生成安装包：

```powershell
$env:RUSTUP_HOME='D:\desktop\Northstar\rustup'
$env:CARGO_HOME='D:\desktop\Northstar\cargo-home'
$env:PATH="$env:CARGO_HOME\bin;$env:PATH"
npm run tauri:dev
```

可用 `npm run tauri:info` 检查 Windows 原生开发依赖。若只想运行浏览器开发版，不需要设置这些变量。

也可以双击项目根目录的 `Start Northstar.lnk`。它会以隐藏终端启动同一个 Tauri 开发窗口；关闭 Northstar 后，开发进程随之结束。快捷方式是本机生成的，不提交到仓库；脚本 `Start-Northstar.ps1` 和 `Start-Northstar-hidden.vbs` 会随源码保留。

当前开发版默认无 Key，核心规划、任务记录、复盘提案、灵感冷却、记忆确认/删除、成长去重和 JSON 导出均可离线使用。所有候选变更先经过 `src/lib/domain.ts` 的权限、版本、容量、保护项、依赖、幂等、审计与撤销检查。

## 阶段记录

- P0：Today 深浅主题、响应式首屏、WebGL 程序化 Core、静态降级、无 Key 演示和真实 DOM 交互。
- P1：本地持久化开发存储、战略/任务/记录、软容量、停车场、记忆、成长规则、审计与撤销。
- P2：兼容 Chat Completions Provider 适配器，包含 API Root 规范化、HTTPS/环回限制、超时、取消、有限重试、流式截断与上下文授权；未使用真实 Key。
- P3：复盘提案审批、经验事件去重/封顶/更正、导出导入边界。
- P4：已完成基础类型、构建、单元、契约、浏览器交互和 Windows Tauri 开发窗口启动检查；SQLite、系统凭据库、真实 API 和完整 DPI/帧率验收未验证。

详见 [KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md)、[qa/ACCEPTANCE_REPORT.md](qa/ACCEPTANCE_REPORT.md) 和 `qa/logs/`。

## 交给 Codex
解压整个文件夹到项目目录。把下面这段直接交给 Codex：

> 阅读 AGENTS.md 和 PRODUCT_CONTRACT.md，查看 assets/ui/ 中的设计参考图。
> 按合同 P0→P4 实施，先做可运行的 Windows 本地开发版，不做安装包。
> 将权限、幂等、撤销和防刷经验规则落实在后端；不能只靠提示词。
> Core必须实时程序化，PNG仅作降级。深浅主题都要完成。
> 逐阶段测试并提供真实日志；缺Windows环境或真实API凭据就标未验证，不得冒称完成。
> 不扩大范围；现在开始检查目录、输出短实施清单并执行P0。

## 只需要先看这几项
- [主合同](PRODUCT_CONTRACT.md)：功能、权限、范围、开发顺序。
- [视觉规范](design/DESIGN.md)：深浅主题、核心、布局和动效。
- [素材目录](assets/ASSET_GUIDE.md)：可直接使用的素材与不能冒充组件的参考图。
- [验收标准](ACCEPTANCE.md)：Codex完成应用时需要执行的检查。
- [本次检查结果](qa/REPORT.md)：交接包实测范围与未验证项。

## 包内内容
`assets/ui/` 深色首页、浅色首页、AI复盘、核心进化方向图。
`assets/core/` Core透明PNG/WebP；`assets/brand/` 原创矢量图标。
`design/tokens.json` 颜色/字号/间距；`contracts/` 数据与变更契约。
`reference/` 确定性权限/容量/经验参考函数；`tests/` Node测试与包校验。
`MANIFEST.sha256` 文件校验；`qa/` 本轮日志、报告。

静态素材不是glTF模型，不包含着色器或3D动画成品。参考图数据是演示数据。
API测试需要你自行在本机填写凭据。不要把密钥发给本包、写进对话或提交到仓库。
