import { createHash } from "node:crypto";
import type { DocumentChunk, MarkdownDocument } from "./types.js";

// 第一版：按 ATX 标题划分章节，再按行填充；超长行按 Unicode 码点拆分。
// maxChars 不是 token 数；这一版不使用 overlap，也不解析完整 Markdown AST。
export function chunkDocument(document: MarkdownDocument, maxChars = 500): DocumentChunk[] {
  if (!Number.isInteger(maxChars) || maxChars < 1 || maxChars > 10000) {
    throw new Error("maxChars 必须是 1～10000 的整数。");
  }
  const chunks: DocumentChunk[] = [];
  let heading: string | null = null;
  let text = "";
  let size = 0;
  let startLine = 0;
  let endLine = 0;
  let fence: { marker: string; length: number } | null = null;

  function flush() {
    if (text.trim()) {
      const id = createHash("sha256").update(JSON.stringify([
        document.source, heading, startLine, endLine, chunks.length, text,
      ])).digest("hex");
      chunks.push({ id, source: document.source, heading, startLine, endLine, text });
    }
    text = "";
    size = 0;
  }

  const lines = document.text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    const title = !fence ? /^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (title) {
      flush();
      heading = title[1]!;
    }
    if (fenceMatch) {
      const marker = fenceMatch[1]!;
      if (!fence) fence = { marker: marker[0]!, length: marker.length };
      else if (marker[0] === fence.marker && marker.length >= fence.length && !fenceMatch[2]!.trim()) fence = null;
    }

    const chars = Array.from(line);
    if (text && size + 1 + chars.length > maxChars) flush();
    if (chars.length > maxChars) {
      for (let offset = 0; offset < chars.length; offset += maxChars) {
        text = chars.slice(offset, offset + maxChars).join("");
        startLine = endLine = lineNumber;
        flush();
      }
    } else {
      if (!text) startLine = lineNumber;
      const separator = text ? "\n" : "";
      text += separator + line;
      size += separator.length + chars.length;
      endLine = lineNumber;
    }
  });
  flush();
  return chunks;
}
