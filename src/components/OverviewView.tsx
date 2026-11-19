import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  IndianRupee,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import {
  BusinessDataset,
  FinancialSummary,
  InvoiceRecord,
  NavSection,
  PeriodFilter,
} from '../types/finance';
import { formatINR, formatINRCompact, formatShortDate, getDaysOverdue } from '../utils/formatters';
import { CashFlowTrendChart } from './Charts';

interface OverviewViewProps {
  dataset: BusinessDataset;
  summary: FinancialSummary;
  period: PeriodFilter;
  onPeriodChange: (period: PeriodFilter) => void;
  onNavigate: (section: NavSection) => void;
  onOpenPaymentModal: (invoiceId: string) => void;
  onOpenReminderModal: (invoice: InvoiceRecord) => void;
  onOpenAddModal: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  dataset,
  summary,
  period,
  onPeriodChange,
  onNavigate,
  onOpenPaymentModal,
  onOpenReminderModal,
  onOpenAddModal,
}) => {
  const isEmpty = dataset.invoices.length === 0 && dataset.expenses.length === 0;

  const overdueInvoices = dataset.invoices
    .map((inv) => ({
      inv,
      balance: Math.max(0, inv.amount - inv.paidAmount),
      daysOverdue: getDaysOverdue(inv, dataset.referenceDate),
    }))
    .filter((item) => item.balance > 0 && item.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.balance - a.balance)
    .slice(0, 5);

  const agingTotal = Math.max(1, summary.totalOutstanding);

  return (
    <div className="space-y-6">
      {/* Workspace context strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {dataset.name}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {dataset.segment} <span aria-hidden="true">·</span> {dataset.location}{' '}
            <span aria-hidden="true">·</span> As of {formatShortDate(dataset.referenceDate)}
          </p>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All History' },
              { id: '90d', label: 'Last 90 Days' },
              { id: '30d', label: 'Last 30 Days' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onPeriodChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                period === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-4">
          <div className="w-11 h-11 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900">
              Your business ledger is ready for data
            </h2>
            <p className="text-sm text-slate-600">
              Add your first credit sale or expense, or paste rows directly from your Excel sheet to see cash flow, overdue receivables, and insights instantly.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Record First Entry
            </button>
            <button
              type="button"
              onClick={() => onNavigate('import')}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              Import Excel / CSV
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 4-Column Key Financial Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Total Sales Billed</span>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                {formatINR(summary.totalSales)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 tabular-nums">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  {summary.collectionRatePct.toFixed(1)}% overall collection rate
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Net Cash Flow</span>
                <IndianRupee className="w-4 h-4 text-slate-400" />
              </div>
              <div
                className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
                  summary.netCashFlow >= 0 ? 'text-slate-900' : 'text-red-600'
                }`}
              >
                {summary.netCashFlow >= 0 ? '+' : ''}
                {formatINR(summary.netCashFlow)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs tabular-nums">
                {summary.netCashFlow >= 0 ? (
                  <>
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-medium">
                      Cash Positive · {summary.operatingMarginPct.toFixed(1)}% margin
                    </span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="text-red-700 font-medium">
                      Cash Deficit · Expenses exceed inflow
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Outstanding Receivables</span>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                {formatINR(summary.totalOutstanding)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs tabular-nums">
                {summary.overdueAmount > 0 ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="text-red-700 font-medium">
                      {formatINR(summary.overdueAmount)} overdue ({summary.overdueCount} bills)
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="text-emerald-700 font-medium">Zero overdue invoices</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                <span>Total Expenses</span>
                <ArrowDownRight className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
                {formatINR(summary.totalExpenses)}
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 tabular-nums">
                <span>
                  Avg collection cycle: <strong className="text-slate-800">{summary.avgDaysToCollect} days</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Primary Analytics Split: Monthly Cash Flow Chart + Actionable Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <section className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">
                      Sales, Cash Collections & Expenses
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Compare billed credit sales against actual cash collected and outflows each month
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('cashflow')}
                    className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                  >
                    Full Ledger
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <CashFlowTrendChart data={summary.monthlySeries} />
              </div>

              {/* Receivables Aging Bar integrated with hairline divider */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-semibold text-slate-800">
                    Receivables Aging Snapshot
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    Total Pending: <strong className="font-mono text-slate-900">{formatINR(summary.totalOutstanding)}</strong>
                  </span>
                </div>

                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                  <div
                    style={{ width: `${(summary.aging.current.amount / agingTotal) * 100}%` }}
                    className="bg-teal-600 h-full"
                    title={`Current: ${formatINR(summary.aging.current.amount)}`}
                  />
                  <div
                    style={{ width: `${(summary.aging.days1to30.amount / agingTotal) * 100}%` }}
                    className="bg-amber-500 h-full"
                    title={`1–30 Days Overdue: ${formatINR(summary.aging.days1to30.amount)}`}
                  />
                  <div
                    style={{ width: `${(summary.aging.days31to60.amount / agingTotal) * 100}%` }}
                    className="bg-orange-600 h-full"
                    title={`31–60 Days Overdue: ${formatINR(summary.aging.days31to60.amount)}`}
                  />
                  <div
                    style={{ width: `${(summary.aging.days60plus.amount / agingTotal) * 100}%` }}
                    className="bg-red-600 h-full"
                    title={`60+ Days Overdue: ${formatINR(summary.aging.days60plus.amount)}`}
                  />
                </div>

                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs tabular-nums">
                  <div>
                    <span className="text-slate-500 block">Not Yet Due</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatINRCompact(summary.aging.current.amount)}
                    </span>
                    <span className="text-slate-400 ml-1">({summary.aging.current.count})</span>
                  </div>
                  <div>
                    <span className="text-amber-700 block">1–30d Overdue</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatINRCompact(summary.aging.days1to30.amount)}
                    </span>
                    <span className="text-slate-400 ml-1">({summary.aging.days1to30.count})</span>
                  </div>
                  <div>
                    <span className="text-orange-700 block">31–60d Overdue</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatINRCompact(summary.aging.days31to60.amount)}
                    </span>
                    <span className="text-slate-400 ml-1">({summary.aging.days31to60.count})</span>
                  </div>
                  <div>
                    <span className="text-red-700 block">60+d Overdue</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatINRCompact(summary.aging.days60plus.amount)}
                    </span>
                    <span className="text-slate-400 ml-1">({summary.aging.days60plus.count})</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Actionable Insights Panel */}
            <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 flex flex-col">
              <div className="mb-4">
                <h2 className="text-base font-semibold text-slate-900">Actionable Insights</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Immediate priorities detected from your ledger
                </p>
              </div>

              <div className="divide-y divide-slate-100 flex-1">
                {summary.insights.map((item) => (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1.5 font-semibold ${
                          item.severity === 'critical'
                            ? 'text-red-700'
                            : item.severity === 'warning'
                              ? 'text-amber-700'
                              : 'text-emerald-700'
                        }`}
                      >
                        {item.severity === 'critical' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                        {item.severity === 'warning' && <Clock className="w-3.5 h-3.5 shrink-0" />}
                        {item.severity === 'positive' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                        {item.severity === 'critical'
                          ? 'Action Needed'
                          : item.severity === 'warning'
                            ? 'Watch'
                            : 'On Track'}
                      </span>
                      <span className="font-mono font-semibold text-slate-700 tabular-nums">
                        {item.metricText}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>

                    <button
                      type="button"
                      onClick={() => onNavigate(item.targetSection)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 pt-0.5"
                    >
                      {item.actionLabel}
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          {/* Bottom Operational Strip: Overdue Follow-ups & Expense Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">
                    Overdue Customer Payments
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Parties sorted by oldest overdue credit bill
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('receivables')}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  View All Receivables
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {overdueInvoices.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 border-t border-slate-100">
                  No overdue customer invoices right now. All pending credit bills are within their credit window.
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2 px-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                        <th className="py-2.5 pr-3">Customer</th>
                        <th className="py-2.5 px-3">Due Status</th>
                        <th className="py-2.5 px-3 text-right">Balance Due</th>
                        <th className="py-2.5 pl-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {overdueInvoices.map(({ inv, balance, daysOverdue }) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pr-3">
                            <div className="font-medium text-slate-900">{inv.customerName}</div>
                            <div className="text-xs text-slate-500">
                              {inv.invoiceNumber} · {inv.customerCity}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 tabular-nums whitespace-nowrap">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              {daysOverdue}d overdue
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                            {formatINR(balance)}
                          </td>
                          <td className="py-3 pl-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onOpenReminderModal(inv)}
                                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md inline-flex items-center gap-1 transition-colors"
                                title="Send WhatsApp or SMS Reminder"
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
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Expense Breakdown</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Where your cash outflow went in this period
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('cashflow')}
                  className="text-xs font-medium text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  All Expenses
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {summary.totalExpenses === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 border-t border-slate-100">
                  No expenses logged for this period.
                </div>
              ) : (
                <div className="space-y-4 pt-1">
                  {summary.expenseByCategory.map((item) => (
                    <div key={item.category} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="font-medium text-slate-700">{item.category}</span>
                        <span className="text-slate-900 font-mono font-semibold">
                          {formatINR(item.amount)}{' '}
                          <span className="text-slate-400 font-normal">
                            ({item.sharePct.toFixed(0)}%)
                          </span>
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-slate-800 rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(item.amount > 0 ? 3 : 0, item.sharePct)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};
