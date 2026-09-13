/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/rls.integration.cjs (uses DATABASE_URL).
// Supabase exposes the public schema through its Data API; row-level security
// with no policies is what keeps every table closed there. The app connects as
// the tables' owner, which RLS does not restrict, so this changes nothing for it.
require('dotenv/config');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');

test('every table in public has row-level security enabled', async () => {
  const prisma = new PrismaClient();
  try {
    const open = await prisma.$queryRawUnsafe(
      `SELECT c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY 1`,
    );
    assert.deepEqual(open.map((row) => row.name), [], 'enable RLS in the migration that creates the table');
  } finally {
    await prisma.$disconnect();
  }
});
