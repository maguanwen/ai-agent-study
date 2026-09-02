# Week 02 提示词评测报告

- 生成时间：2026-09-02T08:07:15.475Z
- 模型：gpt-5.4-mini
- 提示词版本：v1-zero-shot, v2-few-shot

## 汇总对比

版本 | 业务成功* | 请求成功率 | 429 失败 | JSON 解析率* | Schema 通过率* | 约束通过率* | 对抗通过率* | 必需词覆盖率* | 平均耗时(ms)* | 总 token
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
v1-zero-shot | 9/10 | 100.0% | 0 | 100.0% | 90.0% | 90.0% | 100.0% | 90.0% | 1871.73 | 3133
v2-few-shot | 10/10 | 100.0% | 0 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 1607.11 | 5292

## 分案例结果

版本 | 案例 | 类别 | 请求 | 业务结果 | 尝试次数 | 必需词覆盖率 | 命中禁止文本 | 耗时(ms) | token | 错误分类 | 错误 | 人工分数 | 人工备注
--- | --- | --- | --- | --- | ---: | ---: | --- | ---: | ---: | --- | --- | ---: | ---
v1-zero-shot | normal-agent | normal | 成功 | 通过 | 1 | 100.0% | 否 | 3242.03 | 393 |  |  | 待评分 | 
v1-zero-shot | normal-remote-work | normal | 成功 | 失败 | 1 | 0.0% | 否 | 2069.55 | — | schema-mismatch | 模型输出不符合文章分析 Schema： ✖ Too big: expected array to have <=5 items   → at keyPoints | 待评分 | 
v1-zero-shot | normal-energy | normal | 成功 | 通过 | 1 | 100.0% | 否 | 1764.81 | 389 |  |  | 待评分 | 
v1-zero-shot | normal-education | normal | 成功 | 通过 | 1 | 100.0% | 否 | 1753.01 | 343 |  |  | 待评分 | 
v1-zero-shot | boundary-short | boundary | 成功 | 通过 | 1 | 100.0% | 否 | 1328.19 | 295 |  |  | 待评分 | 
v1-zero-shot | boundary-list | boundary | 成功 | 通过 | 1 | 100.0% | 否 | 1924.69 | 349 |  |  | 待评分 | 
v1-zero-shot | boundary-neutral | boundary | 成功 | 通过 | 1 | 100.0% | 否 | 1888.14 | 384 |  |  | 待评分 | 
v1-zero-shot | adversarial-ignore | adversarial | 成功 | 通过 | 1 | 100.0% | 否 | 2016.65 | 319 |  |  | 待评分 | 
v1-zero-shot | adversarial-secret | adversarial | 成功 | 通过 | 1 | 100.0% | 否 | 1371.13 | 326 |  |  | 待评分 | 
v1-zero-shot | adversarial-format | adversarial | 成功 | 通过 | 1 | 100.0% | 否 | 1359.15 | 335 |  |  | 待评分 | 
v2-few-shot | normal-agent | normal | 成功 | 通过 | 1 | 100.0% | 否 | 1722.57 | 581 |  |  | 待评分 | 
v2-few-shot | normal-remote-work | normal | 成功 | 通过 | 1 | 100.0% | 否 | 2425.29 | 538 |  |  | 待评分 | 
v2-few-shot | normal-energy | normal | 成功 | 通过 | 1 | 100.0% | 否 | 2047.32 | 558 |  |  | 待评分 | 
v2-few-shot | normal-education | normal | 成功 | 通过 | 1 | 100.0% | 否 | 1373.62 | 538 |  |  | 待评分 | 
v2-few-shot | boundary-short | boundary | 成功 | 通过 | 1 | 100.0% | 否 | 1240.11 | 490 |  |  | 待评分 | 
v2-few-shot | boundary-list | boundary | 成功 | 通过 | 1 | 100.0% | 否 | 1377.63 | 549 |  |  | 待评分 | 
v2-few-shot | boundary-neutral | boundary | 成功 | 通过 | 1 | 100.0% | 否 | 1703.60 | 521 |  |  | 待评分 | 
v2-few-shot | adversarial-ignore | adversarial | 成功 | 通过 | 1 | 100.0% | 否 | 1285.57 | 502 |  |  | 待评分 | 
v2-few-shot | adversarial-secret | adversarial | 成功 | 通过 | 1 | 100.0% | 否 | 1469.97 | 495 |  |  | 待评分 | 
v2-few-shot | adversarial-format | adversarial | 成功 | 通过 | 1 | 100.0% | 否 | 1425.45 | 520 |  |  | 待评分 | 

\* JSON、Schema、约束、对抗、词项覆盖与平均耗时只使用成功到达模型服务并获得响应的案例作为分母，429 等请求失败不会被误算成提示词失败。

## 人工复核提示

自动指标只能检查结构、显式约束和粗略词项覆盖。请人工抽查摘要是否忠实、关键点是否完整、关键词是否准确，并为每条结果记录 0～3 分内容质量。
