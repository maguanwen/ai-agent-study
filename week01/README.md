# Week 01：模型 API 单轮问答

使用 TypeScript 构建一个命令行问答程序，通过 OpenAI 兼容的 Chat Completions API 获取真实模型回答。

## 当前功能

- 从终端读取并校验问题；
- 从服务端环境变量读取模型配置；
- 发送 `system` 和 `user` 消息；
- 支持请求超时和 HTTP 错误处理；
- 使用 Zod 校验模型响应；
- 输出模型名称、请求耗时和 token 用量；
- 使用 Vitest 测试配置与响应解析。

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
```

`MODEL_BASE_URL` 应填写 API 的 `/v1` 基础地址，不要包含 `/chat/completions`。部分模型不支持 `temperature`；遇到参数不支持错误时，可以将 `MODEL_TEMPERATURE` 留空。

不要提交 `.env`，也不要将 API Key 写入浏览器代码、源码或日志。

## 运行

```bash
pnpm start
```

开发监听模式：

```bash
pnpm dev
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 代码结构

```text
src/
├── env.ts    # 环境变量读取与校验
├── index.ts  # 命令行入口与结果展示
└── model.ts  # HTTP 请求与模型响应解析
tests/
├── env.test.ts
└── model.test.ts
```

当前只实现单轮问答。下一步将保存 `system`、`user`、`assistant` 消息历史，实现多轮对话。
