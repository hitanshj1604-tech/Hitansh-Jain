export type NavSection = 'overview' | 'receivables' | 'cashflow' | 'import';

export type PeriodFilter = 'all' | '90d' | '30d';

export type AgingBucket = 'current' | '1-30' | '31-60' | '60+' | 'paid';

export type ExpenseCategory =
  | 'Stock & Purchases'
  | 'Transport & Freight'
  | 'Rent & Utilities'
  | 'Staff & Salaries'
  | 'Marketing & Operations';

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerCity: string;
  customerPhone: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  amount: number; // INR
  paidAmount: number; // INR
  lastPaymentDate?: string;
  notes?: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  category: ExpenseCategory;
  vendor: string;
  amount: number; // INR
  paymentMode: 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque';
}

export interface BusinessDataset {
  id: string;
  name: string;
  segment: string;
  location: string;
  ownerName: string;
  referenceDate: string; // YYYY-MM-DD anchor for consistent aging calculations
  invoices: InvoiceRecord[];
  expenses: ExpenseRecord[];
}

export interface MonthlyCashPoint {
  monthKey: string; // YYYY-MM
  label: string; // e.g., "Jun 26"
  salesBilled: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
}

export interface InsightItem {
  id: string;
  severity: 'critical' | 'warning' | 'positive';
  title: string;
  detail: string;
  metricText: string;
  actionLabel: string;
  targetSection: NavSection;
}

export interface FinancialSummary {
  totalSales: number;
  totalCollected: number;
  totalExpenses: number;
  netCashFlow: number;
  operatingMarginPct: number;
  totalOutstanding: number;
  overdueAmount: number;
  overdueCount: number;
  dueSoonAmount: number;
  collectionRatePct: number;
  avgDaysToCollect: number;
  aging: {
    current: { count: number; amount: number };
    days1to30: { count: number; amount: number };
    days31to60: { count: number; amount: number };
    days60plus: { count: number; amount: number };
  };
  monthlySeries: MonthlyCashPoint[];
  expenseByCategory: Array<{
    category: ExpenseCategory;
    amount: number;
    sharePct: number;
  }>;
  insights: InsightItem[];
}
