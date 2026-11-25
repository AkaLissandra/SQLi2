import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { createApp } from './app.js';
import { sampleCategory, withConnection } from './database.js';
import { bindingComparison, coverage, renderReport, statementInventory } from './report.js';

const cases = [
  { name: 'name-unlimited', sort: 'name', ceiling: null, expectedIds: [1, 2, 3] },
  { name: 'price-unlimited', sort: 'price', ceiling: null, expectedIds: [3, 2, 1] },
  { name: 'name-budget', sort: 'name', ceiling: 250_000, expectedIds: [2, 3] },
  { name: 'price-budget', sort: 'price', ceiling: 250_000, expectedIds: [3, 2] },
];

const suites = ['draft_fixture', 'chain', 'state_matched_fixture'];
const operations = [
  { name: 'save', method: 'PUT', expectedStatus: 201 },
  { name: 'load', method: 'GET', expectedStatus: 200 },
  { name: 'preview', method: 'GET', suffix: '/preview', expectedStatus: 200 },
  { name: 'publish', method: 'POST', suffix: '/publish', expectedStatus: 200 },
  { name: 'export', method: 'GET', suffix: '/export', expectedStatus: 200 },
];

const insertFixture = (connection, id, input, state) => connection.execute(
  'INSERT INTO study_searches (id, category, sort_key, ceiling_dong, state) VALUES (?, ?, ?, ?, ?)',
  [id, input.category, input.sort, input.ceiling, state],
);

async function send(baseUrl, events, operation, id, input) {
  const { method, name, suffix = '' } = operation;
  const response = await fetch(`${baseUrl}/searches/${id}${suffix}`, {
    method,
    headers: name === 'save' ? { 'Content-Type': 'application/json' } : undefined,
    body: name === 'save' ? JSON.stringify(input) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const requestId = response.headers.get('x-request-id');
  const trace = events.get(requestId) || [];
  events.delete(requestId);
  return { requestId, status: response.status, trace, body: await response.json() };
}

function verify(outcome, operation, suite, scenario, id, input) {
  const { status, body, trace } = outcome;
  const expectedStatus = suite === 'draft_fixture' && operation.name === 'export'
    ? 409 : operation.expectedStatus;
  assert.equal(status, expectedStatus, `${suite} / ${scenario.name} / ${operation.name}`);
  assert.ok(outcome.requestId);

  const draft = { id, ...input, state: 'draft' };
  const published = { ...draft, state: 'published' };
  const sites = trace.filter(event => event.type === 'sql').map(event => event.site);

  switch (operation.name) {
    case 'save':
      assert.deepEqual(body, draft);
      assert.deepEqual(sites, ['SAVE_SEARCH']);
      break;
    case 'load':
      assert.deepEqual(body, draft);
      assert.deepEqual(sites, ['LOAD_SEARCH']);
      break;
    case 'preview':
      assert.deepEqual(body.search, draft);
      assert.deepEqual(sites, ['LOAD_SEARCH', input.ceiling === null ? 'PREVIEW_CATEGORY' : 'PREVIEW_BUDGET']);
      break;
    case 'publish':
      assert.deepEqual(body, { id, state: 'published' });
      assert.deepEqual(sites, ['PUBLISH_SEARCH']);
      break;
    case 'export':
      if (expectedStatus === 200) {
        assert.deepEqual(body.search, published);
        assert.deepEqual(sites, ['LOAD_SEARCH', 'EXPORT_SEARCH']);
      } else {
        assert.deepEqual(sites, ['LOAD_SEARCH']);
      }
      assert.deepEqual(trace.find(event => event.type === 'decision'), {
        type: 'decision',
        rule: 'export_requires_published',
        state: expectedStatus === 200 ? 'published' : 'draft',
        allowed: expectedStatus === 200,
      });
      break;
  }

  if (body.items) {
    assert.deepEqual(body.items.map(item => item.item_id), scenario.expectedIds);
    assert.equal(trace.at(-1).variant, input.sort);
  }
  assert.equal(Boolean(body.items), operation.name === 'preview' || (operation.name === 'export' && status === 200));
}

async function runSuite(config, baseUrl, events, suite) {
  const created = [];
  const requests = [];
  try {
    for (const scenario of cases) {
      const input = { category: sampleCategory, sort: scenario.sort, ceiling: scenario.ceiling };
      const chainId = randomUUID();
      for (const operation of operations) {
        const id = suite === 'chain' ? chainId : randomUUID();
        let startingState = null;
        if (operation.name !== 'save') {
          startingState = operation.name === 'export' && suite !== 'draft_fixture' ? 'published' : 'draft';
          if (suite !== 'chain') {
            await withConnection(config, connection => insertFixture(connection, id, input, startingState));
            created.push(id);
          }
        }
        const outcome = await send(baseUrl, events, operation, id, input);
        if (operation.name === 'save' && outcome.status === 201) created.push(id);
        verify(outcome, operation, suite, scenario, id, input);
        requests.push({
          case: scenario.name,
          operation: operation.name,
          startingState,
          searchId: id,
          requestId: outcome.requestId,
          method: operation.method,
          status: outcome.status,
          itemIds: outcome.body.items?.map(item => item.item_id),
          trace: outcome.trace,
        });
      }
    }
    return { suite, requests };
  } finally {
    if (created.length) {
      await withConnection(config, async connection => {
        for (const id of created) await connection.execute('DELETE FROM study_searches WHERE id = ?', [id]);
      });
    }
  }
}

export async function runStudy(config) {
  const events = new Map();
  const server = createApp(config, {
    observe: ({ requestId, ...event }) => {
      if (!events.has(requestId)) events.set(requestId, []);
      events.get(requestId).push(event);
    },
  });
  const listening = once(server, 'listening');
  server.listen(0, '127.0.0.1');
  await listening;
  try {
    const mysqlVersion = await withConnection(config, async connection => {
      const [[{ version }]] = await connection.query('SELECT VERSION() AS version');
      return version;
    });
    const baseUrl = `http://127.0.0.1:${server.address().port}`;
    const runs = [];
    for (const suite of suites) runs.push(await runSuite(config, baseUrl, events, suite));
    const chain = runs.find(run => run.suite === 'chain');
    return {
      environment: {
        mysql: mysqlVersion,
        driver: createRequire(import.meta.url)('mysql2/package.json').version,
        node: process.version,
        runAt: new Date().toISOString(),
      },
      cases: cases.map(scenario => ({ category: sampleCategory, ...scenario })),
      rq1: statementInventory(),
      rq2: bindingComparison(chain.requests),
      rq3: coverage(runs),
      runs,
    };
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

export async function saveReport(report, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  const folder = await mkdtemp(join(outputDirectory, 'run-'));
  await Promise.all([
    writeFile(join(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8'),
    writeFile(join(folder, 'report.md'), renderReport(report), 'utf8'),
  ]);
  return folder;
}
