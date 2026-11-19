import {
  BusinessDataset,
  ExpenseCategory,
  FinancialSummary,
  InsightItem,
  MonthlyCashPoint,
  PeriodFilter,
} from '../types/finance';
import { diffDays, formatINR, getDaysOverdue, getInvoiceAgingBucket } from './formatters';

const ALL_CATEGORIES: ExpenseCategory[] = [
  'Stock & Purchases',
  'Transport & Freight',
  'Rent & Utilities',
  'Staff & Salaries',
  'Marketing & Operations',
];

function isWithinPeriod(dateStr: string, referenceDate: string, period: PeriodFilter): boolean {
  if (period === 'all') return true;
  const daysAgo = diffDays(dateStr, referenceDate);
  if (period === '30d') return daysAgo <= 30 && daysAgo >= -30;
  if (period === '90d') return daysAgo <= 90 && daysAgo >= -30;
  return true;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, 1);
  return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

export function computeFinancialSummary(
  dataset: BusinessDataset,
  period: PeriodFilter
): FinancialSummary {
  const refDate = dataset.referenceDate;

  const filteredInvoices = dataset.invoices.filter((inv) =>
    isWithinPeriod(inv.issueDate, refDate, period)
  );
  const filteredExpenses = dataset.expenses.filter((exp) =>
    isWithinPeriod(exp.date, refDate, period)
  );

  const totalSales = filteredInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalCollected = filteredInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);
  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const netCashFlow = totalCollected - totalExpenses;
  const operatingMarginPct = totalCollected > 0 ? (netCashFlow / totalCollected) * 100 : 0;

  // Receivables aging uses ALL open invoices so overdue debt never gets hidden by period filters
  const aging = {
    current: { count: 0, amount: 0 },
    days1to30: { count: 0, amount: 0 },
    days31to60: { count: 0, amount: 0 },
    days60plus: { count: 0, amount: 0 },
  };

  let totalOutstanding = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let dueSoonAmount = 0;

  for (const inv of dataset.invoices) {
    const balance = Math.max(0, inv.amount - inv.paidAmount);
    if (balance <= 0) continue;

    totalOutstanding += balance;
    const bucket = getInvoiceAgingBucket(inv, refDate);
    if (bucket === 'current') {
      aging.current.count += 1;
      aging.current.amount += balance;
      const daysUntilDue = diffDays(refDate, inv.dueDate);
      if (daysUntilDue >= 0 && daysUntilDue <= 7) {
        dueSoonAmount += balance;
      }
    } else if (bucket === '1-30') {
      aging.days1to30.count += 1;
      aging.days1to30.amount += balance;
      overdueAmount += balance;
      overdueCount += 1;
    } else if (bucket === '31-60') {
      aging.days31to60.count += 1;
      aging.days31to60.amount += balance;
      overdueAmount += balance;
      overdueCount += 1;
    } else if (bucket === '60+') {
      aging.days60plus.count += 1;
      aging.days60plus.amount += balance;
      overdueAmount += balance;
      overdueCount += 1;
    }
  }

  const allBilled = dataset.invoices.reduce((sum, i) => sum + i.amount, 0);
  const allCollected = dataset.invoices.reduce((sum, i) => sum + i.paidAmount, 0);
  const collectionRatePct = allBilled > 0 ? (allCollected / allBilled) * 100 : 0;

  // Average days to collect across invoices with payments recorded
  const paidDaysList = dataset.invoices
    .filter((i) => i.paidAmount > 0 && i.lastPaymentDate)
    .map((i) => Math.max(1, diffDays(i.issueDate, i.lastPaymentDate!)));
  const avgDaysToCollect =
    paidDaysList.length > 0
      ? Math.round(paidDaysList.reduce((a, b) => a + b, 0) / paidDaysList.length)
      : 0;

  // Monthly series
  const monthMap = new Map<string, MonthlyCashPoint>();
  const ensureMonth = (key: string) => {
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        monthKey: key,
        label: formatMonthLabel(key),
        salesBilled: 0,
        cashInflow: 0,
        cashOutflow: 0,
        netCashFlow: 0,
      });
    }
    return monthMap.get(key)!;
  };

  for (const inv of filteredInvoices) {
    const issueMonth = inv.issueDate.slice(0, 7);
    if (issueMonth.length === 7) {
      ensureMonth(issueMonth).salesBilled += inv.amount;
    }
    if (inv.paidAmount > 0) {
      const payMonth = (inv.lastPaymentDate || inv.issueDate).slice(0, 7);
      if (payMonth.length === 7) {
        ensureMonth(payMonth).cashInflow += inv.paidAmount;
      }
    }
  }

  for (const exp of filteredExpenses) {
    const expMonth = exp.date.slice(0, 7);
    if (expMonth.length === 7) {
      ensureMonth(expMonth).cashOutflow += exp.amount;
    }
  }

  const monthlySeries = Array.from(monthMap.values())
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .map((pt) => ({
      ...pt,
      netCashFlow: pt.cashInflow - pt.cashOutflow,
    }));

  // Expense category breakdown
  const catTotals = new Map<ExpenseCategory, number>();
  for (const c of ALL_CATEGORIES) catTotals.set(c, 0);
  for (const exp of filteredExpenses) {
    catTotals.set(exp.category, (catTotals.get(exp.category) || 0) + exp.amount);
  }
  const expenseByCategory = ALL_CATEGORIES.map((category) => {
    const amount = catTotals.get(category) || 0;
    return {
      category,
      amount,
      sharePct: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
    };
  }).sort((a, b) => b.amount - a.amount);

  // Actionable deterministic insights
  const insights: InsightItem[] = [];

  const overdueList = dataset.invoices
    .map((inv) => ({
      inv,
      balance: Math.max(0, inv.amount - inv.paidAmount),
      daysOverdue: getDaysOverdue(inv, refDate),
    }))
    .filter((item) => item.balance > 0 && item.daysOverdue > 0)
    .sort((a, b) => b.balance - a.balance);

  if (overdueList.length > 0) {
    const top = overdueList[0];
    insights.push({
      id: 'insight-top-overdue',
      severity: 'critical',
      title: `Priority collection: ${top.inv.customerName}`,
      detail: `${top.inv.invoiceNumber} is ${top.daysOverdue} days overdue. Following up today recovers ${Math.round((top.balance / Math.max(1, overdueAmount)) * 100)}% of your overdue balance.`,
      metricText: `${formatINR(top.balance)} overdue`,
      actionLabel: 'Open Receivables',
      targetSection: 'receivables',
    });
  }

  if (overdueAmount > 0 && totalOutstanding > 0) {
    const overdueShare = Math.round((overdueAmount / totalOutstanding) * 100);
    if (overdueShare >= 35) {
      insights.push({
        id: 'insight-overdue-concentration',
        severity: 'warning',
        title: `${overdueShare}% of receivables are past due date`,
        detail: `${overdueCount} credit invoices totalling ${formatINR(overdueAmount)} have crossed their credit window. Send WhatsApp payment reminders to protect working capital.`,
        metricText: `${overdueCount} overdue bills`,
        actionLabel: 'Send Reminders',
        targetSection: 'receivables',
      });
    }
  }

  if (netCashFlow < 0) {
    insights.push({
      id: 'insight-negative-cashflow',
      severity: 'critical',
      title: 'Cash outflow exceeds collections in this period',
      detail: `Expenses (${formatINR(totalExpenses)}) are higher than cash collected (${formatINR(totalCollected)}). Collecting pending receivables will close this cash gap.`,
      metricText: `${formatINR(netCashFlow)} net cash`,
      actionLabel: 'Review Cash Flow',
      targetSection: 'cashflow',
    });
  } else if (totalCollected > 0) {
    insights.push({
      id: 'insight-positive-cashflow',
      severity: 'positive',
      title: 'Healthy positive operating cash surplus',
      detail: `Cash collections exceed total business expenses by ${formatINR(netCashFlow)} (${operatingMarginPct.toFixed(1)}% operating cash margin) with an average ${avgDaysToCollect}-day collection cycle.`,
      metricText: `+${formatINR(netCashFlow)} surplus`,
      actionLabel: 'Export Report',
      targetSection: 'import',
    });
  }

  const nonStockExpenses = expenseByCategory.filter(
    (c) => c.category !== 'Stock & Purchases' && c.amount > 0
  );
  if (nonStockExpenses.length > 0 && totalExpenses > 0) {
    const topOp = nonStockExpenses[0];
    insights.push({
      id: 'insight-top-op-expense',
      severity: 'warning',
      title: `Largest overhead: ${topOp.category}`,
      detail: `${topOp.category} accounts for ${topOp.sharePct.toFixed(1)}% of total outflows in the selected period. Monitor route & vendor bills for savings.`,
      metricText: `${formatINR(topOp.amount)} spent`,
      actionLabel: 'Inspect Expenses',
      targetSection: 'cashflow',
    });
  }

  if (dataset.invoices.length === 0 && dataset.expenses.length === 0) {
    insights.push({
      id: 'insight-empty',
      severity: 'warning',
      title: 'Add your first invoice or import an Excel CSV',
      detail: 'Start by recording a credit sale or pasting rows from your existing Excel sheet to generate instant receivables and cash-flow insights.',
      metricText: 'Ready for data',
      actionLabel: 'Import Data',
      targetSection: 'import',
    });
  }

  return {
    totalSales,
    totalCollected,
    totalExpenses,
    netCashFlow,
    operatingMarginPct,
    totalOutstanding,
    overdueAmount,
    overdueCount,
    dueSoonAmount,
    collectionRatePct,
    avgDaysToCollect,
    aging,
    monthlySeries,
    expenseByCategory,
    insights: insights.slice(0, 4),
  };
}
