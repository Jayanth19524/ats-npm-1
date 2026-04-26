import "dotenv/config";
import { startWorker, rescoreAllCandidates } from "./worker.js";
import { logger } from "./lib/logger.js";

logger.info("Starting standalone Resume Scoring Worker process...");

process.on("SIGINT", () => {
  logger.info("Worker shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  logger.info("Worker shutting down...");
  process.exit(0);
});

// One-time rescore on startup, then start the regular worker
rescoreAllCandidates().then(() => {
  startWorker();
});