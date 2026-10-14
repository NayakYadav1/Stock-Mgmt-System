import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { LayoutDashboard, PackagePlus, ShoppingCart, Wallet, Boxes } from 'lucide-react';
import Dashboard from './pages/Dashboard.jsx';
import Purchases from './pages/Purchases.jsx';
import Sales from './pages/Sales.jsx';
import Ledger from './pages/Ledger.jsx';

const TABS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, page: Dashboard },
  { path: '/stock-in', label: 'Stock IN', icon: PackagePlus, page: Purchases },
  { path: '/stock-out', label: 'Stock OUT', icon: ShoppingCart, page: Sales },
  { path: '/credit-ledger', label: 'Credit Ledger', icon: Wallet, page: Ledger },
];

export default function App() {
  return (
    <div className="min-h-screen text-slate-800 md:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2 px-5 py-5 text-lg font-bold text-indigo-600">
          <Boxes /> Stock Manager
        </div>
        <nav className="space-y-1 px-3">
          {TABS.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3 font-bold text-indigo-600 md:hidden">
        <Boxes size={20} /> Stock Manager
      </header>

      {/* Page content */}
      <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 md:pb-6">
        <div className="mx-auto max-w-6xl">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {TABS.map(({ path, page: Page }) => (
              <Route key={path} path={path} element={<Page />} />
            ))}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white md:hidden">
        {TABS.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
                isActive ? 'text-indigo-600' : 'text-slate-500'
              }`
            }
          >
            <Icon size={20} /> {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}