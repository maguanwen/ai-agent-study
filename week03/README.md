# Week 03：工具调用与 Agent 循环

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

本阶段无需 API Key 或复制 .env。验证使用 pnpm typecheck、pnpm test、pnpm build；HTTP 联调测试自动启动随机端口并关闭服务。真实模型选择工具与 Agent 循环是下一阶段。
