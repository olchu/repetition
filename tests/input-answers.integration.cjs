/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/input-answers.integration.cjs (uses DATABASE_URL).
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
const submit = require('../src/app/api/v1/me/attempts/[attemptId]/submit/route.ts').POST;
const getAttempt = require('../src/app/api/v1/me/attempts/[attemptId]/route.ts').GET;
const adminAttempt = require('../src/app/api/v1/admin/attempts/[attemptId]/route.ts').GET;
const { buildTestContent } = require('../src/lib/test-content.ts');
const context = (params) => ({ params: Promise.resolve(params) });
const request = (body) => new Request('http://localhost/test', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('input questions accept either decimal separator and keep what was typed', async () => {
  const fixture = `input-test-${randomUUID()}`;
  let child;
  try {
    child = await prisma.user.create({ data: { login: fixture, role: 'CHILD', passwordHash: 'not-a-login-hash', childProfile: { create: { displayName: 'Input fixture', grade: '5' } } }, include: { childProfile: { include: { subjects: { include: { subject: true }, orderBy: { sortOrder: 'asc' } } } } } });
    currentUser = child;
    const content = buildTestContent([
      { id: 'q1', type: 'input', text: '4,6 : 2', points: 2, correctAnswers: ['2.3'], explanation: 'Half of 4.6.' },
      { id: 'q2', type: 'input', text: 'Capital', correctAnswers: ['Москва'] },
      { id: 'q3', text: 'Choice', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a' },
    ]);
    const testRecord = await prisma.test.create({ data: { stableId: fixture, version: 1, title: fixture, subject: { connect: { slug: 'mathematics' } }, grade: '5', status: 'PUBLISHED', questionCount: 3, content } });
    await prisma.assignment.create({ data: { childId: child.id, testId: testRecord.id } });
    const { attempt } = await (await start(null, context({ testId: testRecord.id }))).json();
    const questionContext = (questionId) => context({ attemptId: attempt.id, questionId });
    assert.equal(attempt.test.questions[0].type, 'input');
    assert.deepEqual(attempt.test.questions[0].options, []);
    assert.equal(attempt.test.questions[0].correctAnswer, undefined, 'the answer key stays hidden until the question is checked');

    assert.equal((await answer(request({ value: '   ' }), questionContext('q1'))).status, 422);
    assert.equal((await answer(request({ value: '1'.repeat(201) }), questionContext('q1'))).status, 422);
    assert.equal((await answer(request({ optionId: 'a' }), questionContext('q1'))).status, 422, 'input questions take a value only');
    assert.equal((await answer(request({ value: 'a' }), questionContext('q3'))).status, 422, 'choice questions take an option id only');

    const checked = await (await answer(request({ value: ' 2,3 ' }), questionContext('q1'))).json();
    assert.deepEqual(checked.answer, { questionId: 'q1', optionId: null, value: '2,3', isCorrect: true });
    assert.equal(checked.feedback.correctAnswer, '2.3');
    assert.equal(checked.feedback.explanation, 'Half of 4.6.');
    assert.equal(checked.reward.pendingStars, 1);
    assert.equal((await answer(request({ value: '2,3' }), questionContext('q1'))).status, 200, 'repeating the same answer is allowed');
    assert.equal((await answer(request({ value: '2.3' }), questionContext('q1'))).status, 409, 'a checked answer cannot be rewritten');

    const wrong = await (await answer(request({ value: 'Минск' }), questionContext('q2'))).json();
    assert.equal(wrong.answer.isCorrect, false);
    assert.equal(wrong.feedback.correctAnswer, 'Москва');
    await answer(request({ optionId: 'a' }), questionContext('q3'));

    const resumed = await (await getAttempt(null, context({ attemptId: attempt.id }))).json();
    assert.deepEqual(resumed.attempt.answers.map((item) => `${item.questionId}:${item.isCorrect}`).sort(), ['q1:true', 'q2:false', 'q3:true']);
    assert.equal(resumed.attempt.test.questions[0].correctAnswer, '2.3');

    const submitted = await (await submit(null, context({ attemptId: attempt.id }))).json();
    assert.equal(submitted.attempt.result.earnedPoints, 3);
    assert.equal(submitted.attempt.result.totalPoints, 4);
    assert.equal(submitted.attempt.reward.earnedStars, 2);

    await assert.rejects(
      prisma.answer.create({ data: { attemptId: attempt.id, questionId: 'extra', optionId: 'a', value: 'x' } }),
      'an answer holds an option id or a value, never both',
    );

    currentUser = { ...child, role: 'ADMIN' };
    const review = await (await adminAttempt(null, context({ attemptId: attempt.id }))).json();
    const [first, second] = review.attempt.questions;
    assert.deepEqual([first.type, first.value, first.isCorrect, first.earnedPoints], ['input', '2,3', true, 2]);
    assert.deepEqual(first.correctAnswers, ['2.3']);
    assert.deepEqual([second.value, second.isCorrect], ['Минск', false]);
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
