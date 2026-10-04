/* eslint-disable @typescript-eslint/no-require-imports */
// Run with node --test tests/progress.integration.cjs against the local database.
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
const { withChildAttemptLock } = require(root + '/src/lib/attempt-lock.ts');
const progress = require(root + '/src/app/api/v1/me/progress/route.ts').GET;
const dashboard = require(root + '/src/app/api/v1/me/dashboard/route.ts').GET;
const results = require(root + '/src/app/api/v1/me/tests/[testId]/results/route.ts').GET;
const review = require(root + '/src/app/api/v1/me/attempts/[attemptId]/route.ts').GET;
const request = (cursor) => new Request('http://localhost/api/v1/me/progress' + (cursor === undefined ? '' : '?cursor=' + encodeURIComponent(cursor)));
const context = (params) => ({ params: Promise.resolve(params) });

test('lifetime progress, reward labels, bounded history and isolation across assignment changes', async () => {
  const fixture = `progress-${randomUUID()}`;
  const children = [];
  const groupIds = [];
  try {
    assert.equal((await progress(request())).status, 401);
    currentUser = { id: 'admin', role: 'ADMIN' };
    assert.equal((await progress(request())).status, 403);
    for (const suffix of ['own', 'other']) {
      children.push(await prisma.user.create({
        data: { login: `${fixture}-${suffix}`, role: 'CHILD', passwordHash: 'x',
          childProfile: { create: { displayName: suffix, grade: '5', subjects: { create: [
            { subject: { connect: { slug: 'mathematics' } } },
            { subject: { connect: { slug: 'biology' } }, sortOrder: 1 },
          ] } } } },
        include: { childProfile: { include: { subjects: { include: { subject: true } } } } },
      }));
    }
    const [child, other] = children;
    const content = { questions: [{ id: 'q1', type: 'choice', text: 'Example', points: 1,
      options: [{ id: 'a', text: 'A' }], correctOptionId: 'a' }] };
    async function makeTest(suffix, version = 1, subject = 'mathematics') {
      return prisma.test.create({ data: { stableId: `${fixture}-${suffix}`, version, title: `${suffix} v${version}`,
        subject: { connect: { slug: subject } }, status: 'PUBLISHED', questionCount: 1, content } });
    }
    const v1 = await makeTest('versions');
    const v2 = await makeTest('versions', 2);
    const rewardTest = await makeTest('reward', 1, 'biology');
    const legacyTest = await makeTest('legacy');
    const untouched = await makeTest('untouched');
    const group = await prisma.group.create({ data: { name: fixture, members: { create: { childId: child.id } } } });
    groupIds.push(group.id);
    const oldAssignment = await prisma.assignment.create({ data: { childId: child.id, testId: v1.id } });
    const currentAssignment = await prisma.assignment.create({ data: { groupId: group.id, testId: v2.id } });
    const rewardAssignment = await prisma.assignment.create({ data: { childId: child.id, testId: rewardTest.id } });
    const legacyAssignment = await prisma.assignment.create({ data: { childId: child.id, testId: legacyTest.id } });
    await prisma.assignment.create({ data: { childId: child.id, testId: untouched.id } });
    const instant = new Date('2026-09-15T12:00:00Z');
    let sequence = 0;
    async function attempt(owner, assignment, percentage, reward) {
      return withChildAttemptLock(owner.id, (transaction) => transaction.attempt.create({ data: {
        childId: owner.id, assignmentId: assignment.id, testVersion: assignment.testId === v2.id ? 2 : 1,
        status: 'SUBMITTED', startedAt: new Date(instant.getTime() - 100000 + sequence++ * 1000), submittedAt: instant,
        result: { create: { earnedPoints: percentage, totalPoints: 100, percentage, passed: percentage >= 70 } },
        ...(reward ? { reward: { create: { childId: owner.id, stableId: reward.stableId, units: reward.units, creditedAt: instant } } } : {}),
      } }));
    }
    const first = await attempt(child, oldAssignment, 33, { stableId: v1.stableId, units: 0 });
    currentUser = child;
    let payload = await (await progress(request())).json();
    assert.equal(payload.summary.completed, 1);
    assert.equal(payload.summary.passed, 0, 'finishing below the threshold counts as completed only');
    assert.equal(payload.summary.stars, 0);
    assert.equal(payload.attempts[0].reward.kind, 'earned', 'zero-star first attempt is not a practice attempt');

    await prisma.assignment.update({ where: { id: oldAssignment.id }, data: { status: 'CANCELLED' } });
    await prisma.test.update({ where: { id: v1.id }, data: { status: 'ARCHIVED' } });
    const passing = await attempt(child, currentAssignment, 100);
    await attempt(child, rewardAssignment, 75, { stableId: rewardTest.stableId, units: 3 });
    const legacy = await attempt(child, legacyAssignment, 0);
    const oldRetry = await attempt(child, legacyAssignment, 25);
    for (let i = 0; i < 21; i++) await attempt(child, currentAssignment, 50);
    await prisma.assignment.update({ where: { id: rewardAssignment.id }, data: { status: 'CANCELLED' } });
    const secret = await attempt(other, currentAssignment, 100);

    const overview = await (await dashboard()).json();
    const row = overview.tests.find((item) => item.stableId === v1.stableId);
    assert.equal(row.completed, true);
    assert.equal(row.passed, true);
    assert.equal(row.bestPercentage, 100);
    assert.equal(row.attemptCount, 23, 'all own versions and cancelled assignments count');
    assert.equal(row.rewardEligible, false);
    assert.equal(overview.tests.find((item) => item.stableId === untouched.stableId).rewardEligible, true);
    assert.equal(overview.stars, 1.5, 'balance includes cancelled assignments');

    const firstPage = await (await progress(request())).json();
    assert.deepEqual({ completed: firstPage.summary.completed, passed: firstPage.summary.passed, stars: firstPage.summary.stars },
      { completed: 3, passed: 2, stars: 1.5 });
    assert.equal(firstPage.attempts.length, 20);
    assert.ok(firstPage.nextCursor);
    assert.equal(firstPage.summary.subjects.find((item) => item.subject === 'mathematics').completed, 2);
    assert.equal(firstPage.summary.subjects.find((item) => item.subject === 'mathematics').tests.find((item) => item.stableId === v1.stableId).bestPercentage, 100);
    const secondPage = await (await progress(request(firstPage.nextCursor))).json();
    const all = [...firstPage.attempts, ...secondPage.attempts];
    assert.equal(all.length, 26);
    assert.equal(new Set(all.map((item) => item.id)).size, 26, 'tied dates paginate without repeats or gaps');
    assert.equal(secondPage.nextCursor, null);
    assert.equal(all.some((item) => item.id === secret.id), false);
    assert.equal(all.find((item) => item.id === first.id).archived, true);
    assert.equal(all.find((item) => item.title.startsWith('reward')).unassigned, true);
    assert.equal(all.find((item) => item.id === legacy.id).reward.kind, 'legacy');
    assert.equal(all.find((item) => item.id === oldRetry.id).reward.kind, 'training');
    assert.equal(all.find((item) => item.id === passing.id).reward.kind, 'training');
    assert.equal((await progress(request('garbage'))).status, 400);
    assert.equal((await progress(request(''))).status, 400);
    assert.equal((await progress(request(Buffer.from('null').toString('base64url')))).status, 400);
    const foreignPage = await (await progress(request(Buffer.from(JSON.stringify({ submittedAt: instant.toISOString(), id: secret.id })).toString('base64url')))).json();
    assert.ok(foreignPage.attempts.every((item) => item.id !== secret.id), 'cursor never changes the owner scope');
    assert.equal((await review(null, context({ attemptId: first.id }))).status, 200, 'cancelled/archived attempts can be reviewed');
    assert.equal((await review(null, context({ attemptId: secret.id }))).status, 404);
    const perTest = await (await results(null, context({ testId: v2.id }))).json();
    assert.equal(perTest.attempts.length, 23);
    assert.ok(perTest.attempts.some((item) => item.id === first.id));
    currentUser = other;
    const privateHistory = await (await progress(request())).json();
    assert.equal(privateHistory.summary.completed, 1);
    assert.equal(privateHistory.attempts.length, 1);
    assert.equal(privateHistory.attempts[0].id, secret.id);
  } finally {
    const ids = children.map((child) => child.id);
    await prisma.result.deleteMany({ where: { attempt: { childId: { in: ids } } } });
    await prisma.answer.deleteMany({ where: { attempt: { childId: { in: ids } } } });
    await prisma.testReward.deleteMany({ where: { childId: { in: ids } } });
    await prisma.attempt.deleteMany({ where: { childId: { in: ids } } });
    await prisma.assignment.deleteMany({ where: { test: { stableId: { startsWith: fixture } } } });
    await prisma.test.deleteMany({ where: { stableId: { startsWith: fixture } } });
    await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
