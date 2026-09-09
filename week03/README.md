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

下一阶段会增加时间查询和本地知识查询工具，然后把工具描述提供给模型，让模型生成工具调用请求。
