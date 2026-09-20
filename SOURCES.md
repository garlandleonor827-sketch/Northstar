# 实现参考（官方文档，核对日期 2026-09-20）
以下来源用于确认接口与安全机制；本包的功能阈值、XP和设计均为产品规则，不声称研究结论。

- S1 OpenAI Chat API Reference：https://developers.openai.com/api/reference/resources/chat
  兼容适配器以Chat Completions为公共接口；不同供应商能力仍需实测，不能由该文档推定第三方兼容程度。
- S2 OpenAI Structured Outputs：https://developers.openai.com/api/docs/guides/structured-outputs
  需要处理结构化输出、拒绝与未完成输出；本地schema/权限校验不能省略。
- S3 Tauri 2 Capabilities：https://v2.tauri.app/security/capabilities/
  限制窗口可以调用的命令；仍需领域层授权与数据约束。
- S4 Microsoft CredWriteW：https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew
  Windows凭据存储由后端封装；不要把加密Key等同于整库加密。
- S5 W3C WCAG Contrast Minimum：https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
  用于文字对比度验收。
- S6 W3C Animation from Interactions：https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
  用于动效关闭/减弱的设计依据。
- S7 Codex AGENTS.md：https://developers.openai.com/codex/guides/agents-md/
  AGENTS.md作为本地开发指引；本文件不能越过运行环境或更高层安全规则。

未提供API Key，未调用真实收费接口。未承诺任何模型可用性、定价、令牌窗口或第三方数据留存政策。
