# Week 01：模型 API 多轮问答

使用 TypeScript 构建一个命令行多轮聊天程序，通过 OpenAI 兼容的 Chat Completions API 获取真实模型回答，并管理上下文、历史窗口和运行日志。

## 当前功能

- 在一个进程中连续进行多轮对话；
- 从终端读取并校验问题；
- 从服务端环境变量读取模型配置；
- 发送 `system`、`user` 和 `assistant` 消息历史；
- 通过 SSE 实时输出模型生成的文本增量；
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
MODEL_MAX_OUTPUT_TOKENS=800
MODEL_TEMPERATURE=0.2
CHAT_MAX_TURNS=10
CHAT_LOG_PATH=logs/chat.jsonl
```

`MODEL_BASE_URL` 应填写 API 的 `/v1` 基础地址，不要包含 `/chat/completions`。`MODEL_MAX_OUTPUT_TOKENS` 会映射为 Chat Completions 的 `max_completion_tokens`，用于限制一次请求最多生成的 token。该限制还包括模型生成的不可见推理或格式 token，因此实际可见回答通常少于配置值。部分模型不支持 `temperature`；遇到参数不支持错误时，可以将 `MODEL_TEMPERATURE` 留空。

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

## 流式输出

模型请求使用 `stream: true`，服务端通过 SSE 连续返回 `chat.completion.chunk`。程序读取 `choices[0].delta.content` 并立即写入终端，因此不需要等待完整回答生成后才看到内容。

程序同时发送：

```json
{
  "stream_options": {
    "include_usage": true
  }
}
```

最终的空 `choices` chunk 用于返回整次请求的 token 用量。流结束后，程序才会把拼接后的完整回答提交到会话历史和 JSONL 日志。如果流中途失败，已经显示的部分文本不会进入正式历史。

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
├── model.ts   # 普通请求、流式请求与模型响应解析
└── sse.ts     # SSE 网络分片解析
tests/
├── chat.test.ts
├── env.test.ts
├── logger.test.ts
├── model.test.ts
└── sse.test.ts
```

当前历史只保存在进程内，退出后不会恢复。JSONL 文件用于学习记录和评测，不会在启动时自动载入为上下文。
