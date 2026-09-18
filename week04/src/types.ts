export interface MarkdownDocument {
  source: string; // 相对于资料目录的路径，不向后续模型暴露机器绝对路径。
  text: string;
}

export interface DocumentChunk {
  id: string;
  source: string;
  heading: string | null;
  startLine: number; // 从 1 开始，包含边界。
  endLine: number;
  text: string;
}
