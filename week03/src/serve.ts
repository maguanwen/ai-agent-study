import { createKnowledgeServer } from "./knowledge-server.js";

const server = createKnowledgeServer();
server.on("error", (error) => {
  console.error("知识服务启动失败：" + error.message);
  process.exitCode = 1;
});
server.listen(3033, "127.0.0.1", () => {
  console.log("本地知识服务：http://127.0.0.1:3033/knowledge");
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close());
}
