# 数据与边界（实现自由，语义固定）

| 实体 | 关键字段/约束 |
|---|---|
| profile / principles / constraints | value、source、confirmed_at、valid_from/to；未知为null，不能补造 |
| goals | parent_id、horizon、status、version；父子无环，已确认/草稿分开 |
| projects | goal_id、kind(primary/maintenance/responsibility)、active；季度仅一条active primary |
| weekly_plans | approved_outcome、focus_id、capacity_minutes、start_local_date、timezone、version |
| tasks | goal_id、plan_id、definition、acceptance、estimate、soft_slot、hard_due、pinned、dependencies |
| execution_records | task_id、actual_minutes、result、note、recorded_at；用户事实，不由AI改写 |
| checkins / reviews | 输入事实、覆盖度、AI解释、用户确认、period_key；无记录≠0 |
| ideas | 内容、冷却截止、状态、替代对象、提前升级理由 |
| memories | content、source_ids、kind(statement/observation/inference)、candidate/confirmed、版本 |
| proposals | 基础版本、影响对象、理由、证据ID、变更集、pending/approved/rejected/stale |
| commands / audits | request_id、canonical_hash、before/after、actor、reason、version、undo_of |
| experience_events | rule_version、unique_source_key、award、review_period；事件去重与封顶 |
| core_profile | valid_xp、highest_stage、状态/依据；最高阶段与短期状态独立 |
| finance_snapshots | integer_minor_units、currency、个人/家庭归属；不是银行流水 |
| providers / role_bindings | api_root、credential_ref、model_id、capabilities；不保存明文Key |
| ai_requests | context_ids/version、目标站点、用户授权、状态、错误码、时延；内容日志默认关闭 |

## 提交管道
AI完整输出 → JSON结构校验 → 领域命令白名单 → 数据/关系/权限/容量检查 → 提案或事务 → 审计 → UI回执。
模型返回的`approval`、置信度、证据文本都不等于授权；只信任本地确认动作及可查询的source_id。
自动计划仅调整approved scope内已存在任务的软排程；新任务/定义变化先提案。
导出schema的版本独立于应用版本；迁移必须可测试；财务/实际记录缺值不转0。

## 幂等与并发
同request_id同内容：返回既有结果；同request_id不同内容：拒绝。
base_version过期：不落库，返回stale并展示当前版本；不得无声覆盖用户手工编辑。
审批时再校验所有受影响对象；提案过期需重算，不把“曾经批准”视为永久授权。
撤销只能在目标版本尚未再变时补偿；否则进入冲突处理。
相关对象变更+审计+经验奖励应同事务，应用崩溃后不得出现只发经验未完成任务。

## 备份与隐私
内置导出JSON/Markdown以及一致性SQLite备份；提供完整恢复和预览，不仅一个“下载”按钮。
默认手动导入整份替换，先备份当前库；失败保留当前数据。不首发复杂合并逻辑。
备份manifest包含schema版本、hash、时间；凭据排除，恢复后要求重新配置。
删除记录同步去除索引/摘要中对应记忆或标记待重新生成；明确提醒旧备份仍可能存在。
