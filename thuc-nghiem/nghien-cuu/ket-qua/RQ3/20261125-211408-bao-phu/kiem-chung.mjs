import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reuseSites, statements } from '../../../../src/statements.js';

const dossier = dirname(fileURLToPath(import.meta.url));
assert.equal(process.argv.length, 3, 'Pass the path to the original report.json');
const input = resolve(process.argv[2]);
const rawReference = relative(dossier, input).replaceAll('\\', '/');
const report = JSON.parse(readFileSync(input, 'utf8'));
const cliMarkdown = readFileSync(resolve(dirname(input), 'report.md'), 'utf8');
const { cases, runs, rq1, rq3 } = report;

const byTemplate = (site, variant) => site + '/' + variant;
const difference = (left, right) => left.filter(value => !right.includes(value));
const percent = (count, total) => (100 * count / total).toFixed(1);
const sites = Object.entries(statements)
  .filter(([, entry]) => [...entry.bindings, ...entry.selectors].some(field => field.source === 'stored'))
  .map(([site]) => site);
const templates = sites.flatMap(site => Object.keys(statements[site].templates)
  .map(variant => byTemplate(site, variant)));
assert.deepEqual(reuseSites, sites);
assert.deepEqual(sites, ['PREVIEW_CATEGORY', 'PREVIEW_BUDGET', 'EXPORT_SEARCH']);
assert.equal(templates.length, 6);
assert.deepEqual(rq3.denominator, { sites, templates });
assert.deepEqual(rq1.filter(entry => entry.reusesStoredData).map(entry => entry.site), sites);
for (const { site, templates: inventoryTemplates } of rq1) {
  assert.deepEqual(inventoryTemplates, statements[site].templates);
}

const operations = new Map([
  ['save', 'PUT'], ['load', 'GET'], ['preview', 'GET'], ['publish', 'POST'], ['export', 'GET'],
]);
const pairs = new Map([
  ['name-unlimited', ['name', null]], ['price-unlimited', ['price', null]],
  ['name-budget', ['name', 250000]], ['price-budget', ['price', 250000]],
]);
assert.deepEqual(new Map(cases.map(({ name, sort, ceiling }) => [name, [sort, ceiling]])), pairs);
assert.equal(cases.length, pairs.size);
const suiteNames = ['chain', 'state_matched_fixture', 'draft_fixture'];
assert.deepEqual(runs.map(run => run.suite).sort(), [...suiteNames].sort());
const requestIds = new Set();
const searchOwners = new Map();
const evidence = [];
const summaries = new Map();
const statusTotals = new Map();

function expectedPath(operation, testCase, startingState) {
  const sql = (site, variant = 'fixed') => ({ type: 'sql', site, variant });
  const load = sql('LOAD_SEARCH');
  switch (operation) {
    case 'save':
      return [sql('SAVE_SEARCH')];
    case 'load':
      return [load];
    case 'publish':
      return [sql('PUBLISH_SEARCH')];
    case 'preview': {
      const hasCeiling = testCase.ceiling !== null;
      const site = hasCeiling ? 'PREVIEW_BUDGET' : 'PREVIEW_CATEGORY';
      return [load, { type: 'decision', rule: 'preview_ceiling', hasCeiling, site }, sql(site, testCase.sort)];
    }
    case 'export': {
      const allowed = startingState === 'published';
      const path = [load, { type: 'decision', rule: 'export_requires_published', state: startingState, allowed }];
      if (allowed) path.push(sql('EXPORT_SEARCH', testCase.sort));
      return path;
    }
  }
}

