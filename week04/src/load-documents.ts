import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { MarkdownDocument } from "./types.js";

const ignored = new Set(["node_modules", "dist", "coverage"]);

export async function loadDocuments(directory: string): Promise<MarkdownDocument[]> {
  const root = await realpath(directory);
  if (!(await stat(root)).isDirectory()) throw new Error("资料路径必须是目录。");
  const documents: MarkdownDocument[] = [];

  async function visit(folder: string): Promise<void> {
    const entries = await readdir(folder, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      // 不跟随符号链接，避免意外读取目录外的资料；跳过隐藏文件与生成目录。
      if (entry.isSymbolicLink() || entry.name.startsWith(".") || ignored.has(entry.name)) continue;
      const path = join(folder, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
        const text = (await readFile(path, "utf8")).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
        if (text.trim()) documents.push({ source: relative(root, path).split(sep).join("/"), text });
      }
    }
  }

  await visit(root);
  return documents;
}
