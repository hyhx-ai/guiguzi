# Guiguzi

> AI Coding Agent with Intelligent Router — 智能路由 AI 编程助手

Guiguzi 是一个全栈 AI 编程代理平台，内置智能路由引擎，可在多个 AI 模型之间自动选择最优方案。支持终端 TUI、Web 控制台和多通道网关（飞书/Slack/Discord），既可以本地使用，也可以部署为团队共享的 AI 服务。

## 核心特性

- **智能路由** — 5 种路由策略（静态/任务感知/成本优化/故障转移/混合），自动选择最优 AI 模型
- **多模型支持** — 统一接口对接 OpenAI、Anthropic、Ollama 等 20+ 大模型
- **终端 TUI** — 基于 Ink (React) 的终端交互界面，实时展示路由决策和对话流
- **Web 控制台** — 可视化管理面板，支持会话管理、Provider 配置、路由可视化
- **多通道网关** — 飞书/Slack/Discord/Webhook 统一接入，内置限流和会话同步
- **对话持久化** — 树状对话结构，支持分支和上下文压缩
- **TypeScript 全栈** — pnpm monorepo，8 个独立包，263 个测试用例

## 架构

```
guiguzi/
├── packages/
│   ├── nova-ai/          # AI Provider 抽象层 — 统一接口、任务分类、模型注册
│   ├── nova-router/      # 智能路由引擎 — 5 种策略、健康检查、故障转移
│   ├── nova-agent-core/  # Agent 运行时 — 对话树、工具执行、上下文压缩
│   ├── nova-tui/         # 终端 UI — Ink 组件 (ChatView/StatusBar/RouterPanel)
│   ├── nova-gateway/     # 多通道网关 — 飞书/Slack/Discord/Webhook 适配
│   ├── nova-web/         # Web 控制台 — Dashboard/Chat/Sessions/Providers
│   ├── nova-sdk/         # 嵌入 SDK — 将 Guiguzi 集成到你自己的应用
│   └── nova-cli/         # CLI 入口 — Agent 模式、Doctor 诊断、初始化
├── deploy/               # 部署配置 (systemd)
├── Dockerfile            # 多阶段 Docker 构建
└── docker-compose.yml    # Docker Compose (Gateway + Ollama)
```

## 快速开始

### 终端 Agent（本地使用）

```bash
git clone https://github.com/hyhx-ai/guiguzi.git
cd guiguzi
pnpm install
pnpm build

# 设置 API 密钥（至少一个）
export OPENAI_API_KEY=sk-xxx
# export ANTHROPIC_API_KEY=sk-ant-xxx

# 启动终端 Agent
node packages/nova-cli/dist/index.js agent
```

### Docker 部署

```bash
cp .env.example .env
# 编辑 .env 填入 API 密钥
docker compose up -d
```

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

### systemd 直接部署（VPS）

```bash
git clone https://github.com/hyhx-ai/guiguzi.git
cd guiguzi
sudo bash deploy/install.sh
# 编辑 /etc/guiguzi/env 填入 API 密钥
sudo systemctl enable --now guiguzi-gateway
```

### 纯本地使用

不需要 Docker，直接运行：

```bash
pnpm install && pnpm build
export OPENAI_API_KEY=sk-xxx
node packages/nova-cli/dist/index.js agent
```

## 配置

复制 `.env.example` 为 `.env`，主要配置项：

| 变量 | 说明 |
|------|------|
| `OPENAI_API_KEY` | OpenAI API 密钥 |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 |
| `OLLAMA_BASE_URL` | Ollama 地址（默认 `http://localhost:11434`） |
| `GATEWAY_PORT` | 网关端口（默认 `18789`） |
| `WEB_PORT` | Web 控制台端口（默认 `3000`） |

## License

MIT
