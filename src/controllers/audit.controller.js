const auditRepository = require('../repositories/audit.repository');
const auditUtil = require('../utils/audit');

const PAGE_SIZE = 25;
const ENTITY_TYPES = [
  'sales_order',
  'delivery',
  'invoice',
  'payment',
  'inventory',
  'customer',
  'product',
  'category',
  'warehouse',
  'user',
  'auth',
];

function validDate(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const parsed = new Date(`${text}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? '' : text;
}

function buildQuery(filters, page) {
  const params = new URLSearchParams();
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.action) params.set('action', filters.action);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/audit?${query}` : '/audit';
}

function index(req, res) {
  const entityType = ENTITY_TYPES.includes(req.query.entityType) ? req.query.entityType : '';
  const action = auditUtil.ACTION_META[req.query.action] ? req.query.action : '';
  const dateFrom = validDate(req.query.dateFrom);
  const dateTo = validDate(req.query.dateTo);

  const requestedPage = Number.parseInt(req.query.page, 10);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const filters = { entityType, action, dateFrom, dateTo };
  const { rows, total } = auditRepository.list({
    ...filters,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageLinks = [];
  const from = Math.max(1, page - 2);
  const to = Math.min(pages, page + 2);
  for (let index = from; index <= to; index += 1) {
    pageLinks.push({ number: index, href: buildQuery(filters, index), active: index === page });
  }

  res.render('audit/index', {
    title: 'Audit trail',
    entries: rows.map((row) => ({
      ...auditUtil.describe(row),
      rawDetails: auditUtil.parseDetails(row),
    })),
    total,
    page,
    pages,
    pageLinks,
    filters,
    entityTypes: ENTITY_TYPES,
    entityLabels: auditUtil.ENTITY_LABELS,
    actions: Object.keys(auditUtil.ACTION_META),
    actionLabels: Object.fromEntries(
      Object.entries(auditUtil.ACTION_META).map(([key, value]) => [key, value.label])
    ),
    previousHref: page > 1 ? buildQuery(filters, page - 1) : null,
    nextHref: page < pages ? buildQuery(filters, page + 1) : null,
    resetHref: '/audit',
  });
}

module.exports = { index };
