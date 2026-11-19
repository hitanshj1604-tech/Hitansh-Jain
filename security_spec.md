# FinSight Firestore Security Specification

## 1. Data Invariants
1. Every document under `/users/{userId}/...` belongs strictly to the verified Google account whose `request.auth.uid == userId` and `request.auth.token.email_verified == true`.
2. Every ledger, invoice, and expense document stores `ownerId == request.auth.uid` (immutable after creation).
3. Every subcollection document (`invoices`, `expenses`) enforces parent ledger existence and ownership via `get()` on `/users/{userId}/ledgers/{ledgerId}`, and ensures `ledgerId` matches the path parameter and stays immutable.
4. Numeric invariants: `invoice.amount > 0`, `invoice.paidAmount >= 0`, `invoice.paidAmount <= invoice.amount`, and `expense.amount > 0`.
5. Temporal integrity: `createdAt` and `updatedAt` must equal `request.time`, and `createdAt` is immutable on updates.
6. All path document IDs (`userId`, `ledgerId`, `invoiceId`, `expenseId`) match `^[a-zA-Z0-9_\-]+$` with length `<= 128`.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Read**: `GET /users/userA/ledgers/primary` with `auth = null`.
2. **Unverified Email**: `CREATE /users/userA/ledgers/primary` with `auth = { uid: 'userA', token: { email_verified: false } }`.
3. **Cross-User Read (PII Leak)**: `GET /users/userA/private/profile` as `userB`.
4. **Cross-User Invoice List**: `LIST /users/userA/ledgers/primary/invoices` as `userB`.
5. **Identity Spoofing on Create**: `CREATE /users/userB/ledgers/primary` with `ownerId: 'userA'` as `userB`.
6. **Shadow / Ghost Field Injection**: `CREATE /users/userA/ledgers/primary` containing an unexpected field `isAdmin: true`.
7. **ID Poisoning**: `CREATE /users/userA/ledgers/../../admin` or ID exceeding 128 chars.
8. **Negative or Over-Paid Invoice**: `CREATE /users/userA/ledgers/primary/invoices/inv1` with `amount: 1000, paidAmount: 5000`.
9. **Immutable Field Mutation**: `UPDATE /users/userA/ledgers/primary/invoices/inv1` modifying `ownerId` or `createdAt`.
10. **Client-Forged Timestamp**: `CREATE /users/userA/ledgers/primary/expenses/exp1` with client timestamp instead of `request.time`.
11. **Orphan Subcollection Write**: `CREATE /users/userA/ledgers/nonexistent/invoices/inv1` when parent ledger does not exist.
12. **Oversized String DoS**: `CREATE /users/userA/ledgers/primary/expenses/exp1` with `title` length > 140 chars.
