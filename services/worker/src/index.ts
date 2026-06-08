import cron from "node-cron";
import { processRecurring } from "./jobs/processRecurring";

console.log("[worker-service] started");

// Process recurring transactions every minute
cron.schedule("* * * * *", async () => {
  try {
    await processRecurring();
  } catch (err) {
    console.error("[recurring] error:", err);
  }
});
