import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { reuseSites, statements } from '../../../../src/statements.js';

const [rawDirectory] = process.argv.slice(2);
assert.ok(rawDirectory, 'Cách chạy: node kiem-chung.mjs <thư mục run>');
const dossier = import.meta.dirname;
const raw = resolve(rawDirectory, 'report.json');
const source = relative(dossier, raw).replaceAll('\\', '/');
const report = JSON.parse(readFileSync(raw, 'utf8'));
const markdown = readFileSync(join(rawDirectory, 'report.md'), 'utf8');
const { cases, rq1, rq2, runs } = report;

const catalog = new Map(rq1.map(entry => [entry.site, entry]));
assert.deepEqual([...catalog.keys()], Object.keys(statements));
for (const [site, definition] of Object.entries(statements)) {
  assert.deepEqual(catalog.get(site), {
    site, ...definition, reusesStoredData: reuseSites.includes(site),
  });
}
assert.deepEqual(cases.map(({ name, sort, ceiling, expectedIds }) => [name, sort, ceiling, expectedIds]), [
  ['name-unlimited', 'name', null, [1, 2, 3]],
  ['price-unlimited', 'price', null, [3, 2, 1]],
  ['name-budget', 'name', 250000, [2, 3]],
  ['price-budget', 'price', 250000, [3, 2]],
]);
assert.deepEqual(runs.map(({ suite, requests }) => [suite, requests.length]), [
  ['draft_fixture', 20], ['chain', 20], ['state_matched_fixture', 20],
]);
const requestIds = runs.flatMap(({ requests }) => requests.map(({ requestId }) => requestId));
assert.ok(requestIds.every(id => typeof id === 'string' && id.length > 0));
assert.equal(new Set(requestIds).size, requestIds.length);

const chainIndex = runs.findIndex(({ suite }) => suite === 'chain');
const { requests } = runs[chainIndex];
const operations = [
  ['save', 'PUT', 201, null, 'SAVE_SEARCH'],
  ['load', 'GET', 200, 'draft', 'LOAD_SEARCH'],
  ['preview', 'GET', 200, 'draft'],
  ['publish', 'POST', 200, 'draft', 'PUBLISH_SEARCH'],
  ['export', 'GET', 200, 'published'],
];
const searchIds = new Set();
const events = [];
for (const [caseIndex, scenario] of cases.entries()) {
  const { name, sort, ceiling, expectedIds } = scenario;
  const hasCeiling = ceiling !== null;
  const preview = hasCeiling ? 'PREVIEW_BUDGET' : 'PREVIEW_CATEGORY';
  const start = caseIndex * operations.length;
  const searchId = requests[start].searchId;
  assert.ok(searchId && !searchIds.has(searchId));
  searchIds.add(searchId);

  for (const [step, [operation, method, status, startingState, site]] of operations.entries()) {
    const requestIndex = start + step;
    const request = requests[requestIndex];
    const { requestId, trace, itemIds } = request;
    assert.deepEqual(
      [request.case, request.operation, request.method, request.status, request.startingState, request.searchId],
      [name, operation, method, status, startingState, searchId],
    );

    const isPreview = operation === 'preview';
    const isExport = operation === 'export';
    const decision = isPreview
      ? { type: 'decision', rule: 'preview_ceiling', hasCeiling, site: preview }
      : { type: 'decision', rule: 'export_requires_published', state: 'published', allowed: true };
    if (isPreview || isExport) {
      assert.deepEqual(trace.map(event => event.site ?? event.rule), [
        'LOAD_SEARCH', isPreview ? preview : decision.rule, isPreview ? preview : 'EXPORT_SEARCH',
      ]);
      assert.deepEqual(trace[1], decision);
      assert.equal(trace[2].variant, sort);
      assert.equal(trace[2].rowCount, expectedIds.length);
      assert.deepEqual(itemIds, expectedIds);
    } else {
      assert.deepEqual(trace.map(event => event.site), [site]);
    }

    for (const [eventIndex, event] of trace.entries()) {
      if (event.type !== 'sql') continue;
      const definition = catalog.get(event.site);
      const template = definition.templates[event.variant];
      assert.equal(event.protocol, 'prepared');
      assert.ok(template, `${event.site}/${event.variant}`);
      assert.equal(event.variant, definition.reusesStoredData ? sort : 'fixed');
      assert.equal(template.split('?').length - 1, event.bindings.length);
      assert.deepEqual(event.selectors, definition.selectors);
      assert.deepEqual(
        event.bindings.map(({ treatment, ...slot }) => slot),
        definition.bindings.map((binding, index) => ({ ...binding, slot: index + 1 })),
      );
      events.push({ event, name, requestId, requestIndex, eventIndex });
    }
  }
}

