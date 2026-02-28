<div align="center">

<img src="docs/logos/logo-full.png" alt="Metapi" width="280">

🔮 **中转站的中转站 — 将分散的 AI 中转站聚合为一个统一网关**

<p>
把你在各处注册的 New API / One API / OneHub / DoneHub / Veloera / AnyRouter / Sub2API 等站点，
<br>
汇聚成 <strong>一个 API Key、一个入口</strong>，自动发现模型、智能路由、成本最优。
</p>

<p align="center">
<a href="https://github.com/cita-777/metapi/releases">
  <img alt="GitHub Release" src="https://img.shields.io/github/v/release/cita-777/metapi?label=Release&logo=github&style=flat">
</a><!--
--><a href="https://hub.docker.com/r/1467078763/metapi">
  <img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/1467078763/metapi?style=flat&logo=docker&label=Docker%20Pulls">
</a><!--
--><a href="https://hub.docker.com/r/1467078763/metapi">
  <img alt="Docker Image" src="https://img.shields.io/badge/docker-1467078763%2Fmetapi-blue?logo=docker&style=flat">
</a><!--
--><a href="LICENSE">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat">
</a><!--
--><img alt="Node.js" src="https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&style=flat"><!--
--><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&style=flat">
</p>

<p align="center">
  <a href="docs/README.md"><strong>📚 文档中心</strong></a> ·
  <a href="docs/getting-started.md">快速上手</a> ·
  <a href="docs/deployment.md">部署指南</a> ·
  <a href="docs/configuration.md">配置说明</a> ·
  <a href="docs/faq.md">常见问题</a> ·
  <a href="CONTRIBUTING.md">贡献指南</a>
</p>

</div>

---

## 📖 介绍

现在 AI 生态里有越来越多基于 New API / One API 系列的聚合中转站，要管理多个站点的余额、模型列表和 API 密钥，往往既分散又费时。

Metapi 作为这些中转站之上的聚合层，把多个站点统一到 **一个 API Key、一个入口**。当前已支持基于以下项目的中转站：

