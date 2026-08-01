// ---- 全域狀態 ----
const state = {
  view: 'home',
  month: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(),
  listMonth: (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })(),
};

const els = {
  view: document.getElementById('view'),
  topbarTitle: document.getElementById('topbar-title'),
  modalRoot: document.getElementById('modal-root'),
};

const VIEW_TITLES = { home: '記帳本', list: '明細', stats: '統計', settings: '設定' };
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// ---- 小工具 ----
function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function fmtMoney(n) {
  const cur = Store.getSettings().currency || 'NT$';
  return `${cur} ${Math.round(n).toLocaleString('zh-Hant')}`;
}
function monthLabel(y, m) { return `${y} 年 ${m + 1} 月`; }
function isSameMonth(dateStr, y, m) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.getFullYear() === y && d.getMonth() === m;
}
function dateLabelFull(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const t = new Date(); t.setHours(0,0,0,0);
  const diffDays = Math.round((t - d) / 86400000);
  const md = `${d.getMonth() + 1}月${d.getDate()}日`;
  const wd = `週${WEEKDAYS[d.getDay()]}`;
  if (diffDays === 0) return `今天 · ${md}`;
  if (diffDays === 1) return `昨天 · ${md}`;
  return `${md} ${wd}`;
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2000);
}
function shiftMonth(obj, delta) {
  let { y, m } = obj;
  m += delta;
  if (m < 0) { m = 11; y -= 1; }
  if (m > 11) { m = 0; y += 1; }
  return { y, m };
}

// ---- 主渲染 ----
function render() {
  els.topbarTitle.textContent = VIEW_TITLES[state.view];
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === state.view));
  document.getElementById('fab-add').style.display = (state.view === 'home' || state.view === 'list') ? '' : 'none';
  if (state.view === 'home') renderHome();
  else if (state.view === 'list') renderList();
  else if (state.view === 'stats') renderStats();
  else if (state.view === 'settings') renderSettings();
}

function txListToHTML(transactions, { showDate = false } = {}) {
  if (transactions.length === 0) {
    return `<div class="empty-state"><div class="big">🧾</div>目前沒有任何記帳紀錄</div>`;
  }
  if (!showDate) {
    return transactions.map(txItemHTML).join('');
  }
  const groups = {};
  transactions.forEach((t) => { (groups[t.date] ||= []).push(t); });
  const dates = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  return dates.map((date) => {
    const items = groups[date];
    const dayTotal = items.reduce((s, t) => s + (t.type === 'expense' ? -t.amount : t.amount), 0);
    return `
      <div class="tx-group-label">${dateLabelFull(date)} <span style="float:right">${dayTotal >= 0 ? '+' : ''}${fmtMoney(dayTotal)}</span></div>
      ${items.map(txItemHTML).join('')}
    `;
  }).join('');
}

function txItemHTML(t) {
  const cat = Store.getCategory(t.categoryId) || { icon: '❓', name: '未分類' };
  const sign = t.type === 'expense' ? '-' : '+';
  return `
    <div class="tx-item" data-id="${t.id}">
      <div class="tx-icon">${cat.icon}</div>
      <div class="tx-main">
        <div class="tx-cat">${cat.name}</div>
        ${t.note ? `<div class="tx-note">${escapeHTML(t.note)}</div>` : ''}
      </div>
      <div class="tx-amount ${t.type}">${sign}${fmtMoney(t.amount)}</div>
    </div>`;
}