const sites = new Map();
const inconsistent = [];
const rows = [];
const modeled = new Set();
const observed = new Set();
for (const { event, name, requestId, requestIndex, eventIndex } of events) {
  const { site, variant, bindings } = event;
  if (!sites.has(site)) sites.set(site, []);
  const calls = sites.get(site);
  if (calls.length && !isDeepStrictEqual(calls[0].bindings, bindings)) {
    inconsistent.push({ name, requestId, eventIndex, site, variant });
  }
  calls.push(event);
  for (const [index, { slot, field, source: origin, treatment }] of bindings.entries()) {
    const stored = origin === 'stored';
    const model = stored ? 'unbound' : treatment;
    assert.ok(typeof treatment === 'string' && treatment.length > 0);
    if (stored) {
      modeled.add(site);
      if (treatment !== 'bound') observed.add(site);
    } else {
      assert.equal(treatment, 'bound');
    }
    rows.push([
      `RQ2-${site}-${slot}`, name, requestId, eventIndex, site, variant, slot, field, origin, model, treatment,
      `${source}#/runs/${chainIndex}/requests/${requestIndex}/trace/${eventIndex}/bindings/${index}`,
    ]);
  }
}

const missingReuseSites = reuseSites.filter(site => !sites.has(site));
const reuseVariants = reuseSites.flatMap(site => Object.keys(statements[site].templates).map(variant => `${site}/${variant}`));
const reuseEvents = events.filter(({ event }) => reuseSites.includes(event.site));
const seenVariants = new Set(reuseEvents.map(({ event }) => `${event.site}/${event.variant}`));
const a = [...modeled];
const b = [...observed];
const reduction = a.length - b.length;
const sameSet = (left, right) => left.length === right.length && left.every(value => right.includes(value));
const firstSummaries = [...sites].map(([site, [{ bindings }]]) => ({
  site,
  modeledUnboundSlots: bindings.filter(slot => slot.source === 'stored')
    .map(({ source, field, slot }) => ({ source, field, slot })),
  observedUnboundSlots: bindings.filter(slot => slot.source === 'stored' && slot.treatment !== 'bound'),
}));

assert.equal(rq2.method, 'metadata_counterfactual');
assert.deepEqual(rq2.observedSites, [...sites.keys()]);
assert.deepEqual(rq2.sites, firstSummaries);
const sameAsCli = sameSet(a, rq2.writeOnly.sites) && sameSet(b, rq2.writeAndReuse.sites)
  && a.length === rq2.writeOnly.violationCount && b.length === rq2.writeAndReuse.violationCount
  && reduction === rq2.reduction;
const cliSites = values => values.length ? values.map(site => '\x60' + site + '\x60').join(', ') : '—';
assert.ok(markdown.includes(`| Chỉ ràng buộc khi ghi (mô hình) | ${rq2.writeOnly.violationCount} | ${cliSites(rq2.writeOnly.sites)} |`));
assert.ok(markdown.includes(`| Ràng buộc cả khi ghi và khi tái sử dụng (thực thi) | ${rq2.writeAndReuse.violationCount} | ${cliSites(rq2.writeAndReuse.sites)} |`));
assert.ok(markdown.includes(`Chênh lệch là **${rq2.reduction} vị trí**.`));

