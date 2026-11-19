import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  ArrowLeftRight,
  ChevronRight,
  FileSpreadsheet,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ReceiptIndianRupee,
  X,
} from 'lucide-react';
import { auth, googleProvider } from './firebase';
import {
  batchImportExpenses,
  batchImportInvoices,
  createExpenseDoc,
  createInvoiceDoc,
  deleteExpenseDoc,
  deleteInvoiceDoc,
  ensureUserLedger,
  recordInvoicePaymentDoc,
  replaceCloudDataset,
  saveUserProfile,
  subscribeToUserLedger,
  updateLedgerProfileDoc,
} from './services/firestoreLedger';
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

const GoogleGIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96z"
    />
  </svg>
);

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

  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [period, setPeriod] = useState<PeriodFilter>('all');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [entryModalOpen, setEntryModalOpen] = useState(false);
  const [entryModalMode, setEntryModalMode] = useState<ModalMode>('invoice');
  const [paymentInvoiceId, setPaymentInvoiceId] = useState<string | undefined>(undefined);
  const [reminderInvoice, setReminderInvoice] = useState<InvoiceRecord | null>(null);

  // Save local copy when signed out
  useEffect(() => {
    if (!user) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataset));
      } catch {
        // Ignore storage quota issues
      }
    }
  }, [dataset, user]);

  // Firebase Auth listener + Firestore live ledger subscription
  useEffect(() => {
    let unsubLedger: (() => void) | null = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubLedger) {
        unsubLedger();
        unsubLedger = null;
      }

      setUser(nextUser);
      setAvatarFailed(false);
      setAuthReady(true);

      if (!nextUser) {
        return;
      }

      try {
        await saveUserProfile(nextUser);
        await ensureUserLedger(nextUser.uid, datasetRef.current);
        if (cancelled) return;

        unsubLedger = subscribeToUserLedger(nextUser.uid, {
          onMeta: (meta) => {
            setDataset((prev) => ({
              ...prev,
              id: 'primary',
              ...meta,
            }));
          },
          onInvoices: (invoices) => {
            setDataset((prev) => ({
              ...prev,
              id: 'primary',
              invoices,
            }));
          },
          onExpenses: (expenses) => {
            setDataset((prev) => ({
              ...prev,
              id: 'primary',
              expenses,
            }));
          },
        });
      } catch (err) {
        if (!cancelled) {
          setAuthError(
            err instanceof Error
              ? err.message
              : 'Could not sync your Google ledger. Please try again.'
          );
        }
      }
    });

    return () => {
      cancelled = true;
      if (unsubLedger) unsubLedger();
      unsubAuth();
    };
  }, []);

  const handleSignInWithGoogle = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setAuthError('Google sign-in popup was closed before completing.');
      } else if (code === 'auth/popup-blocked') {
        setAuthError('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        setAuthError(
          err instanceof Error ? err.message : 'Google Sign-In failed. Please try again.'
        );
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await signOut(auth);
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as BusinessDataset;
          if (parsed && Array.isArray(parsed.invoices)) {
            setDataset(parsed);
            return;
          }
        }
      } catch {
        // Ignore parse error
      }
      setDataset(SAMPLE_DATASETS[0]);
    } finally {
      setAuthBusy(false);
    }
  };

  const summary = useMemo(
    () => computeFinancialSummary(dataset, period),
    [dataset, period]
  );

  const openModal = (mode: ModalMode, invId?: string) => {
    setEntryModalMode(mode);
    setPaymentInvoiceId(invId);
    setEntryModalOpen(true);
  };

  const handleAddInvoice = async (newInv: Omit<InvoiceRecord, 'id'>) => {
    if (user) {
      await createInvoiceDoc(user.uid, newInv);
    } else {
      setDataset((prev) => ({
        ...prev,
        invoices: [{ ...newInv, id: `inv-${Date.now()}` }, ...prev.invoices],
      }));
    }
  };

  const handleAddExpense = async (newExp: Omit<ExpenseRecord, 'id'>) => {
    if (user) {
      await createExpenseDoc(user.uid, newExp);
    } else {
      setDataset((prev) => ({
        ...prev,
        expenses: [{ ...newExp, id: `exp-${Date.now()}` }, ...prev.expenses],
      }));
    }
  };

  const handleRecordPayment = async (
    invoiceId: string,
    paymentAmount: number,
    paymentDate: string
  ) => {
    const target = dataset.invoices.find((i) => i.id === invoiceId);
    if (!target) return;
    const updatedPaid = Math.min(target.amount, target.paidAmount + paymentAmount);
    if (user) {
      await recordInvoicePaymentDoc(user.uid, invoiceId, updatedPaid, paymentDate);
    } else {
      setDataset((prev) => ({
        ...prev,
        invoices: prev.invoices.map((inv) =>
          inv.id === invoiceId
            ? {
                ...inv,
                paidAmount: updatedPaid,
                lastPaymentDate: paymentDate,
              }
            : inv
        ),
      }));
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (user) {
      await deleteInvoiceDoc(user.uid, invoiceId);
    } else {
      setDataset((prev) => ({
        ...prev,
        invoices: prev.invoices.filter((i) => i.id !== invoiceId),
      }));
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (user) {
      await deleteExpenseDoc(user.uid, expenseId);
    } else {
      setDataset((prev) => ({
        ...prev,
        expenses: prev.expenses.filter((e) => e.id !== expenseId),
      }));
    }
  };

  const handleSelectPreset = async (presetId: string) => {
    const found = SAMPLE_DATASETS.find((d) => d.id === presetId);
    if (!found) return;
    setPeriod('all');
    if (user) {
      await replaceCloudDataset(user.uid, found);
    } else {
      setDataset(found);
    }
  };

  const handleClearLedger = async () => {
    const blank = createBlankDataset();
    setPeriod('all');
    if (user) {
      await replaceCloudDataset(user.uid, blank);
    } else {
      setDataset(blank);
    }
  };

  const handleUpdateProfile = async (
    updates: Partial<Pick<BusinessDataset, 'name' | 'segment' | 'location' | 'ownerName'>>
  ) => {
    if (user) {
      await updateLedgerProfileDoc(user.uid, updates);
    } else {
      setDataset((prev) => ({ ...prev, ...updates }));
    }
  };

  const handleImportInvoices = async (records: InvoiceRecord[], replaceExisting: boolean) => {
    if (user) {
      await batchImportInvoices(user.uid, records, replaceExisting);
    } else {
      setDataset((prev) => ({
        ...prev,
        invoices: replaceExisting ? records : [...records, ...prev.invoices],
      }));
    }
  };

  const handleImportExpenses = async (records: ExpenseRecord[], replaceExisting: boolean) => {
    if (user) {
      await batchImportExpenses(user.uid, records, replaceExisting);
    } else {
      setDataset((prev) => ({
        ...prev,
        expenses: replaceExisting ? records : [...records, ...prev.expenses],
      }));
    }
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeSection)?.label || 'Overview';
  const userInitial = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

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

      {/* Active Business & Google Account Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3">
        <div>
          <div className="text-xs font-medium text-slate-400">
            {user ? 'Synced to Google' : 'Local Demo Ledger'}
          </div>
          <div className="text-xs font-semibold text-slate-900 truncate mt-0.5">
            {dataset.name}
          </div>
          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
            Overdue:{' '}
            <span className="font-mono text-red-700">
              {formatINRCompact(summary.overdueAmount)}
            </span>
          </div>
        </div>

        {user ? (
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-800 truncate">
                {user.displayName || 'Google User'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={authBusy}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleSignInWithGoogle}
            disabled={authBusy || !authReady}
            className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <GoogleGIcon className="w-3.5 h-3.5" />
            Sign in with Google
          </button>
        )}
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
        {/* Top Bar Contract: Breadcrumb on left, Google Sign-In / Profile + Record Entry on right */}
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
            {user ? (
              <div className="hidden sm:inline-flex items-center gap-2.5 pr-1">
                {user.photoURL && !avatarFailed ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User avatar'}
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarFailed(true)}
                    className="w-7 h-7 rounded-full object-cover border border-slate-200"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center">
                    {userInitial}
                  </span>
                )}
                <span className="text-xs font-medium text-slate-700 max-w-[140px] truncate">
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={authBusy}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignInWithGoogle}
                disabled={authBusy || !authReady}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                <GoogleGIcon className="w-3.5 h-3.5" />
                <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
              </button>
            )}

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

        {authError && (
          <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between gap-4 text-xs text-red-700">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-red-700 hover:text-red-900 font-medium whitespace-nowrap"
            >
              Dismiss
            </button>
          </div>
        )}

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
