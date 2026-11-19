import React, { useState } from 'react';
import { X } from 'lucide-react';
import { ExpenseCategory, ExpenseRecord, InvoiceRecord } from '../types/finance';
import { formatINR } from '../utils/formatters';

export type ModalMode = 'invoice' | 'expense' | 'payment';

interface EntryModalProps {
  isOpen: boolean;
  initialMode: ModalMode;
  invoices: InvoiceRecord[];
  preselectedInvoiceId?: string;
  referenceDate: string;
  onClose: () => void;
  onAddInvoice: (invoice: Omit<InvoiceRecord, 'id'>) => void;
  onAddExpense: (expense: Omit<ExpenseRecord, 'id'>) => void;
  onRecordPayment: (invoiceId: string, paymentAmount: number, paymentDate: string) => void;
}

const CATEGORIES: ExpenseCategory[] = [
  'Stock & Purchases',
  'Transport & Freight',
  'Rent & Utilities',
  'Staff & Salaries',
  'Marketing & Operations',
];

export const EntryModal: React.FC<EntryModalProps> = ({
  isOpen,
  initialMode,
  invoices,
  preselectedInvoiceId,
  referenceDate,
  onClose,
  onAddInvoice,
  onAddExpense,
  onRecordPayment,
}) => {
  const [mode, setMode] = useState<ModalMode>(initialMode);
  const [error, setError] = useState<string | null>(null);

  // Invoice form state
  const [invoiceNumber, setInvoiceNumber] = useState(`INV-2026-${Math.floor(200 + Math.random() * 700)}`);
  const [customerName, setCustomerName] = useState('');
  const [customerCity, setCustomerCity] = useState('Indore');
  const [customerPhone, setCustomerPhone] = useState('+91 ');
  const [issueDate, setIssueDate] = useState(referenceDate);
  const [dueDate, setDueDate] = useState(referenceDate);
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [paidNow, setPaidNow] = useState('0');

  // Expense form state
  const [expDate, setExpDate] = useState(referenceDate);
  const [expTitle, setExpTitle] = useState('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('Stock & Purchases');
  const [expVendor, setExpVendor] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expMode, setExpMode] = useState<ExpenseRecord['paymentMode']>('UPI');

  // Payment form state
  const openInvoices = invoices.filter((inv) => inv.amount - inv.paidAmount > 0);
  const [selectedInvId, setSelectedInvId] = useState<string>(
    preselectedInvoiceId || openInvoices[0]?.id || ''
  );
  const selectedInv = invoices.find((i) => i.id === selectedInvId);
  const maxPayable = selectedInv ? Math.max(0, selectedInv.amount - selectedInv.paidAmount) : 0;
  const [paymentAmt, setPaymentAmt] = useState(maxPayable > 0 ? String(maxPayable) : '');
  const [paymentDate, setPaymentDate] = useState(referenceDate);

  React.useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      setError(null);
      if (preselectedInvoiceId) {
        setSelectedInvId(preselectedInvoiceId);
        const found = invoices.find((i) => i.id === preselectedInvoiceId);
        if (found) {
          setPaymentAmt(String(Math.max(0, found.amount - found.paidAmount)));
        }
      } else if (openInvoices[0]) {
        setSelectedInvId(openInvoices[0].id);
        setPaymentAmt(String(Math.max(0, openInvoices[0].amount - openInvoices[0].paidAmount)));
      }
    }
  }, [isOpen, initialMode, preselectedInvoiceId]);

  if (!isOpen) return null;

  const handleInvoiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(invoiceAmount);
    const paid = Number(paidNow || 0);
    if (!customerName.trim()) {
      setError('Enter the customer or dealer name.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid positive invoice amount in INR.');
      return;
    }
    if (paid < 0 || paid > amt) {
      setError('Advance / paid amount must be between ₹0 and total invoice amount.');
      return;
    }
    onAddInvoice({
      invoiceNumber: invoiceNumber.trim() || `INV-${Date.now()}`,
      customerName: customerName.trim(),
      customerCity: customerCity.trim() || 'Indore',
      customerPhone: customerPhone.trim() || '+91 98260 00000',
      issueDate,
      dueDate,
      amount: Math.round(amt),
      paidAmount: Math.round(paid),
      lastPaymentDate: paid > 0 ? issueDate : undefined,
    });
    onClose();
  };

  const handleExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(expAmount);
    if (!expTitle.trim()) {
      setError('Enter an expense description.');
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid positive expense amount in INR.');
      return;
    }
    onAddExpense({
      date: expDate,
      title: expTitle.trim(),
      category: expCategory,
      vendor: expVendor.trim() || 'Direct Vendor',
      amount: Math.round(amt),
      paymentMode: expMode,
    });
    onClose();
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInv) {
      setError('Select an open invoice.');
      return;
    }
    const amt = Number(paymentAmt);
    if (!Number.isFinite(amt) || amt <= 0 || amt > maxPayable) {
      setError(`Payment must be between ₹1 and ${formatINR(maxPayable)}.`);
      return;
    }
    onRecordPayment(selectedInv.id, Math.round(amt), paymentDate);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="entry-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="entry-modal-title" className="text-lg font-semibold text-slate-900">
            Record Financial Entry
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('invoice');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'invoice'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Credit Sale
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('payment');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'payment'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Receive Payment
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('expense');
                setError(null);
              }}
              className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'expense'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Log Expense
            </button>
          </div>
        </div>

        {error && (
          <div className="mx-6 mt-4 px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {mode === 'invoice' && (
          <form onSubmit={handleInvoiceSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer / Dealer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Patidar Kirana Mart"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Invoice Number
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">City / Town</label>
                <input
                  type="text"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp / Phone
                </label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+91 98260 12345"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Bill Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Bill Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="85000"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Advance Paid Now (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={paidNow}
                  onChange={(e) => setPaidNow(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Save Credit Sale
              </button>
            </div>
          </form>
        )}

        {mode === 'payment' && (
          <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
            {openInvoices.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-600">
                All recorded invoices are fully settled. No pending receivables right now.
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Select Pending Invoice
                  </label>
                  <select
                    value={selectedInvId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedInvId(id);
                      const inv = invoices.find((i) => i.id === id);
                      if (inv) {
                        setPaymentAmt(String(Math.max(0, inv.amount - inv.paidAmount)));
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  >
                    {openInvoices.map((inv) => {
                      const bal = inv.amount - inv.paidAmount;
                      return (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} — {inv.customerName} (Due: {formatINR(bal)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedInv && (
                  <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-slate-50 border border-slate-200 text-xs tabular-nums">
                    <span className="text-slate-600">
                      Billed: <strong className="text-slate-900">{formatINR(selectedInv.amount)}</strong>
                    </span>
                    <span className="text-slate-600">
                      Paid: <strong className="text-emerald-700">{formatINR(selectedInv.paidAmount)}</strong>
                    </span>
                    <span className="text-slate-600">
                      Balance: <strong className="text-red-600">{formatINR(maxPayable)}</strong>
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Amount Received (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={maxPayable}
                      value={paymentAmt}
                      onChange={(e) => setPaymentAmt(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Collection Date
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              {openInvoices.length > 0 && (
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
                >
                  Confirm Payment
                </button>
              )}
            </div>
          </form>
        )}

        {mode === 'expense' && (
          <form onSubmit={handleExpenseSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Expense Description
                </label>
                <input
                  type="text"
                  value={expTitle}
                  onChange={(e) => setExpTitle(e.target.value)}
                  placeholder="e.g. Tempo Freight to Ujjain"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Vendor / Payee</label>
                <input
                  type="text"
                  value={expVendor}
                  onChange={(e) => setExpVendor(e.target.value)}
                  placeholder="e.g. Malwa Transport"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Payment Mode</label>
                <select
                  value={expMode}
                  onChange={(e) => setExpMode(e.target.value as ExpenseRecord['paymentMode'])}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="14500"
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Expense Date</label>
                <input
                  type="date"
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                Save Expense
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