const header = 'evidence_id,case,request_id,event_index,site,variant,slot,field,source,model_treatment,observed_treatment,source_ref';
const csvCell = value => '"' + String(value).replaceAll('"', '""') + '"';
writeFileSync(join(dossier, 'bang-chung.csv'), [header, ...rows.map(row => row.map(csvCell).join(',')), ''].join('\n'));

const reused = reuseSites.filter(site => sites.has(site));
const variantCounts = Object.fromEntries([...seenVariants].map(key => [
  key, reuseEvents.filter(({ event }) => `${event.site}/${event.variant}` === key).length,
]));
console.log(JSON.stringify({
  source,
  requestCount: requestIds.length,
  chainRequests: requests.length,
  sqlEvents: events.length,
  observedSqlSites: [...sites.keys()],
  reuseSites: reused,
  missingReuseSites,
  missingReuseVariants: reuseVariants.filter(key => !seenVariants.has(key)),
  reuseEvents: reuseEvents.length,
  variantCounts,
  evidenceRows: rows.length,
  storedRows: rows.filter(row => row[8] === 'stored').length,
  A: a,
  B: b,
  aOnly: a.filter(site => !observed.has(site)),
  bOnly: b.filter(site => !modeled.has(site)),
  reduction,
  inconsistent,
  sameAsCli,
}, null, 2));

const barWidth = value => 580 * value / Math.max(reused.length, 1);
const ticks = Array.from({ length: reused.length + 1 }, (_, value) => ({ value, x: 505 + barWidth(value) }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="570" viewBox="0 0 1200 570" role="img" aria-labelledby="title desc">
  <title id="title">RQ2 · Vị trí vi phạm tiêu chí tách dữ liệu khỏi cấu trúc SQL</title>
  <desc id="desc">Mô hình A có ${a.length}/${reused.length} vị trí vi phạm. Thực thi B có ${b.length}/${reused.length}. Chênh lệch ${reduction} vị trí.</desc>
  <rect width="1200" height="570" fill="#fff"/>
  <g font-family="Segoe UI, Arial, sans-serif" fill="#172c37">
    <text x="61" y="75" font-size="38" font-weight="700">Vị trí vi phạm tiêu chí tách dữ liệu khỏi cấu trúc SQL</text>
    <text x="63" y="123" font-size="25" fill="#415b67">RQ2 · Nhóm chain · ${reused.length} vị trí tái sử dụng được quan sát</text>
    <g stroke="#d8e2e6" stroke-width="2">
      ${ticks.map(({ x }) => `<line x1="${x}" y1="174" x2="${x}" y2="404"/>`).join('')}
    </g>
    <g font-size="26" font-weight="700">
      <text x="63" y="221">A · Mô hình</text>
      <text x="63" y="343">B · Thực thi</text>
    </g>
    <g font-size="22" fill="#415b67">
      <text x="63" y="254">Chỉ ràng buộc khi ghi</text>
      <text x="63" y="376">Ràng buộc khi ghi và tái sử dụng</text>
    </g>
    <rect x="505" y="201" width="${barWidth(a.length)}" height="55" rx="5" fill="#266575"/>
    <rect x="505" y="323" width="${barWidth(b.length)}" height="55" rx="5" fill="#266575"/>
    <text x="${505 + barWidth(a.length) + 15}" y="240" font-size="30" font-weight="700">${a.length}</text>
    <text x="${505 + barWidth(b.length) + 15}" y="362" font-size="30" font-weight="700">${b.length}</text>
    <g font-size="21" text-anchor="middle" fill="#415b67">
      ${ticks.map(({ x, value }) => `<text x="${x}" y="435">${value}</text>`).join('')}
      <text x="795" y="475">Số vị trí vi phạm</text>
    </g>
    <text x="63" y="527" font-size="21" fill="#415b67">Nguồn · report.json, nhóm chain, cùng dấu vết MySQL cho cả hai chính sách</text>
  </g>
</svg>
`;
mkdirSync(join(dossier, 'hinh'), { recursive: true });
writeFileSync(join(dossier, 'hinh', 'rq2-vi-tri-vi-pham.svg'), svg);

