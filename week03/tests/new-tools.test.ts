import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createTimeTool } from "../src/tools/time.js";
import { createKnowledgeTool } from "../src/tools/knowledge-search.js";
import { createKnowledgeServer } from "../src/knowledge-server.js";
import { ToolRegistry } from "../src/tool-registry.js";
import { executeTool } from "../src/tool-executor.js";

describe("时间工具", () => {
  const tool = createTimeTool(() => new Date("2026-09-09T18:00:00Z"));
  it("根据同一时刻换算时区并处理跨日", async () => {
    await expect(tool.invoke({ timezone: "Asia/Shanghai" })).resolves.toMatchObject({
      utc: "2026-09-09T18:00:00.000Z", localTime: "2026-09-10 02:00:00",
    });
    await expect(tool.invoke({ timezone: "UTC" })).resolves.toMatchObject({
      localTime: "2026-09-09 18:00:00",
    });
  });
  it("拒绝未知时区与额外参数", async () => {
    await expect(tool.invoke({ timezone: "Invalid/Zone" })).rejects.toMatchObject({ name: "ToolInputValidationError" });
    await expect(tool.invoke({ timezone: "UTC", extra: true })).rejects.toThrow();
  });
});

describe("知识服务真实 HTTP 联调", () => {
  const server = createKnowledgeServer();
  let endpoint: string;
  beforeAll(async () => {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    endpoint = "http://127.0.0.1:" + (server.address() as AddressInfo).port + "/knowledge";
  });
  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  });
  it("通过执行器查询中文并返回来源", async () => {
    const registry = new ToolRegistry([createKnowledgeTool({ endpoint })]);
    const result = await executeTool(registry, { name: "search_knowledge", arguments: { query: "工具", limit: 1 } });
    expect(result.output).toMatchObject({ results: [{ id: "tools", source: "week03-notes/tools" }] });
  });
  it("无匹配时返回空数组", async () => {
    await expect(createKnowledgeTool({ endpoint }).invoke({ query: "无此资料XYZ" })).resolves.toEqual({ results: [] });
  });
  it("服务端拒绝非法查询、方法和路径", async () => {
    expect((await fetch(endpoint + "?query=&limit=1")).status).toBe(400);
    expect((await fetch(endpoint + "?query=zod&limit=9")).status).toBe(400);
    expect((await fetch(endpoint, { method: "POST" })).status).toBe(405);
    expect((await fetch(endpoint + "/missing")).status).toBe(404);
  });
});

describe("知识工具失败路径", () => {
  it("非法参数不发起网络请求", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(createKnowledgeTool({ fetchImplementation: request }).invoke({ query: " ", limit: 0 })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
  it.each([
    [new Response("unavailable", { status: 503 }), "http"],
    [new Response("not json"), "invalid-response"],
    [new Response(JSON.stringify({ results: [{ title: "缺少字段" }] })), "invalid-response"],
  ])("分类 HTTP 或响应错误", async (response, kind) => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    await expect(createKnowledgeTool({ fetchImplementation: request }).invoke({ query: "zod" })).rejects.toMatchObject({ kind });
  });
  it("分类网络异常并通过执行器保留 cause", async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const registry = new ToolRegistry([createKnowledgeTool({ fetchImplementation: request })]);
    await expect(executeTool(registry, { name: "search_knowledge", arguments: { query: "zod" } })).rejects.toMatchObject({
      name: "ToolExecutionError", cause: { kind: "network" },
    });
  });
  it("超时会中止 fetch 并清理计时器", async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | null | undefined;
      const request = vi.fn<typeof fetch>((_url, init) => {
        signal = init?.signal;
        return new Promise((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      });
      const result = createKnowledgeTool({ fetchImplementation: request, timeoutMs: 100 }).invoke({ query: "zod" });
      const assertion = expect(result).rejects.toMatchObject({ kind: "timeout" });
      await vi.advanceTimersByTimeAsync(100);
      await assertion;
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });
});
