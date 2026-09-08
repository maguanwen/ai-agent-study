# Week 02：提示词工程与可靠结构化输出

本周通过“文章摘要 + 关键信息提取”学习提示词组织、模型业务 JSON、Zod 运行时校验、失败重试、提示词版本管理与回归评测。

## 当前基础能力

- 从服务端环境变量读取并校验模型配置；
- 使用 Chat Completions API 进行一次非流式模型调用；
- 使用 JSON mode 要求模型生成合法 JSON；
- 使用 Zod 定义并校验文章分析业务结构；
- 区分 API 外层响应错误、非法 JSON 和业务 Schema 错误；
- 记录提示词版本、模型名称和 token 用量；
- 支持 `v1-zero-shot` 与 `v2-few-shot` 两个提示词版本；
- 包含 10 条正常、边界和对抗评测样例；
- 汇总 JSON、Schema、约束、对抗、词项覆盖、耗时和 token 指标；
- 生成 JSON 与 Markdown 对比报告；
- 通过依赖注入测试模型调用，不消耗真实 token。
- 将临时 429、配额耗尽、HTTP、超时、网络、模型响应、业务 JSON 和 Schema 错误分类；
- 对临时 429 执行有限次数的退避重试，并优先遵守服务端返回的等待时间；
- 用全局调度器限制每一次真实 HTTP 请求，包括首次分析、429 重试和输出修复请求；
- 连续 429 耗尽短重试后冷却一次，并重新执行当前案例。
- 当模型业务 JSON 无法解析或不符合 Zod Schema 时，使用校验错误进行一次输出修复；
- 分别记录 HTTP 尝试次数和输出修复次数，并累计修复调用产生的 token。

当前已经完成提示词版本对比基础设施、429 有限重试、请求节流和一次有限输出修复。修复仍失败时会返回明确错误，不会生成伪造的业务数据。

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

批量评测默认先等待 7000 ms，再保证每两次真实 HTTP 请求至少间隔 7000 ms；临时 429 最多额外重试 2 次。短重试仍失败时，当前案例默认冷却 60 秒后重新运行一次。可以在 `.env` 中调整：

```dotenv
EVAL_REQUEST_INTERVAL_MS=7000
EVAL_INITIAL_DELAY_MS=7000
EVAL_MAX_RETRIES=2
EVAL_RETRY_BASE_DELAY_MS=7000
EVAL_RETRY_MAX_DELAY_MS=30000
EVAL_RATE_LIMIT_COOLDOWN_MS=60000
EVAL_MAX_RATE_LIMIT_COOLDOWNS=1
```

`EVAL_MAX_RETRIES=2` 表示一次调用在首次请求之外最多再尝试 2 次，总尝试次数最多为 3。程序会依次读取 `Retry-After`、`retry-after-ms`、`x-ratelimit-reset-requests` 和标准错误消息中的等待时间；没有提示时才使用指数退避。普通的 400、401，以及 `insufficient_quota` 这类无法靠等待恢复的额度错误不会重试。

## 运行

分析默认示例文章：

```bash
pnpm start
```

分析指定 UTF-8 文本文件：

```bash
pnpm start -- fixtures/sample-article.txt
```

指定提示词版本：

```bash
pnpm start -- fixtures/sample-article.txt v2-few-shot
```

## 提示词版本

- `v1-zero-shot`：只提供任务、字段和约束，不提供完整示例；
- `v2-few-shot`：在真实任务前提供一组文章和正确 JSON 输出示例。

few-shot 会增加输入 token，但可能提高输出格式和内容的一致性。是否值得使用应由相同测试集上的评测结果决定，而不是只观察一个示例。

## 运行评测

```bash
pnpm evaluate
```

该命令会运行：

```text
10 个案例 × 2 个提示词版本 = 20 次基础分析
```

案例包括 4 条正常文章、3 条边界文章和 3 条包含干扰指令的对抗文章。执行前请确认 `.env`、模型额度和最大输出 token 配置。评测按顺序执行，全局调度器会限制每次真实 HTTP 请求；单个案例失败不会中断其余案例。由于存在输出修复、429 重试和限流冷却恢复，实际 HTTP 尝试次数可能大于 20。

完成后生成：

```text
reports/evaluation.json # 完整机器可读数据和模型分析结果
reports/evaluation.md   # 汇总表、逐案例结果和人工复核提示
```

自动指标包括：

- JSON 解析率；
- Zod Schema 通过率；
- 字段长度和数组数量约束通过率；
- 对抗样例禁止文本命中情况；
- 必需词粗略覆盖率；
- 平均耗时与 token 总量。

报告会额外记录请求是否成功、错误分类、尝试次数和限流冷却次数。JSON、Schema 等输出指标只以请求成功的案例为分母，避免把 429 错误算成提示词质量问题。

## 输出修复与降级

首次模型输出出现 `invalid-json` 或 `schema-mismatch` 时，分析流程会保留原任务上下文，并追加错误输出和本地校验信息，请模型重新生成一次完整 JSON。默认最多修复一次：

```text
首次分析
  ├─ 校验通过 → 返回结果，repairAttempts = 0
  └─ JSON/Schema 失败 → 修复请求
       ├─ 校验通过 → 返回结果，repairAttempts = 1
       └─ 再次失败 → 返回明确错误，不再重试
```

`attempts` 表示首次分析、输出修复和限流冷却前后累计产生的 HTTP 尝试次数，其中也包含 429 引发的短重试；`repairAttempts` 只表示额外发起了多少次输出修复请求；`rateLimitCooldowns` 表示短重试耗尽后执行了多少次长冷却。网络、认证、限流等 API 请求错误不会触发输出修复。

词项覆盖不能代表真实回答质量。仍需人工检查摘要忠实度、关键点完整度和关键词准确性，并按 0～3 分记录内容质量。

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
├── evaluate.ts        # 真实批量评测入口
├── evaluation.ts      # 单案例执行、指标与汇总
├── evaluation-cases.ts # 10 条分层评测样例
├── index.ts           # CLI 入口
├── model.ts           # 通用模型文本调用
├── prompts.ts         # 提示词及版本号
├── report.ts          # JSON/Markdown 报告生成
└── schema.ts          # 文章输入和输出业务 Schema
tests/
├── analyzer.test.ts
├── env.test.ts
├── evaluation.test.ts
├── model.test.ts
├── prompts.test.ts
├── report.test.ts
└── schema.test.ts
```
