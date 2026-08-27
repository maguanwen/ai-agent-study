import "dotenv/config";

import { loadModelConfig, loadServerConfig } from "./env.js";
import { createHttpApp } from "./http.js";

try {
  const modelConfig = loadModelConfig();
  const serverConfig = loadServerConfig();
  const server = createHttpApp({ modelConfig });

  server.listen(serverConfig.port, serverConfig.host, () => {
    console.log(
      `HTTP API 已启动：http://${serverConfig.host}:${serverConfig.port}`,
    );
  });
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`HTTP API 启动失败：${message}`);
  process.exitCode = 1;
}
