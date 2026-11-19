import { AgingBucket, ExpenseCategory, ExpenseRecord, InvoiceRecord } from '../types/finance';

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function formatINR(amount: number): string {
  if (!Number.isFinite(amount)) return '₹0';
  const rounded = Math.round(amount);
  if (rounded < 0) {
    return `-${inrFormatter.format(Math.abs(rounded))}`;
  }
  return inrFormatter.format(rounded);
}

export function formatINRCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) {
    return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  }
  if (abs >= 100000) {
    return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  }
  if (abs >= 1000) {
    return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  }
  return formatINR(amount);
}

export function formatShortDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function diffDays(fromDateStr: string, toDateStr: string): number {
  const from = new Date(`${fromDateStr}T00:00:00`);
  const to = new Date(`${toDateStr}T00:00:00`);
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function getInvoiceAgingBucket(invoice: InvoiceRecord, referenceDate: string): AgingBucket {
  const balance = Math.max(0, invoice.amount - invoice.paidAmount);
  if (balance <= 0) return 'paid';
  const daysPastDue = diffDays(invoice.dueDate, referenceDate);
  if (daysPastDue <= 0) return 'current';
  if (daysPastDue <= 30) return '1-30';
  if (daysPastDue <= 60) return '31-60';
  return '60+';
}

export function getDaysOverdue(invoice: InvoiceRecord, referenceDate: string): number {
  const balance = Math.max(0, invoice.amount - invoice.paidAmount);
  if (balance <= 0) return 0;
  return Math.max(0, diffDays(invoice.dueDate, referenceDate));
}

export function parseCsvOrTsv(rawText: string): string[][] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : ',';

  return lines.map((line) => {
    if (delimiter === '\t') {
      return line.split('\t').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    }
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });
}

const VALID_CATEGORIES: ExpenseCategory[] = [
  'Stock & Purchases',
  'Transport & Freight',
  'Rent & Utilities',
  'Staff & Salaries',
  'Marketing & Operations',
];

export function normalizeCategory(input: string): ExpenseCategory {
  const lower = input.toLowerCase();
  if (lower.includes('stock') || lower.includes('purch') || lower.includes('invent') || lower.includes('goods')) {
    return 'Stock & Purchases';
  }
  if (lower.includes('trans') || lower.includes('freight') || lower.includes('fuel') || lower.includes('deliv')) {
    return 'Transport & Freight';
  }
  if (lower.includes('rent') || lower.includes('util') || lower.includes('elect') || lower.includes('power')) {
    return 'Rent & Utilities';
  }
  if (lower.includes('staff') || lower.includes('sal') || lower.includes('wage')) {
    return 'Staff & Salaries';
  }
  const exact = VALID_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return exact ?? 'Marketing & Operations';
}

export function parseInvoicesFromTable(rows: string[][]): { records: InvoiceRecord[]; errors: string[] } {
  if (rows.length < 2) {
    return { records: [], errors: ['Include a header row and at least one invoice row.'] };
  }

  const headers = rows[0].map((h) => h.toLowerCase());
  const findCol = (keywords: string[], fallbackIndex: number) => {
    const idx = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    return idx >= 0 ? idx : fallbackIndex;
  };

  const invIdx = findCol(['invoice', 'inv', 'bill'], 0);
  const custIdx = findCol(['customer', 'party', 'dealer', 'client', 'name'], 1);
  const cityIdx = findCol(['city', 'location', 'town'], 2);
  const phoneIdx = findCol(['phone', 'mobile', 'contact'], 3);
  const issueIdx = findCol(['issue', 'bill date', 'date'], 4);
  const dueIdx = findCol(['due'], 5);
  const amtIdx = findCol(['amount', 'total', 'billed'], 6);
  const paidIdx = findCol(['paid', 'received', 'collected'], 7);

  const records: InvoiceRecord[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const customerName = r[custIdx] || '';
    const rawAmount = Number((r[amtIdx] || '0').replace(/[^0-9.-]/g, ''));
    const rawPaid = Number((r[paidIdx] || '0').replace(/[^0-9.-]/g, ''));

    if (!customerName || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      errors.push(`Row ${i + 1}: Missing valid customer name or positive amount.`);
      continue;
    }

    const issueDate = /^\d{4}-\d{2}-\d{2}$/.test(r[issueIdx] || '') ? r[issueIdx] : '2026-11-01';
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(r[dueIdx] || '') ? r[dueIdx] : '2026-11-15';

    records.push({
      id: `imp-inv-${Date.now()}-${i}`,
      invoiceNumber: r[invIdx] || `INV-${1000 + i}`,
      customerName,
      customerCity: r[cityIdx] || 'Indore',
      customerPhone: r[phoneIdx] || '+91 98260 00000',
      issueDate,
      dueDate,
      amount: Math.round(rawAmount),
      paidAmount: Number.isFinite(rawPaid) ? Math.min(Math.round(rawAmount), Math.max(0, Math.round(rawPaid))) : 0,
    });
  }

  return { records, errors };
}

export function parseExpensesFromTable(rows: string[][]): { records: ExpenseRecord[]; errors: string[] } {
  if (rows.length < 2) {
    return { records: [], errors: ['Include a header row and at least one expense row.'] };
  }

  const headers = rows[0].map((h) => h.toLowerCase());
  const findCol = (keywords: string[], fallbackIndex: number) => {
    const idx = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
    return idx >= 0 ? idx : fallbackIndex;
  };

  const dateIdx = findCol(['date'], 0);
  const titleIdx = findCol(['title', 'desc', 'particular', 'item'], 1);
  const catIdx = findCol(['category', 'head', 'type'], 2);
  const vendorIdx = findCol(['vendor', 'payee', 'party'], 3);
  const amtIdx = findCol(['amount', 'cost', 'value'], 4);
  const modeIdx = findCol(['mode', 'payment'], 5);

  const records: ExpenseRecord[] = [];
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const title = r[titleIdx] || '';
    const rawAmount = Number((r[amtIdx] || '0').replace(/[^0-9.-]/g, ''));

    if (!title || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      errors.push(`Row ${i + 1}: Missing valid description or positive amount.`);
      continue;
    }

    const date = /^\d{4}-\d{2}-\d{2}$/.test(r[dateIdx] || '') ? r[dateIdx] : '2026-11-10';
    const rawMode = (r[modeIdx] || '').toLowerCase();
    const paymentMode: ExpenseRecord['paymentMode'] = rawMode.includes('upi')
      ? 'UPI'
      : rawMode.includes('cash')
        ? 'Cash'
        : rawMode.includes('cheque')
          ? 'Cheque'
          : 'Bank Transfer';

    records.push({
      id: `imp-exp-${Date.now()}-${i}`,
      date,
      title,
      category: normalizeCategory(r[catIdx] || ''),
      vendor: r[vendorIdx] || 'General Vendor',
      amount: Math.round(rawAmount),
      paymentMode,
    });
  }

  return { records, errors };
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
