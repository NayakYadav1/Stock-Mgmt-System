import { useEffect, useState } from 'react';
import { productsApi, ledgerApi } from './services/api';
import { LOW_STOCK_LIMIT, formatMoney } from './utils';

export default function App() {
  const [info, setInfo] = useState('Loading...');

  useEffect(() => {
    Promise.all([productsApi.getAll(), ledgerApi.getDue()])
      .then(([products, due]) => {
        const low = products.filter((p) => p.stock_quantity <= LOW_STOCK_LIMIT).length;
        const totalDue = due.reduce((sum, d) => sum + d.due_amount, 0);
        setInfo(
          `Products: ${products.length} | Low stock: ${low} | Sales with due: ${due.length} | Total due: ${formatMoney(totalDue)}`
        );
      })
      .catch((e) => setInfo('ERROR: ' + e.message));
  }, []);

  return <div className="p-6 text-lg font-medium text-slate-800">{info}</div>;
}