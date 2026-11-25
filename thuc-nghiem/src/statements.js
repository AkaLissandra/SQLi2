const input = field => ({ field, source: 'request' });
const stored = field => ({ field, source: 'stored' });
const selector = (field, effect) => ({ ...stored(field), effect });

const catalogSelect = 'SELECT item_id, name, price_dong FROM study_items WHERE category = ?';
const orderBy = {
  name: ' ORDER BY name ASC, item_id ASC',
  price: ' ORDER BY price_dong ASC, item_id ASC',
};

const sorts = sql => ({
  name: sql + orderBy.name,
  price: sql + orderBy.price,
});

export const statements = {
  SAVE_SEARCH: {
    templates: {
      fixed: "INSERT INTO study_searches (id, category, sort_key, ceiling_dong, state) VALUES (?, ?, ?, ?, 'draft')",
    },
    bindings: [input('id'), input('category'), input('sort'), input('ceiling')],
    selectors: [],
  },
  LOAD_SEARCH: {
    templates: {
      fixed: 'SELECT id, category, sort_key AS sort, ceiling_dong AS ceiling, state FROM study_searches WHERE id = ?',
    },
    bindings: [input('id')],
    selectors: [],
  },
  PUBLISH_SEARCH: {
    templates: {
      fixed: "UPDATE study_searches SET state = 'published' WHERE id = ? AND state = 'draft'",
    },
    bindings: [input('id')],
    selectors: [],
  },
  PREVIEW_CATEGORY: {
    templates: sorts(catalogSelect),
    bindings: [stored('category')],
    selectors: [selector('ceiling', 'site'), selector('sort', 'variant')],
  },
  PREVIEW_BUDGET: {
    templates: sorts(catalogSelect + ' AND price_dong <= ?'),
    bindings: [stored('category'), stored('ceiling')],
    selectors: [selector('ceiling', 'site'), selector('sort', 'variant')],
  },
  EXPORT_SEARCH: {
    templates: sorts(catalogSelect + ' AND (? IS NULL OR price_dong <= ?)'),
    bindings: [stored('category'), stored('ceiling'), stored('ceiling')],
    selectors: [selector('state', 'execution_gate'), selector('sort', 'variant')],
  },
};

export const reuseSites = Object.keys(statements).filter(site => {
  const { bindings, selectors } = statements[site];
  return [...bindings, ...selectors].some(field => field.source === 'stored');
});

export async function execute(connection, emit, site, variant, values) {
  const { templates, bindings, selectors } = statements[site];
  if (!Object.hasOwn(templates, variant)) throw new Error('Mẫu SQL không được phép');

  const params = bindings.map(({ source, field }) => {
    const fields = values[source];
    if (!fields || !Object.hasOwn(fields, field) || fields[field] === undefined) {
      throw new Error(`Thiếu giá trị tham số cho ${site}: ${source}.${field}`);
    }
    return fields[field];
  });
  const [result] = await connection.execute(templates[variant], params);

  emit({
    type: 'sql',
    site,
    variant,
    protocol: 'prepared',
    bindings: bindings.map(({ source, field }, index) => ({
      slot: index + 1, source, field, treatment: 'bound',
    })),
    selectors,
    ...(Array.isArray(result) ? { rowCount: result.length } : { affectedRows: result.affectedRows }),
  });
  return result;
}
