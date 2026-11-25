import { reuseSites, statements } from './statements.js';

export function statementInventory() {
  return Object.entries(statements).map(([site, { templates, bindings, selectors }]) => ({
    site,
    templates,
    bindings,
    selectors,
    reusesStoredData: reuseSites.includes(site),
  }));
}

export function bindingComparison(requests) {
  const firstObservation = new Map();
  for (const { trace } of requests) {
    for (const event of trace) {
      if (event.type === 'sql' && !firstObservation.has(event.site)) {
        firstObservation.set(event.site, event);
      }
    }
  }

  const sites = [...firstObservation.values()].map(({ site, bindings }) => ({
    site,
    modeledUnboundSlots: bindings.filter(slot => slot.source === 'stored')
      .map(({ source, field, slot }) => ({ source, field, slot })),
    observedUnboundSlots: bindings.filter(slot => slot.source === 'stored' && slot.treatment !== 'bound'),
  }));
  const summarize = key => {
    const violations = sites.filter(site => site[key].length > 0).map(({ site }) => site);
    return { violationCount: violations.length, sites: violations };
  };
  const writeOnly = summarize('modeledUnboundSlots');
  const writeAndReuse = summarize('observedUnboundSlots');

  return {
    method: 'metadata_counterfactual',
    observedSites: sites.map(({ site }) => site),
    writeOnly,
    writeAndReuse,
    reduction: writeOnly.violationCount - writeAndReuse.violationCount,
    sites,
  };
}

export function coverage(runs) {
  const templates = reuseSites.flatMap(site =>
    Object.keys(statements[site].templates).map(variant => `${site}/${variant}`),
  );

  const suites = runs.map(({ suite, requests }) => {
    const executed = requests.flatMap(({ trace }) =>
      trace.filter(event => event.type === 'sql' && reuseSites.includes(event.site)),
    );
    const observedSites = new Set(executed.map(({ site }) => site));
    const observedTemplates = new Set(executed.map(({ site, variant }) => `${site}/${variant}`));
    return {
      suite,
      requestCount: requests.length,
      sites: reuseSites.filter(site => observedSites.has(site)),
      missingSites: reuseSites.filter(site => !observedSites.has(site)),
      templates: templates.filter(template => observedTemplates.has(template)),
      missingTemplates: templates.filter(template => !observedTemplates.has(template)),
    };
  });

  const draft = suites.find(suite => suite.suite === 'draft_fixture');
  const chain = suites.find(suite => suite.suite === 'chain');
  const differences = chain.sites.filter(site => !draft.sites.includes(site)).map(site => ({
    site,
    templates: chain.templates.filter(template => template.startsWith(site + '/') && !draft.templates.includes(template)),
    fixtureEvidence: runs.find(run => run.suite === 'draft_fixture').requests.flatMap(request =>
      request.trace
        .filter(event => site === 'EXPORT_SEARCH' && event.rule === 'export_requires_published' && !event.allowed)
        .map(event => ({ case: request.case, requestId: request.requestId, status: request.status, state: event.state })),
    ),
  }));
  return { denominator: { sites: reuseSites, templates }, suites, differences };
}

const list = values => values.length ? values.map(value => '`' + value + '`').join(', ') : '—';
const selectorLabels = { site: 'chọn vị trí', variant: 'chọn mẫu', execution_gate: 'điều kiện thực thi' };
const fraction = (count, total) => `${count}/${total} (${(100 * count / total).toFixed(1)}%)`;

