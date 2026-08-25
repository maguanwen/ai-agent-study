# Week 01：模型 API 多轮问答

使用 TypeScript 构建一个命令行多轮聊天程序，通过 OpenAI 兼容的 Chat Completions API 获取真实模型回答，并管理上下文、历史窗口和运行日志。

## 当前功能

- 在一个进程中连续进行多轮对话；
- 从终端读取并校验问题；
- 从服务端环境变量读取模型配置；
- 发送 `system`、`user` 和 `assistant` 消息历史；
- 支持 `/help`、`/history`、`/clear` 和 `/exit`；
- 限制上下文中保留的最大对话轮数；
- 支持请求超时和 HTTP 错误处理；
- 使用 Zod 校验模型响应；
- 输出模型名称、请求耗时和 token 用量；
- 将每轮问答追加保存为 JSON Lines 日志；
- 使用 Vitest 测试配置、会话状态、请求消息、日志与响应解析。

## 配置

复制环境变量示例：

```bash
cp .env.example .env
```

编辑 `.env`：

```dotenv
MODEL_API_KEY=你的密钥
MODEL_BASE_URL=https://api.openai.com/v1
MODEL_NAME=你的模型名称
MODEL_TIMEOUT_MS=30000
MODEL_TEMPERATURE=0.2
CHAT_MAX_TURNS=10
CHAT_LOG_PATH=logs/chat.jsonl
```

`MODEL_BASE_URL` 应填写 API 的 `/v1` 基础地址，不要包含 `/chat/completions`。部分模型不支持 `temperature`；遇到参数不支持错误时，可以将 `MODEL_TEMPERATURE` 留空。

不要提交 `.env`，也不要将 API Key 写入浏览器代码、源码或日志。

`CHAT_MAX_TURNS` 控制发送给模型的历史轮数。窗口超出限制时，只移除最早的 `user/assistant` 消息，始终保留 system 消息。

## 运行

```bash
pnpm start
```

开发监听模式：

```bash
pnpm dev
```

## 聊天命令

```text
/help     显示帮助
/history  查看本次会话历史
/clear    清空历史并保留 system 消息
/exit     退出程序
```

模型请求失败时，本轮问题和回答不会写入会话历史，程序会继续等待下一次输入。

## 对话日志

每次成功问答会追加到 `CHAT_LOG_PATH` 指定的 JSONL 文件。每行是一条独立 JSON，包含：

- ISO 时间；
- 问题与回答；
- 模型名称；
- 请求耗时；
- token 用量。

日志可能包含对话内容，`logs/` 已被 Git 忽略。日志不会记录 API Key 或 Authorization 请求头。

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 代码结构

```text
src/
├── chat.ts    # 消息类型、会话状态和命令解析
├── env.ts     # 环境变量读取与校验
├── index.ts   # 多轮聊天循环与结果展示
├── logger.ts  # JSON Lines 日志追加
└── model.ts   # HTTP 请求与模型响应解析
tests/
├── chat.test.ts
├── env.test.ts
├── logger.test.ts
└── model.test.ts
```

当前历史只保存在进程内，退出后不会恢复。JSONL 文件用于学习记录和评测，不会在启动时自动载入为上下文。
