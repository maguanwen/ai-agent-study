import { describe, expect, it } from "vitest";

import { readSseData } from "../src/sse.js";

function createChunkedStream(content: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(content);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < bytes.length; index += 5) {
        controller.enqueue(bytes.slice(index, index + 5));
      }
      controller.close();
    },
  });
}

describe("readSseData", () => {
  it("能够从任意网络分片中还原 SSE data 事件", async () => {
    const stream = createChunkedStream(
      [
        'data: {"delta":"你好"}',
        ": keep-alive",
        "data: [DONE]",
        "",
      ].join("\r\n\r\n"),
    );
    const events: string[] = [];

    for await (const data of readSseData(stream)) {
      events.push(data);
    }

    expect(events).toEqual(['{"delta":"你好"}', "[DONE]"]);
  });
});