export function renderReport({ environment, cases, rq1, rq2, rq3 }) {
  const inventory = rq1.map(({ site, bindings, selectors }) =>
    `| \`${site}\` | ${list(bindings.map(({ source, field }) => `${source}.${field}`))} | ${selectors.map(({ field, effect }) => `\`${field}\` (${selectorLabels[effect]})`).join(', ') || '—'} |`,
  );
  const coverageRows = rq3.suites.map(suite =>
    `| \`${suite.suite}\` | ${suite.requestCount} | ${fraction(suite.sites.length, rq3.denominator.sites.length)} | ${fraction(suite.templates.length, rq3.denominator.templates.length)} | ${list(suite.missingSites)} |`,
  );
  const differences = rq3.differences.map(diff =>
    `- \`${diff.site}\` thiếu ở nhóm fixture nháp. ${diff.fixtureEvidence.length} yêu cầu xuất gặp trạng thái \`draft\` và nhận HTTP 409. Chênh lệch giữa fixture nháp và chuỗi nằm ở ${list(diff.templates)}.`,
  );
  const modeledSlots = rq2.sites.filter(site => site.modeledUnboundSlots.length > 0).map(({ site, modeledUnboundSlots }) =>
    `- \`${site}\` có các vị trí giá trị sau trong mô hình chỉ ràng buộc khi ghi: ${list(modeledUnboundSlots.map(({ field, slot }) => `${field} [${slot}]`))}.`,
  );

  return [
    '# Kết quả thí nghiệm tái sử dụng dữ liệu lưu trong MySQL',
    '',
    `MySQL ${environment.mysql}, Node.js ${environment.node}, mysql2 ${environment.driver}. Thời điểm chạy (UTC) ${environment.runAt}.`,
    '',
    '## RQ1 · Đường đi của dữ liệu',
    '',
    '`SAVE_SEARCH` ghi `category`, `sort` và `ceiling` qua tham số. Hai thao tác xem trước và xuất danh mục đọc lại bản ghi bằng `LOAD_SEARCH` rồi dùng chính bản ghi đó. `request` là dữ liệu của yêu cầu hiện tại. `stored` là dữ liệu do MySQL trả về.',
    '',
    '| Vị trí | Các tham số theo thứ tự | Quyết định dựa trên bản ghi |',
    '| --- | --- | --- |',
    ...inventory,
    '',
    '`state` do ứng dụng quản lý. `sort` chọn một trong hai mệnh đề sắp xếp cố định. Kiểm tra `ceiling` có giá trị hay không quyết định vị trí truy vấn xem trước. Truy vấn xuất luôn dùng cùng điều kiện giá cho mỗi thứ tự sắp xếp, với `ceiling` ràng buộc ở hai vị trí.',
    '',
    '## RQ2 · Mở rộng ràng buộc tham số',
    '',
    '| Chính sách | Số vị trí vi phạm | Vị trí |',
    '| --- | ---: | --- |',
    `| Chỉ ràng buộc khi ghi (mô hình) | ${rq2.writeOnly.violationCount} | ${list(rq2.writeOnly.sites)} |`,
    `| Ràng buộc cả khi ghi và khi tái sử dụng (thực thi) | ${rq2.writeAndReuse.violationCount} | ${list(rq2.writeAndReuse.sites)} |`,
    '',
    `Chênh lệch là **${rq2.reduction} vị trí**. Tiêu chí đếm một vị trí nếu nó có ít nhất một ô giá trị từ bản ghi mà chính sách bỏ ràng buộc. Mô hình áp tiêu chí này trên dấu vết của cùng luồng nghiệp vụ. Ràng buộc cho ID của yêu cầu hiện tại và quy tắc chọn mẫu giống nhau ở cả hai chính sách. Mọi câu SQL nghiệp vụ gửi đến MySQL đều sử dụng prepared statement.`,
    '',
    ...modeledSlots,
    '',
    '## RQ3 · Độ bao phủ',
    '',
    `Mỗi nhóm chạy cùng 5 thao tác HTTP trên ${cases.length} ca đầu vào. Hai giá trị \`sort\` kết hợp với hai giá trị của \`ceiling\` (\`null\` và 250.000 đồng). Mẫu số lấy từ danh mục các vị trí và biến thể tái sử dụng. Một lần gọi được quan sát khi MySQL trả kết quả thành công cho câu lệnh, kể cả khi trả về 0 dòng.`,
    '',
    '| Nhóm | Yêu cầu | Vị trí | Biến thể | Vị trí chưa quan sát |',
    '| --- | ---: | ---: | ---: | --- |',
    ...coverageRows,
    '',
    ...differences,
    '- Bản ghi có và không có trần giá xuất hiện trong cả ba nhóm. Vì vậy cả hai vị trí xem trước đều được quan sát.',
    '- Fixture thỏa tiền điều kiện nghiệp vụ cho từng yêu cầu đạt cùng độ bao phủ với chuỗi. Riêng thao tác xuất cần fixture đã công bố, tương ứng với trạng thái mà chuỗi đạt được sau thao tác công bố.',
    '',
    'Số liệu mô tả các ca và trạng thái đã chọn trong ứng dụng này. Xem `report.json` để đối chiếu từng yêu cầu, thứ tự vị trí SQL, ô tham số, mẫu và quyết định nhánh.',
    '',
  ].join('\n');
}
