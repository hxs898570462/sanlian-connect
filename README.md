# Sanlian Connect · PostgreSQL 版

前端为 HTML / CSS / 原生 JavaScript，后端为 Node.js / Express，数据库现为 **PostgreSQL**。保留 user / stuff 用户组、活动、报名、反馈和管理后台。运行时不再读取 SQLite；node:sqlite 仅用于一次性旧数据导入及迁移测试。

小组合作见 [合作文档](docs/team-collaboration.md)，权限见 [权限说明](docs/access-control.md)，数据库改造见 [PostgreSQL 说明](docs/postgresql.md)。

## 本地启动

需要 Node.js 22.20.0 或以上兼容版本。首次下载工程运行 `npm ci`（包含本地 PostgreSQL 开发工具；生产环境可仅安装生产依赖）。

终端一，在工程目录运行：

```powershell
npm run db:local
```

这会启动真实 PostgreSQL，仅监听本机 127.0.0.1:55432，不安装系统服务；数据在 data/postgres，随机生成的连接配置写入被忽略提交的 .env（仅当该文件不存在时）。已有 .env 原样保留。终端保持运行，Ctrl+C 停止数据库。

终端二运行：

```powershell
npm run dev
```

浏览器打开 http://localhost:3000 。普通启动可用 `npm start`。先停止网页服务，再停止数据库。

.env 会自动读取；同名的现有进程环境变量优先。数据库连接密码只保存在 .env / 私有环境变量中，不要复制到聊天、代码或 Git。

## 旧 SQLite 数据迁移

本项目原 data/sanlian.sqlite 已完成本地迁移，原文件保留。迁移工具只允许导入**业务表全空的目标库**，不会重复覆盖已导入数据。

从旧工程副本迁移时，先配置目标 PostgreSQL，关闭旧版网页服务及 SQLite 编辑事务，然后运行：

```powershell
npm run migrate:sqlite
```

默认读取 data/sanlian.sqlite，也可在命令后传入其他 SQLite 文件的完整路径。工具创建一致性备份，再在一个 PostgreSQL 事务中导入用户、活动、报名、反馈、图书、日志和会话，检查数量和约束。失败则全部回滚；原 SQLite 文件始终只读。reader → user、staff/manager → stuff，保留用户编号、密码哈希和关联。

源数据时间无效、外键错误、重复邮箱/报名或超额报名时会拒绝导入，需要先核对原始记录。导入不是持续双向同步；迁移后网页只修改 PostgreSQL。

## 账号和功能

普通网页注册只创建 user。stuff 登录后进入管理后台，可管理用户、报名、反馈和活动，查看操作日志。普通用户只能读取本人资料、报名和反馈及公开内容。

初始化管理员：

```powershell
npm run create-admin
```

授权已有账号（保留密码、撤销原会话）：

```powershell
npm run create-admin -- --promote
```

这两个命令均操作 .env / DATABASE_URL 指定的 PostgreSQL，运行前确认目标环境。组员各自使用账号，不共用管理员密码。

## 数据库配置

- DATABASE_URL：PostgreSQL / Neon 连接串，必须配置；云端使用平台提供的 TLS 连接配置。
- SEED_DEMO：默认 false；新空库可选 true 创建虚构活动和书目。
- PORT：默认 3000。
- DB_PATH 已停止使用，不要传入 SQLite 路径作为 DATABASE_URL。

日期使用 PostgreSQL TIMESTAMPTZ；接口仍返回 UTC ISO 字符串，页面按北京时间显示。费用保留整数分，角色保留 user/stuff，布尔标记暂保留 0/1 以兼容现有页面。

schema.sql 为 PostgreSQL 初始结构。以后改表需编写递增迁移；CREATE TABLE IF NOT EXISTS 不会自动修改已有列。

## 测试

```powershell
npm test
```

默认自动启动一个独立临时真实 PostgreSQL，为各测试组创建独立数据库；两个 HTTP 服务各用独立连接池，测试完成后删除测试库并关闭临时服务。不会清空开发库或修改 Softr。

可在已有 PostgreSQL 测试服务器上通过 TEST_DATABASE_URL 运行；测试连接账号需要创建/删除独立测试数据库的权限。云端部署不应将生产 DATABASE_URL 当 TEST_DATABASE_URL。

测试覆盖：24 个用户争抢最后一席、同一用户并发重复报名、管理员恢复/改容量与用户报名竞争、两个管理员相互降级、数据隔离、反馈回复、会话撤销、服务重启、管理员 CLI、SQLite 导入与回滚。

## 工程结构

- public/：页面、样式及前端交互。
- server/app.js、server/admin.js：异步 API 与权限校验。
- server/db.js：pg 连接池、事务与初始建表。
- server/queries.js：公共查询与活动行锁。
- server/schema.sql：PostgreSQL 表、外键、CHECK 和唯一索引。
- server/auth.js：scrypt 密码哈希、数据库会话。
- scripts/：本地 PostgreSQL、测试服务、管理员和旧库导入。
- data/：私有数据库文件、开发凭据和备份；不提交 Git。
- test/：真实 PostgreSQL 集成测试及历史 SQLite 结构样本。

## 部署边界

已完成 PostgreSQL 后端改造和本地验证；首次代码已上传 GitHub，用户已创建 Neon 项目。**尚未连接 Neon 或部署 Render**。免费部署路线为 Render Free + Neon Free。

已补齐 Render 部署配置：生产监听 0.0.0.0 和平台 PORT，使用明确的 HTTPS 网站地址校验 Host/Origin，开启 Secure Cookie。本地默认仍只监听 127.0.0.1。上线步骤、免费构建命令和验收边界见 [部署说明](docs/deployment.md)。这些代码与本机模拟代理测试不代表已连接 Neon 或已完成 Render 线上验收。

正式备份使用 PostgreSQL 的 pg_dump / 平台导出工具；不要在服务运行时随意复制 PostgreSQL 数据目录。原 SQLite 文件与升级备份仅作为迁移前快照保留。

