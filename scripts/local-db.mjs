// The local Postgres used for development: Homebrew's postgresql@16, or the
// data directory in LOCAL_PG_DATA. Production uses Supabase and never runs this.
// Usage: node scripts/local-db.mjs start|stop|status
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FORMULA = "postgresql@16";

function brewPrefix() {
  try {
    return execFileSync("brew", ["--prefix"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

/** The server's data directory, or null when there is no local server to manage. */
export function localDataDir() {
  const prefix = brewPrefix();
  const dir = process.env.LOCAL_PG_DATA ?? (prefix && path.join(prefix, "var", FORMULA));
  return dir && existsSync(path.join(dir, "PG_VERSION")) ? dir : null;
}

/** postgresql@16 is keg-only, so its pg_ctl may not be on PATH. */
function pgCtl(args, stdio = "ignore") {
  const prefix = brewPrefix();
  const kegged = prefix && path.join(prefix, "opt", FORMULA, "bin", "pg_ctl");
  const binary = kegged && existsSync(kegged) ? kegged : "pg_ctl";
  return spawnSync(binary, args, { stdio }).status;
}

export function isRunning(dataDir) {
  return pgCtl(["status", "-D", dataDir]) === 0;
}

/** `brew services start` hands the server to launchd, which starts it at login and
 *  restarts it whenever it stops — pg_ctl has to leave such a server alone. Only
 *  Homebrew's own data directory can be that service. */
export function managedByBrewServices(dataDir) {
  const prefix = brewPrefix();
  if (!prefix || path.resolve(dataDir) !== path.join(prefix, "var", FORMULA)) return false;
  return spawnSync("launchctl", ["list", `homebrew.mxcl.${FORMULA}`], { stdio: "ignore" }).status === 0;
}

export function brewServicesHint(dataDir) {
  return `Local Postgres runs as a brew service: it starts at login and restarts whenever it stops.\n`
    + `To let npm start and stop it, turn the service off once: brew services stop ${path.basename(dataDir)}`;
}

export function startServer(dataDir) {
  const logFile = path.join(path.dirname(dataDir), "log", `${path.basename(dataDir)}.log`);
  mkdirSync(path.dirname(logFile), { recursive: true });
  return pgCtl(["start", "-D", dataDir, "-l", logFile, "-w"], "inherit") === 0;
}

export function stopServer(dataDir) {
  return pgCtl(["stop", "-D", dataDir, "-m", "fast", "-w"], "inherit") === 0;
}

function main(command) {
  const dataDir = localDataDir();
  if (!dataDir) {
    console.error("No local Postgres data directory found. Set LOCAL_PG_DATA to it.");
    return 1;
  }
  const running = isRunning(dataDir);
  const brewService = managedByBrewServices(dataDir);

  switch (command) {
    case "status":
      console.log(`Local Postgres (${dataDir}): ${running ? "running" : "stopped"}${brewService ? ", run by brew services" : ""}`);
      return 0;
    case "start":
      if (running) {
        console.log("Local Postgres is already running.");
        return 0;
      }
      return startServer(dataDir) ? 0 : 1;
    case "stop":
      if (brewService) {
        console.error(brewServicesHint(dataDir));
        return 1;
      }
      if (!running) {
        console.log("Local Postgres is already stopped.");
        return 0;
      }
      return stopServer(dataDir) ? 0 : 1;
    default:
      console.error("Usage: node scripts/local-db.mjs start|stop|status");
      return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(process.argv[2]));
}
