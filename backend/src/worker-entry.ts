import "dotenv/config";
import { startWorker } from "./worker.js";
import { logger } from "./lib/logger.js";

logger.info("Starting standalone Resume Scoring Worker process...");

// Handle process termination gracefully
process.on("SIGINT", () => {
  logger.info("Worker shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Worker shutting down...");
  process.exit(0);
});

startWorker();
