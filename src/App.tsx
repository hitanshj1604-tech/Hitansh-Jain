import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  Menu,
  Plus,
  ReceiptIndianRupee,
  Upload,
  X,
} from 'lucide-react';
import {
  BusinessDataset,
  ExpenseRecord,
  InvoiceRecord,
  NavSection,
  PeriodFilter,
} from './types/finance';
import { createBlankDataset, SAMPLE_DATASETS } from './data/sampleDatasets';
import { computeFinancialSummary } from './utils/analytics';
import { formatINRCompact } from './utils/formatters';
import { OverviewView } from './components/OverviewView';
import { ReceivablesView } from './components/ReceivablesView';
import { CashFlowExpensesView } from './components/CashFlowExpensesView';
import { ImportReportsView } from './components/ImportReportsView';
import { EntryModal, ModalMode } from './components/EntryModal';
import { ReminderModal } from './components/ReminderModal';

const STORAGE_KEY = 'finsight_active_dataset_v1';

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'receivables', label: 'Receivables', icon: ReceiptIndianRupee },
  { id: 'cashflow', label: 'Cash Flow & Expenses', icon: ArrowLeftRight },
  { id: 'import', label: 'Import & Reports', icon: FileSpreadsheet },
];

export default function App() {
  const [dataset, setDataset] = useState<BusinessDataset>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as BusinessDataset;
        if (parsed && Array.isArray(parsed.invoices) && Array.isArray(parsed.expenses)) {
          return parsed;
        }
      }
    } catch {
      // Fall back to default sample dataset
    }
    return SAMPLE_DATASETS[0];
  });

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState<ModalMode>('invoice');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | undefined>(undefined);
  const [reminderInvoice, setReminderInvoice] = useState<InvoiceRecord | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
    } catch {
      // Ignore storage quota issues
    }
  }, [dataset]);

  const summary = useMemo(
    () => computeFinancialSummary(dataset, period),
    [dataset, period]
  );

  const openModal = (mode: ModalMode, invId?: string) => {
    setEntryModalMode(mode);
    setPaymentInvoiceId(invId);
    setEntryModalOpen(true);
  };

  const handleAddInvoice = (newInv: Omit<InvoiceRecord, 'id'>) => {
    setDataset((prev) => ({
      ...prev,
      invoices: [
        { ...newInv, id: `inv-${Date.now()}` },
        ...prev.invoices,
      ],
    }));
  };

  const handleAddExpense = (newExp: Omit<ExpenseRecord, 'id'>) => {
    setDataset((prev) => ({
      ...prev,
      expenses: [
        { ...newExp, id: `exp-${Date.now()}` },
        ...prev.expenses,
      ],
    }));
  };

  const handleRecordPayment = (invoiceId: string, paymentAmount: number, paymentDate: string) => {
    setDataset((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) =>
        inv.id === invoiceId
          ? {
              ...inv,
              paidAmount: Math.min(inv.amount, inv.paidAmount + paymentAmount),
              lastPaymentDate: paymentDate,
            }
          : inv
      ),
    }));
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    setDataset((prev) => ({
      ...prev,
      invoices: prev.invoices.filter((i) => i.id !== invoiceId),
    }));
  };

  const handleDeleteExpense = (expenseId: string) => {
    setDataset((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== expenseId),
    }));
  };

  const handleSelectPreset = (presetId: string) => {
    const found = SAMPLE_DATASETS.find((d) => d.id === presetId);
    if (found) {
      setDataset(found);
      setPeriod('all');
    }
  };

  const handleClearLedger = () => {
    setDataset(createBlankDataset());
    setPeriod('all');
  };

  const handleUpdateProfile = (
    updates: Partial<Pick<BusinessDataset, 'name' | 'segment' | 'location' | 'ownerName'>>
  ) => {
    setDataset((prev) => ({ ...prev, ...updates }));
  };

  const handleImportInvoices = (records: InvoiceRecord[], replaceExisting: boolean) => {
    setDataset((prev) => ({
      ...prev,
      invoices: replaceExisting ? records : [...records, ...prev.invoices],
    }));
  };

  const handleImportExpenses = (records: ExpenseRecord[], replaceExisting: boolean) => {
    setDataset((prev) => ({
      ...prev,
      expenses: replaceExisting ? records : [...records, ...prev.expenses],
    }));
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeSection)?.label || 'Overview';

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('overview');
            setMobileMenuOpen(false);
          }}
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          <span className="w-7 h-7 rounded-lg bg-teal-700 text-white flex items-center justify-center text-sm font-bold">
            F
          </span>
          <span>FinSight</span>
        </a>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primary navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-teal-50 text-teal-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
              }`}
            >
              <span className="inline-flex items-center gap-2.5">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-teal-700' : 'text-slate-400'
                  }`}
                />
                <span>{item.label}</span>
              </span>
              {item.id === 'receivables' && summary.overdueCount > 0 && (
                <span className="font-mono text-xs font-semibold text-red-700 tabular-nums">
                  {summary.overdueCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Active Business Switcher in Sidebar Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3">
        <div>
          <div className="text-xs font-medium text-slate-400">Active Business</div>
          <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
            {dataset.name}
          </div>
          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
            Overdue: <span className="font-mono text-red-700">{formatINRCompact(summary.overdueAmount)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveSection('import');
            setMobileMenuOpen(false);
          }}
          className="w-full py-2 px-3 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors text-center whitespace-nowrap"
        >
          Switch Dataset / Import CSV
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-62 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-50">{SidebarContent}</div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, max 2 primary actions on right */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <nav className="flex items-center gap-1.5 text-sm min-w-0" aria-label="Breadcrumb">
              <span className="text-slate-500 whitespace-nowrap">FinSight</span>
              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-900 truncate">{activeNavLabel}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSection('import')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              Import Data
            </button>

            <button
              type="button"
              onClick={() => openModal(activeSection === 'cashflow' ? 'expense' : 'invoice')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Record Entry
            </button>
          </div>
        </header>

        {/* Viewport Container */}
        <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {activeSection === 'overview' && (
            <OverviewView
              dataset={dataset}
              summary={summary}
              period={period}
              onPeriodChange={setPeriod}
              onNavigate={setActiveSection}
              onOpenPaymentModal={(invId) => openModal('payment', invId)}
              onOpenReminderModal={(inv) => setReminderInvoice(inv)}
              onOpenAddModal={() => openModal('invoice')}
            />
          )}

          {activeSection === 'receivables' && (
            <ReceivablesView
              invoices={dataset.invoices}
              referenceDate={dataset.referenceDate}
              summary={summary}
              onOpenAddInvoice={() => openModal('invoice')}
              onOpenPaymentModal={(invId) => openModal('payment', invId)}
              onOpenReminderModal={(inv) => setReminderInvoice(inv)}
              onDeleteInvoice={handleDeleteInvoice}
            />
          )}

          {activeSection === 'cashflow' && (
            <CashFlowExpensesView
              expenses={dataset.expenses}
              summary={summary}
              onOpenAddExpense={() => openModal('expense')}
              onDeleteExpense={handleDeleteExpense}
            />
          )}

          {activeSection === 'import' && (
            <ImportReportsView
              dataset={dataset}
              summary={summary}
              onSelectPreset={handleSelectPreset}
              onClearLedger={handleClearLedger}
              onUpdateProfile={handleUpdateProfile}
              onImportInvoices={handleImportInvoices}
              onImportExpenses={handleImportExpenses}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <EntryModal
        isOpen={entryModalOpen}
        initialMode={entryModalMode}
        invoices={dataset.invoices}
        preselectedInvoiceId={paymentInvoiceId}
        referenceDate={dataset.referenceDate}
        onClose={() => setEntryModalOpen(false)}
        onAddInvoice={handleAddInvoice}
        onAddExpense={handleAddExpense}
        onRecordPayment={handleRecordPayment}
      />

      <ReminderModal
        invoice={reminderInvoice}
        businessName={dataset.name}
        referenceDate={dataset.referenceDate}
        onClose={() => setReminderInvoice(null)}
      />
    </div>
  );
}
