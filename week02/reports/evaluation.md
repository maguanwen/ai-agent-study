# Week 02 提示词评测报告

- 生成时间：2026-09-07T08:27:57.028Z
- 模型：gpt-5.4-mini
- 提示词版本：v1-zero-shot, v2-few-shot

## 汇总对比

版本 | 业务成功* | 请求成功率 | 429 失败 | 修复成功/触发 | JSON 解析率* | Schema 通过率* | 约束通过率* | 对抗通过率* | 必需词覆盖率* | 平均耗时(ms)* | 总 token
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
v1-zero-shot | 0/0 | 0.0% | 10 | 0/0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.00 | —
v2-few-shot | 0/0 | 0.0% | 10 | 0/0 | 0.0% | 0.0% | 0.0% | 0.0% | 0.0% | 0.00 | —

## 分案例结果

版本 | 案例 | 类别 | 请求 | 业务结果 | HTTP 尝试 | 输出修复 | 必需词覆盖率 | 命中禁止文本 | 耗时(ms) | token | 错误分类 | 错误 | 人工分数 | 人工备注
--- | --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | ---: | ---
v1-zero-shot | normal-agent | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 8662.94 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | normal-remote-work | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5277.81 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | normal-energy | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 4731.25 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | normal-education | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 4825.38 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | boundary-short | boundary | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5751.04 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | boundary-list | boundary | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5151.72 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | boundary-neutral | boundary | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 4193.73 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | adversarial-ignore | adversarial | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 4770.27 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | adversarial-secret | adversarial | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5256.46 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v1-zero-shot | adversarial-format | adversarial | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 4367.53 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | normal-agent | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5132.29 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | normal-remote-work | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5955.88 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | normal-energy | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 4870.57 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | normal-education | normal | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5344.71 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | boundary-short | boundary | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5111.85 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | boundary-list | boundary | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5597.70 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | boundary-neutral | boundary | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5413.30 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | adversarial-ignore | adversarial | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 4508.25 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | adversarial-secret | adversarial | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 6630.23 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 
v2-few-shot | adversarial-format | adversarial | 失败 | 失败 | 3 | 0 | 0.0% | 否 | 5554.21 | — | rate-limit | 模型请求受到限流（HTTP 429） | 待评分 | 

\* JSON、Schema、约束、对抗、词项覆盖与平均耗时只使用成功到达模型服务并获得响应的案例作为分母，429 等请求失败不会被误算成提示词失败。Token 会累计首次分析和输出修复请求的用量。

## 人工复核提示

自动指标只能检查结构、显式约束和粗略词项覆盖。请人工抽查摘要是否忠实、关键点是否完整、关键词是否准确，并为每条结果记录 0～3 分内容质量。
