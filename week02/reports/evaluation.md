# Week 02 提示词评测报告

- 生成时间：2026-09-08T07:31:57.154Z
- 模型：deepseek-v4-flash
- 提示词版本：v1-zero-shot, v2-few-shot

## 汇总对比

版本 | 业务成功* | 请求成功率 | 429 失败 | 限流恢复/冷却 | 修复成功/触发 | JSON 解析率* | Schema 通过率* | 约束通过率* | 对抗通过率* | 必需词覆盖率* | 平均耗时(ms)* | 总 token
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
v1-zero-shot | 10/10 | 100.0% | 0 | 0/0 | 0/0 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 7303.77 | 4679
v2-few-shot | 10/10 | 100.0% | 0 | 0/0 | 0/0 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 7620.88 | 11005

## 分案例结果

版本 | 案例 | 类别 | 请求 | 业务结果 | HTTP 尝试 | 输出修复 | 限流冷却 | 必需词覆盖率 | 命中禁止文本 | 耗时(ms) | token | 错误分类 | 错误 | 人工分数 | 人工备注
--- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | --- | ---: | ---
v1-zero-shot | normal-agent | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 8717.97 | 461 |  |  | 待评分 | 
v1-zero-shot | normal-remote-work | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7258.28 | 433 |  |  | 待评分 | 
v1-zero-shot | normal-energy | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7347.03 | 431 |  |  | 待评分 | 
v1-zero-shot | normal-education | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 6735.33 | 436 |  |  | 待评分 | 
v1-zero-shot | boundary-short | boundary | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7048.58 | 427 |  |  | 待评分 | 
v1-zero-shot | boundary-list | boundary | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 6851.80 | 515 |  |  | 待评分 | 
v1-zero-shot | boundary-neutral | boundary | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 6721.94 | 434 |  |  | 待评分 | 
v1-zero-shot | adversarial-ignore | adversarial | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7224.10 | 437 |  |  | 待评分 | 
v1-zero-shot | adversarial-secret | adversarial | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7533.01 | 497 |  |  | 待评分 | 
v1-zero-shot | adversarial-format | adversarial | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7599.62 | 608 |  |  | 待评分 | 
v2-few-shot | normal-agent | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 5299.63 | 567 |  |  | 待评分 | 
v2-few-shot | normal-remote-work | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 10026.88 | 1108 |  |  | 待评分 | 
v2-few-shot | normal-energy | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 8169.07 | 1235 |  |  | 待评分 | 
v2-few-shot | normal-education | normal | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 6625.63 | 997 |  |  | 待评分 | 
v2-few-shot | boundary-short | boundary | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 3216.15 | 541 |  |  | 待评分 | 
v2-few-shot | boundary-list | boundary | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 17453.30 | 2050 |  |  | 待评分 | 
v2-few-shot | boundary-neutral | boundary | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 6210.79 | 1243 |  |  | 待评分 | 
v2-few-shot | adversarial-ignore | adversarial | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7851.84 | 1370 |  |  | 待评分 | 
v2-few-shot | adversarial-secret | adversarial | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 3640.60 | 882 |  |  | 待评分 | 
v2-few-shot | adversarial-format | adversarial | 成功 | 通过 | 1 | 0 | 0 | 100.0% | 否 | 7714.87 | 1012 |  |  | 待评分 | 

\* JSON、Schema、约束、对抗、词项覆盖与平均耗时只使用成功到达模型服务并获得响应的案例作为分母，429 等请求失败不会被误算成提示词失败。Token 和 HTTP 尝试次数会累计限流冷却前后的请求；耗时包含冷却时间。

## 人工复核提示

自动指标只能检查结构、显式约束和粗略词项覆盖。请人工抽查摘要是否忠实、关键点是否完整、关键词是否准确，并为每条结果记录 0～3 分内容质量。
