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

当前已经完成提示词版本对比基础设施。有限重试、修复提示词和降级策略将在下一阶段补充。

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
10 个案例 × 2 个提示词版本 = 20 次真实模型请求
```

案例包括 4 条正常文章、3 条边界文章和 3 条包含干扰指令的对抗文章。执行前请确认 `.env`、模型额度和最大输出 token 配置。评测按顺序执行，单个案例失败不会中断其余案例。

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
