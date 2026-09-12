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
const request = (body) => new Request('http://localhost/api/v1/admin/assignments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
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
        subject: 'MATHEMATICS',
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
