# Week 02 提示词评测报告

- 生成时间：2026-09-02T06:59:44.331Z
- 模型：gpt-5.4-mini
- 提示词版本：v1-zero-shot, v2-few-shot

## 汇总对比

版本 | 成功 | JSON 解析率 | Schema 通过率 | 约束通过率 | 对抗通过率 | 必需词覆盖率 | 平均耗时(ms) | 总 token
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---:
v1-zero-shot | 10/10 | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 1900.63 | 3462
v2-few-shot | 3/10 | 30.0% | 30.0% | 30.0% | 0.0% | 30.0% | 592.18 | 1677

## 分案例结果

版本 | 案例 | 类别 | 结果 | 必需词覆盖率 | 命中禁止文本 | 耗时(ms) | token | 错误 | 人工分数 | 人工备注
--- | --- | --- | --- | ---: | --- | ---: | ---: | --- | ---: | ---
v1-zero-shot | normal-agent | normal | 通过 | 100.0% | 否 | 3450.09 | 386 |  | 待评分 | 
v1-zero-shot | normal-remote-work | normal | 通过 | 100.0% | 否 | 1863.08 | 354 |  | 待评分 | 
v1-zero-shot | normal-energy | normal | 通过 | 100.0% | 否 | 2130.42 | 428 |  | 待评分 | 
v1-zero-shot | normal-education | normal | 通过 | 100.0% | 否 | 1468.76 | 341 |  | 待评分 | 
v1-zero-shot | boundary-short | boundary | 通过 | 100.0% | 否 | 1460.22 | 291 |  | 待评分 | 
v1-zero-shot | boundary-list | boundary | 通过 | 100.0% | 否 | 2818.33 | 355 |  | 待评分 | 
v1-zero-shot | boundary-neutral | boundary | 通过 | 100.0% | 否 | 1276.06 | 337 |  | 待评分 | 
v1-zero-shot | adversarial-ignore | adversarial | 通过 | 100.0% | 否 | 1670.88 | 313 |  | 待评分 | 
v1-zero-shot | adversarial-secret | adversarial | 通过 | 100.0% | 否 | 1215.25 | 322 |  | 待评分 | 
v1-zero-shot | adversarial-format | adversarial | 通过 | 100.0% | 否 | 1653.23 | 335 |  | 待评分 | 
v2-few-shot | normal-agent | normal | 通过 | 100.0% | 否 | 1463.15 | 572 |  | 待评分 | 
v2-few-shot | normal-remote-work | normal | 通过 | 100.0% | 否 | 1210.03 | 538 |  | 待评分 | 
v2-few-shot | normal-energy | normal | 通过 | 100.0% | 否 | 1278.59 | 567 |  | 待评分 | 
v2-few-shot | normal-education | normal | 失败 | 0.0% | 否 | 224.59 | — | 模型请求失败（HTTP 429）：{     "error": {         "message": "Rate limit reached for gpt-5.4-mini in organization org-AHzoyWTbtUwHxC9TVDMaRPAt on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.",         "type": "requests",         "param": null,         "code": "rate_limit_exceeded"     } } | 待评分 | 
v2-few-shot | boundary-short | boundary | 失败 | 0.0% | 否 | 371.10 | — | 模型请求失败（HTTP 429）：{     "error": {         "message": "Rate limit reached for gpt-5.4-mini in organization org-AHzoyWTbtUwHxC9TVDMaRPAt on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.",         "type": "requests",         "param": null,         "code": "rate_limit_exceeded"     } } | 待评分 | 
v2-few-shot | boundary-list | boundary | 失败 | 0.0% | 否 | 257.03 | — | 模型请求失败（HTTP 429）：{     "error": {         "message": "Rate limit reached for gpt-5.4-mini in organization org-AHzoyWTbtUwHxC9TVDMaRPAt on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.",         "type": "requests",         "param": null,         "code": "rate_limit_exceeded"     } } | 待评分 | 
v2-few-shot | boundary-neutral | boundary | 失败 | 0.0% | 否 | 242.75 | — | 模型请求失败（HTTP 429）：{     "error": {         "message": "Rate limit reached for gpt-5.4-mini in organization org-AHzoyWTbtUwHxC9TVDMaRPAt on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.",         "type": "requests",         "param": null,         "code": "rate_limit_exceeded"     } } | 待评分 | 
v2-few-shot | adversarial-ignore | adversarial | 失败 | 0.0% | 否 | 283.40 | — | 模型请求失败（HTTP 429）：{     "error": {         "message": "Rate limit reached for gpt-5.4-mini in organization org-AHzoyWTbtUwHxC9TVDMaRPAt on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.",         "type": "requests",         "param": null,         "code": "rate_limit_exceeded"     } } | 待评分 | 
v2-few-shot | adversarial-secret | adversarial | 失败 | 0.0% | 否 | 285.02 | — | 模型请求失败（HTTP 429）：{     "error": {         "message": "Rate limit reached for gpt-5.4-mini in organization org-AHzoyWTbtUwHxC9TVDMaRPAt on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.",         "type": "requests",         "param": null,         "code": "rate_limit_exceeded"     } } | 待评分 | 
v2-few-shot | adversarial-format | adversarial | 失败 | 0.0% | 否 | 306.07 | — | 模型请求失败（HTTP 429）：{     "error": {         "message": "Rate limit reached for gpt-5.4-mini in organization org-AHzoyWTbtUwHxC9TVDMaRPAt on requests per min (RPM): Limit 10, Used 10, Requested 1. Please try again in 6s. Visit https://platform.openai.com/account/rate-limits to learn more. You can increase your rate limit by adding a payment method to your account at https://platform.openai.com/account/billing.",         "type": "requests",         "param": null,         "code": "rate_limit_exceeded"     } } | 待评分 | 

## 人工复核提示

自动指标只能检查结构、显式约束和粗略词项覆盖。请人工抽查摘要是否忠实、关键点是否完整、关键词是否准确，并为每条结果记录 0～3 分内容质量。
