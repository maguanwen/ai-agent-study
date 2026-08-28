import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import { DEFAULT_SYSTEM_PROMPT, type ChatMessage } from "./chat.js";
import type { ModelConfig } from "./env.js";
import { callModel, ModelApiError, type ModelResult } from "./model.js";

const MAX_BODY_BYTES = 16 * 1024;

const chatRequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
}).strict();

type ModelCaller = (
  messages: readonly ChatMessage[],
  config: ModelConfig,
) => Promise<ModelResult>;

export interface HttpAppOptions {
  modelConfig: ModelConfig;
  modelCaller?: ModelCaller;
  publicDirectory?: string;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(body));
}

const staticFiles = new Map([
  ["/", { fileName: "index.html", contentType: "text/html; charset=utf-8" }],
  ["/app.js", { fileName: "app.js", contentType: "text/javascript; charset=utf-8" }],
  ["/styles.css", { fileName: "styles.css", contentType: "text/css; charset=utf-8" }],
]);

async function sendStaticFile(
  response: ServerResponse,
  publicDirectory: string,
  pathname: string,
): Promise<boolean> {
  const staticFile = staticFiles.get(pathname);
  if (!staticFile) {
    return false;
  }

  try {
    const contents = await readFile(resolve(publicDirectory, staticFile.fileName));
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      "Content-Type": staticFile.contentType,
      "X-Content-Type-Options": "nosniff",
    });
    response.end(contents);
  } catch (error: unknown) {
    console.error(`[static] 无法读取 ${staticFile.fileName}`, error);
    sendJson(response, 500, { error: "页面资源读取失败" });
  }

  return true;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers["content-type"]?.split(";", 1)[0]?.trim();
  if (contentType !== "application/json") {
    throw new HttpError(415, "Content-Type 必须是 application/json");
  }

  const chunks: Buffer[] = [];
  let receivedBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    receivedBytes += buffer.length;

    if (receivedBytes > MAX_BODY_BYTES) {
      throw new HttpError(413, "请求体过大");
    }

    chunks.push(buffer);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "请求体必须是合法 JSON");
  }
}

export function createHttpApp(options: HttpAppOptions) {
  const modelCaller = options.modelCaller ?? callModel;
  const publicDirectory = options.publicDirectory ?? resolve(process.cwd(), "public");

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (
      request.method === "GET" &&
      await sendStaticFile(response, publicDirectory, url.pathname)
    ) {
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { status: "ok" });
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/api/chat") {
      sendJson(response, 404, { error: "路由不存在" });
      return;
    }

    try {
      const parsed = chatRequestSchema.safeParse(await readJsonBody(request));
      if (!parsed.success) {
        throw new HttpError(400, "question 必须是 1 到 2000 字符的字符串");
      }

      // 浏览器只能提交问题。system 消息与模型密钥均由可信服务端控制。
      const messages: ChatMessage[] = [
        { role: "system", content: DEFAULT_SYSTEM_PROMPT },
        { role: "user", content: parsed.data.question },
      ];
      const result = await modelCaller(messages, options.modelConfig);

      sendJson(response, 200, {
        answer: result.answer,
        model: result.model,
        usage: result.usage,
      });
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        sendJson(response, error.status, { error: error.message });
        return;
      }

      if (error instanceof ModelApiError) {
        console.error(`[model] ${error.message}`);
        sendJson(response, 502, { error: "模型服务暂时不可用" });
        return;
      }

      console.error("[http] 未处理错误", error);
      sendJson(response, 500, { error: "服务器内部错误" });
    }
  });
}
