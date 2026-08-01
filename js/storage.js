// 資料儲存層：包在 localStorage 上，提供交易與分類的存取
const STORAGE_KEY = 'ledger.v1';

const DEFAULT_CATEGORIES = [
  { id: 'exp-food', type: 'expense', name: '餐飲', icon: '🍜', order: 0 },
  { id: 'exp-transport', type: 'expense', name: '交通', icon: '🚗', order: 1 },
  { id: 'exp-shopping', type: 'expense', name: '購物', icon: '🛍️', order: 2 },
  { id: 'exp-fun', type: 'expense', name: '娛樂', icon: '🎮', order: 3 },
  { id: 'exp-medical', type: 'expense', name: '醫療', icon: '💊', order: 4 },
  { id: 'exp-edu', type: 'expense', name: '教育', icon: '📚', order: 5 },
  { id: 'exp-home', type: 'expense', name: '居家', icon: '🏠', order: 6 },
  { id: 'exp-bill', type: 'expense', name: '帳單', icon: '🧾', order: 7 },
  { id: 'exp-other', type: 'expense', name: '其他', icon: '📦', order: 8 },
  { id: 'inc-salary', type: 'income', name: '薪資', icon: '💰', order: 0 },
  { id: 'inc-bonus', type: 'income', name: '獎金', icon: '🎁', order: 1 },
  { id: 'inc-invest', type: 'income', name: '投資', icon: '📈', order: 2 },
  { id: 'inc-other', type: 'income', name: '其他', icon: '💵', order: 3 },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { transactions: [], categories: DEFAULT_CATEGORIES, settings: { currencyCode: 'TWD' } };
    const parsed = JSON.parse(raw);
    if (!parsed.categories || parsed.categories.length === 0) parsed.categories = DEFAULT_CATEGORIES;
    if (!parsed.settings) parsed.settings = {};
    if (!parsed.settings.currencyCode) parsed.settings.currencyCode = 'TWD';
    if (!parsed.transactions) parsed.transactions = [];
    return parsed;
  } catch (e) {
    console.error('讀取資料失敗', e);
    return { transactions: [], categories: DEFAULT_CATEGORIES, settings: { currencyCode: 'TWD' } };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const Store = {
  state: loadState(),

  save() {
    saveState(this.state);
  },

  getTransactions() {
    return [...this.state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  },

  addTransaction(tx) {
    const record = {
      id: uid(),
      type: tx.type,
      amount: Number(tx.amount),
      categoryId: tx.categoryId,
      date: tx.date,
      note: tx.note || '',
      createdAt: Date.now(),
    };
    this.state.transactions.push(record);
    this.save();
    return record;
  },

  updateTransaction(id, patch) {
    const idx = this.state.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.state.transactions[idx] = { ...this.state.transactions[idx], ...patch, amount: Number(patch.amount ?? this.state.transactions[idx].amount) };
    this.save();
    return this.state.transactions[idx];
  },

  deleteTransaction(id) {
    this.state.transactions = this.state.transactions.filter((t) => t.id !== id);
    this.save();
  },

  getCategories(type) {
    const list = [...this.state.categories].sort((a, b) => a.order - b.order);
    return type ? list.filter((c) => c.type === type) : list;
  },

  getCategory(id) {
    return this.state.categories.find((c) => c.id === id);
  },

  addCategory(cat) {
    const type = cat.type;
    const maxOrder = Math.max(-1, ...this.state.categories.filter((c) => c.type === type).map((c) => c.order));
    const record = { id: uid(), type, name: cat.name, icon: cat.icon || '🏷️', order: maxOrder + 1 };
    this.state.categories.push(record);
    this.save();
    return record;
  },

  deleteCategory(id) {
    const inUse = this.state.transactions.some((t) => t.categoryId === id);
    if (inUse) return { ok: false, reason: 'in-use' };
    this.state.categories = this.state.categories.filter((c) => c.id !== id);
    this.save();
    return { ok: true };
  },

  getSettings() {
    return this.state.settings;
  },

  updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.save();
  },

  exportJSON() {
    return JSON.stringify(this.state, null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    if (!parsed.transactions || !parsed.categories) throw new Error('資料格式不正確');
    this.state = parsed;
    this.save();
  },

  clearAll() {
    this.state = { transactions: [], categories: DEFAULT_CATEGORIES, settings: { currencyCode: 'TWD' } };
    this.save();
  },
};
