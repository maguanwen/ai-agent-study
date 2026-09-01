# Week 02：提示词工程与可靠结构化输出

本周通过“文章摘要 + 关键信息提取”学习提示词组织、模型业务 JSON、Zod 运行时校验、失败重试、提示词版本管理与回归评测。

## 当前基础能力

- 从服务端环境变量读取并校验模型配置；
- 使用 Chat Completions API 进行一次非流式模型调用；
- 使用 JSON mode 要求模型生成合法 JSON；
- 使用 Zod 定义并校验文章分析业务结构；
- 区分 API 外层响应错误、非法 JSON 和业务 Schema 错误；
- 记录提示词版本、模型名称和 token 用量；
- 通过依赖注入测试模型调用，不消耗真实 token。

当前只有 `v1-zero-shot` 提示词和单次分析。有限重试、few-shot、10 条评测集以及提示词版本对比将在下一阶段补充。

## 输出结构

```json
{
  "summary": "文章摘要",
  "keyPoints": ["关键点一", "关键点二"],
  "keywords": ["关键词一", "关键词二"]
}
```

JSON mode 只能保证输出是合法 JSON，不能保证字段符合业务要求，因此仍必须通过 `articleAnalysisSchema` 校验。

## 配置

```bash
cp .env.example .env
```

在本地 `.env` 中填写真实模型配置。不要提交 `.env`，也不要从代码中读取 `week01/.env`。

## 运行

分析默认示例文章：

```bash
pnpm start
```

分析指定 UTF-8 文本文件：

```bash
pnpm start -- fixtures/sample-article.txt
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

自动化测试不调用真实模型服务。

## 代码结构

```text
fixtures/
└── sample-article.txt # 默认示例文章
src/
├── analyzer.ts        # 输入校验、业务 JSON 解析和分析流程
├── env.ts             # 环境变量校验
├── index.ts           # CLI 入口
├── model.ts           # 通用模型文本调用
├── prompts.ts         # 提示词及版本号
└── schema.ts          # 文章输入和输出业务 Schema
tests/
├── analyzer.test.ts
├── env.test.ts
├── model.test.ts
└── schema.test.ts
```
