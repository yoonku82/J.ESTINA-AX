const test = require('node:test');
const assert = require('node:assert/strict');
const sales = require('../dist/sales-data.js');

const row = (id, date, amount, profit, product = 'jewelry', channel = 'online') => ({
  id, date, product, channel, sales: amount, operatingProfit: profit
});
const snapshot = records => ({ asOf: '2026-10-26T16:00:00+09:00', records });
const records = [
  row('prior-year', '2025-12-31', 999, 99),
  row('q1', '2026-01-01', 10000, 1000),
  row('q1-end', '2026-03-31', 20000, 2000),
  row('q2', '2026-04-01', 30000, 3000, 'bags', 'offline'),
  row('q3', '2026-09-30', 40000, 4000, 'romanson', 'global'),
  row('oct-start', '2026-10-01', 50000, 5000),
  row('today', '2026-10-26', 60000, 6000),
  row('refund', '2026-10-26', -10000, -2000),
  row('later', '2026-10-27', 999, 99)
];

test('day, month, quarter and YTD exclude later dates and other years', () => {
  const amounts = { day: 50000, month: 100000, quarter: 100000, ytd: 200000 };
  for (const [period, expected] of Object.entries(amounts)) {
    const actual = sales.summarize(records, { date: '2026-10-26', period });
    assert.equal(actual.sales, expected, period);
    assert.equal(actual.end, '2026-10-26');
  }
  assert.equal(sales.summarize(records, { date: '2026-10-26', period: 'day' }).operatingProfit, 4000);
});

test('product and channel filters preserve additivity', () => {
  const opts = { date: '2026-10-26', period: 'ytd' };
  const total = sales.summarize(records, opts).sales;
  for (const [key, dictionary] of [['product', sales.PRODUCTS], ['channel', sales.CHANNELS]]) {
    const subtotals = Object.keys(dictionary).map(value => sales.summarize(records, { ...opts, [key]: value }).sales);
    assert.equal(subtotals.reduce((sum, value) => sum + value, 0), total);
  }
  assert.equal(sales.summarize(records, { ...opts, product: 'bags', channel: 'online' }).recordCount, 0);
});

test('quarterly bars reconcile to YTD and handle quarter/year boundaries', () => {
  const options = { date: '2026-10-26' };
  const quarters = sales.quarterly(records, options);
  assert.deepEqual(quarters.map(q => q.sales), [30000, 30000, 40000, 100000]);
  assert.equal(quarters.reduce((sum, q) => sum + q.sales, 0), sales.summarize(records, { ...options, period: 'ytd' }).sales);
  assert.equal(quarters[3].end, '2026-10-26');
  const early = sales.quarterly(records, { date: '2026-01-01' });
  assert.equal(early[0].sales, 10000);
  assert.equal(early[1].end, null);
  assert.equal(early[1].recordCount, 0);
  assert.equal(early[1].operatingProfit, null);
  assert.equal(sales.summarize(records, { date: '2026-04-01', period: 'quarter' }).start, '2026-04-01');
});

test('missing costs are never silently treated as confirmed zero profit', () => {
  const rows = [row('a', '2026-10-26', 100, 10), row('b', '2026-10-26', 200, null)];
  const result = sales.summarize(rows, { date: '2026-10-26' });
  assert.equal(result.sales, 300);
  assert.equal(result.operatingProfit, null);
  assert.equal(result.recordCount, 2);
  const empty = sales.summarize([], { date: '2026-10-26' });
  assert.equal(empty.recordCount, 0);
  assert.equal(empty.operatingProfit, null);
  assert.equal(sales.summarize([row('zero', '2026-10-26', 0, 0)], { date: '2026-10-26' }).operatingProfit, 0);
});

test('validator accepts negative refunds and losses, preserves zero, clones rows', () => {
  const input = snapshot([row('refund', '2026-10-26', -15000, -1000), row('zero', '2026-10-26', 0, null)]);
  const output = sales.validatePayload(input);
  assert.deepEqual(output, input);
  assert.notEqual(output.records[0], input.records[0]);
  assert.equal(sales.summarize(output.records, { date: '2026-10-26' }).operatingProfit, null);
});

