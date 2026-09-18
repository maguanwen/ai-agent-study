import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDocuments } from "../src/load-documents.js";

const temporaryDirectories: string[] = [];
async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), "week04-docs-"));
  temporaryDirectories.push(directory);
  return directory;
}
afterEach(async () => {
  // 只清理本测试通过 mkdtemp 创建并记录的临时目录。
  for (const directory of temporaryDirectories.splice(0)) await rm(directory, { recursive: true, force: true });
});

describe("Markdown 加载", () => {
  it("递归读取 Markdown，返回排序后的相对路径并统一换行", async () => {
    const directory = await fixture();
    await mkdir(join(directory, "notes"));
    await writeFile(join(directory, "notes", "b.MD"), "# B");
    await writeFile(join(directory, "a.md"), "\uFEFF# A\r\n内容");
    await writeFile(join(directory, "secret.txt"), "不读取");
    await writeFile(join(directory, "empty.md"), " \n");
    const docs = await loadDocuments(directory);
    expect(docs).toEqual([
      { source: "a.md", text: "# A\n内容" },
      { source: "notes/b.MD", text: "# B" },
    ]);
  });
  it("跳过隐藏目录和生成目录", async () => {
    const directory = await fixture();
    for (const name of [".git", "node_modules", "dist", "coverage"]) {
      await mkdir(join(directory, name));
      await writeFile(join(directory, name, "hidden.md"), "不读取");
    }
    await writeFile(join(directory, ".private.md"), "不读取");
    expect(await loadDocuments(directory)).toEqual([]);
  });
  it("拒绝不存在的目录与普通文件路径", async () => {
    const directory = await fixture();
    await expect(loadDocuments(join(directory, "missing"))).rejects.toThrow();
    await writeFile(join(directory, "file.md"), "正文");
    await expect(loadDocuments(join(directory, "file.md"))).rejects.toThrow("目录");
  });
});
