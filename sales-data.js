/* Sales amounts are integer KRW. This module never contacts an ERP itself. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.AXSales = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PRODUCTS = Object.freeze({ jewelry: '주얼리', bags: '핸드백', romanson: '로만손' });
  const CHANNELS = Object.freeze({ online: '온라인', offline: '오프라인', global: '글로벌' });
  const WON_PER_EOK = 100000000;

  function koreaDate(value = new Date()) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error('올바른 기준 시각이 필요합니다.');
    return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  }

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(value + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }

  function requireDate(value) {
    if (!validDate(value)) throw new Error('기준일은 유효한 YYYY-MM-DD 날짜여야 합니다.');
    return value;
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('매출 데이터 응답 형식을 확인해 주세요.');
    }
    if (typeof payload.asOf !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(payload.asOf) ||
        !validDate(payload.asOf.slice(0, 10)) || !Number.isFinite(Date.parse(payload.asOf))) {
      throw new Error('asOf에는 시간대가 포함된 유효한 ISO 갱신 시각이 필요합니다.');
    }
    if (!Array.isArray(payload.records)) throw new Error('매출 records 배열이 필요합니다.');
    const ids = new Set();
    let absoluteSales = 0, absoluteProfit = 0;
    const records = payload.records.map((record, index) => {
      const fail = reason => { throw new Error(`매출 ${index + 1}행: ${reason}`); };
      if (!record || typeof record !== 'object' || Array.isArray(record)) fail('행 형식이 올바르지 않습니다.');
      if (typeof record.id !== 'string' || !record.id.trim() || record.id.length > 200) fail('고유 id가 필요합니다.');
      if (ids.has(record.id)) fail('중복 id입니다.');
      ids.add(record.id);
      if (!validDate(record.date)) fail('매출일이 올바르지 않습니다.');
      if (!Object.hasOwn(PRODUCTS, record.product)) fail('지원하지 않는 품목 코드입니다.');
      if (!Object.hasOwn(CHANNELS, record.channel)) fail('지원하지 않는 채널 코드입니다.');
      if (!Number.isSafeInteger(record.sales)) fail('sales는 원 단위의 안전한 정수여야 합니다.');
      if (record.operatingProfit !== null && !Number.isSafeInteger(record.operatingProfit)) {
        fail('operatingProfit은 원 단위 정수 또는 null이어야 합니다.');
      }
      // Bound all possible filtered sums, not only the net snapshot total.
      // Compare before adding so even the validation never performs an unsafe sum.
      const salesMagnitude = Math.abs(record.sales);
      const profitMagnitude = record.operatingProfit === null ? 0 : Math.abs(record.operatingProfit);
      if (salesMagnitude > Number.MAX_SAFE_INTEGER - absoluteSales) {
        fail('전체 sales 절댓값 합계가 원 단위 정수의 안전 범위를 초과합니다.');
      }
      if (profitMagnitude > Number.MAX_SAFE_INTEGER - absoluteProfit) {
        fail('전체 operatingProfit 절댓값 합계가 원 단위 정수의 안전 범위를 초과합니다.');
      }
      absoluteSales += salesMagnitude;
      absoluteProfit += profitMagnitude;
      return {
        id: record.id, date: record.date, product: record.product, channel: record.channel,
        sales: record.sales, operatingProfit: record.operatingProfit
      };
    });
    return { asOf: payload.asOf, records };
  }

  function filterOptions(options = {}) {
    const date = requireDate(options.date || koreaDate());
    const product = options.product || 'all';
    const channel = options.channel || 'all';
    if (product !== 'all' && !Object.hasOwn(PRODUCTS, product)) throw new Error('지원하지 않는 품목입니다.');
    if (channel !== 'all' && !Object.hasOwn(CHANNELS, channel)) throw new Error('지원하지 않는 채널입니다.');
    return { date, product, channel };
  }

  function sumRange(records, start, end, product, channel) {
    const selected = end === null ? [] : records.filter(row =>
      row.date >= start && row.date <= end &&
      (product === 'all' || row.product === product) &&
      (channel === 'all' || row.channel === channel));
    let sales = 0, operatingProfit = 0;
    let profitComplete = selected.length > 0;
    for (const record of selected) {
      sales += record.sales;
      if (record.operatingProfit === null) profitComplete = false;
      else operatingProfit += record.operatingProfit;
      if (!Number.isSafeInteger(sales) || !Number.isSafeInteger(operatingProfit)) {
        throw new Error('합계가 원 단위 정수의 안전 범위를 초과했습니다.');
      }
    }
    return { sales, operatingProfit: profitComplete ? operatingProfit : null, recordCount: selected.length, start, end };
  }

  function summarize(records, options = {}) {
    const { date, product, channel } = filterOptions(options);
    const period = options.period || 'day';
    const year = date.slice(0, 4);
    const month = Number(date.slice(5, 7));
    const quarterMonth = String(Math.floor((month - 1) / 3) * 3 + 1).padStart(2, '0');
    const starts = { day: date, month: date.slice(0, 7) + '-01', quarter: year + '-' + quarterMonth + '-01', ytd: year + '-01-01' };
    if (!Object.hasOwn(starts, period)) throw new Error('지원하지 않는 집계 기간입니다.');
    return sumRange(records, starts[period], date, product, channel);
  }

  function quarterly(records, options = {}) {
    const { date, product, channel } = filterOptions(options);
    const year = date.slice(0, 4);
    return [1, 2, 3, 4].map(quarter => {
      const month = String((quarter - 1) * 3 + 1).padStart(2, '0');
      const start = `${year}-${month}-01`;
      const quarterEnd = `${year}-${String(quarter * 3).padStart(2, '0')}-${quarter === 1 || quarter === 4 ? '31' : '30'}`;
      const end = date < start ? null : date < quarterEnd ? date : quarterEnd;
      return { label: quarter + '분기', quarter, ...sumRange(records, start, end, product, channel) };
    });
  }

  function createDemoData(date = koreaDate()) {
    requireDate(date);
    const records = [];
    const first = new Date(date.slice(0, 4) + '-01-01T00:00:00Z');
    const last = new Date(date + 'T00:00:00Z');
    const productShares = [.60, .32, .08];
    const channelShares = [.40, .51, .09];
    let day = 0;
    for (let cursor = first; cursor <= last; cursor = new Date(cursor.getTime() + 86400000), day++) {
      const businessDate = cursor.toISOString().slice(0, 10);
      const weekend = cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6;
      const season = 1 + cursor.getUTCMonth() * .018;
      const dailySales = (24000000 + (day % 11 - 5) * 230000) * season * (weekend ? 1.13 : 1);
      Object.keys(PRODUCTS).forEach((product, pi) => {
        Object.keys(CHANNELS).forEach((channel, ci) => {
          const sales = Math.round(dailySales * productShares[pi] * channelShares[ci]);
          const margin = .11 + pi * .012 - ci * .008 + (day % 7) * .002;
          records.push({
            id: `demo-${businessDate}-${product}-${channel}`, date: businessDate,
            product, channel, sales, operatingProfit: Math.round(sales * margin)
          });
        });
      });
    }
    const asOf = date === koreaDate() ? new Date().toISOString() : date + 'T23:59:59+09:00';
    return validatePayload({ asOf, records });
  }

  return Object.freeze({ PRODUCTS, CHANNELS, WON_PER_EOK, koreaDate, validatePayload, summarize, quarterly, createDemoData });
});
