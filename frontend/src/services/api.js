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
  low_stock_threshold: n(p.low_stock_threshold),
});

const cleanParty = (party) => ({
  ...party,
  balance: n(party.balance),
});

const cleanTransaction = (transaction) => ({
  ...transaction,
  total_amount: n(transaction.total_amount),
  items: (transaction.items || []).map((item) => ({
    ...item,
    quantity: n(item.quantity),
    unit_price: n(item.unit_price),
    line_total: n(item.line_total),
  })),
});

export const productsApi = {
  getAll: async () => (await api.get('/products')).data.data.map(cleanProduct),
  create: async (body) => (await api.post('/products', body)).data,
  update: async (id, body) => (await api.put(`/products/${id}`, body)).data,
  remove: async (id) => (await api.delete(`/products/${id}`)).data,
};

export const partiesApi = {
  getAll: async (type) =>
    (
      await api.get("/parties", {
        params: type ? { type } : {},
      })
    ).data.data.map(cleanParty),

  getLedger: async (id) => (await api.get(`/parties/${id}/ledger`)).data.data,
  create: async (body) => (await api.post("/parties", body)).data,
  update: async (id, body) => (await api.patch(`/parties/${id}`, body)).data,
  remove: async (id) => (await api.delete(`/parties/${id}`)).data,
};

export const transactionsApi = {
  getAll: async () =>
    (await api.get("/transactions")).data.data.map(cleanTransaction),

  createPurchase: async (body) =>
    (await api.post("/transactions/purchases", body)).data,

  createSale: async (body) =>
    (await api.post("/transactions/sales", body)).data,
};

export const paymentsApi = {
  settle: async (body) => (await api.post("/payments", body)).data,
};

export const dashboardApi = {
  getSummary: async () => (await api.get("/dashboard")).data.data,
};