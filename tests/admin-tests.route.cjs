/* eslint-disable @typescript-eslint/no-require-imports */
// Run with: node --test tests/admin-tests.route.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
let listQuery;

const prisma = {
  test: {
    count: async (query) => query.where.status === 'PUBLISHED' ? 1 : 2,
    findMany: async (query) => {
      if (query.distinct?.includes('grade')) return [{ grade: '7' }, { grade: '5' }];
      listQuery = query;
      return [{
        id: 'test-2',
        stableId: 'algebra-advanced',
        version: 1,
        title: 'Algebra Advanced',
        subject: { slug: 'mathematics' },
        grade: '5',
        status: 'DRAFT',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        passPercentage: 70,
        questionCount: 10,
        _count: { assignments: 3 },
      }];
    },
  },
};

const originalLoad = Module._load;
Module._load = function (id, parent, main) {
  if (id === '@/lib/auth') return { getCurrentUser: async () => ({ id: 'admin', role: 'ADMIN' }) };
  if (id === '@/lib/prisma') return { prisma };
  return originalLoad.call(this, id.startsWith('@/') ? path.join(root, 'src', id.slice(2)) : id, parent, main);
};

require.extensions['.ts'] = function (module, filename) {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};

const listTests = require('../src/app/api/v1/admin/tests/route.ts').GET;

test('test list applies title search, grade filter and server pagination', async () => {
  const url = new URL('http://localhost/api/v1/admin/tests');
  url.searchParams.set('search', 'ALGEBRA');
  url.searchParams.set('grade', '5');
  url.searchParams.set('page', '2');
  url.searchParams.set('pageSize', '1');
  const response = await listTests(new Request(url));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.deepEqual(listQuery.where, {
    title: { contains: 'ALGEBRA', mode: 'insensitive' },
    grade: '5',
  });
  assert.equal(listQuery.skip, 1);
  assert.equal(listQuery.take, 1);
  assert.deepEqual(listQuery.orderBy, [{ createdAt: 'desc' }, { version: 'desc' }, { id: 'desc' }]);
  assert.equal(payload.tests[0].assignmentCount, 3);
  assert.equal(payload.tests[0].subject, 'mathematics');
  assert.deepEqual(payload.pagination, { page: 2, pageSize: 1, totalItems: 2, totalPages: 2 });
  assert.deepEqual(payload.filters.grades, ['5', '7']);
  assert.deepEqual(payload.summary, { publishedItems: 1 });
});