function escapeHTML(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bindTxItemClicks(root) {
  root.querySelectorAll('.tx-item').forEach((el) => {
    el.addEventListener('click', () => {
      const tx = Store.state.transactions.find((t) => t.id === el.dataset.id);
      if (tx) openAddSheet(tx);
    });
  });
}

// ---- 首頁 ----
function renderHome() {
  const { y, m } = state.month;
  const all = Store.getTransactions();
  const monthTx = all.filter((t) => isSameMonth(t.date, y, m));
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;
  const recent = all.slice(0, 6);

  els.view.innerHTML = `
    <div class="month-nav">
      <button id="home-prev">‹</button>
      <div class="month-label">${monthLabel(y, m)}</div>
      <button id="home-next">›</button>
    </div>
    <div class="card summary-card">
      <div class="summary-item">
        <div class="label">本月結餘</div>
        <div class="balance-value">${fmtMoney(balance)}</div>
      </div>
      <div class="summary-row">
        <div class="summary-item">
          <div class="label">💰 收入</div>
          <div class="value">${fmtMoney(income)}</div>
        </div>
        <div class="summary-item">
          <div class="label">💸 支出</div>
          <div class="value">${fmtMoney(expense)}</div>
        </div>
      </div>
    </div>
    <div class="section-title">最近紀錄 <span class="link" id="see-all">查看全部</span></div>
    ${txListToHTML(recent)}
  `;

  document.getElementById('home-prev').onclick = () => { state.month = shiftMonth(state.month, -1); renderHome(); };
  document.getElementById('home-next').onclick = () => { state.month = shiftMonth(state.month, 1); renderHome(); };
  document.getElementById('see-all').onclick = () => { state.view = 'list'; render(); };
  bindTxItemClicks(els.view);
}

// ---- 明細 ----
function renderList() {
  const { y, m } = state.listMonth;
  const all = Store.getTransactions().filter((t) => isSameMonth(t.date, y, m));

  els.view.innerHTML = `
    <div class="month-nav">
      <button id="list-prev">‹</button>
      <div class="month-label">${monthLabel(y, m)}</div>
      <button id="list-next">›</button>
    </div>
    ${txListToHTML(all, { showDate: true })}
  `;

  document.getElementById('list-prev').onclick = () => { state.listMonth = shiftMonth(state.listMonth, -1); renderList(); };
  document.getElementById('list-next').onclick = () => { state.listMonth = shiftMonth(state.listMonth, 1); renderList(); };
  bindTxItemClicks(els.view);
}

// ---- 統計 ----
function renderStats() {
  const { y, m } = state.month;
  const all = Store.getTransactions();
  const monthTx = all.filter((t) => isSameMonth(t.date, y, m));
  const expenseTx = monthTx.filter((t) => t.type === 'expense');
  const income = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = expenseTx.reduce((s, t) => s + t.amount, 0);

  const byCat = {};
  expenseTx.forEach((t) => { byCat[t.categoryId] = (byCat[t.categoryId] || 0) + t.amount; });
  const catRows = Object.entries(byCat)
    .map(([catId, amt], i) => ({ catId, amt, color: PALETTE[i % PALETTE.length] }))
    .sort((a, b) => b.amt - a.amt);

  const pieData = catRows.map((r) => ({ label: Store.getCategory(r.catId)?.name || '未分類', value: r.amt, color: r.color }));

  // 近 6 個月 收入/支出 長條圖
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const dt = shiftMonth({ y, m }, -i);
    const tx = all.filter((t) => isSameMonth(t.date, dt.y, dt.m));
    trend.push({
      label: `${dt.m + 1}月`,
      income: tx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0),
      expense: tx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    });
  }

  els.view.innerHTML = `
    <div class="month-nav">
      <button id="stats-prev">‹</button>
      <div class="month-label">${monthLabel(y, m)}</div>
      <button id="stats-next">›</button>
    </div>

    <div class="card">
      <div class="section-title">支出分類佔比</div>
      <div class="pie-wrap"><div id="pie-container"></div></div>
      <div class="legend">
        ${catRows.length === 0 ? `<div class="empty-chart">本月尚無支出</div>` : catRows.map((r) => {
          const cat = Store.getCategory(r.catId) || { name: '未分類' };
          const pct = expense > 0 ? Math.round((r.amt / expense) * 100) : 0;
          return `<div class="legend-row"><span class="legend-dot" style="background:${r.color}"></span><span class="legend-name">${cat.name}</span><span class="legend-pct">${pct}%</span><span class="legend-amt">${fmtMoney(r.amt)}</span></div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="section-title">近 6 個月收支趨勢</div>
      <div id="bar-container"></div>
      <div class="legend-mini">
        <span><span class="dot-inline" style="background:var(--income)"></span>收入</span>
        <span><span class="dot-inline" style="background:var(--expense)"></span>支出</span>
      </div>
    </div>
  `;

  renderPieChart(document.getElementById('pie-container'), pieData);
  renderBarChart(document.getElementById('bar-container'), trend);

  document.getElementById('stats-prev').onclick = () => { state.month = shiftMonth(state.month, -1); renderStats(); };
  document.getElementById('stats-next').onclick = () => { state.month = shiftMonth(state.month, 1); renderStats(); };
}

// ---- 設定 ----
function renderSettings() {
  const expCats = Store.getCategories('expense');
  const incCats = Store.getCategories('income');

  els.view.innerHTML = `
    <div class="card">
      <div class="section-title">支出分類</div>
      <div class="chip-wrap" id="exp-cat-chips">
        ${expCats.map((c) => `<span class="tag-chip" data-id="${c.id}">${c.icon} ${c.name} <span class="x" data-del="${c.id}">✕</span></span>`).join('')}
        <span class="tag-chip" id="add-exp-cat" style="cursor:pointer">＋ 新增</span>
      </div>
    </div>
    <div class="card">
      <div class="section-title">收入分類</div>
      <div class="chip-wrap" id="inc-cat-chips">
        ${incCats.map((c) => `<span class="tag-chip" data-id="${c.id}">${c.icon} ${c.name} <span class="x" data-del="${c.id}">✕</span></span>`).join('')}
        <span class="tag-chip" id="add-inc-cat" style="cursor:pointer">＋ 新增</span>
      </div>
    </div>
    <div class="card">
      <div class="section-title">幣別符號</div>
      <input type="text" id="currency-input" maxlength="5" value="${Store.getSettings().currency || 'NT$'}" />
    </div>
    <div class="card">
      <div class="section-title">資料管理</div>
      <button class="btn-secondary" id="export-btn">匯出備份 (JSON)</button>
      <button class="btn-secondary" id="import-btn">匯入備份</button>
      <input type="file" id="import-file" accept="application/json" style="display:none" />
      <button class="btn-danger" id="clear-btn">清除所有資料</button>
    </div>
    <div class="card" style="text-align:center; color:var(--text-muted); font-size:12.5px;">
      記帳本 · 資料只儲存在此裝置本機瀏覽器中
    </div>
  `;

  document.querySelectorAll('#exp-cat-chips .x, #inc-cat-chips .x').forEach((x) => {
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      const res = Store.deleteCategory(x.dataset.del);
      if (!res.ok) { toast('此分類已有紀錄使用，無法刪除'); return; }
      renderSettings();
    });
  });
  document.getElementById('add-exp-cat').onclick = () => openCategorySheet('expense');
  document.getElementById('add-inc-cat').onclick = () => openCategorySheet('income');

  document.getElementById('currency-input').addEventListener('change', (e) => {
    Store.updateSettings({ currency: e.target.value || 'NT$' });
    toast('已更新幣別符號');
  });

  document.getElementById('export-btn').onclick = () => {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `記帳本備份_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = document.getElementById('import-file');
  document.getElementById('import-btn').onclick = () => importFile.click();
  importFile.onchange = () => {
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        Store.importJSON(reader.result);
        toast('匯入成功');
        render();
      } catch (e) {
        toast('匯入失敗：檔案格式不正確');
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  };

  document.getElementById('clear-btn').onclick = () => {
    openConfirmSheet('清除所有資料？', '此動作會刪除所有記帳紀錄與自訂分類，且無法復原。', () => {
      Store.clearAll();
      toast('已清除所有資料');
      render();
    });
  };
}

