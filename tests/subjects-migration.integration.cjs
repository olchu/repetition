/* eslint-disable @typescript-eslint/no-require-imports */
// Requires psql and DATABASE_URL. Uses a unique temporary schema, never public data.
require('dotenv/config');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const { randomUUID } = require('node:crypto');
const path = require('node:path');

test('subject migration preserves every legacy subject, assignment order, test and reward', () => {
  const schema = 'subject_migration_' + randomUUID().replaceAll('-', '');
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete('schema');
  const run = (sql, scoped = true) => execFileSync('psql', [url.toString(), '-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
    input: sql, encoding: 'utf8', env: { ...process.env, PGOPTIONS: scoped ? `-c search_path=${schema}` : '' },
  }).trim();
  const migrationRoot = path.resolve(__dirname, '../prisma/migrations');
  const { readFileSync } = require('node:fs');
  run(`CREATE SCHEMA "${schema}";`, false);
  try {
    for (const name of readdirSync(migrationRoot).filter((name) => /^\d/.test(name) && name < '20260912120000').sort()) {
      run(readFileSync(path.join(migrationRoot, name, 'migration.sql'), 'utf8'));
    }
    run(`
      INSERT INTO "User" ("id","role","login","passwordHash","updatedAt") VALUES ('migration-child','CHILD','migration-child','x',now());
      INSERT INTO "ChildProfile" ("userId","displayName","grade","subjects","updatedAt")
        VALUES ('migration-child','Fixture','5',ARRAY['HISTORY','MATHEMATICS','BIOLOGY']::"Subject"[],now());
      INSERT INTO "Test" ("id","stableId","version","title","subject","content","updatedAt")
        SELECT 'test-' || item::text, 'test-' || item::text, 1, item::text, item, '{"questions":[]}'::jsonb, now()
        FROM unnest(enum_range(NULL::"Subject")) item;
      INSERT INTO "Assignment" ("id","testId","childId","updatedAt") VALUES ('migration-assignment','test-MATHEMATICS','migration-child',now());
      INSERT INTO "Attempt" ("id","assignmentId","childId","testVersion","status")
        VALUES ('migration-attempt','migration-assignment','migration-child',1,'SUBMITTED');
      INSERT INTO "Result" ("attemptId","earnedPoints","totalPoints","percentage","passed")
        VALUES ('migration-attempt',1,1,100,true);
      INSERT INTO "TestReward" ("childId","stableId","attemptId","units","creditedAt")
        VALUES ('migration-child','test-MATHEMATICS','migration-attempt',2,now());
    `);
    run(readFileSync(path.join(migrationRoot, '20260912120000_subject_catalog/migration.sql'), 'utf8'));
    assert.equal(run('SELECT count(*) FROM "Subject";'), '11');
    assert.equal(run('SELECT count(*) FROM "Test" t JOIN "Subject" s ON s.id = t."subjectId";'), '11');
    assert.equal(run('SELECT string_agg(s.slug, \',\' ORDER BY cs."sortOrder") FROM "ChildSubject" cs JOIN "Subject" s ON s.id = cs."subjectId";'), 'history,mathematics,biology');
    assert.equal(run('SELECT units FROM "TestReward" WHERE "childId" = \'migration-child\';'), '2');
    assert.equal(run('SELECT count(*) FROM "Result" WHERE passed;'), '1');
  } finally {
    run(`DROP SCHEMA "${schema}" CASCADE;`, false);
  }
});
