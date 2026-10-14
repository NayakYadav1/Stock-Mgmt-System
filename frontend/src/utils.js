export const LOW_STOCK_LIMIT = 5;

export const formatMoney = (value) =>
  'Rs. ' + (Number(value) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Today's date in YYYY-MM-DD using YOUR local time (Nepal), which is what the date picker needs
export const todayISO = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

export const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

// Price to compare against for the "selling below cost" warning
export const minAllowedPrice = (product) =>
  product.latest_unit_cost != null ? product.latest_unit_cost : product.cost_price;

// Backend says UNPAID/DUE/PARTIAL/PAID. We show DUE, PARTIAL, PAID.
export const normalizeStatus = (status) => (status === 'UNPAID' ? 'DUE' : status);

// Display-only reference numbers, e.g. formatRef('INV', 16) -> "INV-0016"
export const formatRef = (prefix, id) => `${prefix}-${String(id).padStart(4, '0')}`;

// Local calendar day as YYYY-MM-DD (used to group transactions by day)
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const dayLabel = (value) => {
  const key = dayKey(value);
  if (key === dayKey(new Date())) return 'Today';
  if (key === dayKey(new Date(Date.now() - 86400000))) return 'Yesterday';
  return new Date(value).toLocaleDateString('en-GB', {
    weekday: 'long', day: '2-digit', month: 'short', year: 'numeric',
  });
};