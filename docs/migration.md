# Softr 结构与本地迁移映射

当前本地运行时已切换 PostgreSQL，原 SQLite 已备份并完成本地导入，详见 [PostgreSQL 改造与验证](postgresql.md)。下面 Softr 盘点及字段映射保留作历史来源；本次没有向 Softr 或 Neon 迁入数据。

核对日期：2026-10-30，Asia/Hong_Kong。来源为 Softr 连接器只读查询。完整字段、关联、页面、记录数和 VIEW 限制见 `softr-structure-2026-10-30.json`。未拉取用户记录，未迁移密码、电话或其他真实内容。

## 工作区与页面

工作区 `fa0b9a3a-69aa-4221-a59d-293a498d3dc7` 中有 Sanlian App、Sanlian Connect for C、Sanlian Connect for B 及两个其他应用。C 为本地第一阶段的主要参照，B 端仅核对页面清单。

C 包括首页、活动、活动详情、我的预约、活动反馈、会员列表/详情、账号和登录相关页面；反馈管理与反馈提交成功页被禁用。活动详情以 Vibe block 实现，旧详情和名单块被禁用。

**历史差异**：C 的 API `published` 已为 `2026-10-30T01:29:54Z`（本地时间 09:29:54），不再是 10 月 26 日交接所记的未发布状态。此字段不证明最新编辑已全部发布，也不证明实际业务验收通过。本轮没有发布或修改 Softr。

## 数据库与映射

| 远端表 | 核对记录数 | 本地对应 / 当前阶段 |
| --- | ---: | --- |
| Users | 17 | users；本地独立认证，角色为 reader/staff/manager，游客是未登录状态 |
| activity | 8 | activities；保留标题、分类、时间、地点、容量、费用和发布状态 |
| registration | 32 | registrations；保留用户/活动关系、姓名、电话、状态、凭证、同意时间 |
| book | 8 | books；仅建示例展示，后续核对书目后迁入 |
| _order | 8 | 后续 orders，不直接沿用下划线命名 |
| food_item | 0 | 后续 food_items |
| order_item | 0 | 后续 order_items，金额以整数分表示 |
| operation_log | 0 | operation_logs，已记录本地店长创建活动 |
| Feedbacks | 14 | 属于会员服务反馈，须与活动反馈区分后再迁移 |
| Members | 8 | 后续 members；含余额、积分等，不自动推断用户关系 |

另有 `BookRecommendation` 数据库（Users 5 条、Books 10 条），Books 含 BookName、Author、BookTags（多选）、Intro、Rating、ISBN。它与主库 book 并非同一张表，需确认去重规则和推荐流程后合并。还有 Untitled Database / Table 1（3 条），未归入第一阶段。

## 已确认的断开引用

- 原活动反馈表 `3MwTRjVkVcMm6z` 的 get_table 返回 NOT_FOUND。
- C 活动反馈 block `bf32dd99-bc5f-44ce-ad91-0bec41907c14` 仍引用该 ID。
- Users、activity、registration 的关联字段以及一条 VIEW 限制也仍引用旧 ID。
- 新 Feedbacks 通过“会员卡号”关联 Members，不能直接替代原“用户—活动—报名”的反馈关系。

本地 `feedbacks` 本阶段明确用于活动反馈，通过报名验证归属和活动结束时间。将来迁移会员服务反馈时需独立模型或明确类型；不得把两套反馈无条件混合。

## 关键业务差异

- 用户归属使用稳定的 user_id 外键，不依赖浏览器传入的 user_id 或邮箱筛选。
- enrolled_count 从有效报名汇总，不迁入旧的冗余计数作为事实。
- 活动费用和书价使用整数分，UTC ISO 时间入库、北京时间显示。
- 双向 LINKED_RECORD 在 SQL 中改成单向外键及查询；公式/LOOKUP/ROLLUP 需要转为查询逻辑。
- 已发布和未删除条件在后端执行。本人记录读写限制由后端检查；不依赖页面隐藏。
- 远端 Role 当前选项为 staff/guest，本地新增 reader/manager 是本轮工程决策，不代表远端已有这些角色。

## 后续真实迁移顺序

1. 确定需要搬迁的数据范围，先做导出备份和字段映射；schema 快照不是记录备份。
2. 明确 Users 与 Members、两套书目/反馈的关系；排除失效引用。
3. 导入公开内容；保留 source_id 以便追踪与避免重复导入。
4. 设计账号激活/密码重设，确认后再导入私有业务数据和对应关系。
5. 核对记录数、外键、状态、时区、金额、人数和两个账号的数据隔离。

当前没有执行以上真实数据迁移，也没有声称 Softr 断开引用已经修复。

## 本地 v2 角色更新（2026-10-30）

本地角色现统一为 user / stuff，替代本说明早期提到的 reader/staff/manager。v1 数据库升级会先备份，并映射 reader → user、staff/manager → stuff，保留账号 ID 与关联记录。该升级仅针对本地数据库，不改变 Softr 角色或记录。权限详见 access-control.md。
