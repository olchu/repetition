/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/grading.unit.cjs (no database needed).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = function (module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, resolveJsonModule: true },
  });
  module._compile(output.outputText, filename);
};
const { matchesAcceptedAnswer, isAnswerCorrect } = require('../src/lib/grading.ts');
const { buildTestContent, readTestContent } = require('../src/lib/test-content.ts');

test('numbers compare by value whatever the decimal separator', () => {
  for (const typed of ['2,3', '2.3', ' 2.30 ', '+2,3', '02.3']) assert.equal(matchesAcceptedAnswer(typed, ['2.3']), true, typed);
  assert.equal(matchesAcceptedAnswer('2.3', ['2,3']), true);
  assert.equal(matchesAcceptedAnswer('-0,5', ['-0.5']), true);
  assert.equal(matchesAcceptedAnswer('−3', ['-3']), true, 'typographic minus');
  assert.equal(matchesAcceptedAnswer('1 000', ['1000']), true);
  assert.equal(matchesAcceptedAnswer(',5', ['0.5']), true);
  for (const typed of ['2.4', '23', '2,3,4', 'два и три', '']) assert.equal(matchesAcceptedAnswer(typed, ['2.3']), false, typed);
});

test('text compares ignoring case, spaces, ё and the separator inside numbers', () => {
  assert.equal(matchesAcceptedAnswer('  Москва ', ['москва']), true);
  assert.equal(matchesAcceptedAnswer('ЁЖ', ['еж']), true);
  assert.equal(matchesAcceptedAnswer('3,5  кг', ['3.5 кг']), true);
  assert.equal(matchesAcceptedAnswer('1/2', ['1/2', '0.5']), true);
  assert.equal(matchesAcceptedAnswer('0,5', ['1/2', '0.5']), true);
  assert.equal(matchesAcceptedAnswer('Минск', ['москва']), false);
  assert.equal(matchesAcceptedAnswer('2.3', ['abc']), false);
});

test('isAnswerCorrect grades both question types', () => {
  const { questions: [choice, input] } = buildTestContent([
    { id: 'q1', text: 'Choice', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a' },
    { id: 'q2', type: 'input', text: 'Input', correctAnswers: [' 2.3 '] },
  ]);
  assert.equal(choice.type, 'choice');
  assert.deepEqual(input.correctAnswers, ['2.3'], 'accepted answers are trimmed on import');
  assert.equal(isAnswerCorrect(choice, { optionId: 'a', value: null }), true);
  assert.equal(isAnswerCorrect(choice, { optionId: 'b', value: null }), false);
  assert.equal(isAnswerCorrect(input, { optionId: null, value: '2,3' }), true);
  assert.equal(isAnswerCorrect(input, { optionId: 'a', value: null }), false);
  assert.equal(isAnswerCorrect(input, undefined), false);
});

test('content stored before question types reads as choice questions', () => {
  const { questions } = readTestContent({ schemaVersion: '1.0', questions: [{ id: 'q1', text: 'Old', points: 1, options: [], correctOptionId: 'a', hint: null, explanation: null }] });
  assert.equal(questions[0].type, 'choice');
});

test('the upload schema accepts input questions and rejects mixed shapes', () => {
  const Ajv2020 = require('ajv/dist/2020').default;
  const validate = new Ajv2020({ allErrors: true, useDefaults: true }).compile(require('../docs/test.schema.json'));
  const document = (question) => ({ schemaVersion: '1.0', id: 'unit', title: 'Unit', subject: 'mathematics', grade: '5', questions: [question] });
  const input = { id: 'q1', type: 'input', text: 'Input', correctAnswers: ['2.3'] };
  const choice = { id: 'q1', text: 'Choice', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOptionId: 'a' };
  assert.equal(validate(document(input)), true, JSON.stringify(validate.errors));
  const withDefaults = document({ ...choice });
  assert.equal(validate(withDefaults), true, JSON.stringify(validate.errors));
  assert.equal(withDefaults.questions[0].type, 'choice');
  assert.equal(validate(document({ ...input, correctAnswers: [] })), false);
  assert.equal(validate(document({ ...input, correctAnswers: ['  '] })), false);
  assert.equal(validate(document({ ...input, options: choice.options })), false);
  assert.equal(validate(document({ id: 'q1', type: 'input', text: 'Input' })), false);
  assert.equal(validate(document({ ...choice, correctAnswers: ['a'] })), false);
  assert.equal(validate(document({ id: 'q1', text: 'Choice' })), false);
  assert.equal(validate(document({ ...input, type: 'essay' })), false);
});
