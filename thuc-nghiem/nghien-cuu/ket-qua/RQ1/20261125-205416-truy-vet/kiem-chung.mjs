import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [rawFolder, csvPath] = process.argv.slice(2);
assert.ok(rawFolder && csvPath, 'Cách chạy: node kiem-chung.mjs <thư mục run> <đường dẫn CSV>');
const report = JSON.parse(readFileSync(join(rawFolder, 'report.json'), 'utf8'));
const markdown = readFileSync(join(rawFolder, 'report.md'), 'utf8');
const source = '../../../../src/';
const statementsRef = source + 'statements.js';
const handlerRef = source + 'app.js#L63';
const sqlLabels = {
  SAVE_SEARCH: 'SAVE',
  LOAD_SEARCH: 'LOAD',
  PUBLISH_SEARCH: 'PUBLISH',
  PREVIEW_CATEGORY: 'PREVIEW-CATEGORY',
  PREVIEW_BUDGET: 'PREVIEW-BUDGET',
  EXPORT_SEARCH: 'EXPORT',
};

const requestFields = ['id', 'category', 'sort', 'ceiling'];
const selector = (field, effect) => ({ field, source: 'stored', effect });
const previewSelectors = [selector('ceiling', 'site'), selector('sort', 'variant')];
const definitions = {
  SAVE_SEARCH: { fields: requestFields, line: 17 },
  LOAD_SEARCH: { fields: ['id'], line: 24 },
  PUBLISH_SEARCH: { fields: ['id'], line: 31 },
  PREVIEW_CATEGORY: { fields: ['category'], selectors: previewSelectors, line: 38 },
  PREVIEW_BUDGET: { fields: ['category', 'ceiling'], selectors: previewSelectors, line: 43 },
  EXPORT_SEARCH: {
    fields: ['category', 'ceiling', 'ceiling'],
    selectors: [selector('state', 'execution_gate'), selector('sort', 'variant')],
    line: 48,
  },
};
const labels = { site: 'chọn vị trí', variant: 'chọn mẫu', execution_gate: 'điều kiện thực thi' };
const orderedCases = {
  'name-unlimited': { sort: 'name', ceiling: null, itemIds: [1, 2, 3] },
  'price-unlimited': { sort: 'price', ceiling: null, itemIds: [3, 2, 1] },
  'name-budget': { sort: 'name', ceiling: 250000, itemIds: [2, 3] },
  'price-budget': { sort: 'price', ceiling: 250000, itemIds: [3, 2] },
};
const steps = [
  ['save', 'PUT', 201, null],
  ['load', 'GET', 200, 'draft'],
  ['preview', 'GET', 200, 'draft'],
  ['publish', 'POST', 200, 'draft'],
  ['export', 'GET', 200, 'published'],
];

assert.deepEqual(report.cases.map(({ name }) => name), Object.keys(orderedCases));
for (const { name, category, sort, ceiling, expectedIds } of report.cases) {
  assert.equal(category, "Đồ của O'Brien");
  assert.deepEqual({ sort, ceiling, itemIds: expectedIds }, orderedCases[name]);
}

const expectedSites = Object.entries(definitions).filter(([, def]) => def.selectors).map(([site]) => site);
assert.deepEqual(report.rq1.map(({ site }) => site), Object.keys(definitions));
for (const { site, templates, bindings, selectors, reusesStoredData } of report.rq1) {
  const def = definitions[site];
  const stored = Boolean(def.selectors);
  const origin = stored ? 'stored' : 'request';
  assert.equal(reusesStoredData, stored);
  assert.deepEqual(bindings, def.fields.map(field => ({ field, source: origin })), site);
  assert.deepEqual(selectors, def.selectors ?? [], site);
  assert.deepEqual(Object.keys(templates), stored ? ['name', 'price'] : ['fixed']);
  for (const sql of Object.values(templates)) {
    assert.equal(sql.split('?').length - 1, def.fields.length, site);
  }
  if (stored) {
    const prefix = 'SELECT item_id, name, price_dong FROM study_items WHERE category = ?';
    const condition = {
      PREVIEW_CATEGORY: '',
      PREVIEW_BUDGET: ' AND price_dong <= ?',
      EXPORT_SEARCH: ' AND (? IS NULL OR price_dong <= ?)',
    }[site];
    assert.equal(templates.name, prefix + condition + ' ORDER BY name ASC, item_id ASC', site);
    assert.equal(templates.price, prefix + condition + ' ORDER BY price_dong ASC, item_id ASC', site);
  }
  const rows = bindings.map(({ field }) => '`' + origin + '.' + field + '`');
  const rules = selectors.map(({ field, effect }) => '`' + field + '` (' + labels[effect] + ')');
  const expectedRow = '| `' + site + '` | ' + rows.join(', ') + ' | ' + (rules.join(', ') || '—') + ' |';
  assert.ok(markdown.includes(expectedRow), expectedRow);
}

