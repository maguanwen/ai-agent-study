// 对 JSON 对象按键排序，数组保留顺序；不依赖原始文本的空格或键顺序。
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => JSON.stringify(key) + ":" + canonicalJson(child)).join(",") + "}";
  }
  return JSON.stringify(value)!;
}

export function toolCallFingerprint(name: string, rawArguments: string): string {
  try {
    return JSON.stringify([name, "json", canonicalJson(JSON.parse(rawArguments))]);
  } catch {
    // 非法 JSON 也可能被反复提交；保留原文，首次仍交给执行层反馈 invalid-json。
    return JSON.stringify([name, "raw", rawArguments]);
  }
}
