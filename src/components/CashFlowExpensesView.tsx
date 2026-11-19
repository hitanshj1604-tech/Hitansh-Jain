import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { ExpenseCategory, ExpenseRecord, FinancialSummary } from '../types/finance';
import { formatINR, formatShortDate } from '../utils/formatters';

interface CashFlowExpensesViewProps {
  expenses: ExpenseRecord[];
  summary: FinancialSummary;
  onOpenAddExpense: () => void;
  onDeleteExpense: (expenseId: string) => void;
}

const CATEGORY_TABS: Array<'All' | ExpenseCategory> = [
  'All',
  'Stock & Purchases',
  'Transport & Freight',
  'Rent & Utilities',
  'Staff & Salaries',
  'Marketing & Operations',
];

export const CashFlowExpensesView: React.FC<CashFlowExpensesViewProps> = ({
  expenses,
  summary,
  onOpenAddExpense,
  onDeleteExpense,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'All' | ExpenseCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredExpenses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return expenses
      .filter((exp) => {
        if (selectedCategory !== 'All' && exp.category !== selectedCategory) return false;
        if (!q) return true;
        return (
          exp.title.toLowerCase().includes(q) ||
          exp.vendor.toLowerCase().includes(q) ||
          exp.category.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedCategory, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Cash Flow & Expenses
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track monthly cash collections against inventory purchases and operating overheads
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddExpense}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Log Expense
        </button>
      </div>

      {/* 3-Column Cash Movement Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Cash Collected (Inflow)</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatINR(summary.totalCollected)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Customer payments received across invoices
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Business Outflows (Expenses)</span>
            <ArrowDownRight className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatINR(summary.totalExpenses)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Stock, freight, rent, staff & operations
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Net Operating Cash</span>
          </div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              summary.netCashFlow >= 0 ? 'text-slate-900' : 'text-red-600'
            }`}
          >
            {summary.netCashFlow >= 0 ? '+' : ''}
            {formatINR(summary.netCashFlow)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
            {summary.operatingMarginPct.toFixed(1)}% operating cash margin
          </p>
        </div>
      </div>

      {/* Monthly Cash Flow Statement Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-900">Monthly Cash Movement</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Month-by-month comparison of sales billed, actual cash received, and expenses paid
          </p>
        </div>

        {summary.monthlySeries.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500 border-t border-slate-100">
            No monthly transactions recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-2.5 pr-4">Month</th>
                  <th className="py-2.5 px-3 text-right">Sales Billed (₹)</th>
                  <th className="py-2.5 px-3 text-right">Cash Inflow (₹)</th>
                  <th className="py-2.5 px-3 text-right">Expenses Outflow (₹)</th>
                  <th className="py-2.5 pl-3 text-right">Net Cash Flow (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm tabular-nums">
                {summary.monthlySeries.map((row) => (
                  <tr key={row.monthKey} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pr-4 font-medium text-slate-900">{row.label}</td>
                    <td className="py-3 px-3 text-right font-mono text-slate-700">
                      {formatINR(row.salesBilled)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-emerald-700">
                      {formatINR(row.cashInflow)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-amber-700">
                      {formatINR(row.cashOutflow)}
                    </td>
                    <td
                      className={`py-3 pl-3 text-right font-mono font-semibold ${
                        row.netCashFlow >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {row.netCashFlow >= 0 ? '+' : ''}
                      {formatINR(row.netCashFlow)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Expense Ledger */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            {CATEGORY_TABS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expense or vendor..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="py-10 text-center border-t border-slate-100 space-y-2">
            <p className="text-sm font-medium text-slate-800">
              No expense entries found for this filter.
            </p>
            <p className="text-xs text-slate-500">
              Log a new business expense or switch category tabs above.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-slate-100 pt-2">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                  <th className="py-3 pr-3">Date</th>
                  <th className="py-3 px-3">Particulars</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Vendor / Payee</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3 text-right">Amount (₹)</th>
                  <th className="py-3 pl-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 pr-3 font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatShortDate(exp.date)}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-900">{exp.title}</td>
                    <td className="py-3 px-3 text-xs text-slate-600 whitespace-nowrap">
                      {exp.category}
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600">{exp.vendor}</td>
                    <td className="py-3 px-3 text-xs text-slate-500 whitespace-nowrap">
                      {exp.paymentMode}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {formatINR(exp.amount)}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(exp.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        aria-label={`Delete ${exp.title}`}
                        title="Delete expense"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
