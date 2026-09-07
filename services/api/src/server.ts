import { createApp } from "./app";
import { env } from "./config";
import { NEARVIA_CONFIG } from "@nearvia/config";

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 NEARVIA REST API Service (${NEARVIA_CONFIG.APP_NAME})`);
  console.log(`📌 Tagline: ${NEARVIA_CONFIG.TAGLINE}`);
  console.log(`🌐 Server running on http://${env.API_HOST}:${env.PORT}`);
  console.log(
    `🩺 Health check: http://${env.API_HOST}:${env.PORT}${NEARVIA_CONFIG.API_PREFIX}/health`,
  );
  console.log(`🛡️  Environment: ${env.NODE_ENV}`);
  console.log(`====================================================`);
});

// Graceful Shutdown Lifecycle
const handleShutdown = (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down nearvia-api gracefully...`);
  server.close(() => {
    console.log("HTTP server closed successfully.");
    process.exit(0);
  });
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
