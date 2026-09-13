// `npm run dev`: start the local Postgres if it is stopped, run `next dev`, and
// stop the server again once Next exits (Ctrl+C) — but only if this script
// started it, so a server that was already running is left as it was.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { brewServicesHint, isRunning, localDataDir, managedByBrewServices, startServer, stopServer } from "./local-db.mjs";

const dataDir = localDataDir();
let startedHere = false;

if (!dataDir) {
  console.log("[dev] No local Postgres found; starting Next only.");
} else if (!isRunning(dataDir)) {
  console.log("[dev] Starting local Postgres…");
  if (!startServer(dataDir)) {
    console.error("[dev] Local Postgres did not start; see its log file.");
    process.exit(1);
  }
  startedHere = true;
} else if (managedByBrewServices(dataDir)) {
  console.log(`[dev] ${brewServicesHint(dataDir)}`);
}

const nextBin = createRequire(import.meta.url).resolve("next/dist/bin/next");
const next = spawn(process.execPath, [nextBin, "dev", ...process.argv.slice(2)], { stdio: "inherit" });

// Ctrl+C reaches Next directly (same process group); this process waits for it
// to finish. Other signals, such as closing the terminal, are passed on.
for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => next.kill(signal));
}

next.on("exit", (code, signal) => {
  if (startedHere) {
    console.log("[dev] Stopping local Postgres…");
    stopServer(dataDir);
  }
  // Stopped by a signal is the normal way out of a dev server, not a failure.
  process.exit(code ?? (signal ? 0 : 1));
});
