import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { withConnection } from './database.js';
import { execute } from './statements.js';

const pathPattern = /^\/searches\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\/(preview|publish|export))?$/;
const allowedMethods = { search: 'GET, PUT', preview: 'GET', publish: 'POST', export: 'GET' };
const maxBodyBytes = 4096;

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readSearchInput(request) {
  const mediaType = request.headers['content-type']?.split(';')[0].trim().toLowerCase();
  if (mediaType !== 'application/json') throw new RequestError(415, 'Cần Content-Type application/json');

  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) {
      request.resume();
      throw new RequestError(413, 'Nội dung vượt quá 4096 byte');
    }
    chunks.push(chunk);
  }

  let body;
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new RequestError(400, 'Nội dung JSON UTF-8 không hợp lệ');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => !['category', 'sort', 'ceiling'].includes(key))) {
    throw new RequestError(400, 'Dữ liệu gồm category, sort và ceiling tùy chọn');
  }
  const { category, sort, ceiling = null } = body;
  if (typeof category !== 'string' || !category.isWellFormed() ||
      !category.trim() || [...category].length > 64) {
    throw new RequestError(400, 'category phải dài từ 1 đến 64 ký tự và có nội dung');
  }
  if (sort !== 'name' && sort !== 'price') {
    throw new RequestError(400, 'sort phải là name hoặc price');
  }
  if (ceiling !== null && (!Number.isInteger(ceiling) || ceiling < 0 || ceiling > 100_000_000)) {
    throw new RequestError(400, 'ceiling phải là null hoặc số nguyên từ 0 đến 100000000');
  }
  return { category, sort, ceiling };
}

async function load(run, id) {
  const [search] = await run('LOAD_SEARCH', 'fixed', { request: { id } });
  if (!search) throw new RequestError(404, 'Không tìm thấy bộ lọc');
  return search;
}

async function perform(run, emit, { action, method, id, input }) {
  if (method === 'PUT') {
    await run('SAVE_SEARCH', 'fixed', { request: { id, ...input } });
    return { status: 201, body: { id, ...input, state: 'draft' } };
  }
  if (action === 'publish') {
    const result = await run('PUBLISH_SEARCH', 'fixed', { request: { id } });
    if (result.affectedRows !== 1) throw new RequestError(409, 'Cần một bộ lọc đang là bản nháp');
    return { body: { id, state: 'published' } };
  }

  const search = await load(run, id);
  if (action === 'search') return { body: search };

  if (action === 'export') {
    const allowed = search.state === 'published';
    emit({ type: 'decision', rule: 'export_requires_published', state: search.state, allowed });
    if (!allowed) throw new RequestError(409, 'Cần công bố bộ lọc trước khi xuất danh mục');
    const items = await run('EXPORT_SEARCH', search.sort, { stored: search });
    return { body: { search, items } };
  }

  const hasCeiling = search.ceiling !== null;
  const site = hasCeiling ? 'PREVIEW_BUDGET' : 'PREVIEW_CATEGORY';
  emit({ type: 'decision', rule: 'preview_ceiling', hasCeiling, site });
  const items = await run(site, search.sort, { stored: search });
  return { body: { search, items } };
}

export function createApp(config, { observe = () => {}, onError = console.error } = {}) {
  return createServer({ requestTimeout: 10_000 }, async (request, response) => {
    const requestId = randomUUID();
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    try {
      const path = new URL(request.url, 'http://127.0.0.1').pathname;
      const [, id, action = 'search'] = pathPattern.exec(path) || [];
      if (!id) throw new RequestError(404, 'Đường dẫn không tồn tại');
      const method = request.method;
      if (!allowedMethods[action].split(', ').includes(method)) {
        response.setHeader('Allow', allowedMethods[action]);
        throw new RequestError(405, 'Phương thức HTTP không được hỗ trợ');
      }
      const input = method === 'PUT' ? await readSearchInput(request) : undefined;
      const emit = event => observe({ requestId, ...event });
      const { status = 200, body } = await withConnection(config, connection =>
        perform((...args) => execute(connection, emit, ...args), emit, { action, method, id, input }),
      );
      if (status === 201) response.setHeader('Location', `/searches/${id}`);
      if (action === 'export') response.setHeader('Content-Disposition', 'attachment; filename="catalog.json"');
      response.writeHead(status).end(JSON.stringify(body));
    } catch (error) {
      let failure = error;
      if (error.code === 'ER_DUP_ENTRY' && request.method === 'PUT') {
        failure = new RequestError(409, 'Mã bộ lọc đã tồn tại');
      }
      if (!(failure instanceof RequestError)) {
        onError(error);
        failure = new RequestError(500, 'Lỗi nội bộ khi xử lý yêu cầu');
      }
      response.writeHead(failure.status).end(JSON.stringify({ error: failure.message }));
    }
  });
}
