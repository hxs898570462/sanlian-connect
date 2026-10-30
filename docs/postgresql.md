# PostgreSQL 改造与验证

日期：2026-10-30（Asia/Hong_Kong）。工程：D:\XJTLU\ENT\sanlian-connect。

## 已完成

运行时已由 node:sqlite 切换为 node-postgres（pg）连接池。现有前端接口形状不变；账号角色仍为 user / stuff，权限仍在后端执行。数据库保存原有 7 类业务表，并新增 schema_migrations 结构版本表。

- 查询改为异步调用、PostgreSQL $1/$2 参数。
- instr 改为 strpos；邮箱大小写唯一通过 lower(email) 唯一索引保证。
- 时间改为 TIMESTAMPTZ，接口继续返回 UTC ISO 字符串；费用继续使用整数分。
- sessions.expires_at 改为 BIGINT，保留原会话到期的毫秒表示。
- 反馈增加复合外键，确保报名、用户和活动的归属一致。
- 每个事务从池中取得一个连接，在同一连接上执行 BEGIN / COMMIT / ROLLBACK；失败后释放连接。
- 正常启动和管理脚本统一读取 DATABASE_URL，可自动读取工程 .env；DB_PATH 不再使用。

## 并发报名的约束

报名、取消、管理员恢复/取消报名、修改容量均先锁定对应 activities 行。取得锁后，在另一条 SQL 中重新计算有效报名人数，再决定是否写入。后端使用 READ COMMITTED，使等待活动锁的请求能在后续查询中看见前一事务提交的报名。

不能在等待锁之前读取人数，也不能把人数查询与等待行锁混在同一条可能使用旧快照的聚合查询中。one_active_registration 部分唯一索引继续保证一个账号每个活动只有一条有效报名。

管理员角色变更使用数据库级事务咨询锁串行化，并在取得锁后再次核对操作者当前会话/角色，防止两个管理员并发互相降级后无人管理。失败的管理修改和操作日志会一并回滚。

## 原数据库迁移结果

已从项目原 SQLite 建立一致性备份并导入本地真实 PostgreSQL 18.4。没有上传任何真实数据到云端或 Softr。

| 表 | 迁入记录数 | 数据库重启后逐字段匹配数 |
| --- | ---: | ---: |
| users | 1 | 1 |
| activities | 6 | 6 |
| registrations | 1 | 1 |
| feedbacks | 0 | 0 |
| books | 2 | 2 |
| operation_logs | 2 | 2 |
| sessions | 1 | 1 |

匹配包含账号 ID、密码哈希、角色、关联、报名资料、会话和时间；没有把这些私有值输出到报告。时间按同一 UTC 表示归一化后比较。记录数反映迁移时快照，后续网页操作可能增加记录。

原 data/sanlian.sqlite 和 before-postgres 备份保留，迁移器以只读打开源库。PostgreSQL 数据在 data/postgres，连接凭据在忽略提交的 .env / data/postgres-local.json。不要将这些运行数据提交 Git。

迁移工具仅向业务表全空的目标库导入；锁定目标表并使用完整事务。重复导入会拒绝，约束或时间错误、超额报名会回滚；不会自动覆盖或清空已有用户。

## 真实数据库验证结果

最终 npm test：**29 项通过，0 失败**（包含父测试）。使用真实 PostgreSQL 18.4，隔离的临时数据库，两个独立 HTTP 服务及两个独立连接池。不是 SQLite 或内存 SQL 模拟器。

| 验证 | 结果 |
| --- | --- |
| 24 个账号、两个服务并发争抢最后一席 | 1 次成功，23 次名额冲突；有效人数 1 |
| 同一账号 12 次并发报名 | 1 次成功，11 次冲突；有效报名 1 |
| 管理员恢复报名与普通用户争抢末席 | 仅一个成功，另一个冲突；未超额 |
| 管理员减容量与新报名竞争 | 一个操作成功，另一个冲突；人数不超过容量 |
| 普通用户读取/修改他人数据、访问后台 | 被拒绝；本人反馈及回复正常 |
| 管理员用户/报名/反馈/活动与日志 | 正常 |
| 账号停用或降级后的旧会话跨实例访问 | 失效 |
| 两个管理员并发互相降级 | 仅一方成功，保留一位启用管理员 |
| 服务连接池重启、退出 | 数据/会话按预期保留或失效 |
| 新建及提升管理员命令 | PostgreSQL 目标库中生效，保留原密码 |
| SQLite 旧角色映射、备份、关系保留 | 通过 |
| 源数据违反新约束时导入 | 全部回滚，目标库无半套记录 |

## 启动与云端边界

本地：先在终端一运行 npm run db:local，终端二运行 npm run dev。已迁移的本工程无需再次导入。

连接 Neon 时由负责人设置私有 DATABASE_URL，使用平台给出的 TLS 连接串；不会把本地 .env 推送到 GitHub。新 Neon 空库启动会建立表，但导入实际数据需要单独执行迁移工具并核对目标。

尚未建立 Neon 项目、部署 Render 或验证公网连接。当前 HTTP 服务的本机监听与域名限制仍保留；部署前还需完成相应配置、HTTPS 代理及线上验收。免费的服务额度和休眠规则仍按合作文档执行。

## 参考

- [node-postgres 事务要求](https://node-postgres.com/features/transactions)
- [PostgreSQL 显式锁](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL 事务隔离](https://www.postgresql.org/docs/current/transaction-iso.html)

