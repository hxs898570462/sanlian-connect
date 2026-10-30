# Sanlian Connect 小组合作文档

编写日期：2026-10-30（Asia/Hong_Kong）

适用工程：`D:\XJTLU\ENT\sanlian-connect`。当前技术栈为 HTML / CSS / 原生 JavaScript、Node.js / Express、PostgreSQL。原 SQLite 数据已备份并迁入本地 PostgreSQL；详见 postgresql.md。本文件是合作约定与部署准备说明，不代表仓库或共享网站已经建立。

## 1. 合作方式

采用“一个 GitHub 私有仓库 + 每人本地开发 + 一套共享测试网站”。

| 层面 | 合作方式 | 保存内容 |
| --- | --- | --- |
| 代码 | GitHub 私有仓库、功能分支、Pull Request | 前后端代码、表结构、迁移脚本、测试和文档 |
| 本地开发 | 每位成员独立运行 | 自己的测试账号、活动和数据库 |
| 集成测试 | 共享测试网站 | 全组使用的同一套测试账号与业务数据 |
| 数据 | 共享网站后端统一读写独立的云端测试数据库（免费方案建议 Neon PostgreSQL） | 用户、报名、反馈和日志 |

GitHub 仓库权限与网站用户组分别管理：GitHub 协作者可以改代码；网站的 user / stuff 决定其在网页中能查看和管理哪些数据。授予其中一种权限不会自动获得另一种。

## 2. 建立共享仓库

由一名成员担任仓库负责人，以本工程目录为仓库根目录，创建 GitHub 私有仓库，再邀请组员为协作者。当前本机已建立 main，并与 hxs898570462/sanlian-connect 的 origin/main 同步；下方初始化命令仅供其他新工程参考，不要重复初始化当前工程。

负责人初始化时可以依次运行：

```powershell
cd D:\XJTLU\ENT\sanlian-connect
git init -b main
git add .
git status
```

提交前检查暂存内容，确认没有数据库、密码、环境配置或私人文件，再运行：

```powershell
git commit -m "Initialize Sanlian Connect"
```

然后在 GitHub 创建空的私有仓库，使用该仓库页面提供的真实地址配置 origin，并推送 main。不要将文档中的示例地址直接作为远端。

当前 `.gitignore` 已排除 `node_modules/`、`.npm-cache/`、`data/*`、`.env`、日志和覆盖率结果；保留 `data/.gitkeep`。数据库和升级备份必须继续放在忽略范围内。不要将含真实账号、电话或报名的数据复制到其他会被提交的位置。

## 3. 组员首次运行

每位成员安装 Node.js 和 Git。全组约定相同的 Node.js 版本；当前实际验证环境为 22.20.0，升级运行时后需要重新测试。

从 GitHub 使用真实仓库地址进行 clone，进入包含 package.json 的工程目录后：

```powershell
npm ci
npm test
npm run db:local
```

保持数据库终端运行，在另一个终端执行 `npm run dev`，浏览器打开 `http://localhost:3000`。每个人使用自己的本地 PostgreSQL，.env 自动保存本机连接配置；个人数据不会自动同步给其他成员。共享测试网站才是全组共同验收的数据环境。

## 4. 日常开发流程

main 保存经过检查、能够运行的版本。每个独立功能使用一个分支，例如 `feature/feedback-management`、`fix/registration-validation` 或 `docs/team-guide`。