// ---- 新增/編輯分類 Sheet ----
function openCategorySheet(type) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-header"><h2>新增${type === 'expense' ? '支出' : '收入'}分類</h2><button class="icon-btn" id="close-cat-sheet" style="background:var(--bg);color:var(--text)">✕</button></div>
      <div class="field-label">圖示 (輸入一個 emoji)</div>
      <input type="text" id="cat-icon" maxlength="4" placeholder="🏷️" />
      <div class="field-label">分類名稱</div>
      <input type="text" id="cat-name" maxlength="10" placeholder="例如：寵物" />
      <button class="btn-primary" id="save-cat">儲存</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('close-cat-sheet').onclick = () => overlay.remove();
  document.getElementById('save-cat').onclick = () => {
    const name = document.getElementById('cat-name').value.trim();
    const icon = document.getElementById('cat-icon').value.trim() || '🏷️';
    if (!name) { toast('請輸入分類名稱'); return; }
    Store.addCategory({ type, name, icon });
    overlay.remove();
    renderSettings();
    toast('已新增分類');
  };
}

function openConfirmSheet(title, desc, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `
    <div class="sheet">
      <div class="sheet-header"><h2>${title}</h2></div>
      <p style="color:var(--text-muted); font-size:13.5px;">${desc}</p>
      <button class="btn-danger" id="confirm-yes" style="background:var(--expense); color:#fff;">確定刪除</button>
      <button class="btn-secondary" id="confirm-no">取消</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('confirm-no').onclick = () => overlay.remove();
  document.getElementById('confirm-yes').onclick = () => { overlay.remove(); onConfirm(); };
}

// ---- 新增/編輯交易 Sheet ----
function openAddSheet(existingTx) {
  const editing = !!existingTx;
  const sheetState = {
    type: existingTx?.type || 'expense',
    amount: existingTx ? String(existingTx.amount) : '',
    categoryId: existingTx?.categoryId || null,
    date: existingTx?.date || todayStr(),
    note: existingTx?.note || '',
  };
  if (!sheetState.categoryId) {
    const first = Store.getCategories(sheetState.type)[0];
    sheetState.categoryId = first ? first.id : null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  document.body.appendChild(overlay);

  function draw() {
    const cats = Store.getCategories(sheetState.type);
    overlay.innerHTML = `
      <div class="sheet tx-sheet">
        <div class="tx-top-row">
          <div class="type-toggle">
            <button data-type="expense" class="${sheetState.type === 'expense' ? 'active expense' : ''}">支出</button>
            <button data-type="income" class="${sheetState.type === 'income' ? 'active income' : ''}">收入</button>
          </div>
          <button class="icon-btn" id="close-add-sheet" style="background:var(--bg);color:var(--text)">✕</button>
        </div>
        <div class="amount-input-wrap">
          <span class="currency">${Store.getSettings().currency || 'NT$'}</span>
          <input class="amount-input" id="amount-display" type="text" inputmode="none" readonly value="${sheetState.amount || '0'}" />
        </div>
        <div class="keypad" id="keypad">
          ${['1','2','3','4','5','6','7','8','9','.','0','⌫'].map((k) => `<button data-key="${k}" class="${k === '⌫' ? 'op' : ''}">${k}</button>`).join('')}
        </div>
        <div class="category-grid" id="cat-grid">
          ${cats.map((c) => `<div class="category-chip ${c.id === sheetState.categoryId ? 'selected' : ''}" data-cat="${c.id}"><span class="emoji">${c.icon}</span><span>${c.name}</span></div>`).join('')}
        </div>
        <div class="tx-bottom-row">
          <input type="date" class="pill-input" id="date-input" value="${sheetState.date}" />
          <input type="text" class="pill-input" id="note-input" placeholder="新增備註" value="${escapeHTML(sheetState.note)}" />
        </div>
        <button class="btn-primary" id="save-tx">${editing ? '儲存變更' : '新增紀錄'}</button>
        ${editing ? `<button class="btn-danger-compact" id="delete-tx">刪除此紀錄</button>` : ''}
      </div>
    `;
    bindSheetEvents();
  }

  function bindSheetEvents() {
    document.getElementById('close-add-sheet').onclick = () => overlay.remove();
    overlay.querySelectorAll('.type-toggle button').forEach((b) => {
      b.onclick = () => {
        sheetState.type = b.dataset.type;
        const first = Store.getCategories(sheetState.type)[0];
        sheetState.categoryId = first ? first.id : null;
        draw();
      };
    });
    overlay.querySelectorAll('#cat-grid .category-chip').forEach((c) => {
      c.onclick = () => { sheetState.categoryId = c.dataset.cat; draw(); };
    });
    document.getElementById('keypad').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const key = btn.dataset.key;
      if (key === '⌫') {
        sheetState.amount = sheetState.amount.slice(0, -1);
      } else if (key === '.') {
        if (!sheetState.amount.includes('.')) sheetState.amount += '.';
      } else {
        if (sheetState.amount === '0') sheetState.amount = key;
        else sheetState.amount += key;
      }
      document.getElementById('amount-display').value = sheetState.amount || '0';
    });
    document.getElementById('date-input').addEventListener('change', (e) => { sheetState.date = e.target.value; });
    document.getElementById('note-input').addEventListener('input', (e) => { sheetState.note = e.target.value; });
    document.getElementById('save-tx').onclick = () => {
      const amt = parseFloat(sheetState.amount);
      if (!amt || amt <= 0) { toast('請輸入金額'); return; }
      if (!sheetState.categoryId) { toast('請選擇分類'); return; }
      const payload = { type: sheetState.type, amount: amt, categoryId: sheetState.categoryId, date: sheetState.date, note: sheetState.note.trim() };
      if (editing) Store.updateTransaction(existingTx.id, payload);
      else Store.addTransaction(payload);
      overlay.remove();
      toast(editing ? '已更新紀錄' : '已新增紀錄');
      render();
    };
    if (editing) {
      document.getElementById('delete-tx').onclick = () => {
        openConfirmSheet('刪除這筆紀錄？', '刪除後將無法復原。', () => {
          Store.deleteTransaction(existingTx.id);
          overlay.remove();
          toast('已刪除紀錄');
          render();
        });
      };
    }
  }

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  draw();
}

// ---- 主題 ----
function initTheme() {
  const saved = localStorage.getItem('ledger.theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || 'auto';
    const next = cur === 'auto' ? 'dark' : cur === 'dark' ? 'light' : 'auto';
    if (next === 'auto') { delete document.documentElement.dataset.theme; localStorage.removeItem('ledger.theme'); }
    else { document.documentElement.dataset.theme = next; localStorage.setItem('ledger.theme', next); }
    toast(next === 'auto' ? '主題：跟隨系統' : next === 'dark' ? '主題：深色' : '主題：淺色');
  });
}

// ---- 導覽 & 初始化 ----
function initNav() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => { state.view = btn.dataset.view; render(); });
  });
  document.getElementById('fab-add').addEventListener('click', () => openAddSheet(null));
}

function init() {
  initNav();
  initTheme();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
}

init();
