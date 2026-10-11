import { useState } from 'react';
import { Card, Modal, Spinner, StatusBadge, useToast, btnPrimary, btnGhost } from '../components/ui.jsx';

export default function Dashboard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Dashboard</h1>

      <div style={{ background: 'red', color: 'white', padding: 8 }}>
        TEST 1: plain CSS box (always visible)
      </div>
      <div className="bg-green-500 p-2 text-white">TEST 2: Tailwind box (green if Tailwind works)</div>

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <button className={btnPrimary} onClick={() => toast('success', 'This is a success message')}>
            Test success toast
          </button>
          <button className={btnGhost} onClick={() => toast('error', 'This is an error message')}>
            Test error toast
          </button>
          <button className={btnGhost} onClick={() => setOpen(true)}>Open modal</button>
        </div>
        <div className="flex items-center gap-3 text-indigo-600">
          <Spinner /> <span className="text-sm text-slate-600">Spinner</span>
        </div>
        <div className="flex gap-2">
          <StatusBadge status="PAID" />
          <StatusBadge status="PARTIAL" />
          <StatusBadge status="UNPAID" />
        </div>
      </Card>

      {open && (
        <Modal title="Test Modal" onClose={() => setOpen(false)}>
          <p className="text-sm text-slate-600">If you can read this, the modal works.</p>
        </Modal>
      )}
    </div>
  );
}