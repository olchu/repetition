/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/assignments.integration.cjs (uses DATABASE_URL).
// Only authentication is stubbed; the route handler and PostgreSQL are real.
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

const { prisma } = require('../src/lib/prisma.ts');
const assign = require('../src/app/api/v1/admin/assignments/route.ts').POST;
const listPlans = require('../src/app/api/v1/admin/assignments/route.ts').GET;
const cancel = require('../src/app/api/v1/admin/assignments/[id]/route.ts').DELETE;
const start = require('../src/app/api/v1/me/tests/[testId]/attempts/route.ts').POST;
const { buildTestContent } = require('../src/lib/test-content.ts');
const context = (params) => ({ params: Promise.resolve(params) });
const request = (body) => new Request('http://localhost/api/v1/admin/assignments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

test('the admin plan shows each child\'s tests, progress and the assignments behind them', async () => {
  const fixture = `plan-${randomUUID()}`;
  let admin;
  let child;
  let group;
  const tests = [];

  try {
    admin = await prisma.user.create({ data: { login: `${fixture}-admin`, role: 'ADMIN', passwordHash: 'x' } });
    child = await prisma.user.create({
      data: { login: `${fixture}-child`, role: 'CHILD', passwordHash: 'x', childProfile: { create: { displayName: 'Plan child', grade: '5' } } },
      include: { childProfile: { include: { subjects: { include: { subject: true }, orderBy: { sortOrder: 'asc' } } } } },
    });
    group = await prisma.group.create({ data: { name: fixture, members: { create: [{ childId: child.id }] } } });
    const content = buildTestContent([{ id: 'q1', text: 'Q', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a' }]);
    for (const [stableId, version] of [[`${fixture}-a`, 1], [`${fixture}-a`, 2], [`${fixture}-b`, 1]]) {
      tests.push(await prisma.test.create({ data: { stableId, version, title: `${stableId} v${version}`, subject: { connect: { slug: 'mathematics' } }, grade: '5', status: 'PUBLISHED', questionCount: 1, content } }));
    }
    const [personalV1, personalV2, viaGroup] = tests;

    currentUser = admin;
    assert.equal((await assign(request({ testId: personalV1.id, childIds: [child.id] }))).status, 201);
    assert.equal((await assign(request({ testId: personalV2.id, childIds: [child.id] }))).status, 201);
    assert.equal((await assign(request({ testId: viaGroup.id, groupId: group.id }))).status, 201);
    currentUser = child;
    assert.equal((await listPlans()).status, 403, 'children cannot read plans');
    await start(null, context({ testId: personalV2.id }));

    currentUser = admin;
    const planOf = async () => (await (await listPlans()).json()).plans.find((plan) => plan.childId === child.id).tests;
    const [inProgress, groupTest] = await planOf();
    assert.deepEqual([inProgress.stableId, inProgress.version, inProgress.status, inProgress.inProgressAnswered], [`${fixture}-a`, 2, 'in_progress', 0]);
    assert.deepEqual(inProgress.assignments.map((source) => [source.version, source.groupId]).sort(), [[1, null], [2, null]], 'both personal versions stay one row');
    assert.deepEqual([groupTest.stableId, groupTest.status, groupTest.assignments[0].groupName], [`${fixture}-b`, 'not_started', fixture]);

    assert.equal((await cancel(null, context({ id: groupTest.assignments[0].id }))).status, 204);
    assert.deepEqual((await planOf()).map((row) => row.stableId), [`${fixture}-a`], 'a cancelled group assignment leaves the plan');
  } finally {
    if (child) {
      await prisma.testReward.deleteMany({ where: { childId: child.id } });
      await prisma.attempt.deleteMany({ where: { childId: child.id } });
    }
    for (const record of tests) await prisma.assignment.deleteMany({ where: { testId: record.id } });
    if (group) await prisma.group.delete({ where: { id: group.id } });
    for (const record of tests) await prisma.test.delete({ where: { id: record.id } });
    if (child) await prisma.user.delete({ where: { id: child.id } });
    if (admin) await prisma.user.delete({ where: { id: admin.id } });
  }
});

test('mixed-grade groups can receive any published test', async () => {
  const fixture = `assignment-${randomUUID()}`;
  let admin;
  let group;
  let testRecord;
  const children = [];

  try {
    admin = await prisma.user.create({
      data: { login: `${fixture}-admin`, role: 'ADMIN', passwordHash: 'x' },
    });
    currentUser = admin;

    for (const grade of ['4', '7']) {
      children.push(await prisma.user.create({
        data: {
          login: `${fixture}-${grade}`,
          role: 'CHILD',
          passwordHash: 'x',
          childProfile: { create: { displayName: `Grade ${grade}`, grade } },
        },
      }));
    }

    group = await prisma.group.create({
      data: {
        name: fixture,
        members: { create: children.map((child) => ({ childId: child.id })) },
      },
    });
    testRecord = await prisma.test.create({
      data: {
        stableId: fixture,
        version: 1,
        title: fixture,
        subject: { connect: { slug: 'mathematics' } },
        grade: '5',
        status: 'PUBLISHED',
        content: { questions: [] },
      },
    });

    const groupResponse = await assign(request({ testId: testRecord.id, groupId: group.id }));
    assert.equal(groupResponse.status, 201);
    const groupPayload = await groupResponse.json();
    assert.equal(groupPayload.assignments.length, 1);
    assert.equal(groupPayload.assignments[0].groupId, group.id);

    const individualResponse = await assign(request({ testId: testRecord.id, childIds: [children[1].id] }));
    assert.equal(individualResponse.status, 422, 'individual assignments still enforce the test grade');
    assert.equal((await individualResponse.json()).error.code, 'GRADE_MISMATCH');
  } finally {
    if (testRecord) await prisma.assignment.deleteMany({ where: { testId: testRecord.id } });
    if (group) await prisma.group.delete({ where: { id: group.id } });
    if (testRecord) await prisma.test.delete({ where: { id: testRecord.id } });
    for (const child of children) await prisma.user.delete({ where: { id: child.id } });
    if (admin) await prisma.user.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  }
});
