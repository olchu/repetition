/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/test-sets.integration.cjs (uses DATABASE_URL).
// Only authentication is stubbed; route handlers and PostgreSQL are real.
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
const sets = require('../src/app/api/v1/admin/test-sets/route.ts');
const setById = require('../src/app/api/v1/admin/test-sets/[id]/route.ts');
const setTest = require('../src/app/api/v1/admin/test-sets/[id]/tests/[stableId]/route.ts');
const assignSet = require('../src/app/api/v1/admin/test-sets/[id]/assign/route.ts').POST;
const dashboard = require('../src/app/api/v1/me/dashboard/route.ts').GET;
const { buildTestContent } = require('../src/lib/test-content.ts');
const json = (method, body) => new Request('http://localhost/test', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const context = (params) => ({ params: Promise.resolve(params) });

test('test sets group tests by stableId, move between sets and assign in one go', async () => {
  const fixture = `sets-${randomUUID()}`;
  let admin;
  let child;
  let group;
  const tests = [];
  const setIds = [];

  try {
    admin = await prisma.user.create({ data: { login: `${fixture}-admin`, role: 'ADMIN', passwordHash: 'x' } });
    child = await prisma.user.create({
      data: { login: `${fixture}-child`, role: 'CHILD', passwordHash: 'x', childProfile: { create: { displayName: 'Sets child', grade: '5' } } },
      include: { childProfile: { include: { subjects: { include: { subject: true }, orderBy: { sortOrder: 'asc' } } } } },
    });
    group = await prisma.group.create({ data: { name: fixture, members: { create: [{ childId: child.id }] } } });
    const content = buildTestContent([{ id: 'q1', text: 'Q', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a' }]);
    const make = async (suffix, version, grade, status) => tests.push(await prisma.test.create({
      data: { stableId: `${fixture}-${suffix}`, version, title: `${suffix} v${version}`, subject: { connect: { slug: 'mathematics' } }, grade, status, questionCount: 1, content },
    }));
    await make('a', 1, '5', 'PUBLISHED');
    await make('a', 2, '5', 'PUBLISHED');
    await make('b', 1, '5', 'PUBLISHED');
    await make('c', 1, '7', 'PUBLISHED');
    await make('d', 1, '5', 'DRAFT');

    currentUser = admin;
    const create = (name) => sets.POST(json('POST', { name, description: 'About fractions' }));
    const firstResponse = await create(`${fixture} Week 1`);
    assert.equal(firstResponse.status, 201);
    const week1 = (await firstResponse.json()).set;
    setIds.push(week1.id);
    assert.equal((await create(`${fixture} Week 1`)).status, 409, 'set names are unique');
    assert.equal((await create('   ')).status, 400);
    const week2 = (await (await create(`${fixture} Week 2`)).json()).set;
    setIds.push(week2.id);

    for (const suffix of ['a', 'b', 'c', 'd']) {
      assert.equal((await setTest.PUT(null, context({ id: week1.id, stableId: `${fixture}-${suffix}` }))).status, 200);
    }
    assert.equal((await setTest.PUT(null, context({ id: week1.id, stableId: 'no-such-test' }))).status, 404);
    const moved = await (await setTest.PUT(null, context({ id: week2.id, stableId: `${fixture}-b` }))).json();
    assert.equal(moved.movedFrom, `${fixture} Week 1`, 'a test belongs to one set, so adding moves it');

    const listed = (await (await sets.GET()).json()).sets.filter((set) => setIds.includes(set.id));
    assert.deepEqual(
      listed.map((set) => [set.name, set.tests.map((item) => [item.stableId.slice(-1), item.version, item.publishedTestId !== null])]),
      [[`${fixture} Week 1`, [['a', 2, true], ['c', 1, true], ['d', 1, false]]], [`${fixture} Week 2`, [['b', 1, true]]]],
    );

    // Personal: newest published version, the child's grade only.
    const toChild = () => assignSet(json('POST', { childIds: [child.id] }), context({ id: week1.id }));
    assert.deepEqual(await (await toChild()).json(), { assigned: 1, alreadyAssigned: 0, otherGrade: 1, notPublished: 1 });
    assert.deepEqual(await (await toChild()).json(), { assigned: 0, alreadyAssigned: 1, otherGrade: 1, notPublished: 1 });
    assert.equal((await prisma.assignment.findFirst({ where: { childId: child.id } })).testId, tests[1].id, 'the newest published version is assigned');
    assert.deepEqual(await (await assignSet(json('POST', { groupId: group.id }), context({ id: week2.id }))).json(), { assigned: 1, alreadyAssigned: 0, otherGrade: 0, notPublished: 0 });
    assert.equal((await assignSet(json('POST', {}), context({ id: week1.id }))).status, 400);

    currentUser = child;
    assert.equal((await sets.GET()).status, 403, 'children cannot read sets');
    const setOf = async () => Object.fromEntries((await (await dashboard()).json()).tests.map((item) => [item.stableId, item.set?.name ?? null]));
    assert.deepEqual(await setOf(), { [`${fixture}-a`]: `${fixture} Week 1`, [`${fixture}-b`]: `${fixture} Week 2` });

    currentUser = admin;
    assert.equal((await setTest.DELETE(null, context({ id: week2.id, stableId: `${fixture}-b` }))).status, 204);
    assert.equal((await setTest.DELETE(null, context({ id: week2.id, stableId: `${fixture}-b` }))).status, 404);
    assert.equal((await setById.PATCH(json('PATCH', { name: `${fixture} Week 1 renamed` }), context({ id: week1.id }))).status, 200);
    assert.equal((await setById.PATCH(json('PATCH', { name: `${fixture} Week 2` }), context({ id: week1.id }))).status, 409);
    assert.equal((await setById.DELETE(null, context({ id: week1.id }))).status, 204);
    assert.equal((await setById.DELETE(null, context({ id: week1.id }))).status, 404);

    currentUser = child;
    assert.deepEqual(await setOf(), { [`${fixture}-a`]: null, [`${fixture}-b`]: null }, 'tests stay assigned when their set goes, just ungrouped');
  } finally {
    await prisma.testSet.deleteMany({ where: { id: { in: setIds } } });
    await prisma.testSetItem.deleteMany({ where: { stableId: { startsWith: fixture } } });
    for (const record of tests) await prisma.assignment.deleteMany({ where: { testId: record.id } });
    if (group) await prisma.group.delete({ where: { id: group.id } });
    for (const record of tests) await prisma.test.delete({ where: { id: record.id } });
    if (child) await prisma.user.delete({ where: { id: child.id } });
    if (admin) await prisma.user.delete({ where: { id: admin.id } });
    await prisma.$disconnect();
  }
});
