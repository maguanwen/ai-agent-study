import { describe, expect, it } from "vitest";

import { ChatSession, parseCommand } from "../src/chat.js";

describe("ChatSession", () => {
  it("构造包含 system 和当前 user 消息的请求", () => {
    const session = new ChatSession(10, "system prompt");

    expect(session.createRequestMessages("你好")).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "你好" },
    ]);
  });

  it("成功后提交 user 和 assistant 消息", () => {
    const session = new ChatSession(10, "system prompt");
    session.commitTurn("我叫小明", "你好，小明");

    expect(session.createRequestMessages("我叫什么？")).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "我叫小明" },
      { role: "assistant", content: "你好，小明" },
      { role: "user", content: "我叫什么？" },
    ]);
  });

  it("只保留最近的最大轮数", () => {
    const session = new ChatSession(2);
    session.commitTurn("问题 1", "回答 1");
    session.commitTurn("问题 2", "回答 2");
    session.commitTurn("问题 3", "回答 3");

    expect(session.turnCount).toBe(2);
    expect(session.getConversation()).toEqual([
      { role: "user", content: "问题 2" },
      { role: "assistant", content: "回答 2" },
      { role: "user", content: "问题 3" },
      { role: "assistant", content: "回答 3" },
    ]);
  });

  it("清空历史后仍可重新构造带 system 的请求", () => {
    const session = new ChatSession(10, "system prompt");
    session.commitTurn("问题", "回答");
    session.clear();

    expect(session.turnCount).toBe(0);
    expect(session.createRequestMessages("新问题")).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "新问题" },
    ]);
  });
});

describe("parseCommand", () => {
  it("忽略命令两侧空格和大小写", () => {
    expect(parseCommand("  /HELP ")).toBe("help");
  });

  it("普通消息不被识别为命令", () => {
    expect(parseCommand("什么是 Agent？")).toBeUndefined();
  });
});
