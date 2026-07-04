# Guiguzi

> AI Coding Agent with Intelligent Router — 智能路由 AI 编程助手

Guiguzi 是一个全栈 AI 编程代理平台，内置智能路由引擎，可在多个 AI 模型之间自动选择最优方案。支持终端 TUI、Web 控制台和 15+ 消息通道网关，既可以本地使用，也可以部署为团队共享的 AI 服务。

## 核心特性

- **智能路由** — 5 种路由策略（静态/任务感知/成本优化/故障转移/混合），自动选择最优 AI 模型
- **多模型支持** — 统一接口对接 OpenAI、Anthropic、Google、Ollama 等 20+ 大模型
- **终端 TUI** — OpenClaw 风格垂直布局终端 UI，支持 Markdown 渲染、工具执行展示、Slash 命令、暗/亮主题
- **Web 控制台** — 可视化管理面板，支持会话管理、Provider 配置、路由可视化
- **15+ 消息通道** — 飞书/Slack/Discord/Telegram/WhatsApp/Matrix/Teams/LINE/IRC/Google Chat/Mattermost/SMS/Nostr/QQ Bot/Web
- **对话持久化** — 树状对话结构，支持分支和上下文压缩
- **TypeScript 全栈** — pnpm monorepo，8 个独立包，263+ 测试用例

## 架构

```
guiguzi/
├── packages/
│   ├── nova-ai/          # AI Provider 抽象层 — 统一接口、任务分类、模型注册
│   ├── nova-router/      # 智能路由引擎 — 5 种策略、健康检查、故障转移
│   ├── nova-agent-core/  # Agent 运行时 — 对话树、工具执行、上下文压缩
│   ├── nova-tui/         # 终端 UI — Header/ChatLog/Status/Footer/Editor 垂直布局
│   ├── nova-gateway/     # 多通道网关 — 15+ 通道适配、限流、队列、会话同步
│   ├── nova-web/         # Web 控制台 — Dashboard/Chat/Sessions/Providers
│   ├── nova-sdk/         # 嵌入 SDK — 将 Guiguzi 集成到你自己的应用
│   └── nova-cli/         # CLI 入口 — Agent/Onboard/Doctor/Gateway 命令
├── scripts/              # 安装脚本 (install.sh / install-cli.sh / install.ps1)
├── deploy/               # 部署配置 (systemd)
├── Dockerfile            # 多阶段 Docker 构建
├── docker-compose.yml    # Docker Compose (Gateway + Ollama)
├── fly.toml              # Fly.io 部署
└── render.yaml           # Render 部署配置
```

## 安装

### 一键安装（推荐）

**Linux / macOS:**
```bash
curl -fsSL https://raw.githubusercontent.com/hyhx-ai/guiguzi/main/scripts/install.sh | bash
```

**Windows (PowerShell):**
```powershell
iwr -useb https://raw.githubusercontent.com/hyhx-ai/guiguzi/main/scripts/install.ps1 | iex
```

**本地前缀安装（不需要系统 Node.js）:**
```bash
curl -fsSL https://raw.githubusercontent.com/hyhx-ai/guiguzi/main/scripts/install-cli.sh | bash
```

### npm 安装

```bash
npm install -g guiguzi@latest
```

### 从源码安装

```bash
git clone https://github.com/hyhx-ai/guiguzi.git
cd guiguzi
pnpm install
pnpm build
```

## 快速开始

### 交互式设置向导

```bash
guiguzi onboard
```

引导你完成 AI Provider 选择、API Key 配置、模型选择、通道配置、守护进程安装。

### 终端 Agent

```bash
# 设置 API 密钥（至少一个）
export OPENAI_API_KEY=sk-xxx
# export ANTHROPIC_API_KEY=sk-ant-xxx

# 启动终端 Agent
guiguzi agent
```

### TUI 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Escape` | 取消/退出 |
| `Ctrl+C` | 退出 |
| `/help` | 查看所有命令 |
| `/model <name>` | 切换模型 |
| `/think` | 切换思考模式 |
| `/fast` | 切换快速模式 |
| `/usage` | 查看 Token 用量 |
| `/abort` | 中止当前操作 |
| `/new` | 新建会话 |

## 部署方式

### Docker Compose（推荐）

最简单的部署方式，自带 Ollama 本地模型支持：

```bash
git clone https://github.com/hyhx-ai/guiguzi.git
cd guiguzi
cp .env.example .env
# 编辑 .env 配置 API 密钥和通道参数
docker compose up -d
```

Gateway 默认运行在 `18789` 端口。

### Fly.io 部署

```bash
fly launch --copy-config
fly deploy
```

### Render 部署

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/hyhx-ai/guiguzi)

### systemd 直接部署（VPS）

```bash
git clone https://github.com/hyhx-ai/guiguzi.git
cd guiguzi
sudo bash deploy/install.sh
# 编辑 /etc/guiguzi/env 填入 API 密钥
sudo systemctl enable --now guiguzi-gateway
```

### 纯本地使用

```bash
pnpm install && pnpm build
export OPENAI_API_KEY=sk-xxx
guiguzi agent
```

## 支持的消息通道

| 通道 | 类型 | 配置方式 |
|------|------|----------|
| 飞书 (Feishu) | 企业协作 | Webhook + App |
| Slack | 企业协作 | Event API |
| Discord | 社区 | Bot API |
| Telegram | 即时通讯 | Bot API |
| WhatsApp | 即时通讯 | Business API |
| Matrix | 去中心化 | Homeserver |
| Microsoft Teams | 企业协作 | Bot Framework |
| LINE | 即时通讯 | Messaging API |
| IRC | 经典 | Bridge |
| Google Chat | 企业协作 | Workspace |
| Mattermost | 企业协作 | Webhook |
| SMS (Twilio) | 短信 | Webhook |
| Nostr | 去中心化 | NIP-04 DM |
| QQ Bot | 社区 | Bot API |
| Web | 内嵌 | REST API |

## 配置

复制 `.env.example` 为 `.env`，主要配置项：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `GOOGLE_API_KEY` | Google Gemini API 密钥 |
| `OLLAMA_BASE_URL` | Ollama 地址（默认 `http://localhost:11434`） |
| `GATEWAY_PORT` | 网关端口（默认 `18789`） |
| `WEB_PORT` | Web 控制台端口（默认 `3000`） |

## License

MIT
