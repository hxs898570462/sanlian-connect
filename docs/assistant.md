# AI 阅读助手 / AI reading assistant

本地实现：右下角可收起的聊天浮窗，接入 DeepSeek 官方 API。服务端默认使用 `deepseek-flash`。这次改动尚未推送或部署至共享站；不能将本地验收当作线上验收。

The local implementation adds a floating chat panel using the official DeepSeek API, with `deepseek-flash` as the default model. This change has not been pushed or deployed to the shared site; local checks do not establish hosted acceptance.

## 配置 / Configuration

在私有 `.env` 中保留原数据库配置，追加 `.env.example` 中的三个 `DEEPSEEK_*` 配置项。密钥只由 Node 后端读取，浏览器仅调用本站 `/api/assistant/*`。没有密钥时，助手显示未配置，原有网站仍可正常使用。

Preserve the database settings in the private `.env` and add the three `DEEPSEEK_*` settings shown in `.env.example`. Only the Node backend reads the key; the browser calls the site's `/api/assistant/*` endpoints. Without a key, the panel displays an unavailable notice and the rest of the site remains usable.

本机如果需要已运行的 HTTP 代理，可设置 `DEEPSEEK_PROXY_URL=http://127.0.0.1:实际端口`。该设置只接受本地 HTTP 代理，保留对 DeepSeek 的端到端 TLS 证书检查；不自动更改系统网络。Render 不要设置此项。线上需在 Render Environment 中另行添加密钥、接口地址、模型名，再部署本次代码。本机文件不会自动同步至 Render。

If local requests require an existing HTTP proxy, set `DEEPSEEK_PROXY_URL=http://127.0.0.1:ACTUAL_PORT`. Only a loopback HTTP proxy is accepted; end-to-end TLS certificate verification remains enabled, and system network settings are not changed. Do not set this variable on Render. Configure the key, endpoint, and model separately in Render Environment when deploying this code; local files are not synchronized to Render.

## 能力与确认 / Capabilities and confirmation

- 查询未来最多 180 天的已发布活动；最多返回 9 项，可按关键词或日期范围筛选。活动介绍、费用和余位来自 PostgreSQL。
- 按标题、作者、分类、简介查询库内书目；最多返回 6 项。当前示例库不支持购买、库存或套餐结算。
- 用户明确选中活动后，助手可准备确认页并自动打开活动报名表，不创建报名、不占位、不付款。
- 已登录账号的称呼由原表单预填。电话仍在网站表单填写，同意选项不自动勾选。点击确认后，原报名事务重新检查身份、活动、名额及重复报名。
- 未登录读者先登录；从活动详情页登录时，会返回原活动。助手不提供管理员功能。

The assistant searches published events up to 180 days ahead (up to 9 results), searches the actual bookshelf by title, author, category, or summary (up to 6 results), and opens book details or an event confirmation form. Preparing a form does not register, reserve, or pay. The existing form pre-fills the signed-in display name; the reader fills in their phone, checks consent, and submits. The existing registration transaction revalidates availability and duplicates. Sign-in from an event detail page returns to that event. There are no administrative tools, package checkout, stock, or payment functions.

## 隐私与运行边界 / Privacy and operating limits

只向模型提供用户消息和查询到的公开活动／书目数据，以及必要的本人是否已报名结果；不发送账号邮箱、数据库凭据、Cookie、密码哈希或完整报名记录。用户消息中的常见邮箱和电话号码会先做简单脱敏；这不是所有个人信息的自动识别，应避免在聊天里输入个人资料。模型答复用文本呈现；操作按钮仅由后端校验的数据库记录生成。

The model receives user messages, public event/book query results, and the necessary own-registration existence result. Account email, database credentials, cookies, password hashes, and full registrations are not supplied. Common email/phone patterns are redacted from messages as a best effort, not a comprehensive personal-data detector. Users should enter contact details in the first-party form. Model text is rendered as text; action buttons come from backend-validated database records.

对话按登录会话与当前页面的对话编号隔离，不写入 PostgreSQL。最多保留最近 4 轮；20 分钟不活跃后，在后续聊天请求中清理，进程重启也会丢失。刷新页面会开始独立对话；“清空对话”会删除当前服务端上下文，退出或切换账号清空可见聊天。模型服务商的数据处理仍受其自身条款约束。

Conversations are scoped to the authenticated session and a per-page conversation ID, not stored in PostgreSQL. Up to 4 complete turns are retained in process memory; inactive entries are cleaned on subsequent chat requests after 20 minutes and are lost on restart. Reload starts an independent conversation. Clear deletes the current server context; logout/account switching clears visible messages. Provider data handling remains subject to its own terms.

初版在每个服务进程内限制：每账号每分钟 10 条、滚动窗口约 24 小时内 80 条，全站每天最多 1000 个聊天请求，同时最多 3 个请求。每条最多 1500 字符，查询最多 6 次工具调用，总等待上限 45 秒。限额不是服务商费用的硬上限；进程重启会重置计数，多实例不共享计数。扩大开放范围前需评估共享限流和服务商侧预算控制。

Per-process limits are 10 messages per account per minute, 80 over an approximately 24-hour rolling window, 1000 site-wide chat requests per UTC day, and 3 simultaneous requests. Each message is limited to 1500 characters, 6 tool calls, and 45 seconds. These are not a hard provider spending cap; counters reset on restart and are not shared across instances. Reassess shared rate limiting and provider-side budget controls before broader access.

## 验证 / Validation

`npm test` 使用隔离真实 PostgreSQL 和模拟模型响应，验证查询、角色／会话隔离、确认前不写入、最终提交重新校验、错误处理及原有功能，不消耗真实模型额度。真实 API 与浏览器检查需要单独进行。测试不连接共享 Neon。

`npm test` uses isolated real PostgreSQL databases and mocked model responses to check queries, session boundaries, no writes before confirmation, submission-time revalidation, error handling, and existing functionality without provider charges. Live API and browser checks are separate. Tests do not connect to the shared Neon database.

2026-10-30 本地验收：54 项测试通过（含父测试）；官方 DeepSeek 经现有本地代理真实调用成功；在独立临时数据库及虚构账号中，浏览器验证了活动查询、对话选定活动后自动打开确认表、文学书目推荐及详情跳转。确认表保留空电话与未勾选同意项，没有在浏览器代替用户提交报名。390 × 844 手机尺寸无横向溢出，发送按钮及浮窗留白已检查。共享站尚未部署或验收。

Local acceptance on 2026-10-30: all 54 tests passed, including parent tests. Live official DeepSeek calls succeeded through the existing local proxy. Browser checks with an isolated temporary database and fictional account verified event search, automatic confirmation-form navigation after selection, book recommendations, and book-detail navigation. Phone and consent remained unfilled; the browser did not submit a registration for the reader. A 390 × 844 viewport had no horizontal overflow, with panel margins and the send button checked. Hosted deployment and acceptance remain pending.
