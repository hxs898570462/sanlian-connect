# Render + Neon 共享测试部署

工程根目录就是本仓库根目录，包含 package.json。代码协作使用 GitHub 私有仓库；每人保留自己的本机库，Render 网站连接单独的 Neon 测试库。本说明不是线上验收记录。

## Render 配置

创建 Node.js Web Service，连接本私有仓库，选择 main 和 Singapore，实例选择 Free。Root Directory 留空。

| 字段 | 值 |
| --- | --- |
| Build Command | npm ci --omit=dev |
| Start Command | npm start |
| Health Check Path | /api/health |
| NODE_ENV | production |
| DATABASE_URL | 从 Neon Connect 复制的 PostgreSQL 连接串，保留 TLS 参数，仅存 Render 私有环境变量 |
| SEED_DEMO | true 可为新空库创建虚构活动和书目；false 则由管理员自己创建 |

.node-version 固定为本机已验证的 22.20.0；升级 Node 补丁后需重新验证。Render 构建只安装运行依赖，不在免费构建容器中启动内嵌 PostgreSQL。每次推送前在本机运行 npm test，测试使用隔离的临时数据库；不要把 Neon 共享库配置为 TEST_DATABASE_URL。

PORT、RENDER、RENDER_EXTERNAL_URL 由 Render 提供，不手工填写。生产监听默认为 0.0.0.0，开发默认为 127.0.0.1。APP_ORIGIN 缺省使用 Render 的完整 HTTPS 网址；以后使用自定义域名时，将 APP_ORIGIN 设为那个准确的 HTTPS origin（不含路径），并从该网址访问。

生产启动若没有网站地址、地址含密码/路径或使用 HTTP，会明确拒绝启动。Host 必须匹配配置域名；写请求还必须带同源 Origin 与前端请求标记。域名检查直接读 Host，不采用 X-Forwarded-Host。生产 Cookie 带 Secure、HttpOnly、SameSite=Lax。

TRUST_PROXY_HOPS 本机默认为 0，Render 初始为 1；只信任明确的末端跳数，不设 trust proxy=true。上线验收要根据实际转发链确认跳数，并用不同网络的两个客户端检查登录限额是否相互独立、伪造转发头是否不能重置限额。当前自动测试验证模拟的一跳代理规则，不证明 Render 实际转发链就是一跳；未经核对不要增加跳数。限流状态目前在单个服务进程内，重启会重置，不适合作为多实例共享限流。

## 数据与首位管理员

新 Neon 库不会自动包含本机账号或报名。首次运行会建业务表；SEED_DEMO=true 只在活动表为空时创建虚构活动，不复制本机私人数据。不要默认执行旧 SQLite 导入。

Render Free 无交互 Shell。负责人可在本机创建被忽略的 .env.cloud，私下填入目标 Neon 的 DATABASE_URL 和 SEED_DEMO=false，然后在工程目录运行：

```powershell
node --env-file=.env.cloud scripts/create-admin.js
```

交互输入管理员邮箱和密码；提升已经在共享网站注册的账号则追加 --promote。该操作写入云端库，应先核对目标。--env-file 的值优先于工程 .env，原本机 .env 无需修改。不要将 .env.cloud、连接串或数据库密码提交到 Git 或发到聊天/群聊。每人使用独立账号。

## 上线验收（仍待实际执行）

1. /api/health 返回 status=ok、storage=postgresql、mode=hosted，静态首页可加载。
2. HTTPS 注册、登录、刷新、退出及用户/管理员界面正常；Cookie 能设置和回传。
3. 两个用户只看到本人的报名/反馈；普通用户不能访问后台。
4. 管理员创建活动、回复反馈；报名/取消后余位正确。
5. 两个不同客户端的限流互不干扰，转发头伪造不能重置限额。
6. 重新部署后账号、活动和报名仍在；各成员在实际网络中能访问。

Render Free 有休眠和构建/流量额度；Neon 有免费存储和计算额度。保持 Free，不启用自动付费升级，并定期通过 PostgreSQL/平台导出做备份。

参考：[Render 端口](https://render.com/docs/web-services#port-binding)、[环境变量](https://render.com/docs/environment-variables)、[健康检查](https://render.com/docs/health-checks)、[Express 代理设置](https://expressjs.com/en/guide/behind-proxies/)。