for (const [runIndex, { suite, requests }] of runs.entries()) {
  const observedSites = new Set();
  const observedTemplates = new Set();
  const statuses = {};
  const blocked = [];
  const byCase = new Map();
  for (const [requestIndex, request] of requests.entries()) {
    const { case: caseName, operation, method, startingState, searchId, requestId, status, itemIds, trace } = request;
    const testCase = cases.find(entry => entry.name === caseName);
    assert.ok(testCase, caseName);
    assert.ok(operations.has(operation), operation);
    assert.equal(method, operations.get(operation));
    if (!byCase.has(caseName)) byCase.set(caseName, []);
    byCase.get(caseName).push(operation);

    const context = [suite, caseName, operation].join(' / ');
    const exportAllowed = operation === 'export' && suite !== 'draft_fixture';
    const denied = operation === 'export' && !exportAllowed;
    const state = operation === 'save' ? null : exportAllowed ? 'published' : 'draft';
    assert.equal(startingState, state, context);
    assert.equal(status, operation === 'save' ? 201 : denied ? 409 : 200, context);
    assert.deepEqual(itemIds, operation === 'preview' || exportAllowed ? testCase.expectedIds : undefined, context);
    assert.match(requestId, /^[0-9a-f-]{36}$/);
    assert.ok(!requestIds.has(requestId), context);
    requestIds.add(requestId);
    assert.match(searchId, /^[0-9a-f-]{36}$/);
    const owner = suite === 'chain' ? suite + '/' + caseName : context;
    assert.equal(searchOwners.get(searchId) ?? owner, owner, context);
    searchOwners.set(searchId, owner);
    if (suite === 'chain') {
      const saved = requests.find(entry => entry.case === caseName && entry.operation === 'save');
      assert.equal(searchId, saved.searchId, context);
    }
    statuses[status] = (statuses[status] ?? 0) + 1;

    const path = trace.map(({ type, site, variant, ...properties }) =>
      type === 'sql' ? { type, site, variant } : { type, ...(site ? { site } : {}), ...properties });
    assert.deepEqual(path, expectedPath(operation, testCase, state), context);
    if (operation === 'publish') assert.equal(trace[0].affectedRows, 1, context);
    if (denied) blocked.push({ case: caseName, requestId, status, state: trace[1].state });

    for (const [eventIndex, event] of trace.entries()) {
      if (event.type === 'sql') {
        assert.equal(event.protocol, 'prepared', context);
        assert.ok(Number.isInteger(event.rowCount ?? event.affectedRows), context);
        if (sites.includes(event.site)) {
          observedSites.add(event.site);
          observedTemplates.add(byTemplate(event.site, event.variant));
        }
      }
      const decision = event.rule === 'preview_ceiling' ? 'hasCeiling=' + event.hasCeiling
        : event.rule === 'export_requires_published' ? 'state=' + event.state + ', allowed=' + event.allowed
        : '';
      evidence.push([
        'RQ3-' + operation.toUpperCase() + '-' + caseName, suite, caseName, operation, searchId, requestId,
        status, startingState, event.rule, decision, eventIndex, event.site, event.variant,
        rawReference + '#/runs/' + runIndex + '/requests/' + requestIndex + '/trace/' + eventIndex,
      ]);
    }
  }
  assert.equal(requests.length, cases.length * operations.size);
  assert.equal(byCase.size, cases.length);
  for (const observedOperations of byCase.values()) assert.deepEqual(observedOperations, [...operations.keys()]);
  const counted = {
    suite, requestCount: requests.length,
    sites: sites.filter(site => observedSites.has(site)),
    missingSites: sites.filter(site => !observedSites.has(site)),
    templates: templates.filter(template => observedTemplates.has(template)),
    missingTemplates: templates.filter(template => !observedTemplates.has(template)),
  };
  assert.deepEqual(counted, rq3.suites.find(entry => entry.suite === suite));
  const cliRow = cliMarkdown.split(/\r?\n/).find(line => line.startsWith('| `' + suite + '` |'));
  assert.ok(cliRow, suite);
  const fraction = (count, total) => count + '/' + total + ' (' + percent(count, total) + '%)';
  const cliMissing = counted.missingSites.map(site => '`' + site + '`').join(', ') || '—';
  assert.deepEqual(cliRow.split('|').slice(2, -1).map(value => value.trim()), [
    String(counted.requestCount), fraction(counted.sites.length, sites.length),
    fraction(counted.templates.length, templates.length), cliMissing,
  ]);
  if (suite === 'draft_fixture') assert.deepEqual(rq3.differences[0].fixtureEvidence, blocked);
  summaries.set(suite, counted);
  statusTotals.set(suite, statuses);
}

const comparisons = [
  ['chain', 'state_matched_fixture'], ['state_matched_fixture', 'draft_fixture'], ['chain', 'draft_fixture'],
].map(([a, b]) => {
  const left = summaries.get(a);
  const right = summaries.get(b);
  const siteDelta = left.sites.length - right.sites.length;
  const templateDelta = left.templates.length - right.templates.length;
  return {
    a, b, siteDelta, templateDelta,
    sitePercentagePoints: percent(siteDelta, sites.length),
    templatePercentagePoints: percent(templateDelta, templates.length),
    sitesOnlyA: difference(left.sites, right.sites), sitesOnlyB: difference(right.sites, left.sites),
    templatesOnlyA: difference(left.templates, right.templates), templatesOnlyB: difference(right.templates, left.templates),
  };
});
assert.equal(rq3.differences.length, 1);
assert.deepEqual(comparisons[2].sitesOnlyA, [rq3.differences[0].site]);
assert.deepEqual(comparisons[2].templatesOnlyA, rq3.differences[0].templates);

const columns = 'evidence_id,suite,case,operation,search_id,request_id,status,starting_state,decision_rule,decision_value,event_index,site,variant,source_ref';
const csvCell = value => value == null ? '' : '"' + String(value).replaceAll('"', '""') + '"';
writeFileSync(resolve(dossier, 'bang-chung.csv'), [columns, ...evidence.map(row => row.map(csvCell).join(',')), ''].join('\n'), 'utf8');

console.log(JSON.stringify({
  denominator: { sites, templates }, requestCount: requestIds.size, searchIdCount: searchOwners.size, evidenceRows: evidence.length,
  suites: suiteNames.map(name => ({ ...summaries.get(name), statuses: statusTotals.get(name) })),
  comparisons,
}, null, 2));
