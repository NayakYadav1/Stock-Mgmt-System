import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 15000,
});

// Backend errors look like { message: '...' }. Put that text in err.message.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    err.message = err.response?.data?.message || err.message || 'Something went wrong';
    return Promise.reject(err);
  }
);

// Backend sends numbers like "4550.00" as text. Convert to real numbers.
const n = (v) => Number(v) || 0;

const cleanProduct = (p) => ({
  ...p,
  cost_price: n(p.cost_price),
  selling_price: n(p.selling_price),
  stock_quantity: n(p.stock_quantity),
  latest_unit_cost: p.latest_unit_cost == null ? null : n(p.latest_unit_cost),
});

const cleanDue = (d) => ({
  ...d,
  total_amount: n(d.total_amount),
  amount_paid: n(d.amount_paid),
  due_amount: n(d.due_amount),
});

export const productsApi = {
  getAll: async () => (await api.get('/products')).data.data.map(cleanProduct),
  create: async (body) => (await api.post('/products', body)).data,
  update: async (id, body) => (await api.put(`/products/${id}`, body)).data,
  remove: async (id) => (await api.delete(`/products/${id}`)).data,
};

export const purchasesApi = {
  getAll: async () => (await api.get('/purchases')).data.data,
  create: async (body) => (await api.post('/purchases', body)).data,
};

export const salesApi = {
  getAll: async () => (await api.get('/sales')).data.data,
  create: async (body) => (await api.post('/sales', body)).data,
};

export const ledgerApi = {
  getDue: async () => (await api.get('/ledger/due')).data.data.map(cleanDue),
  pay: async (body) => (await api.post('/ledger/pay', body)).data,
};