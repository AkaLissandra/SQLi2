import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import test from 'node:test';
import { createApp } from '../src/app.js';
import { bindingComparison } from '../src/report.js';
import { execute, reuseSites, statements } from '../src/statements.js';

test('SQL catalog maps all placeholders and keeps stable reuse locations', () => {
  assert.deepEqual(reuseSites, ['PREVIEW_CATEGORY', 'PREVIEW_BUDGET', 'EXPORT_SEARCH']);
  for (const { bindings, templates } of Object.values(statements)) {
    for (const template of Object.values(templates)) {
      assert.equal(template.split('?').length - 1, bindings.length);
    }
  }
});

test('executor sends separate parameters and accepts only registered variants', async () => {
  const category = "Đồ của O'Brien";
  const traces = [];
  const calls = [];
  const connection = { execute: async (...args) => { calls.push(args); return [[]]; } };
  const run = variant => execute(connection, event => traces.push(event), 'EXPORT_SEARCH', variant, {
    stored: { category, ceiling: null },
  });

  await run('price');
  assert.deepEqual(calls, [[statements.EXPORT_SEARCH.templates.price, [category, null, null]]]);
  assert.equal(traces[0].rowCount, 0);
  assert.ok(traces[0].bindings.every(slot => slot.treatment === 'bound'));
  await assert.rejects(run('constructor'), /Mẫu SQL không được phép/);
  assert.equal(calls.length, 1);
});

test('binding comparison counts each position once and excludes fixed-template selectors', async () => {
  const trace = [];
  const connection = { execute: async () => [[]] };
  for (const sort of ['name', 'price']) {
    await execute(connection, event => trace.push(event), 'PREVIEW_CATEGORY', sort, {
      stored: { category: 'Mẫu' },
    });
  }
  const result = bindingComparison([{ trace }]);
  assert.deepEqual(result.writeOnly, { violationCount: 1, sites: ['PREVIEW_CATEGORY'] });
  assert.deepEqual(result.writeAndReuse, { violationCount: 0, sites: [] });
  assert.deepEqual(result.sites[0].modeledUnboundSlots, [{ source: 'stored', field: 'category', slot: 1 }]);
});

test('invalid request data is rejected before business queries', async () => {
  const trace = [];
  const errors = [];
  const app = createApp({}, { observe: event => trace.push(event), onError: error => errors.push(error) });
  const listening = once(app, 'listening');
  app.listen(0, '127.0.0.1');
  await listening;
  try {
    const url = `http://127.0.0.1:${app.address().port}/searches/${randomUUID()}`;
    const cases = [
      { type: 'application/json', body: '{"category":"Mẫu","sort":"unsupported"}', status: 400 },
      { type: 'application/json', body: '{"category":"Mẫu","sort":"price","ceiling":-1}', status: 400 },
      { type: 'application/json', body: '{', status: 400 },
      { type: 'application/json', body: 'a'.repeat(4097), status: 413 },
      { type: 'text/plain', body: 'Mẫu', status: 415 },
    ];
    for (const { type, body, status } of cases) {
      const response = await fetch(url, { method: 'PUT', headers: { 'Content-Type': type }, body });
      assert.equal(response.status, status);
      assert.ok((await response.json()).error);
    }
    assert.deepEqual(trace, []);
    assert.deepEqual(errors, []);
  } finally {
    await new Promise((resolve, reject) => app.close(error => error ? reject(error) : resolve()));
  }
});