assert.deepEqual(report.runs.map(({ suite, requests }) => [suite, requests.length]), [
  ['draft_fixture', 20], ['chain', 20], ['state_matched_fixture', 20],
]);
const allRequests = report.runs.flatMap(({ requests }) => requests);
const requestIds = allRequests.map(({ requestId }) => requestId);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
assert.ok(requestIds.every(id => uuid.test(id)));
assert.equal(new Set(requestIds).size, allRequests.length);

const chain = report.runs.find(({ suite }) => suite === 'chain').requests;
const csvRows = [[
  'evidence_id', 'case', 'search_id', 'request_id', 'operation', 'event_index',
  'site', 'variant', 'field', 'origin', 'role', 'slot', 'source_ref',
]];
const observedCalls = new Map();
let chainSql = 0;
let chainDecisions = 0;
let storedSlots = 0;
const searchIds = new Set();

function record(request, index, id, site, variant, field, origin, role, slot, ref) {
  csvRows.push([
    'RQ1-' + id, request.case, request.searchId, request.requestId, request.operation,
    index, site, variant, field, origin, role, slot, ref,
  ]);
}

function checkSql(request, index, site, variant, isChain) {
  const { fields, selectors, line } = definitions[site];
  const origin = selectors ? 'stored' : 'request';
  const event = request.trace[index];
  const result = ['SAVE_SEARCH', 'PUBLISH_SEARCH'].includes(site)
    ? { affectedRows: 1 }
    : { rowCount: site === 'LOAD_SEARCH' ? 1 : request.itemIds.length };
  assert.deepEqual(event, {
    type: 'sql', site, variant, protocol: 'prepared',
    bindings: fields.map((field, i) => ({ slot: i + 1, source: origin, field, treatment: 'bound' })),
    selectors: selectors ?? [], ...result,
  }, request.requestId);
  if (isChain) chainSql++;
  if (isChain && selectors) {
    const key = site + '/' + variant;
    observedCalls.set(key, (observedCalls.get(key) || 0) + 1);
    storedSlots += event.bindings.length;
  }
  for (const { field, slot } of event.bindings) {
    const slotId = selectors ? '-' + slot : '';
    record(request, index, sqlLabels[site] + '-' + field.toUpperCase() + slotId,
      site, variant, field, origin, 'giá trị ràng buộc', slot, statementsRef + '#L' + line);
  }
  if (selectors) {
    record(request, index, sqlLabels[site] + '-SORT', site, variant, 'sort', 'stored',
      'chọn biến thể', '', handlerRef);
  }
}

for (const [i, [name, scenario]] of Object.entries(orderedCases).entries()) {
  const requests = chain.slice(i * steps.length, (i + 1) * steps.length);
  assert.ok(uuid.test(requests[0].searchId));
  assert.ok(!searchIds.has(requests[0].searchId));
  searchIds.add(requests[0].searchId);
  for (const [index, request] of requests.entries()) {
    const { searchId, case: caseName, operation, method, status, startingState, trace, itemIds } = request;
    assert.equal(caseName, name);
    assert.equal(searchId, requests[0].searchId);
    assert.deepEqual([operation, method, status, startingState], steps[index], request.requestId);
    const reuse = operation === 'preview' || operation === 'export';
    assert.equal(trace.length, reuse ? 3 : 1);
    assert.deepEqual(itemIds, reuse ? scenario.itemIds : undefined);
    if (operation === 'save') {
      checkSql(request, 0, 'SAVE_SEARCH', 'fixed', true);
    } else if (operation === 'publish') {
      checkSql(request, 0, 'PUBLISH_SEARCH', 'fixed', true);
    } else {
      checkSql(request, 0, 'LOAD_SEARCH', 'fixed', true);
    }
    if (operation === 'preview') {
      const hasCeiling = scenario.ceiling !== null;
      const site = hasCeiling ? 'PREVIEW_BUDGET' : 'PREVIEW_CATEGORY';
      assert.deepEqual(trace[1], { type: 'decision', rule: 'preview_ceiling', hasCeiling, site });
      record(request, 1, sqlLabels[site] + '-CEILING-SITE', site, '', 'ceiling',
        'stored', 'chọn vị trí', '', handlerRef);
      checkSql(request, 2, site, scenario.sort, true);
      chainDecisions++;
    } else if (operation === 'export') {
      assert.deepEqual(trace[1], {
        type: 'decision', rule: 'export_requires_published', state: 'published', allowed: true,
      });
      record(request, 1, 'EXPORT-PUBLISHED', 'EXPORT_SEARCH', '', 'state',
        'stored', 'điều kiện thực thi', '', handlerRef);
      checkSql(request, 2, 'EXPORT_SEARCH', scenario.sort, true);
      chainDecisions++;
    }
  }
}

