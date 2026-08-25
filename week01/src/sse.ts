function parseEventData(event: string): string | undefined {
  const dataLines = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""));

  return dataLines.length > 0 ? dataLines.join("\n") : undefined;
}

export async function* readSseData(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const boundary = buffer.match(/\r?\n\r?\n/);
        if (!boundary || boundary.index === undefined) {
          break;
        }

        const event = buffer.slice(0, boundary.index);
        buffer = buffer.slice(boundary.index + boundary[0].length);
        const data = parseEventData(event);

        if (data !== undefined) {
          yield data;
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const data = parseEventData(buffer);
      if (data !== undefined) {
        yield data;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
