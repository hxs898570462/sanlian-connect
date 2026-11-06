# Sanlian Connect

**面向书店社群的文化活动平台，让阅读与相遇发生。**

[English](README.md)

Sanlian Connect 为三联书店天镜湖店社群提供活动发现、报名、参加者反馈和门店管理功能。这是一个学生团队项目，采用原生 JavaScript 前端、Express 后端和 PostgreSQL 数据库。

**[打开共享测试网站](https://sanlian-connect.onrender.com)**

共享测试站运行在 Render，数据保存在 Neon。初始活动和书目均为虚构示例。本地开发使用独立数据库。

## 主要功能

- **发现文化活动**：浏览未来 60 天已发布活动，搜索和筛选活动列表，也可扩展到未来 180 天。
- **报名与参加管理**：查看余位，同意联系用途后填写资料报名，查看本人凭证，并在符合条件时取消报名、释放名额。
- **活动反馈**：持有效报名的参加者可在活动结束后评价，并查看门店回复。
- **账号管理**：注册、登录并查看私人资料。读者可在[设置](docs/account-settings.md)编辑资料、修改密码、调整主题和字体大小；显示偏好仅保存在当前浏览器。
- **门店管理后台**：管理用户、活动、报名和反馈，并查看操作日志。
- **示例书架**：浏览基础的图书推荐演示。

网站包含 `user` 和 `stuff` 两种角色。`stuff` 是项目约定的管理员角色，拼写为有意保留。公开注册只会创建 `user`。

## 系统架构

**浏览器 → Render 上的 Node.js / Express → Neon 上的 PostgreSQL**

| 层面 | 技术和职责 |
| --- | --- |
| 前端 | HTML、CSS、原生 JavaScript；活动页面、表单与管理界面 |
| 后端 | Node.js、Express；输入校验、权限检查和业务规则 |
| 数据库 | PostgreSQL、`pg`；账号、会话、活动、报名、反馈、图书和日志 |
| 协作 | GitHub；源代码、表结构、迁移工具和代码审查 |

浏览器向后端提交数据，后端校验后再读写数据库。私有查询按当前登录用户筛选。报名事务锁定活动行，并通过约束控制容量和重复报名。管理员修改与对应日志在同一事务中提交。

GitHub 保存代码和数据库定义；实际业务记录和数据库凭据保存在仓库之外。

## 本地启动

使用 [`.node-version`](.node-version) 固定的 Node.js **22.20.0**。

```powershell
git clone https://github.com/hxs898570462/sanlian-connect.git
cd sanlian-connect
npm ci
```

私有仓库需要先为你的 GitHub 账号授予访问权限，才能克隆。

在第一个终端启动 PostgreSQL：

```powershell
npm run db:local
```

该命令启动真实本机 PostgreSQL，监听 `127.0.0.1:55432`，不安装系统服务。数据保存在 `data/postgres`。如果 `.env` 不存在，命令会使用随机生成的数据库密码创建该文件；已有 `.env` 保持原样。请保持此终端运行。

在第二个终端进入工程目录，运行：

```powershell
npm run dev
```

打开 **[localhost:3000](http://localhost:3000)**。无需监听文件变化时可使用 `npm start`。关闭时先停止网页服务，再停止 PostgreSQL。

每位开发者的本机数据库与共享网站独立。克隆代码不会下载云端账号、报名或凭据。如需在新库中生成虚构活动和书目，可在启动网站前将本机 `.env` 中的 `SEED_DEMO` 设为 `true`。

## 配置

[`.env.example`](.env.example) 提供不含真实密码的配置模板。程序自动读取 `.env`；同名的现有进程环境变量优先。

| 变量 | 用途 |
| --- | --- |
| `DATABASE_URL` | 必填的 PostgreSQL 连接串；连接云端时保留平台提供的 TLS 设置 |
| `SEED_DEMO` | 默认 `false`；设为 `true` 后，活动表为空时创建虚构活动和书目 |
| `PORT` | 网站端口，默认 `3000`，或使用托管平台提供的值 |
| `NODE_ENV` | HTTPS 线上环境设为 `production`，启用安全 Cookie |
| `APP_ORIGIN` | 准确的网站 origin；Render 默认使用平台提供的 `RENDER_EXTERNAL_URL` |
| `HOST` | 本机默认 `127.0.0.1`，生产环境默认 `0.0.0.0` |
| `TRUST_PROXY_HOPS` | 可信代理跳数；本机默认 `0`，Render 初始为 `1`，调整前需核对实际转发链 |

`DB_PATH` 已停止使用。网站运行时只使用 PostgreSQL；SQLite 仅用于旧数据导入和迁移测试。

日期使用 PostgreSQL `TIMESTAMPTZ`，接口返回 UTC ISO 字符串，页面按北京时间显示。金额保存为整数分；兼容标记使用 `0`/`1`。

## 账号与管理

普通用户可访问公开内容及本人的资料、报名和反馈。管理员通过后台管理业务数据。角色或账号状态变化会撤销受影响账号已有的登录会话。

在本机 `.env` / `DATABASE_URL` 指定的数据库中创建管理员：

```powershell
npm run create-admin
```

提升已有账号，保留密码并撤销原会话：

```powershell
npm run create-admin -- --promote
```

执行前先核对目标环境。每位成员使用独立账号，不共用管理员密码。使用独立私有 `.env.cloud` 设置云端管理员的步骤见 [部署说明](docs/deployment.md)。

## 测试

```powershell
npm test
```

测试自动启动临时真实 PostgreSQL，并创建隔离测试数据库。多实例场景使用两个 HTTP 服务和独立连接池。测试结束后清理临时数据库及服务，不清空开发库。

设置功能分支于 **2026 年 11 月 6 日**使用 Node.js 24.20.0 完成验证，**44 项测试全部通过**，包含父测试。覆盖仅显示分类的设置首页、资料升级与隔离、修改密码后的跨实例会话撤销，以及现有报名、反馈、后台、部署与数据迁移检查。

如使用现成的测试服务器，可配置 `TEST_DATABASE_URL`；账号需有创建和删除隔离测试数据库的权限。不要将共享或生产数据库作为测试目标。

## 部署与数据迁移

共享测试站部署在 **Render**，业务数据持久保存在 **Neon PostgreSQL**。本机原数据已迁入 Neon，并在重新连接后逐字段核对。项目负责人也已确认原账号、管理员后台和本人报名在线上正常。完整多人开发流程及实际代理转发链仍需单独验收。

| Render 配置 | 值 |
| --- | --- |
| 运行时 / 分支 | Node / `main` |
| Root Directory | 留空，仓库根目录已有 `package.json` |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Health Check | `/api/health` |
| 环境变量 | `NODE_ENV=production`、私有 Neon `DATABASE_URL`，初始化后 `SEED_DEMO=false` |

实际记录保存在 Neon，不依赖 Render 的本地文件系统。凭据使用私有环境配置保存，改表或批量操作前先备份。日常 PostgreSQL 备份使用 `pg_dump` 或平台导出；直接复制运行中的数据库目录不能作为可靠备份。

项目提供两种一次性迁移工具：

- **旧 SQLite → PostgreSQL**：`npm run migrate:sqlite` 创建一致性源库备份，只向业务表全空的目标导入。保留 ID、密码哈希和关联，将旧角色映射为 `user` / `stuff`，失败时完整回滚。无效日期、关联、重复记录或超额报名会被拒绝。详见 [PostgreSQL 说明](docs/postgresql.md)。
- **本机 PostgreSQL → Neon**：`node scripts/migrate-postgres.js` 审计并备份两边数据库。只有显式传入 `--apply` 才会导入，目标必须为空或仅含未经修改的默认示例数据。详见 [云端迁移记录](docs/postgres-to-neon.md)。

当前工程已经完成迁移，不要向共享库重复导入。上述工具执行一次性复制；本机和云端随后不会自动同步。修改已有表必须提供明确迁移脚本：只改 `schema.sql` 中的 `CREATE TABLE IF NOT EXISTS`，不会更新已有列。

## 小组协作

1. 接受仓库邀请，克隆工程，在本机运行独立数据库。
2. 从已更新的 `main` 创建功能分支。
3. 修改代码，运行相关测试，检查受影响的页面。
4. 提交 Pull Request，说明功能、验证结果及数据库变更。
5. 由另一位成员检查后再合并。若启用自动部署，Render 会部署所关联分支的更新。

GitHub 协作者权限和网站角色分别管理。所有成员通过共享网站使用同一套云端数据，并受网站权限限制；本机开发不需要共享数据库密码。

**文档约定：**每次更新 README，必须在同一次改动中同步更新 `README.md` 和 `README.zh-CN.md`，保持功能、命令、配置、进度和链接一致。该规则也记录在 [AGENTS.md](AGENTS.md) 中。

## 工程结构

```text
public/       页面、样式和前端交互
server/       Express 接口、权限、查询和 schema.sql
scripts/      本机数据库、测试、管理员设置及迁移工具
test/         真实 PostgreSQL 集成测试和历史表结构样本
docs/         部署、权限、协作和迁移记录
data/         私有本机数据库及备份，不提交 Git
```

更多中文资料：[部署说明](docs/deployment.md)、[权限说明](docs/access-control.md)、[小组合作](docs/team-collaboration.md)、[PostgreSQL 改造](docs/postgresql.md)、[云端迁移](docs/postgres-to-neon.md)及 [Softr 历史迁移](docs/migration.md)。
