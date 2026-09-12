/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/attempt-report.integration.cjs (uses DATABASE_URL).
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
const adminAttempt = require('../src/app/api/v1/admin/attempts/[attemptId]/route.ts').GET;
const attemptReport = require('../src/app/api/v1/admin/attempts/[attemptId]/report/route.ts').GET;
const testReport = require('../src/app/api/v1/admin/results/report/route.ts').GET;
const { buildTestContent } = require('../src/lib/test-content.ts');
const Ajv2020 = require('ajv/dist/2020').default;
const validateTest = new Ajv2020({ allErrors: true }).compile(require('../docs/test.schema.json'));
const context = (params) => ({ params: Promise.resolve(params) });
const request = (body) => new Request('http://localhost/test', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const withoutKey = (key) => (question) => Object.fromEntries(Object.entries(question).filter(([name]) => name !== key));
// Report questions minus the child's results must be a valid upload.
const assertUploadable = (questions, key) => {
  const document = { schemaVersion: '1.0', id: 'follow-up', title: 'Follow-up', subject: 'mathematics', grade: '5', questions: questions.map(withoutKey(key)) };
  assert.equal(validateTest(document), true, JSON.stringify(validateTest.errors));
};

test('attempt and whole-test reports show wrong, skipped, hinted and changing answers', async () => {
  const fixture = `report-test-${randomUUID()}`;
  let child;
  try {
    child = await prisma.user.create({ data: { login: fixture, role: 'CHILD', passwordHash: 'not-a-login-hash', childProfile: { create: { displayName: 'Report fixture', grade: '5' } } }, include: { childProfile: { include: { subjects: { include: { subject: true }, orderBy: { sortOrder: 'asc' } } } } } });
    const admin = { ...child, role: 'ADMIN' };
    const options = [{ id: 'a', text: 'Right' }, { id: 'b', text: 'Wrong' }];
    const content = buildTestContent([
      { id: 'q1', text: 'Hinted, then clean', options, correctOptionId: 'a', hint: 'Pick the right one', explanation: 'Because.' },
      { id: 'q2', type: 'input', text: 'Hinted and wrong, then right', correctAnswers: ['2.3'], hint: 'Subtract' },
      { id: 'q3', text: 'Wrong twice', options, correctOptionId: 'a' },
      { id: 'q4', type: 'input', text: 'Skipped, then right', correctAnswers: ['5'] },
      { id: 'q5', text: 'Right, then wrong', points: 2, options, correctOptionId: 'a' },
      { id: 'q6', text: 'Always right', options, correctOptionId: 'a' },
    ]);
    const takeTest = async (version, steps) => {
      currentUser = child;
      const testRecord = await prisma.test.create({ data: { stableId: fixture, version, title: `${fixture} v${version}`, subject: { connect: { slug: 'mathematics' } }, grade: '5', status: 'PUBLISHED', questionCount: 6, content } });
      await prisma.assignment.create({ data: { childId: child.id, testId: testRecord.id } });
      const { attempt } = await (await start(null, context({ testId: testRecord.id }))).json();
      for (const [questionId, body, withHint] of steps) {
        if (withHint) await hint(null, context({ attemptId: attempt.id, questionId }));
        await answer(request(body), context({ attemptId: attempt.id, questionId }));
      }
      await submit(null, context({ attemptId: attempt.id }));
      return attempt.id;
    };

    const firstAttemptId = await takeTest(3, [['q1', { optionId: 'a' }, true], ['q2', { value: '2,4' }, true], ['q3', { optionId: 'b' }], ['q5', { optionId: 'a' }], ['q6', { optionId: 'a' }]]);
    const firstContext = context({ attemptId: firstAttemptId });
    assert.equal((await attemptReport(null, firstContext)).status, 403, 'children cannot export reports');

    // One attempt.
    currentUser = admin;
    const response = await attemptReport(null, firstContext);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="result-report-test-[a-zA-Z0-9-]+-v3-\d{4}-\d{2}-\d{2}\.json"$/);
    const single = await response.json();
    assert.deepEqual([single.reportVersion, single.scope], ['1.0', 'attempt']);
    assert.deepEqual(single.child, { displayName: 'Report fixture', login: fixture, grade: '5' });
    assert.deepEqual(single.result, { earnedPoints: 4, totalPoints: 7, percentage: 57.14, passed: false });
    assert.deepEqual(single.summary, { questionCount: 6, correct: 3, incorrect: 2, unanswered: 1, hintsUsed: 2, correctWithHint: 1, problemQuestionIds: ['q1', 'q2', 'q3', 'q4'] });
    const [q1, q2, , q4] = single.questions;
    assert.deepEqual(q1.childResult, { outcome: 'correct', hintUsed: true, answer: { optionId: 'a', text: 'Right' }, earnedPoints: 1 });
    assert.deepEqual(q2.childResult, { outcome: 'incorrect', hintUsed: true, answer: { value: '2,4' }, earnedPoints: 0 });
    assert.deepEqual(q4.childResult, { outcome: 'unanswered', hintUsed: false, answer: null, earnedPoints: 0 });
    assert.equal('explanation' in q2, false, 'empty fields are omitted as in an uploaded file');
    assertUploadable(single.questions, 'childResult');
    const detail = await (await adminAttempt(null, firstContext)).json();
    assert.deepEqual(detail.attempt.questions.map((question) => question.hintUsed), [true, true, false, false, false, false]);

    // A retry on a re-uploaded version of the same test joins the history.
    await takeTest(4, [['q1', { optionId: 'a' }], ['q2', { value: '2.3' }], ['q3', { optionId: 'b' }], ['q4', { value: '5' }], ['q5', { optionId: 'b' }], ['q6', { optionId: 'a' }]]);
    const historyUrl = (params) => new Request(`http://localhost/api/v1/admin/results/report?${new URLSearchParams(params)}`);
    currentUser = child;
    assert.equal((await testReport(historyUrl({ childId: child.id, stableId: fixture }))).status, 403);
    currentUser = admin;
    assert.equal((await testReport(historyUrl({ childId: child.id }))).status, 400);
    assert.equal((await testReport(historyUrl({ childId: child.id, stableId: 'no-such-test' }))).status, 404);

    const historyResponse = await testReport(historyUrl({ childId: child.id, stableId: fixture }));
    assert.equal(historyResponse.status, 200);
    assert.match(historyResponse.headers.get('content-disposition'), /-all-attempts-\d{4}-\d{2}-\d{2}\.json"$/);
    const history = await historyResponse.json();
    assert.equal(history.scope, 'test');
    assert.deepEqual(history.test.versions, [3, 4]);
    assert.deepEqual(
      history.attempts.map((item) => [item.number, item.version, item.correct, item.incorrect, item.unanswered, item.hintsUsed]),
      [[1, 3, 3, 2, 1, 2], [2, 4, 4, 2, 0, 0]],
    );
    assert.deepEqual(history.summary, {
      attemptCount: 2,
      passedAttempts: 0,
      bestPercentage: 57.14,
      latestPercentage: 57.14,
      questionCount: 6,
      masteredQuestionIds: ['q6'],
      improvedQuestionIds: ['q1', 'q2', 'q4'],
      regressedQuestionIds: ['q5'],
      strugglingQuestionIds: ['q3'],
      problemQuestionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
    });
    const byId = Object.fromEntries(history.questions.map((question) => [question.id, question.history]));
    assert.deepEqual(
      byId.q5.timeline.map((entry) => [entry.attempt, entry.version, entry.outcome, entry.answer.text]),
      [[1, 3, 'correct', 'Right'], [2, 4, 'incorrect', 'Wrong']],
    );
    assert.deepEqual([byId.q5.correct, byId.q5.incorrect, byId.q5.lastOutcome], [1, 1, 'incorrect']);
    assert.deepEqual([byId.q1.correct, byId.q1.correctWithHint, byId.q1.hintsUsed], [2, 1, 1]);
    assert.deepEqual(byId.q2.timeline.map((entry) => entry.answer.value), ['2,4', '2.3']);
    assertUploadable(history.questions, 'history');

    currentUser = null;
    assert.equal((await attemptReport(null, firstContext)).status, 401);
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
