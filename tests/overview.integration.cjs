/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/overview.integration.cjs (uses DATABASE_URL).
// Locks in the counting rules of lib/student-progress against the real database.
require('dotenv/config');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
let currentUser = null;
const originalLoad = Module._load;
Module._load = function (id, parent, main) {
  if (id === '@/lib/auth') return { getCurrentUser: async () => currentUser };
  return originalLoad.call(this, id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id, parent, main);
};
require.extensions['.ts'] = function (module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};
const { prisma } = require(root + '/src/lib/prisma.ts');
const dashboard = require(root + '/src/app/api/v1/me/dashboard/route.ts').GET;
const start = require(root + '/src/app/api/v1/me/tests/[testId]/attempts/route.ts').POST;
const submit = require(root + '/src/app/api/v1/me/attempts/[attemptId]/submit/route.ts').POST;
const { buildTestContent } = require(root + '/src/lib/test-content.ts');
const context = (params) => ({ params: Promise.resolve(params) });

test('one test counted once across versions and assignments', async () => {
  const fixture = `overview-${randomUUID()}`;
  let child, group;
  try {
    child = await prisma.user.create({
      data: {
        login: fixture, role: 'CHILD', passwordHash: 'x',
        childProfile: { create: { displayName: 'Overview fixture', grade: '5', subjects: ['MATHEMATICS', 'BIOLOGY'] } },
      },
      include: { childProfile: true },
    });
    currentUser = child;

    const questions = [{ id: 'q1', text: 'q1', points: 1, options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a' }];
    const v1 = await prisma.test.create({ data: { stableId: fixture, version: 1, title: fixture, subject: 'MATHEMATICS', grade: '5', status: 'PUBLISHED', questionCount: 1, content: buildTestContent(questions) } });
    const v2 = await prisma.test.create({ data: { stableId: fixture, version: 2, title: `${fixture} v2`, subject: 'MATHEMATICS', grade: '5', status: 'PUBLISHED', questionCount: 1, content: buildTestContent(questions) } });

    group = await prisma.group.create({ data: { name: fixture, members: { create: { childId: child.id } } } });
    await prisma.assignment.create({ data: { childId: child.id, testId: v1.id } });
    await prisma.assignment.create({ data: { groupId: group.id, testId: v2.id } });

    let payload = await (await dashboard()).json();
    assert.equal(payload.tests.length, 1, 'personal + group assignment of one test is one row');
    assert.equal(payload.tests[0].id, v2.id, 'the newest assigned version drives actions');
    assert.equal(payload.tests[0].stableId, fixture);
    assert.equal(payload.tests[0].status, 'not_started');

    const maths = payload.subjects.find((s) => s.subject === 'mathematics');
    const biology = payload.subjects.find((s) => s.subject === 'biology');
    assert.deepEqual(
      { assigned: maths.assigned, completed: maths.completed, passed: maths.passed },
      { assigned: 1, completed: 0, passed: 0 },
    );
    assert.ok(biology, 'a subject without tests stays visible');
    assert.equal(biology.assigned, 0);

    // Wrong answer: completed but not passed, and a retry keeps the count at one.
    const attempt = (await (await start(null, context({ testId: v2.id }))).json()).attempt;
    await submit(null, context({ attemptId: attempt.id }));
    payload = await (await dashboard()).json();
    assert.equal(payload.tests[0].completed, true);
    assert.equal(payload.tests[0].passed, false);
    assert.equal(payload.tests[0].status, 'completed');
    assert.equal(payload.subjects.find((s) => s.subject === 'mathematics').completed, 1);

    // A retry started on the other version still resolves to one unfinished test.
    const retry = (await (await start(null, context({ testId: v1.id }))).json()).attempt;
    payload = await (await dashboard()).json();
    assert.equal(payload.tests.length, 1);
    assert.equal(payload.tests[0].inProgressAttemptId, retry.id, 'an unfinished retry drives "continue"');
    assert.equal(payload.subjects.find((s) => s.subject === 'mathematics').completed, 1, 'a retry does not double the count');
  } finally {
    if (child) {
      await prisma.result.deleteMany({ where: { attempt: { childId: child.id } } });
      await prisma.answer.deleteMany({ where: { attempt: { childId: child.id } } });
      await prisma.testReward.deleteMany({ where: { childId: child.id } });
      await prisma.attempt.deleteMany({ where: { childId: child.id } });
      await prisma.assignment.deleteMany({ where: { test: { stableId: fixture } } });
      await prisma.test.deleteMany({ where: { stableId: fixture } });
      if (group) await prisma.group.delete({ where: { id: group.id } });
      await prisma.user.delete({ where: { id: child.id } });
    }
    await prisma.$disconnect();
  }
});
