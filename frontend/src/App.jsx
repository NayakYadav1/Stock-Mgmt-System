import { Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Inventory from "./pages/Inventory.jsx";
import Transactions from "./pages/Transactions.jsx";
import PartyKhata from "./pages/PartyKhata.jsx";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar />

      <main className="mx-auto max-w-7xl p-4 sm:p-6">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/party-khata" element={<PartyKhata />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}