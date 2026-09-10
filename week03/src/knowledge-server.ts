import { createServer, type ServerResponse } from "node:http";
import { knowledgeInputSchema, searchKnowledge } from "./knowledge.js";

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

export function createKnowledgeServer() {
  return createServer((request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      if (url.pathname !== "/knowledge") {
        send(response, 404, { error: "接口不存在" });
        return;
      }
      if (request.method !== "GET") {
        response.setHeader("Allow", "GET");
        send(response, 405, { error: "仅支持 GET" });
        return;
      }
      const parsed = knowledgeInputSchema.safeParse({
        query: url.searchParams.get("query"),
        limit: url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : 3,
      });
      if (!parsed.success) {
        send(response, 400, { error: "查询参数不合法" });
        return;
      }
      send(response, 200, searchKnowledge(parsed.data));
    } catch {
      send(response, 400, { error: "请求无法解析" });
    }
  });
}