- [New API](https://github.com/QuantumNous/new-api)
- [One API](https://github.com/songquanpeng/one-api)
- [OneHub](https://github.com/MartialBE/one-hub)
- [DoneHub](https://github.com/deanxv/done-hub)
- [Veloera](https://github.com/Veloera/Veloera)
- [AnyRouter](https://anyrouter.top) — 通用路由平台
- [Sub2API](https://github.com/Wei-Shaw/sub2api) — 订阅制中转

| 痛点                                  | Metapi 怎么解决                                                 |
| ------------------------------------- | --------------------------------------------------------------- |
| 🔑 每个站点一个 Key，下游工具配置一堆 | **一个 Key 统一代理**，所有站点的模型自动聚合到 `/v1/*` |
| 💸 不知道哪个站点用某个模型最便宜     | **智能路由** 自动按成本、余额、使用率选最优通道           |
| 🔄 某个站点挂了，手动切换好麻烦       | **自动故障转移**，一个通道失败自动冷却并切到下一个        |
| 📊 余额分散在各处，不知道还剩多少     | **集中看板** 一目了然，余额不足自动告警                   |
| ✅ 每天得去各站签到领额度             | **自动签到** 定时执行，奖励自动追踪                       |
| 🤷 不知道哪个站有什么模型             | **自动模型发现**，上游新增模型零配置出现在你的模型列表里  |

---

## 🖼️ 界面预览

<table>
  <tr>
    <td align="center">
      <img src="docs/screenshots/dashboard.png" alt="dashboard" style="width:100%;height:auto;"/>
      <div>仪表盘</div>
    </td>
    <td align="center">
      <img src="docs/screenshots/model-marketplace.png" alt="model-marketplace" style="width:100%;height:auto;"/>
      <div>模型广场</div>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="docs/screenshots/routes.png" alt="routes" style="width:100%;height:auto;"/>
      <div>智能路由</div>
    </td>
    <td align="center">
      <img src="docs/screenshots/accounts.png" alt="accounts" style="width:100%;height:auto;"/>
      <div>账号管理</div>
    </td>
  </tr>
</table>

---

## ✨ 核心功能

### 🌐 统一代理网关

- 兼容 **OpenAI** 与 **Claude** 下游格式，对接所有主流客户端
- 支持 Chat Completions / Messages / Completions / Embeddings / Images / Models 全接口
- 完整的 SSE 流式传输支持，自动格式转换（OpenAI ⇄ Claude）

### 🧠 智能路由引擎

- 自动发现所有上游站点的可用模型，**零配置**生成路由表
- 四级成本信号：**实测成本 → 账号配置成本 → 目录参考价 → 默认兜底**
- 多通道概率分摊，基于成本（40%）、余额（30%）、使用率（30%）加权分配
- 失败通道自动冷却与避让（默认 10 分钟冷却期）
- 请求失败自动重试，自动切换其他可用通道
- 路由决策可视化解释，每次选择透明可审计

### 📡 多平台聚合管理

| 平台                | 适配器        | 说明                 |
| ------------------- | ------------- | -------------------- |
| **New API**   | `new-api`   | 新一代大模型网关     |
| **One API**   | `one-api`   | 经典 OpenAI 接口聚合 |
| **OneHub**    | `onehub`    | One API 增强分支     |
| **DoneHub**   | `donehub`   | OneHub 增强分支      |
| **Veloera**   | `veloera`   | API 网关平台         |
| **AnyRouter** | `anyrouter` | 通用路由平台         |
| **Sub2API**   | `sub2api`   | 订阅制中转平台       |

每种平台适配器均支持：账号登录、余额查询、模型枚举、Token 同步、每日签到、用户信息获取等完整生命周期管理。

### 👥 账号与 Token 管理

- **多站点多账号**：每个站点可添加多个账号，每个账号可持有多个 API Token
- **健康状态追踪**：`healthy` / `unhealthy` / `degraded` / `disabled` 四级状态机
- **凭证加密存储**：所有敏感凭证均加密保存在本地数据库中
- **自动续签**：Token 过期时自动重新登录获取新凭证
- **站点联动**：禁用站点自动级联禁用所有关联账号

### 🏪 模型广场

- 跨站点模型覆盖总览：哪些模型可用、多少账号覆盖、各站定价对比
- 延迟、成功率等实测指标展示
- 上游模型目录缓存与品牌分类（OpenAI、Anthropic、Google、DeepSeek 等）
- 交互式模型测试器，在线验证模型可用性

### ✅ 自动签到

- Cron 定时自动签到（默认每天 08:00）
- 智能解析签到奖励金额，签到失败自动通知
- 逐账号独立执行，支持启用/禁用控制
- 完整的签到日志记录，支持历史查询
- 并发锁机制，防止重复签到

### 💰 余额管理

- 定时余额刷新（默认每小时），批量更新所有活跃账号
- 收入追踪：记录每日/累计收入，追踪额度消耗趋势
- 余额兜底估算：API 不可用时，从代理日志推算余额变动
- 自动重登录：凭证过期时自动刷新

### 🔔 告警与通知

支持四种通知渠道：

| 渠道                | 说明                 |
| ------------------- | -------------------- |
| **Webhook**   | 自定义 HTTP 推送     |
| **Bark**      | iOS 推送通知         |
| **Server酱**  | 微信 / Telegram 通知 |
| **SMTP 邮件** | 标准邮件通知         |

告警场景覆盖：余额不足预警、站点/账号异常、签到失败、代理请求失败、Token 过期提醒、每日摘要报告。支持告警冷却机制（默认 300 秒），防止相同事件重复通知。

### 📊 数据看板

- 站点余额分布饼图、每日消费趋势图表
- 全局搜索（站点、账号、模型）
- 系统事件日志、代理请求日志（含模型、状态、延迟、Token 消耗、成本估算）

### 📦 轻量部署

- **单 Docker 容器**，内置 SQLite，无外部依赖
- Alpine 基础镜像，体积精简
- 数据完整导入导出，迁移无忧

---

## 🚀 快速开始

### Docker Compose（推荐）

```bash
mkdir metapi && cd metapi

cat > docker-compose.yml << 'EOF'
services:
  metapi:
    image: 1467078763/metapi:latest
    ports:
      - "4000:4000"
    volumes:
      - ./data:/app/data
    environment:
      AUTH_TOKEN: ${AUTH_TOKEN:?AUTH_TOKEN is required}
      PROXY_TOKEN: ${PROXY_TOKEN:?PROXY_TOKEN is required}
      CHECKIN_CRON: "0 8 * * *"
      BALANCE_REFRESH_CRON: "0 * * * *"
      PORT: ${PORT:-4000}
      DATA_DIR: /app/data
      TZ: ${TZ:-Asia/Shanghai}
    restart: unless-stopped
EOF

# 设置令牌并启动
export AUTH_TOKEN=your-admin-token
export PROXY_TOKEN=your-proxy-sk-token
docker compose up -d
```

<details>
<summary><strong>Docker 命令一行启动</strong></summary>

```bash
docker run -d --name metapi \
  -p 4000:4000 \
  -e AUTH_TOKEN=your-admin-token \
  -e PROXY_TOKEN=your-proxy-sk-token \
  -e TZ=Asia/Shanghai \
  -v ./data:/app/data \
  --restart unless-stopped \
  1467078763/metapi:latest
```

</details>

🎉 启动后访问 `http://localhost:4000`，用 `AUTH_TOKEN` 登录即可！

> [!IMPORTANT]
> 请务必修改 `AUTH_TOKEN` 和 `PROXY_TOKEN`，不要使用默认值。数据存储在 `./data` 目录中，升级不影响已有数据。

### 升级

```bash
docker compose pull && docker compose up -d && docker image prune -f
```

📖 更详细的部署方式请参考 [部署指南](docs/deployment.md)

---

## 📚 文档中心

| 分类          | 链接                                                  | 说明                                   |
| ------------- | ----------------------------------------------------- | -------------------------------------- |
| 📖 文档总览   | [docs/README.md](docs/README.md)                         | 文档导航与索引                         |
| 🚀 快速上手   | [docs/getting-started.md](docs/getting-started.md)       | 10 分钟启动                            |
| 🚢 部署指南   | [docs/deployment.md](docs/deployment.md)                 | Docker Compose、反向代理、升级回滚     |
| ⚙️ 配置说明 | [docs/configuration.md](docs/configuration.md)           | 全部环境变量与路由参数                 |
| 🔌 客户端接入 | [docs/client-integration.md](docs/client-integration.md) | Open WebUI / Cherry Studio / Cursor 等 |
| 🔧 运维手册   | [docs/operations.md](docs/operations.md)                 | 备份恢复、日志排查、健康检查           |
| ❓ 常见问题   | [docs/faq.md](docs/faq.md)                               | 常见报错与修复路径                     |

---

## ⚙️ 环境变量

### 基础配置

| 变量名                        | 说明                                        | 默认值                  |
| ----------------------------- | ------------------------------------------- | ----------------------- |
| `AUTH_TOKEN`                | 管理后台登录令牌（**必须修改**）      | `change-me`           |
| `PROXY_TOKEN`               | 代理 API Bearer Token（**必须修改**） | `change-me-proxy`     |
| `PORT`                      | 服务监听端口                                | `4000`                |
| `DATA_DIR`                  | 数据目录（SQLite 数据库）                   | `./data`              |
| `TZ`                        | 时区                                        | `Asia/Shanghai`       |
| `ACCOUNT_CREDENTIAL_SECRET` | 账号凭证加密密钥                            | 默认使用 `AUTH_TOKEN` |

### 定时任务

| 变量名                   | 说明                 | 默认值        |
| ------------------------ | -------------------- | ------------- |
| `CHECKIN_CRON`         | 自动签到 Cron 表达式 | `0 8 * * *` |
| `BALANCE_REFRESH_CRON` | 余额刷新 Cron 表达式 | `0 * * * *` |

<details>
<summary><strong>智能路由参数</strong></summary>

| 变量名                         | 说明                   | 默认值  |
| ------------------------------ | ---------------------- | ------- |
| `ROUTING_FALLBACK_UNIT_COST` | 无成本信号时的默认单价 | `1`   |
| `BASE_WEIGHT_FACTOR`         | 基础权重因子           | `0.5` |
| `VALUE_SCORE_FACTOR`         | 性价比评分因子         | `0.5` |
| `COST_WEIGHT`                | 路由选择中成本权重     | `0.4` |
| `BALANCE_WEIGHT`             | 路由选择中余额权重     | `0.3` |
| `USAGE_WEIGHT`               | 路由选择中使用率权重   | `0.3` |

</details>

<details>
<summary><strong>通知渠道配置</strong></summary>

| 变量名                        | 说明                   | 默认值    |
| ----------------------------- | ---------------------- | --------- |
| `WEBHOOK_ENABLED`           | 启用 Webhook 通知      | `true`  |
| `WEBHOOK_URL`               | Webhook 推送地址       | 空        |
| `BARK_ENABLED`              | 启用 Bark 推送         | `true`  |
| `BARK_URL`                  | Bark 推送地址          | 空        |
| `SERVERCHAN_ENABLED`        | 启用 Server酱 通知     | `true`  |
| `SERVERCHAN_KEY`            | Server酱 SendKey       | 空        |
| `SMTP_ENABLED`              | 启用邮件通知           | `false` |
| `SMTP_HOST`                 | SMTP 服务器地址        | 空        |
| `SMTP_PORT`                 | SMTP 端口              | `587`   |
| `SMTP_SECURE`               | 使用 SSL/TLS           | `false` |
| `SMTP_USER` / `SMTP_PASS` | SMTP 认证              | 空        |
| `SMTP_FROM` / `SMTP_TO`   | 发件/收件人            | 空        |
| `NOTIFY_COOLDOWN_SEC`       | 相同告警冷却时间（秒） | `300`   |

</details>

<details>
<summary><strong>安全配置</strong></summary>

| 变量名                 | 说明                         | 默认值       |
| ---------------------- | ---------------------------- | ------------ |
| `ADMIN_IP_ALLOWLIST` | 管理端 IP 白名单（逗号分隔） | 空（不限制） |

</details>

📖 完整配置说明：[docs/configuration.md](docs/configuration.md)

---

## 📡 代理接口

Metapi 对下游暴露标准 OpenAI / Claude 兼容接口：

| 接口                       | 方法 | 说明                         |
| -------------------------- | ---- | ---------------------------- |
| `/v1/chat/completions`   | POST | OpenAI Chat Completions      |
| `/v1/messages`           | POST | Claude Messages              |
| `/v1/completions`        | POST | OpenAI Completions（Legacy） |
| `/v1/embeddings`         | POST | 向量嵌入                     |
| `/v1/images/generations` | POST | 图像生成                     |
| `/v1/models`             | GET  | 获取所有可用模型列表         |

请求头携带 `Authorization: Bearer <PROXY_TOKEN>` 即可访问。

---

## 🔌 接入下游客户端

适用于所有兼容 OpenAI API 的客户端：

| 配置项             | 值                                                          |
| ------------------ | ----------------------------------------------------------- |
| **Base URL** | `https://your-domain.com`（客户端一般会自动拼接 `/v1`） |
| **API Key**  | 你设置的 `PROXY_TOKEN` 值                                 |
| **模型列表** | 自动从 `GET /v1/models` 获取                              |

### 已验证兼容的客户端

- [ChatGPT-Next-Web](https://github.com/ChatGPTNextWeb/ChatGPT-Next-Web)
- [Open WebUI](https://github.com/open-webui/open-webui)
- [Cherry Studio](https://github.com/kangfenmao/cherry-studio)
- [Cursor](https://cursor.sh)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- [Roo Code](https://github.com/RooVetGit/Roo-Code)
- [Kilo Code](https://github.com/kilocode/kilocode)
- 以及所有支持 OpenAI API 格式的客户端

<details>
<summary><strong>常见问题：流式响应异常</strong></summary>

如果非流式正常但流式异常，请排查：

1. 反向代理是否关闭了 SSE 缓冲（Nginx 需设置 `proxy_buffering off`）
2. 中间层是否改写了 `text/event-stream` Content-Type
3. 客户端是否强制要求特定流式格式

**Nginx 参考配置：**

```nginx
location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_buffering off;
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding off;
}
```

</details>

📖 更详细的接入说明：[docs/client-integration.md](docs/client-integration.md)

---

## 🏗️ 技术栈

| 层                   | 技术                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| **后端框架**   | [Fastify](https://fastify.dev) — 高性能 Node.js 后端框架                                                    |
| **前端框架**   | [React 18](https://react.dev) + [Vite](https://vitejs.dev)                                                      |
| **语言**       | [TypeScript](https://www.typescriptlang.org) — 端到端类型安全                                               |
| **样式**       | [Tailwind CSS v4](https://tailwindcss.com) — 原子化样式框架                                                 |
| **数据库**     | SQLite ([better-sqlite3](https://github.com/WiseLibs/better-sqlite3)) + [Drizzle ORM](https://orm.drizzle.team) |
| **数据可视化** | [VChart](https://visactor.io/vchart) (@visactor/react-vchart)                                                |
| **定时任务**   | [node-cron](https://github.com/node-cron/node-cron)                                                          |
| **容器化**     | Docker (Alpine) + Docker Compose                                                                          |
| **测试**       | [Vitest](https://vitest.dev)                                                                                 |

---

## 🛠️ 本地开发

```bash
# 安装依赖
npm install

# 数据库迁移
npm run db:migrate

# 启动开发环境（前后端热更新）
npm run dev
```

```bash
npm run build          # 构建前端 + 后端
npm run build:web      # 仅构建前端（Vite）
npm run build:server   # 仅构建后端（TypeScript）
npm test               # 运行全部测试
npm run test:watch     # 监听模式
npm run db:generate    # 生成 Drizzle 迁移文件
```

---

## 🔗 相关项目

### 上游兼容平台

| 项目                                            | 说明                                    |
| ----------------------------------------------- | --------------------------------------- |
| [New API](https://github.com/QuantumNous/new-api)  | 新一代大模型网关，Metapi 的主要上游之一 |
| [One API](https://github.com/songquanpeng/one-api) | 经典 OpenAI 接口聚合管理                |
| [OneHub](https://github.com/MartialBE/one-hub)     | One API 增强分支                        |
| [DoneHub](https://github.com/deanxv/done-hub)      | OneHub 增强分支                         |
| [Veloera](https://github.com/Veloera/Veloera)      | API 网关平台                            |

### 参考和使用的项目

| 项目                                                 | 说明                                                      |
| ---------------------------------------------------- | --------------------------------------------------------- |
| [All API Hub](https://github.com/qixing-jk/all-api-hub) | 浏览器扩展版 — 一站式管理中转站账号，Metapi 最初灵感来源 |
| [LLM Metadata](https://github.com/nicepkg/llm-metadata) | LLM 模型元数据库，用于模型描述参考                        |
| [New API](https://github.com/QuantumNous/new-api)       | 平台适配器参考实现                                        |

---

## 🔒 数据与隐私

Metapi 完全自托管，所有数据（账号、令牌、路由、日志）均存储在本地 SQLite 数据库中，不会向任何第三方发送数据。代理请求仅在你的服务器与上游站点之间直连传输。

---

## 🤝 贡献

欢迎各种形式的贡献！

- 🐛 报告 Bug — [提交 Issue](https://github.com/cita-777/metapi/issues)
- 💡 功能建议 — [发起讨论](https://github.com/cita-777/metapi/issues)
- 🔧 代码贡献 — [提交 Pull Request](https://github.com/cita-777/metapi/pulls)
- 📝 贡献指南 — [CONTRIBUTING.md](CONTRIBUTING.md)
- 📜 行为准则 — [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## 🛡️ 安全

如发现安全问题，请参考 [SECURITY.md](SECURITY.md) 使用非公开方式报告。

---

## 📜 License

[MIT](LICENSE)

---

<div align="center">

**⭐ 如果 Metapi 对你有帮助，给个 Star 就是最大的支持！**

`<sub>`Built with ❤️ by the AI community`</sub>`

</div>
