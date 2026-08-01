// 簡易 SVG 圖表：圓餅圖與長條圖，無外部套件依賴
const PALETTE = ['#0d9488', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#22c55e', '#0ea5e9', '#a855f7', '#84cc16', '#f97316'];

function polarToCartesian(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function arcPath(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function renderPieChart(container, data) {
  // data: [{label, value, color}]
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    container.innerHTML = '<div class="empty-chart">尚無資料</div>';
    return;
  }
  const size = 200;
  const cx = size / 2, cy = size / 2, r = size / 2 - 4;
  let angle = 0;
  let paths = '';
  data.forEach((d) => {
    const sweep = (d.value / total) * 360;
    if (sweep > 0.001) {
      const end = angle + sweep;
      paths += `<path d="${arcPath(cx, cy, r, angle, Math.min(end, 359.99))}" fill="${d.color}"><title>${d.label}</title></path>`;
      angle = end;
    }
  });
  const svg = `<svg viewBox="0 0 ${size} ${size}" class="pie-svg">${paths}<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="var(--card-bg)"/></svg>`;
  container.innerHTML = svg;
}

function renderBarChart(container, data, opts = {}) {
  // data: [{label, income, expense}]
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const rows = data.map((d) => {
    const incomeW = (d.income / max) * 100;
    const expenseW = (d.expense / max) * 100;
    return `
      <div class="bar-row">
        <div class="bar-label">${d.label}</div>
        <div class="bar-track">
          <div class="bar-fill income" style="width:${incomeW}%"></div>
        </div>
        <div class="bar-track">
          <div class="bar-fill expense" style="width:${expenseW}%"></div>
        </div>
      </div>`;
  }).join('');
  container.innerHTML = rows;
}