开始新任务，先确认本地已有修改已提交或妥善保存，然后：

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/你的功能名称
```

开发过程中及时提交有意义的小改动。提交前运行 `npm test`，涉及页面时检查桌面和手机宽度；涉及权限时同时检查普通用户与管理员。

完成后将功能分支推送到 origin，并在 GitHub 发起指向 main 的 Pull Request。说明具体功能、测试结果以及是否修改数据库结构。由至少另一位成员检查，修复问题后合并。GitHub 套餐支持时，可以配置主分支规则及自动检查；不能配置时也应遵守同样的组内约定。

main 更新后，其他成员先保存当前修改，再拉取。package-lock.json 变化后重新运行 `npm ci`。不要互相覆盖整个工程文件夹，也不要用网盘同步替代 Git 合并。

出现冲突时，负责该功能的成员与相关文件负责人一起判断保留内容，解决后重新测试。不要使用强制推送覆盖 main 的历史。

## 5. 建议分工

可按当前模块分工，具体负责人由小组填写：

| 模块 | 主要文件 | 负责人 |
| --- | --- | --- |
| 页面与样式 | public/index.html、public/css/ | 待指定 |
| 前端交互与后台页面 | public/js/app.js、public/js/admin.js | 待指定 |
| 登录与权限 | server/auth.js、server/app.js | 待指定 |
| 业务管理接口 | server/admin.js | 待指定 |
| 数据库与迁移 | server/schema.sql、server/db.js、server/migrate.js | 待指定 |
| 测试、合并与部署 | test/、部署配置、运行文档 | 待指定 |

尽量让一个任务集中修改一个模块。多人需要同时改同一个文件时，先沟通修改范围，避免重复实现相同功能。

## 6. 数据库合作规则

- 提交表结构、迁移脚本和虚构示例数据；不提交正在运行的 SQLite 数据库或其备份。
- 修改 schema.sql 的 CREATE TABLE 不会自动更新已有表，必须同时提供相应迁移，验证旧数据能够保留。
- 迁移应能重复启动，执行前备份，执行后检查外键与记录关系。
- 共享测试库与个人开发库分开。部署代码时不覆盖共享测试库，不自动清空测试用户和报名。
- 当前开发版已切换 PostgreSQL；所有成员通过后端接口访问共享测试库，不通过网盘或共享文件夹复制运行中的数据库目录。
- PostgreSQL 驱动、异步查询、事务和迁移工具已实现。共享测试网站按全免费约束计划连接 Neon，尚未创建或连接云端项目。
- 迁移后，每位成员使用个人开发库，共享网站使用统一测试库，避免开发脚本直接修改全组测试数据。前后端代码仍在本地编辑。

## 7. 共享测试网站的账号与验收

每人使用独立测试账号。公开注册默认 user；由管理员按需要授予 stuff。不要多人共用一个管理员账号，以便区分操作日志。

当前 PostgreSQL 版本使用 `npm run create-admin` 新建管理员，或运行 `npm run create-admin -- --promote` 并输入已注册邮箱。脚本已支持 DATABASE_URL。Render 免费服务没有 Shell/SSH 入口；负责人可在本地以私有环境变量连接目标云端测试库执行。不要把连接串提交代码或发到群聊。

共享测试阶段优先使用虚构姓名、测试电话和测试反馈。任何人在后台修改的记录会影响其他成员下一次查询；当前界面不会自动实时推送所有变化，需要刷新或重新查询。

每次部署后至少检查：

1. 首页和已发布活动可加载。
2. user 登录后仅能读取自己的资料、报名和反馈，不能调用管理接口。
3. stuff 能进入后台管理用户、报名、活动和反馈；回复可由对应用户看到。
4. 报名、取消和余位计算正确。
5. 重启或重新部署后账号、报名和反馈仍在。

## 8. 共享部署建议与当前准备状态

### 当前约束：小组共享测试必须全免费

之前提出的“Render 付费服务 + 持久磁盘 + SQLite”不再作为推荐路线。根据 2026-10-30 核对的官方免费计划，当前推荐方案为：

**GitHub 私有仓库 + Render Free Web Service（前后端）+ Neon Free PostgreSQL（持久数据库）。**

这是针对当前 Express 工程的部署路线；现有 SQLite 已在本地迁入 PostgreSQL并完成验证，代码已首次上传 GitHub，用户已创建 Neon 项目；尚未配置云端连接或上线 Render。免费指使用当前免费计划并保持在额度内，不代表不限量或永久保证服务商政策不变。

| 组成 | 作用 | 费用约束 |
| --- | --- | --- |
| GitHub 私有仓库 | 代码、分支与合并 | 使用免费功能，不启用付费附加服务 |
| Render Free Web Service | 运行现有 HTML/CSS/JS 页面和 Express 接口 | 选择 Free 实例，使用平台提供的网址 |
| Neon Free | 独立保存 PostgreSQL 数据 | 保持 Free 计划，在数据库、计算和流量额度内使用 |

Render 配置参考（数据库改造已完成，HTTP 线上适配与公网验收仍待进行）：

| 配置 | 建议 |
| --- | --- |
| 服务类型 | Web Service，Node.js 运行时 |
| 代码分支 | main（合并并通过测试后更新） |
| 仓库根目录 | 推荐直接为 sanlian-connect 工程；若上传整个 ENT 则需要配置子目录 |
| 构建命令 | npm ci --omit=dev；推送前在本机运行 npm test |
| 启动命令 | npm start |
| 健康检查 | /api/health |
| 实例规格 | Free，1 个实例 |
| 持久磁盘 | 不挂载，不把 SQLite 当云端主数据库 |
| DATABASE_URL | Neon 提供的连接串，仅在后端私有环境变量中配置 |
| NODE_ENV | production |
| SEED_DEMO | false（全新空库，管理员创建测试活动）；如需初始虚构活动可选 true |
| Node.js 版本 | 显式固定经过测试且仍受支持的版本；不能依赖平台默认版本或无上限范围 |

`DATABASE_URL` 已实现，.env 自动读取。DB_PATH 不再使用；不能将 SQLite 文件路径填入 DATABASE_URL。

### 已核对的免费限制

- Render Free：闲置 15 分钟后休眠，再访问唤醒通常约需 1 分钟；每工作区每月 750 免费实例小时。免费实例的本地文件不持久，且没有 Shell/SSH。访问外部数据库也可能受平台异常出站流量限制。
- Neon Free：官方当前列出每项目 1 GB PostgreSQL 存储、每月 100 CU-hours 计算量和 5 GB 公网传输，闲置 5 分钟后计算休眠。定价页说明无需信用卡、没有固定试用时限。
- Neon 免费额度用尽时可能暂停计算或拒绝增加存储的操作。不要开通付费升级或依靠自动付费超额，定期检查用量并导出备份。
- 数据库计算休眠与数据删除不同；Render 服务重启不会自动清空保存在 Neon 中的记录。仍需自行建立备份与恢复流程。
- 不使用 Render 自带的免费 PostgreSQL 作为长期小组测试主库：它有创建后 30 天到期限制。
- 全部成员上线前应在自己的实际网络中测试访问和登录，不能仅凭平台地区名称保证访问速度。

### 其他免费备选与选择理由

| 方案 | 可取之处 | 对当前工程的影响 |
| --- | --- | --- |
| Render Free + Neon Free（推荐） | 保留 Express 与现有前端，独立持久数据库 | 改造 SQLite 查询、事务、会话与初始化脚本；接受网站冷启动 |
| Render Free + Supabase Free | 同样提供 PostgreSQL，可进一步使用认证等能力 | 仍需数据库改造；免费库低活动一周可能暂停；当前不必重做现有认证 |
| Cloudflare Workers + D1 Free | Workers 和 D1 都有免费额度，可在同一平台组织应用 | 当前 Node 进程、本地 SQLite、事务和密码哈希运行方式都需适配；改造范围更大，不是当前优先路线 |

“更适合当前工程”是结合现有代码作出的工程判断，不代表免费平台的普遍排名。Cloudflare 官方当前列出 Workers 免费每日 100,000 次请求、每次 10ms CPU，D1 免费每日 500 万行读、10 万行写、总存储 5 GB；不能把传统 Node 后端原样搬过去就假定符合运行限制。

以下是原部署准备清单。PostgreSQL 改造已完成；现又补齐生产监听、固定 HTTPS 网站地址、Host/Origin 校验和 Cookie 配置，并通过 35 项本机测试（含模拟代理）。实际 Neon 连接、Render 部署和线上验收仍待执行，以 [部署说明](deployment.md) 为准。

原清单保留供核对：

1. 将服务监听地址改为可配置；托管环境使用 0.0.0.0 和平台提供的 PORT，本地仍保留本机默认值。
2. 允许明确配置的网站域名，替换只允许 localhost 的检查。
3. 依据托管平台的反向代理方式正确处理 HTTPS、请求来源校验、真实客户端地址和限流；不能简单信任任意转发头。
4. 验证 HTTPS 下登录 Cookie 能设置和回传。
5. 用 PostgreSQL 驱动及异步访问替换 node:sqlite，调整占位符、SQLite 专有函数/PRAGMA、建表、迁移和初始化逻辑。
6. 重新实现并测试报名事务与并发容量检查（例如活动行锁配合有效报名唯一约束），不能只替换连接地址。
7. 迁移用户、角色、报名、反馈、会话和日志时保留 ID/关联，保护连接串，配置备份；不要求小组成员共用管理员账号。
8. 改造管理员初始化工具，建立云端首位管理员，用两个账号验收数据隔离，以及休眠/重启/部署后的记录持久性。

PostgreSQL 驱动、查询、事务、初始化脚本及 SQLite 导入已完成；加上部署配置和模拟代理测试，共 35 项测试通过。活动行锁覆盖报名、取消、管理员恢复和容量调整。HTTP 部署配置已实现；Neon/Render 线上连接、实际代理链及持久性仍需验收。不要把本地测试通过当成网站已上线。

## 9. 参考资料

- [GitHub Pull Request 合作方式](https://docs.github.com/en/pull-requests/reference/pull-requests)
- [SQLite 网络访问说明](https://www.sqlite.org/useovernet.html)
- [Render 部署 Express](https://render.com/docs/deploy-node-express-app)
- [Render 持久磁盘](https://render.com/docs/disks)
- [Render 免费服务限制](https://render.com/docs/free)
- [Render 服务端口绑定](https://render.com/docs/web-services#port-binding)
- [Render Node.js 版本配置](https://render.com/docs/node-version)
- [Neon 免费计划与定价](https://neon.com/pricing)
- [Neon 计划额度](https://neon.com/docs/introduction/plans)
- [Neon 官方免费额度说明源码](https://github.com/neondatabase/website/blob/main/content/faqs/free-plan-limits-and-quotas.md)
- [Supabase 免费计划](https://supabase.com/pricing)
- [Supabase 免费项目暂停规则](https://supabase.com/docs/guides/platform/free-project-pausing)
- [Cloudflare Workers 定价](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1 定价](https://developers.cloudflare.com/d1/platform/pricing/)
