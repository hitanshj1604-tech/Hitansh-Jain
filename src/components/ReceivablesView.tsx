import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { AgingBucket, FinancialSummary, InvoiceRecord } from '../types/finance';
import {
  formatINR,
  formatShortDate,
  getDaysOverdue,
  getInvoiceAgingBucket,
} from '../utils/formatters';

interface ReceivablesViewProps {
  invoices: InvoiceRecord[];
  referenceDate: string;
  summary: FinancialSummary;
  onOpenAddInvoice: () => void;
  onOpenPaymentModal: (invoiceId: string) => void;
  onOpenReminderModal: (invoice: InvoiceRecord) => void;
  onDeleteInvoice: (invoiceId: string) => void;
}

type FilterTab = 'all_open' | AgingBucket | 'all';

export const ReceivablesView: React.FC<ReceivablesViewProps> = ({
  invoices,
  referenceDate,
  summary,
  onOpenAddInvoice,
  onOpenPaymentModal,
  onOpenReminderModal,
  onDeleteInvoice,
}) => {
  const [filter, setFilter] = useState<FilterTab>('all_open');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        const bucket = getInvoiceAgingBucket(inv, referenceDate);
        if (filter === 'all_open' && bucket === 'paid') return false;
        if (filter !== 'all_open' && filter !== 'all' && bucket !== filter) return false;

        if (!q) return true;
        return (
          inv.customerName.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.customerCity.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const daysA = getDaysOverdue(a, referenceDate);
        const daysB = getDaysOverdue(b, referenceDate);
        if (daysB !== daysA) return daysB - daysA;
        return b.issueDate.localeCompare(a.issueDate);
      });
  }, [invoices, referenceDate, filter, searchQuery]);

  const filterOptions: Array<{ id: FilterTab; label: string; amount?: number }> = [
    { id: 'all_open', label: 'All Pending', amount: summary.totalOutstanding },
    { id: 'current', label: 'Not Yet Due', amount: summary.aging.current.amount },
    { id: '1-30', label: '1–30d Overdue', amount: summary.aging.days1to30.amount },
    { id: '31-60', label: '31–60d Overdue', amount: summary.aging.days31to60.amount },
    { id: '60+', label: '60+d Overdue', amount: summary.aging.days60plus.amount },
    { id: 'paid', label: 'Settled' },
    { id: 'all', label: 'All Invoices' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Receivables & Credit Sales
          </h1>
          <p className="text-sm text-slate-500 mt-0.5 tabular-nums">
            {formatINR(summary.totalOutstanding)} total pending across customers{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="text-red-700 font-medium">
              {formatINR(summary.overdueAmount)} overdue
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddInvoice}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Credit Sale
        </button>
      </div>

      {/* Aging Filter Tabs + Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                  filter === opt.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
                {opt.amount !== undefined && (
                  <span className="ml-1.5 text-slate-400 font-mono">
                    {formatINR(opt.amount)}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search party, city, or invoice..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>
        </div>

        {/* High-Density Receivables Table */}
        {filteredInvoices.length === 0 ? (
          <div className="py-12 text-center border-t border-slate-100 space-y-2">
            <p className="text-sm font-medium text-slate-800">
              No invoices match the current filter.
            </p>
            <p className="text-xs text-slate-500">
              Try switching to &ldquo;All Invoices&rdquo; or record a new credit sale.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100 pt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 pr-3">Invoice</th>
                  <th className="py-3 px-3">Customer / Party</th>
                  <th className="py-3 px-3">Issue & Due Date</th>
                  <th className="py-3 px-3 text-right">Billed (₹)</th>
                  <th className="py-3 px-3 text-right">Collected (₹)</th>
                  <th className="py-3 px-3 text-right">Balance Due (₹)</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredInvoices.map((inv) => {
                  const balance = Math.max(0, inv.amount - inv.paidAmount);
                  const daysOverdue = getDaysOverdue(inv, referenceDate);
                  const bucket = getInvoiceAgingBucket(inv, referenceDate);

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 pr-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-slate-900">{inv.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {inv.customerCity} · {inv.customerPhone}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        <div>Issued {formatShortDate(inv.issueDate)}</div>
                        <div className="text-slate-400">Due {formatShortDate(inv.dueDate)}</div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {formatINR(inv.amount)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-emerald-700 tabular-nums whitespace-nowrap">
                        {formatINR(inv.paidAmount)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatINR(balance)}
                      </td>
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {bucket === 'paid' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Paid in full
                          </span>
                        ) : daysOverdue > 0 ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${
                              daysOverdue > 30 ? 'text-red-700' : 'text-amber-700'
                            }`}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            Overdue · {daysOverdue}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-teal-700" />
                            Within credit period
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {balance > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => onOpenReminderModal(inv)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1 transition-colors"
                                title="Send WhatsApp / Copy Reminder"
                              >
                                <MessageSquare className="w-3 h-3" />
                                Remind
                              </button>
                              <button
                                type="button"
                                onClick={() => onOpenPaymentModal(inv.id)}
                                className="px-2.5 py-1.5 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-md transition-colors"
                              >
                                Collect
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteInvoice(inv.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            aria-label={`Delete ${inv.invoiceNumber}`}
                            title="Delete invoice"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
