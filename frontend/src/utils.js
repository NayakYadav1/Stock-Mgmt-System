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