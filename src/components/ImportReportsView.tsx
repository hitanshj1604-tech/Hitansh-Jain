import React, { useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { BusinessDataset, FinancialSummary } from '../types/finance';
import { SAMPLE_DATASETS } from '../data/sampleDatasets';
import {
  downloadTextFile,
  formatINR,
  formatShortDate,
  parseCsvOrTsv,
  parseExpensesFromTable,
  parseInvoicesFromTable,
} from '../utils/formatters';

interface ImportReportsViewProps {
  dataset: BusinessDataset;
  summary: FinancialSummary;
  onSelectPreset: (presetId: string) => void;
  onClearLedger: () => void;
  onUpdateProfile: (updates: Partial<Pick<BusinessDataset, 'name' | 'segment' | 'location' | 'ownerName'>>) => void;
  onImportInvoices: (records: BusinessDataset['invoices'], replaceExisting: boolean) => void;
  onImportExpenses: (records: BusinessDataset['expenses'], replaceExisting: boolean) => void;
}

const SAMPLE_INVOICE_CSV = `Invoice,Customer Name,City,Phone,Issue Date,Due Date,Amount,Paid Amount
INV-2026-301,Agarwal Kirana Bhandar,Indore,+91 98260 51120,2026-10-12,2026-10-27,94000,40000
INV-2026-302,Nema Traders & Agencies,Jabalpur,+91 94251 89210,2026-11-05,2026-11-20,128000,0`;

const SAMPLE_EXPENSE_CSV = `Date,Title,Category,Vendor,Amount,Mode
2026-11-10,Wholesale Grain Stock,Stock & Purchases,Malwa Agro Mills,145000,Bank Transfer
2026-11-14,Route Diesel & Loading,Transport & Freight,Indore Logistics,18500,UPI`;

export const ImportReportsView: React.FC<ImportReportsViewProps> = ({
  dataset,
  summary,
  onSelectPreset,
  onClearLedger,
  onUpdateProfile,
  onImportInvoices,
  onImportExpenses,
}) => {
  const [importKind, setImportKind] = useState<'invoices' | 'expenses'>('invoices');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [bizName, setBizName] = useState(dataset.name);
  const [bizLocation, setBizLocation] = useState(dataset.location);
  const [bizSegment, setBizSegment] = useState(dataset.segment);

  React.useEffect(() => {
    setBizName(dataset.name);
    setBizLocation(dataset.location);
    setBizSegment(dataset.segment);
  }, [dataset.id, dataset.name, dataset.location, dataset.segment]);

  const processRawTableText = (raw: string) => {
    const rows = parseCsvOrTsv(raw);
    if (rows.length < 2) {
      setStatusMessage({
        type: 'error',
        text: 'Could not detect a header row and data rows. Check your CSV or pasted Excel selection.',
      });
      return;
    }

    if (importKind === 'invoices') {
      const { records, errors } = parseInvoicesFromTable(rows);
      if (records.length === 0) {
        setStatusMessage({
          type: 'error',
          text: errors[0] || 'No valid invoice rows found.',
        });
        return;
      }
      onImportInvoices(records, replaceExisting);
      setStatusMessage({
        type: 'success',
        text: `Imported ${records.length} customer invoice${records.length > 1 ? 's' : ''}${
          errors.length > 0 ? ` (${errors.length} row skipped)` : ''
        }.`,
      });
      setPasteText('');
    } else {
      const { records, errors } = parseExpensesFromTable(rows);
      if (records.length === 0) {
        setStatusMessage({
          type: 'error',
          text: errors[0] || 'No valid expense rows found.',
        });
        return;
      }
      onImportExpenses(records, replaceExisting);
      setStatusMessage({
        type: 'success',
        text: `Imported ${records.length} expense record${records.length > 1 ? 's' : ''}${
          errors.length > 0 ? ` (${errors.length} row skipped)` : ''
        }.`,
      });
      setPasteText('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || '');
      processRawTableText(text);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportReceivables = () => {
    const header = 'Invoice,Customer,City,Phone,Issue Date,Due Date,Billed INR,Paid INR,Balance Due INR';
    const lines = dataset.invoices.map((i) =>
      [
        i.invoiceNumber,
        `"${i.customerName.replace(/"/g, '""')}"`,
        `"${i.customerCity}"`,
        i.customerPhone,
        i.issueDate,
        i.dueDate,
        i.amount,
        i.paidAmount,
        Math.max(0, i.amount - i.paidAmount),
      ].join(',')
    );
    downloadTextFile(`${dataset.id}-receivables.csv`, [header, ...lines].join('\n'));
  };

  const handleExportExpenses = () => {
    const header = 'Date,Title,Category,Vendor,Amount INR,Payment Mode';
    const lines = dataset.expenses.map((e) =>
      [
        e.date,
        `"${e.title.replace(/"/g, '""')}"`,
        `"${e.category}"`,
        `"${e.vendor.replace(/"/g, '""')}"`,
        e.amount,
        e.paymentMode,
      ].join(',')
    );
    downloadTextFile(`${dataset.id}-expenses.csv`, [header, ...lines].join('\n'));
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      name: bizName.trim() || 'My Business',
      location: bizLocation.trim() || 'Madhya Pradesh, India',
      segment: bizSegment.trim() || 'Distributor / SME',
    });
    setStatusMessage({ type: 'success', text: 'Business details updated.' });
  };

  return (
    <div className="space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Excel / CSV Import & Financial Reports
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Bring in your existing spreadsheet data, test sample SME ledgers, or export partner-ready summaries
        </p>
      </div>

      {/* Sample Switcher & Business Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Import from Excel, Google Sheets, or CSV
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Copy rows straight from Excel and paste below, or upload a .csv file
              </p>
            </div>

            <div className="inline-flex p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  setImportKind('invoices');
                  setStatusMessage(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  importKind === 'invoices'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Credit Sales / Receivables
              </button>
              <button
                type="button"
                onClick={() => {
                  setImportKind('expenses');
                  setStatusMessage(null);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  importKind === 'expenses'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                Business Expenses
              </button>
            </div>
          </div>

          {statusMessage && (
            <div
              className={`px-4 py-3 rounded-lg border text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusMessage.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-4 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-xs text-slate-600">
              Need the exact column format? Download a starter CSV template.
            </div>
            <button
              type="button"
              onClick={() =>
                downloadTextFile(
                  importKind === 'invoices'
                    ? 'finsight-receivables-template.csv'
                    : 'finsight-expenses-template.csv',
                  importKind === 'invoices' ? SAMPLE_INVOICE_CSV : SAMPLE_EXPENSE_CSV
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Download {importKind === 'invoices' ? 'Receivables' : 'Expenses'} Template
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Paste Spreadsheet Rows (with column headers)
            </label>
            <textarea
              rows={5}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={
                importKind === 'invoices' ? SAMPLE_INVOICE_CSV : SAMPLE_EXPENSE_CSV
              }
              className="w-full p-3 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              Replace existing {importKind} instead of appending
            </label>

            <div className="flex flex-wrap items-center gap-2.5">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Upload CSV File
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <button
                type="button"
                onClick={() => processRawTableText(pasteText)}
                disabled={!pasteText.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 disabled:pointer-events-none rounded-lg transition-colors whitespace-nowrap"
              >
                Import Pasted Rows
              </button>
            </div>
          </div>
        </section>

        {/* Dataset Presets & Business Profile */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Sample Business Datasets
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Switch between demo distributor/dealer ledgers or start with a blank ledger
            </p>
          </div>

          <div className="space-y-2.5">
            {SAMPLE_DATASETS.map((preset) => {
              const active = dataset.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onSelectPreset(preset.id);
                    setStatusMessage({
                      type: 'success',
                      text: `Loaded sample ledger: ${preset.name}`,
                    });
                  }}
                  className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                    active
                      ? 'border-teal-700 bg-teal-50/50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-900">
                      {preset.name}
                    </span>
                    {active && (
                      <span className="text-xs font-medium text-teal-700">Active</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {preset.segment} · {preset.location}
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => {
                onClearLedger();
                setStatusMessage({
                  type: 'success',
                  text: 'Cleared ledger. You can now add or import your own business data.',
                });
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start Blank Ledger (My Own Data)
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-xs font-semibold text-slate-800">Customize Business Label</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="Business Name"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <input
                type="text"
                value={bizLocation}
                onChange={(e) => setBizLocation(e.target.value)}
                placeholder="City / State"
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={bizSegment}
                onChange={(e) => setBizSegment(e.target.value)}
                placeholder="Business Type (e.g. FMCG Dealer)"
                className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:border-teal-700"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                Save Name
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* Partner / CA / Bank Printable Summary & CSV Exports */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Financial Summary Report — {dataset.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Shareable overview for business partners, chartered accountants, or working-capital reviews · As of{' '}
              {formatShortDate(dataset.referenceDate)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              type="button"
              onClick={handleExportReceivables}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Receivables CSV
            </button>
            <button
              type="button"
              onClick={handleExportExpenses}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              Expenses CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Total Sales Billed</span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
              {formatINR(summary.totalSales)}
            </span>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Cash Collected</span>
            <span className="text-lg font-bold font-mono text-emerald-700 mt-1 block">
              {formatINR(summary.totalCollected)}
            </span>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Total Expenses</span>
            <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
              {formatINR(summary.totalExpenses)}
            </span>
          </div>
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-xs text-slate-500 block">Overdue Receivables</span>
            <span className="text-lg font-bold font-mono text-red-700 mt-1 block">
              {formatINR(summary.overdueAmount)}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};
