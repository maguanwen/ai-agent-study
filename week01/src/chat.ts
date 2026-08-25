export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export type ChatCommand = "exit" | "clear" | "history" | "help";

const commandMap: Readonly<Record<string, ChatCommand>> = {
  "/exit": "exit",
  "/clear": "clear",
  "/history": "history",
  "/help": "help",
};

export const DEFAULT_SYSTEM_PROMPT =
  "你是一名耐心、准确的 AI Agent 学习助手。请结合对话上下文，使用简洁的中文回答。";

export const HELP_TEXT = [
  "可用命令：",
  "  /help     显示帮助",
  "  /history  查看本次会话历史",
  "  /clear    清空历史并保留 system 消息",
  "  /exit     退出程序",
].join("\n");

export function parseCommand(input: string): ChatCommand | undefined {
  return commandMap[input.trim().toLowerCase()];
}

export class ChatSession {
  readonly #systemMessage: ChatMessage;
  readonly #maxTurns: number;
  #conversation: ConversationMessage[] = [];

  constructor(
    maxTurns: number,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
  ) {
    if (!Number.isInteger(maxTurns) || maxTurns <= 0) {
      throw new RangeError("maxTurns 必须是正整数");
    }

    this.#maxTurns = maxTurns;
    this.#systemMessage = { role: "system", content: systemPrompt };
  }

  get turnCount(): number {
    return this.#conversation.length / 2;
  }

  createRequestMessages(question: string): ChatMessage[] {
    return [
      { ...this.#systemMessage },
      ...this.#conversation.map((message) => ({ ...message })),
      { role: "user", content: question },
    ];
  }

  commitTurn(question: string, answer: string): void {
    this.#conversation.push(
      { role: "user", content: question },
      { role: "assistant", content: answer },
    );

    const maximumMessages = this.#maxTurns * 2;
    if (this.#conversation.length > maximumMessages) {
      this.#conversation = this.#conversation.slice(-maximumMessages);
    }
  }

  clear(): void {
    this.#conversation = [];
  }

  getConversation(): ConversationMessage[] {
    return this.#conversation.map((message) => ({ ...message }));
  }
}
