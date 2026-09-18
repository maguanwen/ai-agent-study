import { describe, expect, it } from "vitest";
import { chunkDocument } from "../src/chunk-document.js";

describe("文档切分", () => {
  it("按标题切分，保留文件与行号", () => {
    const chunks = chunkDocument({ source: "notes/a.md", text: "# 入门\n正文\n## 工具\n工具内容" });
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ source: "notes/a.md", heading: "入门", startLine: 1, endLine: 2, text: "# 入门\n正文" });
    expect(chunks[1]).toMatchObject({ heading: "工具", startLine: 3, endLine: 4 });
  });
  it("没有标题的正文保留 null 标题，跳过空白文档", () => {
    expect(chunkDocument({ source: "a.md", text: "正文" })[0]?.heading).toBeNull();
    expect(chunkDocument({ source: "empty.md", text: " \n\n" })).toEqual([]);
  });
  it("限制片段字符数，跨行切分保留原始行位置", () => {
    const chunks = chunkDocument({ source: "a.md", text: "abcd\nefgh\nijkl" }, 9);
    expect(chunks.map((chunk) => chunk.text)).toEqual(["abcd\nefgh", "ijkl"]);
    expect(chunks[1]).toMatchObject({ startLine: 3, endLine: 3 });
  });
  it("超长行拆分不丢文字、不破坏 emoji，ID 不重复", () => {
    const text = "😀学习😀学习😀学习";
    const chunks = chunkDocument({ source: "a.md", text }, 3);
    expect(chunks.map((chunk) => chunk.text).join("")).toBe(text);
    expect(chunks.every((chunk) => Array.from(chunk.text).length <= 3)).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.id)).size).toBe(chunks.length);
    expect(chunks.every((chunk) => chunk.startLine === 1 && chunk.endLine === 1)).toBe(true);
  });
  it("代码围栏中的井号不是章节标题", () => {
    const chunks = chunkDocument({ source: "a.md", text: "# 正文\n```sh\n# 注释\n```\n## 下一节\n内容" });
    expect(chunks.map((chunk) => chunk.heading)).toEqual(["正文", "下一节"]);
  });
  it("支持波浪线围栏且短围栏不会提前关闭", () => {
    const chunks = chunkDocument({ source: "a.md", text: "# A\n~~~~\n~~~\n# 注释\n~~~~\n# B" });
    expect(chunks.map((chunk) => chunk.heading)).toEqual(["A", "B"]);
  });
  it("相同输入 ID 稳定，不同来源 ID 不同", () => {
    const doc = { source: "a.md", text: "# 笔记\n内容" };
    expect(chunkDocument(doc)).toEqual(chunkDocument(doc));
    expect(chunkDocument(doc)[0]?.id).not.toBe(chunkDocument({ ...doc, source: "b.md" })[0]?.id);
  });
  it("兼容 BOM 和 Windows 换行", () => {
    expect(chunkDocument({ source: "a.md", text: "\uFEFF# 标题\r\n内容" })[0])
      .toMatchObject({ heading: "标题", startLine: 1, endLine: 2, text: "# 标题\n内容" });
  });
  it.each([0, -1, 1.5, NaN, 10001])("拒绝非法长度 %s", (limit) => {
    expect(() => chunkDocument({ source: "a.md", text: "正文" }, limit)).toThrow();
  });
});
