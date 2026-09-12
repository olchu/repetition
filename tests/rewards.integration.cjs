/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/rewards.integration.cjs (uses DATABASE_URL).
// Only authentication is stubbed; route handlers, transactions and PostgreSQL are real.
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
const start = require('../src/app/api/v1/me/tests/[testId]/attempts/route.ts').POST;
const answer = require('../src/app/api/v1/me/attempts/[attemptId]/answers/[questionId]/route.ts').PUT;
const hint = require('../src/app/api/v1/me/attempts/[attemptId]/hints/[questionId]/route.ts').POST;
const submit = require('../src/app/api/v1/me/attempts/[attemptId]/submit/route.ts').POST;
const getAttempt = require('../src/app/api/v1/me/attempts/[attemptId]/route.ts').GET;
const getTest = require('../src/app/api/v1/me/tests/[testId]/route.ts').GET;
const dashboard = require('../src/app/api/v1/me/dashboard/route.ts').GET;
const { buildTestContent } = require('../src/lib/test-content.ts');
const context = (params) => ({ params: Promise.resolve(params) });
const request = (optionId) => new Request('http://localhost/test', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ optionId }) });

test('first-attempt rewards, hint persistence, immutable answers, retries and concurrent requests', async () => {
  const fixture = `reward-test-${randomUUID()}`;
  let child;
  try {
    child = await prisma.user.create({ data: { login: fixture, role: 'CHILD', passwordHash: 'not-a-login-hash', childProfile: { create: { displayName: 'Reward fixture', grade: '5' } } }, include: { childProfile: { include: { subjects: { include: { subject: true }, orderBy: { sortOrder: 'asc' } } } } } });
    currentUser = child;
    const questions = ['q1', 'q2', 'q3', 'q4'].map((id) => ({ id, text: id, points: 5, hint: 'A useful hint', options: [{ id: 'a', text: 'Correct' }, { id: 'b', text: 'Wrong' }], correctOptionId: 'a' }));
    const testRecord = await prisma.test.create({ data: { stableId: fixture, version: 1, title: fixture, subject: { connect: { slug: 'mathematics' } }, grade: '5', status: 'PUBLISHED', questionCount: 4, content: buildTestContent(questions) } });
    const assignment = await prisma.assignment.create({ data: { childId: child.id, testId: testRecord.id } });
    const testContext = context({ testId: testRecord.id });
    const starts = await Promise.all(Array.from({ length: 3 }, () => start(null, testContext).then((response) => response.json())));
    const attemptId = starts[0].attempt.id;
    assert.ok(starts.every((payload) => payload.attempt.id === attemptId), 'concurrent starts must resume one attempt');
    assert.equal(await prisma.attempt.count({ where: { childId: child.id } }), 1);
    assert.equal(starts[0].attempt.reward.eligible, true);
    assert.equal(starts[0].attempt.test.questions[0].hint, null);
    const preview = await (await getTest(null, testContext)).json();
    assert.equal(preview.test.questions[0].hint, undefined, 'preview must not leak hints');
    const attemptContext = context({ attemptId });
    const questionContext = (questionId) => context({ attemptId, questionId });
    // First correct answer earns one star despite a grading weight of five.
    const first = await (await answer(request('a'), questionContext('q1'))).json();
    assert.equal(first.reward.pendingStars, 1);
    assert.equal((await (await dashboard()).json()).stars, 0, 'balance changes only at submission');
    assert.equal((await answer(request('b'), questionContext('q1'))).status, 409);
    await hint(null, questionContext('q1'));
    assert.equal((await prisma.attempt.findUnique({ where: { id: attemptId } })).hintQuestionIds.includes('q1'), false, 'reviewing hint after answer must not reduce reward');
    await Promise.all([hint(null, questionContext('q2')), hint(null, questionContext('q2'))]);
    const resumed = await (await getAttempt(null, attemptContext)).json();
    assert.equal(resumed.attempt.test.questions[1].hintUsed, true);
    assert.equal(resumed.attempt.test.questions[1].hint, 'A useful hint');
    assert.equal((await prisma.attempt.findUnique({ where: { id: attemptId } })).hintQuestionIds.length, 1);
    const second = await (await answer(request('a'), questionContext('q2'))).json();
    assert.equal(second.reward.pendingStars, 1.5);
    await answer(request('b'), questionContext('q3'));
    // q4 deliberately unanswered; wrong and missing answers both earn zero.
    const completions = await Promise.all([submit(null, attemptContext), submit(null, attemptContext)]);
    for (const response of completions) {
      const payload = await response.json();
      assert.equal(payload.attempt.reward.earnedStars, 1.5);
      assert.equal(payload.attempt.result.earnedPoints, 10);
    }
    assert.equal((await (await dashboard()).json()).stars, 1.5);
    assert.equal((await answer(request('a'), questionContext('q4'))).status, 409);
    const retry = await (await start(null, testContext)).json();
    assert.notEqual(retry.attempt.id, attemptId);
    assert.equal(retry.attempt.reward.eligible, false);
    await answer(request('a'), context({ attemptId: retry.attempt.id, questionId: 'q1' }));
    await submit(null, context({ attemptId: retry.attempt.id }));
    assert.equal((await (await dashboard()).json()).stars, 1.5);
    await prisma.assignment.update({ where: { id: assignment.id }, data: { status: 'CANCELLED' } });
    assert.equal((await (await dashboard()).json()).stars, 1.5, 'cancelled assignments preserve balance');
    const nextVersion = await prisma.test.create({ data: { stableId: fixture, version: 2, title: fixture, subject: { connect: { slug: 'mathematics' } }, status: 'PUBLISHED', content: buildTestContent(questions) } });
    await prisma.assignment.create({ data: { childId: child.id, testId: nextVersion.id } });
    const versionAttempt = await (await start(null, context({ testId: nextVersion.id }))).json();
    assert.equal(versionAttempt.attempt.reward.eligible, false, 'new version must not reset rewards');
    await prisma.assignment.updateMany({ where: { childId: child.id }, data: { status: 'CANCELLED' } });
    await prisma.assignment.create({ data: { childId: child.id, testId: nextVersion.id } });
    const reassigned = await (await start(null, context({ testId: nextVersion.id }))).json();
    assert.equal(reassigned.attempt.id, versionAttempt.attempt.id, 'reassignment resumes an unfinished attempt');
    const competingAnswers = await Promise.all(['a', 'b'].map((option) => answer(request(option), context({ attemptId: versionAttempt.attempt.id, questionId: 'q1' }))));
    assert.deepEqual(competingAnswers.map((response) => response.status).sort(), [200, 409]);
    currentUser = { ...child, id: 'another-child' };
    assert.equal((await hint(null, questionContext('q2'))).status, 404);
    assert.equal((await answer(request('a'), questionContext('q2'))).status, 404);
    assert.equal((await submit(null, attemptContext)).status, 404);
    currentUser = null;
    assert.equal((await hint(null, questionContext('q2'))).status, 401);
  } finally {
    // Remove only this run's uniquely named fixtures, in foreign-key order.
    if (child) {
      await prisma.testReward.deleteMany({ where: { childId: child.id } });
      await prisma.attempt.deleteMany({ where: { childId: child.id } });
      await prisma.assignment.deleteMany({ where: { childId: child.id } });
      await prisma.user.delete({ where: { id: child.id } });
    }
    await prisma.test.deleteMany({ where: { stableId: fixture } });
    await prisma.$disconnect();
  }
});
