const form = document.querySelector("#chat-form");
const questionInput = document.querySelector("#question");
const characterCount = document.querySelector("#character-count");
const submitButton = document.querySelector("#submit-button");
const submitLabel = document.querySelector("#submit-label");
const spinner = document.querySelector("#spinner");
const responsePanel = document.querySelector("#response-panel");
const responseState = document.querySelector("#response-state");
const emptyState = document.querySelector("#empty-state");
const result = document.querySelector("#result");
const errorBox = document.querySelector("#error-box");

function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}

function setLoading(loading) {
  submitButton.disabled = loading;
  questionInput.disabled = loading;
  spinner.hidden = !loading;
  submitLabel.textContent = loading ? "模型生成中…" : "发送测试请求";
  responsePanel.setAttribute("aria-busy", String(loading));
  responseState.textContent = loading ? "请求中" : responseState.textContent;
}

function showError(message) {
  emptyState.hidden = true;
  result.hidden = true;
  errorBox.hidden = false;
  responseState.textContent = "失败";
  setText("#error-message", message);
}

async function checkHealth() {
  try {
    const response = await fetch("/health", { cache: "no-store" });
    if (!response.ok) throw new Error();
    setText("#status-text", "Node.js 服务在线");
    document.querySelector("#status-dot").classList.add("online");
  } catch {
    setText("#status-text", "服务不可用");
  }
}

questionInput.addEventListener("input", () => {
  characterCount.value = String(questionInput.value.length);
});

for (const button of document.querySelectorAll("[data-question]")) {
  button.addEventListener("click", () => {
    questionInput.value = button.dataset.question ?? "";
    questionInput.dispatchEvent(new Event("input"));
    questionInput.focus();
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;

  errorBox.hidden = true;
  result.hidden = true;
  emptyState.hidden = false;
  setLoading(true);
  const startedAt = performance.now();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(typeof body.error === "string" ? body.error : `HTTP ${response.status}`);
    }

    setText("#sent-question", question);
    setText("#answer-text", body.answer);
    setText("#model-name", body.model);
    setText("#input-tokens", body.usage?.inputTokens ?? "未返回");
    setText("#output-tokens", body.usage?.outputTokens ?? "未返回");
    setText("#total-tokens", body.usage?.totalTokens ?? "未返回");
    setText("#duration", `${Math.round(performance.now() - startedAt)} ms`);

    emptyState.hidden = true;
    result.hidden = false;
    responseState.textContent = "成功";
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    showError(message);
  } finally {
    setLoading(false);
  }
});

void checkHealth();