test('validator rejects malformed dates, duplicate rows, unknown codes and unsafe amounts', () => {
  const valid = row('a', '2026-10-26', 100, 10);
  const mutations = [
    { date: '2026-02-30' }, { date: '26-10-26' }, { product: 'unknown' }, { channel: 'unknown' },
    { sales: NaN }, { sales: Infinity }, { sales: 1.5 }, { sales: '100' },
    { sales: Number.MAX_SAFE_INTEGER + 1 }, { operatingProfit: undefined },
    { operatingProfit: '10' }, { operatingProfit: Infinity }, { id: '' }
  ];
  for (const mutation of mutations) assert.throws(() => sales.validatePayload(snapshot([{ ...valid, ...mutation }])));
  assert.throws(() => sales.validatePayload(snapshot([valid, { ...valid }])));
  assert.throws(() => sales.validatePayload({ asOf: '2026-10-26', records: [] }));
  assert.throws(() => sales.validatePayload({ asOf: '2026-02-30T12:00:00Z', records: [] }));
  assert.throws(() => sales.validatePayload({ asOf: '2026-10-26T12:00:00Z', records: null }));
});

test('Korean day boundary and leap day use a stable business date', () => {
  assert.equal(sales.koreaDate('2026-10-25T15:00:00Z'), '2026-10-26');
  assert.equal(sales.koreaDate('2026-10-25T14:59:59Z'), '2026-10-25');
  const leap = sales.createDemoData('2024-02-29');
  assert.equal(leap.records.length, 60 * 9);
  assert.throws(() => sales.createDemoData('2026-02-29'));
  assert.throws(() => sales.summarize([], { date: '2026-04-31' }));
});

test('demo has daily coverage for every product/channel and deterministic additive figures', () => {
  const demo = sales.createDemoData('2026-10-26');
  assert.equal(demo.records.length, 299 * 9);
  assert.deepEqual(demo.records, sales.createDemoData('2026-10-26').records);
  assert.equal(new Set(demo.records.map(record => record.date)).size, 299);
  assert.equal(demo.records.filter(record => record.date === '2026-10-26').length, 9);
  const quarterSum = sales.quarterly(demo.records, { date: '2026-10-26' }).reduce((sum, q) => sum + q.sales, 0);
  assert.equal(quarterSum, sales.summarize(demo.records, { date: '2026-10-26', period: 'ytd' }).sales);
});

test('overflow and invalid filter input fail explicitly', () => {
  assert.throws(() => sales.summarize([row('a', '2026-10-26', Number.MAX_SAFE_INTEGER, 0), row('b', '2026-10-26', 1, 0)], { date: '2026-10-26' }));
  assert.throws(() => sales.summarize(records, { date: '2026-10-26', period: 'week' }));
  assert.throws(() => sales.summarize(records, { date: '2026-10-26', channel: 'unknown' }));
  assert.throws(() => sales.quarterly(records, { date: '2026-10-26', product: 'unknown' }));
});

test('snapshot absolute bounds protect every filtered subtotal before accepting data', () => {
  const max = Number.MAX_SAFE_INTEGER;
  assert.doesNotThrow(() => sales.validatePayload(snapshot([
    row('boundary-a', '2026-10-26', max - 1, -(max - 1)),
    row('boundary-b', '2026-10-26', -1, 1)
  ])));
  assert.throws(() => sales.validatePayload(snapshot([
    row('sales-a', '2026-10-26', max, 0),
    row('sales-b', '2026-10-26', 1, 0)
  ])), /sales 절댓값/);
  assert.throws(() => sales.validatePayload(snapshot([
    row('profit-a', '2026-10-26', 0, max),
    row('profit-b', '2026-10-26', 0, 1)
  ])), /operatingProfit 절댓값/);
  // Cancellation must not bypass the conservative snapshot absolute bound.
  const positive = Math.floor(max / 2) + 1;
  assert.throws(() => sales.validatePayload(snapshot([
    row('cancel-sales-a', '2026-10-26', positive, 0, 'jewelry', 'online'),
    row('cancel-sales-b', '2026-10-26', -positive, 0, 'bags', 'offline')
  ])), /sales 절댓값/);
  assert.throws(() => sales.validatePayload(snapshot([
    row('cancel-profit-a', '2026-10-26', 0, positive, 'jewelry', 'online'),
    row('cancel-profit-b', '2026-10-26', 0, -positive, 'bags', 'offline')
  ])), /operatingProfit 절댓값/);
});
