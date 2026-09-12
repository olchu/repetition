/* eslint-disable @typescript-eslint/no-require-imports */
// Real PostgreSQL and real route handlers; only authentication is stubbed.
require('dotenv/config');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
let currentUser = { id: 'subject-admin', role: 'ADMIN' };
const originalLoad = Module._load;
Module._load = function (id, parent, main) {
  if (id === '@/lib/auth') return { getCurrentUser: async () => currentUser, normalizeLogin: (value) => value.trim().toLowerCase() };
  return originalLoad.call(this, id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id, parent, main);
};
require.extensions['.ts'] = function (module, filename) {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, filename);
};
const { prisma } = require('../src/lib/prisma.ts');
const { childProfileInclude } = require('../src/lib/subject-catalog.ts');
const createSubject = require('../src/app/api/v1/admin/subjects/route.ts').POST;
const updateSubject = require('../src/app/api/v1/admin/subjects/[id]/route.ts').PATCH;
const catalog = require('../src/app/api/v1/subjects/route.ts').GET;
const updateChild = require('../src/app/api/v1/admin/children/[id]/route.ts').PATCH;
const listTests = require('../src/app/api/v1/admin/tests/route.ts').GET;
const importTest = require('../src/app/api/v1/admin/tests/import/route.ts').POST;
const assign = require('../src/app/api/v1/admin/assignments/route.ts').POST;
const dashboard = require('../src/app/api/v1/me/dashboard/route.ts').GET;
const { validateTestDocument } = require('../src/lib/tests.ts');
const ctx = (id) => ({ params: Promise.resolve({ id }) });
const request = (body) => new Request('http://localhost/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('database subjects drive imports, filters, assignments, presentation and archive behavior', async () => {
  const fixture = 'catalog-' + randomUUID();
  let subject, child;
  const details = { slug: fixture, name: 'New subject', icon: null, color: '#123456', backgroundColor: '#eeeeee', textColor: '#222222', sortOrder: 12, archived: false };
  const document = { schemaVersion: '1.0', id: fixture, title: 'Searchable catalog test', subject: fixture, grade: '5',
    questions: [{ id: 'q1', text: 'Question', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a' }] };
  const upload = (data) => {
    const form = new FormData();
    form.set('file', new File([JSON.stringify(data)], 'test.json', { type: 'application/json' }));
    return importTest(new Request('http://localhost/import', { method: 'POST', body: form }));
  };
  try {
    currentUser = null;
    assert.equal((await catalog()).status, 401);
    currentUser = { id: 'child', role: 'CHILD' };
    assert.equal((await createSubject(request(details))).status, 403);
    currentUser = { id: 'admin', role: 'ADMIN' };
    assert.equal((await createSubject(request({ ...details, color: '</style>' }))).status, 400);
    assert.equal((await createSubject(request({ ...details, icon: '/icons/../secret.svg' }))).status, 400);
    const created = await createSubject(request(details));
    assert.equal(created.status, 201);
    subject = (await created.json()).subject;
    assert.equal((await createSubject(request(details))).status, 409);
    assert.equal(validateTestDocument(document).ok, true, 'new DB subjects do not require code or schema changes');
    const imported = await upload(document);
    assert.equal(imported.status, 201);
    const record = (await imported.json()).test;
    assert.equal(record.subject, fixture);
    assert.equal((await prisma.test.findUnique({ where: { id: record.id } })).subjectId, subject.id);
    assert.equal((await upload({ ...document, subject: 'unknown-' + fixture })).status, 422);

    child = await prisma.user.create({ data: { login: fixture, role: 'CHILD', passwordHash: 'x', childProfile: { create: { displayName: fixture, grade: '5' } } } });
    let updated = await updateChild(request({ subjects: [fixture, 'biology'] }), ctx(child.id));
    assert.equal(updated.status, 200);
    assert.deepEqual((await updated.json()).child.subjects, [fixture, 'biology']);
    const initialAssignment = await prisma.childSubject.findUnique({ where: { childId_subjectId: { childId: child.id, subjectId: subject.id } } });
    updated = await updateChild(request({ subjects: ['biology', fixture] }), ctx(child.id));
    assert.deepEqual((await updated.json()).child.subjects, ['biology', fixture]);
    const reordered = await prisma.childSubject.findUnique({ where: { childId_subjectId: { childId: child.id, subjectId: subject.id } } });
    assert.equal(reordered.assignedAt.getTime(), initialAssignment.assignedAt.getTime());
    assert.equal((await updateChild(request({ subjects: [fixture, fixture] }), ctx(child.id))).status, 400);
    assert.equal((await updateChild(request({ subjects: ['unknown-' + fixture] }), ctx(child.id))).status, 422);
    const filtered = await (await listTests(new Request('http://localhost/tests?' + new URLSearchParams({ search: 'SEARCHABLE', grade: '5', subjectId: subject.id, pageSize: '1' })))).json();
    assert.equal(filtered.pagination.totalItems, 1);
    assert.equal(filtered.tests[0].id, record.id);
    const excluded = await (await listTests(new Request('http://localhost/tests?' + new URLSearchParams({ subjectId: subject.id, grade: '7' })))).json();
    assert.equal(excluded.pagination.totalItems, 0);

    await prisma.test.update({ where: { id: record.id }, data: { status: 'PUBLISHED' } });
    assert.equal((await assign(request({ testId: record.id, childIds: [child.id] }))).status, 201);
    assert.equal((await updateSubject(request({ ...details, slug: fixture + '-changed' }), ctx(subject.id))).status, 400);
    assert.equal((await updateSubject(request({ ...details, name: 'Renamed subject', color: '#abcdef', archived: true }), ctx(subject.id))).status, 200);
    const saved = (await (await catalog()).json()).subjects.find((item) => item.id === subject.id);
    assert.equal(saved.name, 'Renamed subject');
    assert.equal(saved.color, '#abcdef');
    assert.equal((await upload(document)).status, 422, 'archived subjects reject new imports');
    assert.equal((await updateChild(request({ subjects: ['biology', fixture] }), ctx(child.id))).status, 200, 'existing archived assignments can be retained');
    currentUser = await prisma.user.findUnique({ where: { id: child.id }, include: { childProfile: { include: childProfileInclude } } });
    const overview = await (await dashboard()).json();
    assert.deepEqual(overview.subjects.map((item) => item.subject), ['biology', fixture]);
    assert.equal(overview.tests[0].subject, fixture);
    assert.equal(overview.subjects[0].assigned, 0, 'subjects without tests stay visible');
    currentUser = { id: 'admin', role: 'ADMIN' };
    assert.equal((await updateChild(request({ subjects: [] }), ctx(child.id))).status, 200);
    assert.equal((await updateChild(request({ subjects: [fixture] }), ctx(child.id))).status, 422, 'archived subjects cannot be newly assigned');
    await assert.rejects(prisma.subject.delete({ where: { id: subject.id } }), { code: 'P2003' });
  } finally {
    if (child) {
      await prisma.assignment.deleteMany({ where: { childId: child.id } });
      await prisma.user.delete({ where: { id: child.id } });
    }
    await prisma.test.deleteMany({ where: { stableId: fixture } });
    if (subject) await prisma.subject.delete({ where: { id: subject.id } });
    await prisma.$disconnect();
  }
});
