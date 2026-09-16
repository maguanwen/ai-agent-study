# Week 03：工具调用与 Agent 循环

## VS Code 断点调试

在 VS Code 中打开整个 ai-agent-study 根目录（不是只打开 week03），根目录 .vscode/launch.json 已提供普通演示、错误恢复演示、真实模型和本地知识服务四个调试入口。

1. 打开 src/agent.ts，在 modelCaller 调用行左侧点击添加红色断点。
2. 按 Ctrl+Shift+D，选择“Week03：Agent 演示（无需 Key）”，按 F5。
3. 暂停后查看左侧变量中的 messages、step；F10 单步跳过，F11 进入函数，Shift+F11 跳出函数，F5 继续，Shift+F5 停止。
4. 在 executeTool 调用行和 messages.push 的 tool 消息位置增加断点，观察第一次模型请求、工具执行和第二次模型请求的区别。断点应放在可执行语句上，interface/type 声明不会执行。

演示模式不会进入 createModelCaller 的 fetch 分支。要调试真实 HTTP 请求，先配置 week03/.env，再选择“Week03：Agent 真实模型（消耗 API 额度）”，输入问题启动；查询知识时先启动“Week03：本地知识服务”配置或另开终端执行 pnpm serve。

配置通过 node --import tsx 直接调试 TypeScript，无需先 build。Windows 配置使用本机已有的 ${env:APPDATA}/nvm/v24.19.0/node.exe，避免系统默认旧版 Node 影响运行。换电脑或 Node 版本后需调整 launch.json 中的 windows.runtimeExecutable；其他系统使用 PATH 中的 node（要求 24.x）。

如果断点呈灰色，先确认使用 F5 启动了对应配置、打开的是根目录、week03 已安装依赖，且断点位于当前运行分支。不要用“运行代码 / Code Runner”代替调试入口。

本周目标是让模型在代码规定的边界内选择工具，由 TypeScript 程序校验参数并执行工具，最后把工具结果交还给模型生成回答。

## 第一阶段：确定性工具层

当前阶段暂不接入模型 API，先完成：

- 使用 `defineTool()` 定义统一工具接口；
- 使用 Zod 校验不可信的工具参数；
- 使用 `ToolRegistry` 建立工具白名单；
- 使用 `executeTool()` 统一执行并记录名称、输入、输出和耗时；
- 区分未知工具、参数错误和工具内部错误；
- 实现安全的四则运算工具，不使用 `eval()`。

## 安装与运行

```bash
pnpm install
pnpm start
pnpm start -- multiply 6 7
```

命令参数依次是：运算类型、左操作数和右操作数。支持 `add`、`subtract`、`multiply` 和 `divide`。

示例结果：

```json
{
  "toolName": "calculator",
  "input": {
    "operation": "multiply",
    "left": 6,
    "right": 7
  },
  "output": {
    "expression": "6 × 7",
    "result": 42
  },
  "elapsedMs": 0.1
}
```

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 当前数据流

```text
手动构造工具调用请求
        ↓
ToolRegistry 检查工具白名单
        ↓
Zod 校验 arguments
        ↓
执行 TypeScript 函数
        ↓
返回统一的工具执行结果
```

## 第二阶段：多工具与异步 HTTP 查询

当前有三个工具：calculator、get_current_time、search_knowledge。工具仍由命令行选择，后续再让模型生成调用请求。

在 week03 目录运行以下命令（JSON 参数使用单引号包裹）：

```bash
pnpm start -- list
pnpm start -- calculator '{"operation":"multiply","left":6,"right":7}'
pnpm start -- get_current_time '{"timezone":"Asia/Shanghai"}'
```

知识查询需要两个终端。第一个终端启动本地服务：

```bash
pnpm serve
```

第二个终端调用工具：

```bash
pnpm start -- search_knowledge '{"query":"工具","limit":2}'
pnpm start -- search_knowledge '{"query":"不存在的内容"}'
```

本地服务仅监听 127.0.0.1:3033，Ctrl+C 退出。资料是 src/knowledge.ts 中的固定教学条目，source 是来源标识；搜索使用标题和正文的子串匹配，不是语义搜索。limit 可省略（默认 3），范围为 1～5。无匹配返回 results: []。

时间工具使用机器时钟，通过 Intl.DateTimeFormat 转换时区，utc 和 localTime 表示同一时刻；localTime 不含偏移量，应结合 timezone 阅读。createTimeTool 可以注入固定时钟，用于可重复测试。

知识工具使用 fetch 请求 GET /knowledge，通过 URLSearchParams 编码中文参数；服务端再次校验查询，客户端使用 Zod 校验响应。默认 3 秒超时，AbortController 中止请求，finally 清理计时器。endpoint、timeoutMs、fetchImplementation 由开发者注入，不能通过工具参数覆盖。

错误分为参数校验错误，以及知识请求的 timeout、network、http、invalid-response。执行器把知识请求错误包装成 ToolExecutionError，并在 cause 中保留分类；CLI 会显示分类及简要说明。未启动服务时会提示运行 pnpm serve。

本阶段的手动工具命令无需 API Key。验证使用 pnpm typecheck、pnpm test、pnpm build；HTTP 联调测试自动启动随机端口并关闭服务。

