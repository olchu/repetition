import "dotenv/config";

import { defineConfig, env } from "prisma/config";

// This config is read by the Prisma CLI only; the app's client connects with
// DATABASE_URL from schema.prisma. On Supabase, DATABASE_URL is the transaction
// pooler (port 6543) and DIRECT_URL the session pooler (port 5432), which
// migrations need. The CLI takes DIRECT_URL as its `url`: in Prisma 6.19 a
// `directUrl` here is shown but not connected with. The shadow database is used
// only by `prisma migrate dev`, so production leaves it unset. See docs/DEPLOY.md.
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  engine: "classic",
  datasource: {
    url: process.env.DIRECT_URL || env("DATABASE_URL"),
    ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.mjs",
  },
});
