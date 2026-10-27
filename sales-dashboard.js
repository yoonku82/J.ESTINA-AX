/* Sales board: integer KRW at the boundary; all displayed money is KRW 100 million. */
(() => {
  'use strict';
  const A = window.AXSales;
  let today = A.koreaDate();
  const periods = {day: '일', month: '월', quarter: '분기', ytd: '누적'};
  const money = value => value === null ? '미집계' : (value / 1e8).toLocaleString('ko-KR', {maximumFractionDigits: 2});
  const percent = (value, target) => target > 0 && value !== null ? `${fmt(value / target * 100)}%` : '산출 안 함';
  const options = dict => Object.entries(dict).map(([key, name]) => `<option value="${key}">${safe(name)}</option>`).join('');
  const state = {date: today, period: 'month', product: 'all', channel: 'all', source: 'demo', requested: 'demo', data: A.createDemoData(today), loading: false, error: '', received: null};
  let requestId = 0;
  let activeController;
  const board = document.createElement('div');
  board.id = 'salesDashboard';
  board.innerHTML = `
    <div class="sales-heading"><div><span class="kicker">DAILY SALES MONITOR</span><h3>매일 확인하는 매출 현황판</h3><p>ERP에 등록된 매출을 품목과 채널별로 한눈에 확인합니다.</p></div><span id="salesSource" class="sales-source"></span></div>
    <div class="sales-toolbar">
      <label>조회 기준일<input id="salesDate" type="date" value="${today}" max="${today}" required></label>
      <label>품목<select id="salesProduct">${options({all:'전체 품목',...A.PRODUCTS})}</select></label>
      <label>채널<select id="salesChannel">${options({all:'전체 채널',...A.CHANNELS})}</select></label>
      <label>데이터<select id="salesMode"><option value="demo">샘플 데이터</option><option value="erp">ERP 데이터</option></select></label>
      <button class="outline" id="refreshSales">새로고침 ↻</button>
    </div>
    <div class="sales-connection" id="salesConnection" role="status" aria-live="polite"></div>
    <div class="sales-periods" role="group" aria-label="매출 조회 기간">${Object.entries(periods).map(([key,label]) => `<button data-sales-period="${key}" aria-pressed="${key === state.period}">${label === '누적' ? '연초부터 누적' : label + ' 매출'}</button>`).join('')}</div>
    <div id="salesSummary" class="sales-summary"></div>
    <div class="sales-section-heading"><h3 id="salesRangeTitle"></h3><span>금액 단위: 억원</span></div>
    <div class="sales-goal-layout">
      <article class="sales-panel sales-goal-inputs"><div class="sales-section-heading"><h3>목표 설정</h3><span>단위: 억원</span></div><p>선택한 기간·품목·채널의 목표를 입력하세요.</p><div class="sales-input-pair"><label>목표 매출 (억원)<input type="number" id="salesRevenueTarget" min="0" step="0.01" required></label><label>목표 영업이익 (억원)<input type="number" id="salesProfitTarget" step="0.01" required></label></div><p id="salesGoalNote" class="small-note"></p><p id="salesTargetStorageNote" class="small-note"></p></article>
      <div id="salesGoals" class="sales-goals"></div>
    </div>
    <article class="sales-panel sales-quarter-panel"><div class="sales-section-heading"><div><span class="kicker">QUARTERLY PERFORMANCE</span><h3>분기별 매출 · 영업이익</h3></div><div class="sales-legend"><span><i class="sales-key"></i>매출</span><span><i class="profit-key"></i>영업이익</span></div></div><div id="salesQuarterChart" class="sales-quarter-chart"></div><p id="salesQuarterNote" class="small-note"></p><div class="sales-table-scroll"><table id="salesQuarterTable"></table></div></article>
    <article class="sales-panel"><div class="sales-section-heading"><div><span class="kicker">PRODUCT × CHANNEL</span><h3>품목·채널별 매출 현황</h3></div><button id="exportSales" class="outline">조회 내역 CSV ↓</button></div><div class="sales-table-scroll"><table id="salesBreakdown"></table></div><p class="small-note">매출은 ERP 등록 기준 순매출이며 반품·취소는 차감합니다. 영업이익은 원가·비용이 수신된 범위만 집계하며, 미수신 값은 ‘미집계’로 표시합니다.</p></article>
    <details class="sales-integration"><summary>ERP 연결 및 데이터 기준 안내</summary><p>현재 샘플 데이터로 화면을 체험할 수 있습니다. 담당 IT 부서에서 ERP 조회 연결을 구성한 뒤 ‘ERP 데이터’를 선택하면 60초마다 최신 등록 내용을 확인합니다. 매출 등록 시점과 회계 마감 시점에 따라 차이가 있으며 영업이익은 비용 반영 전 잠정 수치일 수 있습니다.</p><p>품목은 주얼리·핸드백·로만손, 채널은 온라인·오프라인·글로벌 기준입니다. 세부 채널과 ERP 코드의 대응은 실제 연결 시 확정합니다. 연결 실패 시 샘플을 실제 실적으로 표시하지 않습니다.</p></details>`;
  $('#analyticsTabs').after(board);
  analysisNames.sales = '매출 현황';

  function selection(extra = {}) { return {date: state.date, period: state.period, product: state.product, channel: state.channel, ...extra}; }
  function aggregate(extra) { return A.summarize(state.data.records, selection(extra)); }
  function rangeLabel(summary) { return summary.end ? `${summary.start} ~ ${summary.end}` : '집계 전'; }
  function hasAmount(summary, key) { return summary.recordCount ? summary[key] : null; }
  function sourceStatus() {
    $('#salesSource').textContent = state.source === 'demo' ? '샘플 데이터 · 실제 실적 아님' : 'ERP 수신 데이터';
    $('#salesSource').classList.toggle('erp', state.source === 'erp');
    const stamp = new Date(state.data.asOf).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', hour12: false});
    const stale = state.source === 'erp' && Date.now() - Date.parse(state.data.asOf) > 5 * 60 * 1000;
    $('#salesConnection').textContent = state.loading ? 'ERP 등록 데이터를 확인하고 있습니다…' : state.error ? state.error + (state.source==='erp' ? ` · 데이터 기준 ${stamp} (한국 시간)` : '') : (state.source === 'demo' ? 'ERP 미연결 · 샘플로 조회 중입니다.' : `${stale ? '최근 데이터 수신 지연 · ' : ''}60초마다 갱신 · 데이터 기준 ${stamp} (한국 시간)${state.received ? ' · 최근 확인 ' + state.received.toLocaleTimeString('ko-KR', {timeZone:'Asia/Seoul',hour12:false}) : ''}`);
    $('#salesConnection').classList.toggle('error', !!state.error || stale);
    $('#refreshSales').disabled = state.loading;
    $('#insightsView > .section-head .demo').textContent = analysisType === 'sales' ? (state.source === 'demo' ? '샘플 데이터 · ERP 미연결' : 'ERP 수신 · 손익 잠정치') : '100% 가상 데이터 · 실제 실적 아님';
  }
  function targetKey() { return `ax-sales-goals-v1:${state.source}:${aggregate().start}:${state.period}:${state.product}:${state.channel}`; }
  function defaults(summary) {
    const value = n => Number(Math.max(0, n / 1e8).toFixed(2));
    return {sales: value(summary.sales * 1.08), profit: value((summary.operatingProfit || 0) * 1.1)};
  }
  function setTargets(summary) {
    let targets = null;
    try { targets = JSON.parse(localStorage.getItem(targetKey())); } catch {}
    if (!targets || !Number.isFinite(targets.sales) || targets.sales < 0 || !Number.isFinite(targets.profit)) targets = state.source === 'demo' ? defaults(summary) : {sales: 0, profit: 0};
    $('#salesRevenueTarget').value = targets.sales;
    $('#salesProfitTarget').value = targets.profit;
    drawGoals();
  }
  function drawGoals() {
    const salesInput = $('#salesRevenueTarget'), profitInput = $('#salesProfitTarget');
    if (!salesInput.checkValidity() || !profitInput.checkValidity()) {
      $('#salesGoalNote').textContent = '목표 매출은 0 이상, 목표 영업이익은 숫자로 입력하세요. 소수점 둘째 자리까지 입력할 수 있습니다.';
      $('#salesGoals').innerHTML = '<p class="sales-panel">유효한 목표를 입력하면 비교 결과를 표시합니다.</p>';
      return;
    }
    const targets = {sales: Number(salesInput.value), profit: Number(profitInput.value)};
    const summary = aggregate();
    $('#salesGoalNote').textContent = '1억원 = 100,000,000원 · 목표와 실적에 같은 단위를 적용합니다.';
    $('#salesGoals').innerHTML = [['매출',hasAmount(summary,'sales'),targets.sales*1e8],['영업이익',hasAmount(summary,'operatingProfit'),targets.profit*1e8]].map(([label,actual,target]) => {
      const max = Math.max(Math.abs(actual || 0), Math.abs(target), 1);
      return `<article class="sales-panel sales-goal"><h4>${label} 목표 대비 <small>억원</small></h4>${[['목표',target,'target'],['실적',actual,'actual']].map(([name,value,kind]) => `<div class="sales-goal-row"><span>${name}</span><div class="sales-goal-track"><div class="${kind} ${value < 0 ? 'negative' : ''}" style="width:${value === null ? 0 : Math.abs(value)/max*100}%"></div></div><b>${money(value)}</b></div>`).join('')}<p>목표 대비 차이 <strong>${actual === null ? '미집계' : (actual-target > 0 ? '+' : '') + money(actual-target) + '억원'}</strong> · 달성률 <strong>${percent(actual,target)}</strong></p>${actual < 0 || target < 0 ? '<small>음수는 손실/차감입니다. 막대 길이는 절댓값이며 부호는 금액에 표시합니다.</small>' : ''}</article>`;
    }).join('');
  }
  function chart(quarters) {
    const width = 820, height = 300, left = 65, right = 20, top = 35, bottom = 40;
    const numbers = quarters.flatMap(q => q.recordCount ? [q.sales,q.operatingProfit].filter(n => n !== null) : []);
    const high = Math.max(0,...numbers), low = Math.min(0,...numbers);
    const span = high-low || 1e8;
    const max = high ? high + span * .18 : (low ? 0 : 1e8);
    const min = low ? low - span * .18 : 0;
    const y = value => top + (max-value)/(max-min)*(height-top-bottom);
    const baseline = y(0), group = (width-left-right)/4;
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="quarterChartTitle quarterChartDesc"><title id="quarterChartTitle">분기별 매출 및 영업이익 세로 막대 그래프</title><desc id="quarterChartDesc">단위 억원. 파란색은 매출, 분홍색은 영업이익입니다. 값은 아래 표에서 확인할 수 있습니다. 손실은 0선 아래로 표시합니다.</desc>`;
    for (let i=0;i<=4;i++) {
      const value = min+(max-min)*i/4;
      svg += `<line x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}" class="sales-grid-line"/><text x="${left-10}" y="${y(value)+4}" text-anchor="end" class="sales-axis">${money(value)}</text>`;
    }
    svg += `<line x1="${left}" x2="${width-right}" y1="${baseline}" y2="${baseline}" class="sales-zero-line"/>`;
    quarters.forEach((q,i) => {
      const center = left+group*(i+.5);
      for (const [key,offset,kind] of [['sales',-36,'sales'],['operatingProfit',3,'profit']]) {
        const value = q.recordCount ? q[key] : null;
        if (value === null) continue;
        const barY = Math.min(y(value),baseline), barHeight = Math.abs(y(value)-baseline);
        svg += `<rect data-quarter="${i+1}" data-series="${key}" data-value="${value}" x="${center+offset}" y="${barY}" width="30" height="${barHeight}" rx="3" class="sales-column ${kind}${value < 0 ? ' negative' : ''}"><title>${q.label} ${kind==='sales'?'매출':'영업이익'} ${money(value)}억원</title></rect><text x="${center+offset+15}" y="${value < 0 ? y(value)+16 : y(value)-8}" text-anchor="middle" class="sales-value">${money(value)}</text>`;
      }
      svg += `<text x="${center}" y="${height-13}" text-anchor="middle" class="sales-quarter-label">${safe(q.label)}${q.recordCount?'':' · 데이터 없음'}</text>`;
    });
    return svg+'</svg>';
  }
  function detailRows() {
    return Object.entries(A.PRODUCTS).filter(([p]) => state.product === 'all' || p === state.product).flatMap(([product,pname]) => Object.entries(A.CHANNELS).filter(([c]) => state.channel === 'all' || c === state.channel).map(([channel,cname]) => ({pname,cname,...aggregate({product,channel})})));
  }
  function drawBoard(resetTargets = true) {
    sourceStatus();
    $('#salesTargetStorageNote').textContent = state.source === 'demo'
      ? '목표는 이 브라우저에 저장됩니다. 샘플의 초기 목표는 예시이며, 실제 사업계획과 다릅니다.'
      : '목표는 이 브라우저에 저장됩니다. 예시 목표와 구분되며, 실제 사업계획을 직접 입력하세요. 0 이하 목표의 달성률은 산출하지 않습니다.';
    document.querySelectorAll('[data-sales-period]').forEach(el => el.setAttribute('aria-pressed',el.dataset.salesPeriod === state.period));
    $('#salesSummary').innerHTML = Object.entries(periods).map(([period,label]) => {
      const summary = aggregate({period});
      return `<button class="sales-summary-card ${period===state.period?'selected':''}" data-summary-period="${period}"><span>${period==='ytd'?'연초부터 누적':label+' 매출'}</span><strong>${money(hasAmount(summary,'sales'))}<small>${summary.recordCount?'억원':''}</small></strong><small>${rangeLabel(summary)}</small><span class="sales-card-profit">영업이익 ${money(hasAmount(summary,'operatingProfit'))}${summary.operatingProfit===null?'':'억원'}</span></button>`;
    }).join('');
    board.querySelectorAll('[data-summary-period]').forEach(el => el.onclick=() => {state.period=el.dataset.summaryPeriod;drawBoard();});
    const summary = aggregate();
    $('#salesRangeTitle').textContent = `${periods[state.period]} 실적 · ${rangeLabel(summary)}`;
    if (resetTargets) setTargets(summary); else drawGoals();
    const quarters = A.quarterly(state.data.records, selection());
    $('#salesQuarterChart').innerHTML = chart(quarters);
    $('#salesQuarterNote').textContent = `${state.date.slice(0,4)}년 · ${A.PRODUCTS[state.product] || '전체 품목'} / ${A.CHANNELS[state.channel] || '전체 채널'} · 조회 기준일까지 집계합니다. 진행 중인 분기는 부분 실적이며, 데이터가 없는 분기는 미집계입니다. 단위: 억원.`;
    $('#salesQuarterTable').innerHTML = '<caption class="sr-only">분기 실적 수치 · 단위 억원</caption><thead><tr><th scope="col">분기</th><th scope="col">집계 기간</th><th scope="col">매출 (억원)</th><th scope="col">영업이익 (억원)</th></tr></thead><tbody>'+quarters.map(q => `<tr><th scope="row">${safe(q.label)}</th><td>${rangeLabel(q)}</td><td>${money(hasAmount(q,'sales'))}</td><td>${money(hasAmount(q,'operatingProfit'))}</td></tr>`).join('')+'</tbody>';
    $('#salesBreakdown').innerHTML = '<caption class="sr-only">품목·채널별 실적 · '+rangeLabel(summary)+'</caption><thead><tr><th scope="col">품목</th><th scope="col">채널</th><th scope="col">매출 (억원)</th><th scope="col">영업이익 (억원)</th><th scope="col">영업이익률</th></tr></thead><tbody>'+detailRows().map(row => `<tr><th scope="row">${safe(row.pname)}</th><td>${safe(row.cname)}</td><td>${money(hasAmount(row,'sales'))}</td><td>${money(hasAmount(row,'operatingProfit'))}</td><td>${row.operatingProfit===null || row.sales<=0 ? '산출 안 함' : fmt(row.operatingProfit/row.sales*100)+'%'}</td></tr>`).join('')+`</tbody><tfoot><tr><th scope="row" colspan="2">합계</th><td>${money(hasAmount(summary,'sales'))}</td><td>${money(hasAmount(summary,'operatingProfit'))}</td><td>${summary.operatingProfit===null || summary.sales<=0 ? '산출 안 함' : fmt(summary.operatingProfit/summary.sales*100)+'%'}</td></tr></tfoot>`;
  }
  async function refresh() {
    let reloadTargets = false;
    const currentDay = A.koreaDate();
    if (state.date === today && currentDay !== today) {
      state.date = currentDay;
      $('#salesDate').value = currentDay;
      reloadTargets = true;
    }
    today = currentDay;
    $('#salesDate').max = today;
    const id = ++requestId;
    activeController?.abort();
    state.error = '';
    if (state.requested === 'demo') {
      state.data = A.createDemoData(state.date.slice(0,4) === today.slice(0,4) ? today : state.date);
      reloadTargets ||= state.source !== 'demo';
      state.source = 'demo'; state.loading = false; drawBoard(reloadTargets); return;
    }
    state.loading = true; sourceStatus();
    const controller = new AbortController(); activeController = controller;
    const timeout = setTimeout(() => controller.abort(),15000);
    try {
      const response = await fetch(`/api/erp/sales?year=${state.date.slice(0,4)}`, {credentials:'same-origin',signal:controller.signal,headers:{Accept:'application/json'},cache:'no-store'});
      if (!response.ok) throw new Error('ERP 응답 오류');
      const data = A.validatePayload(await response.json());
      if (id !== requestId) return;
      // Reject a snapshot that cannot be safely aggregated before replacing the last success.
      A.summarize(data.records, selection({period:'ytd'}));
      reloadTargets ||= state.source !== 'erp';
      state.data = data; state.source = 'erp'; state.received = new Date();
    } catch (error) {
      if (id !== requestId) return;
      state.error = `ERP 연결 또는 데이터 확인에 실패했습니다. ${state.source==='demo'?'샘플 데이터 표시를 유지합니다.':'마지막 수신 데이터를 유지합니다.'} 담당 IT 부서에 연결 상태를 확인해 주세요.`;
    } finally {
      clearTimeout(timeout);
      if (id === requestId) {state.loading=false;drawBoard(reloadTargets);}
    }
  }
  $('#salesDate').onchange = () => {
    const el = $('#salesDate');
    if (!el.checkValidity()) {el.reportValidity();return;}
    const changedYear = state.date.slice(0,4) !== el.value.slice(0,4);
    state.date=el.value;
    if (changedYear) refresh();
    drawBoard();
  };
  for (const [selector,key] of [['#salesProduct','product'],['#salesChannel','channel']]) $(selector).onchange = event => {state[key]=event.target.value;drawBoard();};
  board.querySelectorAll('[data-sales-period]').forEach(el => el.onclick=() => {state.period=el.dataset.salesPeriod;drawBoard();});
  $('#salesMode').onchange = event => {state.requested=event.target.value;refresh();};
  $('#refreshSales').onclick=refresh;
  for (const id of ['#salesRevenueTarget','#salesProfitTarget']) $(id).oninput = () => {
    drawGoals();
    if ($('#salesRevenueTarget').checkValidity() && $('#salesProfitTarget').checkValidity()) {
      try {localStorage.setItem(targetKey(),JSON.stringify({sales:Number($('#salesRevenueTarget').value),profit:Number($('#salesProfitTarget').value)}));} catch {$('#salesGoalNote').textContent='목표를 브라우저에 저장하지 못했습니다. 이번 화면에서만 적용됩니다.';}
    }
  };
  $('#exportSales').onclick = () => {
    const summary = aggregate();
    const rows = [['데이터 구분',state.source==='demo'?'샘플 · 실제 실적 아님':'ERP 수신'],['집계 기간',summary.start,summary.end],['금액 단위','억원'],['품목','채널','매출 (억원)','영업이익 (억원)'],...detailRows().map(r => [r.pname,r.cname,r.recordCount ? r.sales/1e8 : '미집계',r.operatingProfit===null?'미집계':r.operatingProfit/1e8]),['합계','',summary.recordCount ? summary.sales/1e8 : '미집계',summary.operatingProfit===null?'미집계':summary.operatingProfit/1e8]];
    downloadText(`JESTINA-매출현황-${state.date}.csv`,rows.map(row => row.map(value => '"'+String(value).replaceAll('"','""')+'"').join(',')).join('\n'),'text/csv;charset=utf-8');
  };
  const priorAnalysis = drawAnalysis;
  drawAnalysis = function() {
    priorAnalysis();
    const isSales = analysisType === 'sales';
    board.hidden = !isSales;
    $('#insightsView > .analytics-controls').hidden = isSales;
    if (isSales) ['#metrics','.analysis-grid','.table-wrap','.definitions','#insightsView > .notice'].forEach(selector => {const el=$('#insightsView').querySelector(selector);if(el)el.hidden=true;});
    // Other tabs retain their existing, explicitly fictional monthly analysis.
    if (isSales) drawBoard(); else sourceStatus();
  };
  setInterval(() => {if(state.requested==='erp' && !state.loading && !document.hidden && view==='insights' && analysisType==='sales') refresh();},60000);
  drawAnalysis();
})();