## 第三阶段：模型选择工具与 Agent 循环

先运行无需 Key 的演示，观察模拟模型请求工具、本地真实执行、观察结果返回给模拟模型的过程：

```bash
pnpm agent:demo
```

真实模型模式在 week03 目录准备 .env（已有文件时请直接编辑，避免覆盖）：

```bash
cp .env.example .env
```

填写 MODEL_API_KEY、MODEL_BASE_URL、MODEL_NAME。使用 Node.js 24 的 loadEnvFile 读取配置，无需 dotenv。沿用你已验证的服务商和支持 Chat Completions function calling 的模型；不同服务商并不保证完全兼容。MODEL_TOKEN_PARAMETER 默认 max_completion_tokens，服务商要求旧参数时改为 max_tokens。

```bash
pnpm agent -- "请使用计算器计算 6 乘 7"
pnpm agent -- "查询上海现在的时间"
pnpm agent -- "在本地知识中查找 Zod 的用途，并注明来源"
```

最后一条需要另一个终端先运行 pnpm serve。真实模型命令会消耗 API 额度。

数据流：用户问题 → 携带 tools 请求模型 → assistant.tool_calls → JSON.parse 参数 → 白名单与 Zod 校验 → 执行工具 → role=tool 消息 → 再次请求模型 → 最终文字或继续调用。

- model.ts：将 Zod Schema 转成模型可读的 JSON Schema，通过 fetch 调用 /chat/completions。strict=false 保留可选参数；refine 中的时区、除零规则仍在本地执行。此处不再强制文章分析的 JSON mode。
- agent.ts：每次运行持有独立 messages，保留 assistant 工具请求；每个 tool 结果携带对应的 tool_call_id。同一步多个工具按顺序执行。
- 工具失败返回 ok=false 和错误分类，模型可以修正参数再调用；模型/API 失败直接停止并保留已有工具轨迹。本阶段没有移植 Week 02 的 HTTP 自动重试。
- AGENT_MAX_STEPS 默认 6，表示包括最终回答在内的模型请求上限；最后一步仍要求工具时停止，不再执行工具。AGENT_MAX_TOOL_CALLS 默认 8，包含失败的工具调用尝试，超出预算的一批不会执行。
- 输出 stopReason、steps、trace、usage 和 missingUsageSteps。completed 表示得到最终文本，并不保证所有工具都成功或答案语义正确；达到上限时 answer=null，不伪造结果。缺少 usage 的步骤不按真实零消费解读，累计 token 只代表已报告用量。
- 模型单次请求默认 30 秒超时；知识 HTTP 工具默认 3 秒超时。这不是整个任务的统一截止时间。重复请求目前由总步数和工具次数限制，后续再学习专门的重复调用检测与幂等。

读取代码建议：run-agent.ts → model.ts 的消息类型和 buildTools → agent.ts 的循环 → 测试。

协议参考：[OpenAI Function calling](https://developers.openai.com/api/docs/guides/function-calling)。本项目本阶段使用 Chat Completions 的工具消息形式；不支持仅提供 Responses 工具调用的模型。

## 第四阶段：错误恢复演示（无需 Key）

在 week03 目录运行：

```bash
pnpm agent:demo:recovery
```

题目固定为“12 除以 3”。复用已有 runAgent，不请求模型 API、不读取 .env、不需要知识服务。

1. 第一轮模拟模型故意返回除数 0；本地 Zod 拒绝参数，生成 invalid-arguments 错误。此时没有真正执行除法。
2. runAgent 将失败作为 role=tool 消息加入历史，而不是立刻结束任务。
3. 第二轮模拟模型读取最近的错误消息，返回新调用，除数改为题目要求的 3；计算器得到 4。
4. 第三轮模拟模型读取最近的成功结果，返回最终文字。

预期：stopReason=completed、steps=3、trace 有两条记录（一次失败、一次成功），answer 包含结果 4。这里的三轮都是模拟调用，未产生 API 费用；missingUsageSteps=3 表示模拟返回未提供 usage。

修复决策在 src/recovery-demo.ts 中明确写死，仅用来演示反馈路径，不是通用自动修复算法。真实模式由真实模型决定是否修正或如实说明失败。这里没有新增 HTTP 重试、重复调用检测或幂等机制，也不是自动重发相同参数。

### 断点阅读顺序

选择 VS Code 的“Week03：错误恢复演示（无需 Key）”，按 F5：

1. 在 agent.ts 的 modelCaller 调用行查看 messages 和 step。
2. 在 recovery-demo.ts 的 observation 赋值处观察最近一条工具消息：无结果 → 失败 → 成功。使用 findLast 而不是 find，避免一直读到最早的失败结果。
3. 在 agent.ts 的 catch 中查看参数校验异常如何变成 ToolOutcome，再查看 role=tool 消息如何加入历史。
4. 在 recovery-demo.ts 的 right = 3 处观察修正后的参数；第三轮查看 result.output.result。

tests/recovery-demo.test.ts 验证错误反馈、参数修正、消息顺序，以及恢复过程仍受最大步数和工具调用预算约束。失败调用也占用工具预算；预算不足时不会保证修复完成。