const rejected = report.runs.find(({ suite }) => suite === 'draft_fixture').requests
  .filter(({ operation }) => operation === 'export');
assert.deepEqual(rejected.map(request => request.case), Object.keys(orderedCases));
for (const request of rejected) {
  assert.deepEqual([request.method, request.status, request.startingState, request.trace.length], ['GET', 409, 'draft', 2]);
  assert.equal(request.itemIds, undefined);
  checkSql(request, 0, 'LOAD_SEARCH', 'fixed', false);
  assert.deepEqual(request.trace[1], { type: 'decision', rule: 'export_requires_published', state: 'draft', allowed: false });
  record(request, 1, 'EXPORT-DRAFT', 'EXPORT_SEARCH', '', 'state',
    'stored', 'điều kiện thực thi', '', handlerRef);
}

for (const field of [...requestFields, 'state']) {
  csvRows.push(['RQ1-READ-' + field.toUpperCase(), '', '', '', 'load', '', 'LOAD_SEARCH',
    'fixed', field, 'database', 'cột trả về', '', statementsRef + '#L24']);
}
csvRows.push(
  ['RQ1-SAVE-STATE', '', '', '', 'save', '', 'SAVE_SEARCH', 'fixed',
    'state', 'application', 'đặt trạng thái draft', '', statementsRef + '#L17'],
  ['RQ1-PUBLISH-STATE', '', '', '', 'publish', '', 'PUBLISH_SEARCH', 'fixed',
    'state', 'application', 'đặt trạng thái published', '', statementsRef + '#L31'],
  ['RQ1-PUBLISH-DRAFT', '', '', '', 'publish', '', 'PUBLISH_SEARCH', 'fixed',
    'state', 'database', 'điều kiện cập nhật draft', '', statementsRef + '#L31'],
);

const observedSites = new Set([...observedCalls.keys()].map(key => key.split('/')[0]));
const expectedVariants = expectedSites.flatMap(site => ['name', 'price'].map(sort => site + '/' + sort));
assert.deepEqual(Object.fromEntries(observedCalls), Object.fromEntries(expectedVariants.map(key =>
  [key, key.startsWith('EXPORT_SEARCH/') ? 2 : 1],
)));
assert.deepEqual(report.rq3.denominator, { sites: expectedSites, templates: expectedVariants });
const chainSummary = report.rq3.suites.find(({ suite }) => suite === 'chain');
assert.deepEqual(chainSummary.sites, expectedSites.filter(site => observedSites.has(site)));
assert.deepEqual(chainSummary.templates, expectedVariants.filter(key => observedCalls.has(key)));
assert.equal(chainSummary.requestCount, chain.length);
assert.ok(markdown.includes('| `chain` | 20 | 3/3 (100.0%) | 6/6 (100.0%) | — |'));
assert.deepEqual([chainSql, chainDecisions, storedSlots, rejected.length], [28, 8, 18, 4]);

const csv = csvRows.map(row => row.map(value => '"' + String(value).replaceAll('"', '""') + '"').join(',')).join('\n');
writeFileSync(csvPath, csv + '\n', 'utf8');
console.log(JSON.stringify({
  requests: allRequests.length,
  chainRequests: chain.length,
  chainSql,
  chainDecisions,
  reuseSites: observedSites.size,
  reuseVariants: observedCalls.size,
  reuseCalls: Object.fromEntries(observedCalls),
  storedSlots,
  draftExportsDenied: rejected.length,
  evidenceRows: csvRows.length - 1,
}, null, 2));
