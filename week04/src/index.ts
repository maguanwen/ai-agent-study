import { resolve } from "node:path";
import { loadDocuments } from "./load-documents.js";
import { chunkDocument } from "./chunk-document.js";

async function main() {
  const args = process.argv.slice(2).filter((arg, index) => !(index === 0 && arg === "--"));
  if (args.length > 2) throw new Error("用法：pnpm start [资料目录] [每块最大字符数]");
  const directory = resolve(args[0] ?? "docs");
  const maxChars = args[1] === undefined ? 500 : Number(args[1]);
  // 即使资料为空，也提前检查参数。
  chunkDocument({ source: "", text: "" }, maxChars);
  const documents = await loadDocuments(directory);
  if (!documents.length) throw new Error("资料目录中没有非空 Markdown 文档。");
  const chunks = documents.flatMap((document) => chunkDocument(document, maxChars));
  console.log(JSON.stringify({ documentCount: documents.length, chunkCount: chunks.length, maxChars, chunks }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "读取资料失败");
  process.exitCode = 1;
});
