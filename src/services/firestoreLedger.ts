import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { BusinessDataset, ExpenseRecord, InvoiceRecord } from '../types/finance';

const LEDGER_ID = 'primary';

function clampStr(val: string | undefined, max: number, fallback = ''): string {
  const clean = (val ?? fallback).trim();
  return clean.slice(0, max) || fallback.slice(0, max);
}

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120);
  return cleaned || `id-${Date.now()}`;
}

export async function saveUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}/private/profile`;
  try {
    await setDoc(
      doc(db, 'users', user.uid, 'private', 'profile'),
      {
        uid: user.uid,
        email: clampStr(user.email || '', 200, 'user@example.com'),
        displayName: clampStr(user.displayName || 'FinSight User', 120, 'FinSight User'),
        ...(user.photoURL ? { photoURL: clampStr(user.photoURL, 500) } : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function ensureUserLedger(
  uid: string,
  seedDataset: BusinessDataset
): Promise<boolean> {
  const ledgerPath = `users/${uid}/ledgers/${LEDGER_ID}`;
  const ledgerRef = doc(db, 'users', uid, 'ledgers', LEDGER_ID);
  try {
    const snap = await getDoc(ledgerRef);
    if (snap.exists()) {
      return false; // Already exists in cloud
    }

    const batch = writeBatch(db);
    batch.set(ledgerRef, {
      ownerId: uid,
      name: clampStr(seedDataset.name, 120, 'My Business Ledger'),
      segment: clampStr(seedDataset.segment, 120, 'Distributor / SME'),
      location: clampStr(seedDataset.location, 120, 'Madhya Pradesh, India'),
      ownerName: clampStr(seedDataset.ownerName, 120, 'Business Owner'),
      referenceDate: clampStr(seedDataset.referenceDate, 10, '2026-11-19'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    for (const inv of seedDataset.invoices) {
      const invId = sanitizeId(inv.id);
      const invRef = doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices', invId);
      batch.set(invRef, buildInvoicePayload(uid, inv));
    }

    for (const exp of seedDataset.expenses) {
      const expId = sanitizeId(exp.id);
      const expRef = doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses', expId);
      batch.set(expRef, buildExpensePayload(uid, exp));
    }

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ledgerPath);
  }
}

function buildInvoicePayload(uid: string, inv: Omit<InvoiceRecord, 'id'>) {
  const amount = Math.max(1, Math.round(inv.amount));
  const paidAmount = Math.min(amount, Math.max(0, Math.round(inv.paidAmount)));
  return {
    ownerId: uid,
    ledgerId: LEDGER_ID,
    invoiceNumber: clampStr(inv.invoiceNumber, 64, `INV-${Date.now()}`),
    customerName: clampStr(inv.customerName, 120, 'Customer'),
    customerCity: clampStr(inv.customerCity, 80, 'Indore'),
    customerPhone: clampStr(inv.customerPhone, 32, '+91 98260 00000'),
    issueDate: clampStr(inv.issueDate, 10, '2026-11-01'),
    dueDate: clampStr(inv.dueDate, 10, '2026-11-15'),
    amount,
    paidAmount,
    ...(inv.lastPaymentDate ? { lastPaymentDate: clampStr(inv.lastPaymentDate, 10) } : {}),
    ...(inv.notes ? { notes: clampStr(inv.notes, 300) } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function buildExpensePayload(uid: string, exp: Omit<ExpenseRecord, 'id'>) {
  return {
    ownerId: uid,
    ledgerId: LEDGER_ID,
    date: clampStr(exp.date, 10, '2026-11-10'),
    title: clampStr(exp.title, 140, 'Business Expense'),
    category: exp.category,
    vendor: clampStr(exp.vendor, 120, 'Vendor'),
    amount: Math.max(1, Math.round(exp.amount)),
    paymentMode: exp.paymentMode,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function subscribeToUserLedger(
  uid: string,
  callbacks: {
    onMeta: (meta: Omit<BusinessDataset, 'id' | 'invoices' | 'expenses'>) => void;
    onInvoices: (invoices: InvoiceRecord[]) => void;
    onExpenses: (expenses: ExpenseRecord[]) => void;
  }
): () => void {
  const ledgerPath = `users/${uid}/ledgers/${LEDGER_ID}`;
  const invoicesPath = `${ledgerPath}/invoices`;
  const expensesPath = `${ledgerPath}/expenses`;

  const unsubLedger = onSnapshot(
    doc(db, 'users', uid, 'ledgers', LEDGER_ID),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      callbacks.onMeta({
        name: String(d.name || 'My Business Ledger'),
        segment: String(d.segment || 'Distributor / SME'),
        location: String(d.location || 'Madhya Pradesh, India'),
        ownerName: String(d.ownerName || 'Business Owner'),
        referenceDate: String(d.referenceDate || '2026-11-19'),
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, ledgerPath);
    }
  );

  const invoicesQuery = query(
    collection(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices'),
    where('ownerId', '==', uid),
    where('ledgerId', '==', LEDGER_ID)
  );
  const unsubInvoices = onSnapshot(
    invoicesQuery,
    (snapshot) => {
      const list: InvoiceRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          invoiceNumber: String(data.invoiceNumber || ''),
          customerName: String(data.customerName || ''),
          customerCity: String(data.customerCity || ''),
          customerPhone: String(data.customerPhone || ''),
          issueDate: String(data.issueDate || ''),
          dueDate: String(data.dueDate || ''),
          amount: Number(data.amount || 0),
          paidAmount: Number(data.paidAmount || 0),
          lastPaymentDate: data.lastPaymentDate ? String(data.lastPaymentDate) : undefined,
          notes: data.notes ? String(data.notes) : undefined,
        };
      });
      callbacks.onInvoices(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, invoicesPath);
    }
  );

  const expensesQuery = query(
    collection(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses'),
    where('ownerId', '==', uid),
    where('ledgerId', '==', LEDGER_ID)
  );
  const unsubExpenses = onSnapshot(
    expensesQuery,
    (snapshot) => {
      const list: ExpenseRecord[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          date: String(data.date || ''),
          title: String(data.title || ''),
          category: data.category as ExpenseRecord['category'],
          vendor: String(data.vendor || ''),
          amount: Number(data.amount || 0),
          paymentMode: data.paymentMode as ExpenseRecord['paymentMode'],
        };
      });
      callbacks.onExpenses(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, expensesPath);
    }
  );

  return () => {
    unsubLedger();
    unsubInvoices();
    unsubExpenses();
  };
}

export async function updateLedgerProfileDoc(
  uid: string,
  updates: Partial<Pick<BusinessDataset, 'name' | 'segment' | 'location' | 'ownerName'>>
): Promise<void> {
  const path = `users/${uid}/ledgers/${LEDGER_ID}`;
  try {
    const cleanUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
    if (updates.name !== undefined) cleanUpdates.name = clampStr(updates.name, 120, 'My Business');
    if (updates.segment !== undefined) cleanUpdates.segment = clampStr(updates.segment, 120, 'SME');
    if (updates.location !== undefined) cleanUpdates.location = clampStr(updates.location, 120, 'India');
    if (updates.ownerName !== undefined) cleanUpdates.ownerName = clampStr(updates.ownerName, 120, 'Owner');
    await updateDoc(doc(db, 'users', uid, 'ledgers', LEDGER_ID), cleanUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createInvoiceDoc(
  uid: string,
  inv: Omit<InvoiceRecord, 'id'>
): Promise<void> {
  const invId = sanitizeId(`inv-${Date.now()}`);
  const path = `users/${uid}/ledgers/${LEDGER_ID}/invoices/${invId}`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices', invId),
      buildInvoicePayload(uid, inv)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function recordInvoicePaymentDoc(
  uid: string,
  invoiceId: string,
  newPaidAmount: number,
  paymentDate: string
): Promise<void> {
  const invId = sanitizeId(invoiceId);
  const path = `users/${uid}/ledgers/${LEDGER_ID}/invoices/${invId}`;
  try {
    await updateDoc(doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices', invId), {
      paidAmount: Math.max(0, Math.round(newPaidAmount)),
      lastPaymentDate: clampStr(paymentDate, 10, '2026-11-19'),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteInvoiceDoc(uid: string, invoiceId: string): Promise<void> {
  const invId = sanitizeId(invoiceId);
  const path = `users/${uid}/ledgers/${LEDGER_ID}/invoices/${invId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices', invId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createExpenseDoc(
  uid: string,
  exp: Omit<ExpenseRecord, 'id'>
): Promise<void> {
  const expId = sanitizeId(`exp-${Date.now()}`);
  const path = `users/${uid}/ledgers/${LEDGER_ID}/expenses/${expId}`;
  try {
    await setDoc(
      doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses', expId),
      buildExpensePayload(uid, exp)
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteExpenseDoc(uid: string, expenseId: string): Promise<void> {
  const expId = sanitizeId(expenseId);
  const path = `users/${uid}/ledgers/${LEDGER_ID}/expenses/${expId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses', expId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function batchImportInvoices(
  uid: string,
  records: InvoiceRecord[],
  replaceExisting: boolean
): Promise<void> {
  const colPath = `users/${uid}/ledgers/${LEDGER_ID}/invoices`;
  try {
    const batch = writeBatch(db);
    if (replaceExisting) {
      const existingSnap = await getDocs(
        query(
          collection(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices'),
          where('ownerId', '==', uid),
          where('ledgerId', '==', LEDGER_ID)
        )
      );
      existingSnap.forEach((d) => batch.delete(d.ref));
    }
    records.forEach((inv, idx) => {
      const invId = sanitizeId(inv.id || `imp-inv-${Date.now()}-${idx}`);
      batch.set(
        doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices', invId),
        buildInvoicePayload(uid, inv)
      );
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }
}

export async function batchImportExpenses(
  uid: string,
  records: ExpenseRecord[],
  replaceExisting: boolean
): Promise<void> {
  const colPath = `users/${uid}/ledgers/${LEDGER_ID}/expenses`;
  try {
    const batch = writeBatch(db);
    if (replaceExisting) {
      const existingSnap = await getDocs(
        query(
          collection(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses'),
          where('ownerId', '==', uid),
          where('ledgerId', '==', LEDGER_ID)
        )
      );
      existingSnap.forEach((d) => batch.delete(d.ref));
    }
    records.forEach((exp, idx) => {
      const expId = sanitizeId(exp.id || `imp-exp-${Date.now()}-${idx}`);
      batch.set(
        doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses', expId),
        buildExpensePayload(uid, exp)
      );
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, colPath);
  }
}

export async function replaceCloudDataset(
  uid: string,
  nextDataset: BusinessDataset
): Promise<void> {
  const ledgerPath = `users/${uid}/ledgers/${LEDGER_ID}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', uid, 'ledgers', LEDGER_ID), {
      name: clampStr(nextDataset.name, 120, 'My Business Ledger'),
      segment: clampStr(nextDataset.segment, 120, 'Distributor / SME'),
      location: clampStr(nextDataset.location, 120, 'Madhya Pradesh, India'),
      ownerName: clampStr(nextDataset.ownerName, 120, 'Business Owner'),
      referenceDate: clampStr(nextDataset.referenceDate, 10, '2026-11-19'),
      updatedAt: serverTimestamp(),
    });

    const oldInvSnap = await getDocs(
      query(
        collection(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices'),
        where('ownerId', '==', uid),
        where('ledgerId', '==', LEDGER_ID)
      )
    );
    oldInvSnap.forEach((d) => batch.delete(d.ref));

    const oldExpSnap = await getDocs(
      query(
        collection(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses'),
        where('ownerId', '==', uid),
        where('ledgerId', '==', LEDGER_ID)
      )
    );
    oldExpSnap.forEach((d) => batch.delete(d.ref));

    nextDataset.invoices.forEach((inv, idx) => {
      const invId = sanitizeId(inv.id || `inv-${Date.now()}-${idx}`);
      batch.set(
        doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'invoices', invId),
        buildInvoicePayload(uid, inv)
      );
    });

    nextDataset.expenses.forEach((exp, idx) => {
      const expId = sanitizeId(exp.id || `exp-${Date.now()}-${idx}`);
      batch.set(
        doc(db, 'users', uid, 'ledgers', LEDGER_ID, 'expenses', expId),
        buildExpensePayload(uid, exp)
      );
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ledgerPath);
  }
}
