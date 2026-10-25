# NexBill DB Schema — Deep Structural Audit for Billion-Row Scale

> **Question answered**: Beyond the Int→BigInt issue, can the current table structure handle billions of rows?  
> **Short answer**: **No. There are 13 critical structural problems** that will cause failures, data corruption, or full-system timeouts well before you hit billions.

---

## 🔴 CRITICAL Issues (Will break at scale)

### Issue #1: `Business` is a God Table — 39 columns, violates 3NF

[Business model](file:///c:/Users/HP/Desktop/nexbill/nexbill_backend/prisma/schema.prisma#L76-L143) has **39 columns** mixing:
- Identity data (name, gstin, phone, email)
- GST settings (gstEnabled, compositionScheme, rcmEnabled)
- Print preferences (printTemplateStyle, printPageSize, printShowLogo, printBankDetails, printTermsFooter)
- **9 pairs** of numbering fields (18 columns just for document numbering)

**Why this breaks at scale:**
- Every single API call does `prisma.business.findUnique()` which fetches ALL 39 columns
- The `Text` columns (billingAddress, printBankDetails, printTermsFooter) make the row physically large — MariaDB/MySQL has a ~65KB row size limit for InnoDB
- Adding more settings requires ALTER TABLE on a hot table

**Fix — Decompose into 4 tables:**

```prisma
model Business {
  id             BigInt   @id @default(autoincrement())
  name           String
  gstin          String?
  phone          String?
  email          String?
  billingAddress String?  @db.Text
  state          String?
  businessType   String?
  logoUrl        String?
  signatureUrl   String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  settings       BusinessSettings?
  printConfig    BusinessPrintConfig?
  numbering      BusinessNumbering?
  // ... all existing relations
  
  @@map("businesses")
}

model BusinessSettings {
  id                         BigInt   @id
  businessId                 BigInt   @unique
  gstEnabled                 Boolean  @default(false)
  compositionScheme          Boolean  @default(false)
  defaultTaxRate             Decimal? @db.Decimal(12, 2)
  rcmEnabled                 Boolean  @default(false)
  showHsnColumn              Boolean  @default(true)
  calculateTaxBeforeDiscount Boolean  @default(false)
  
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  @@map("business_settings")
}

model BusinessPrintConfig {
  id               BigInt   @id
  businessId       BigInt   @unique
  templateStyle    String?
  pageSize         String?  @default("A4")
  showLogo         Boolean  @default(true)
  bankDetails      String?  @db.Text
  termsFooter      String?  @db.Text
  
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  @@map("business_print_configs")
}

model BusinessNumbering {
  id                    BigInt @id
  businessId            BigInt @unique
  salesPrefix           String?
  salesNext             Int    @default(1)
  purchasePrefix        String?
  purchaseNext          Int    @default(1)
  estimatePrefix        String?
  estimateNext          Int    @default(1)
  challanPrefix         String?
  challanNext           Int    @default(1)
  orderPrefix           String?
  orderNext             Int    @default(1)
  returnPrefix          String?
  returnNext            Int    @default(1)
  receiptPrefix         String?
  receiptNext           Int    @default(1)
  paymentOutPrefix      String?
  paymentOutNext        Int    @default(1)
  debitNotePrefix       String?
  debitNoteNext         Int    @default(1)
  
  business Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  @@map("business_numbering")
}
```

**Impact**: Main `businesses` table drops from ~39 cols to ~12 cols. Row size shrinks from ~4KB+ to ~500B. Faster reads, less memory per query.

---

### Issue #2: `Item.stockQuantity` & `Item.stockValue` are Denormalized — Update Anomaly Risk

[Item model](file:///c:/Users/HP/Desktop/nexbill/nexbill_backend/prisma/schema.prisma#L265-L306) stores `stockQuantity`, `stockValue`, and `allocatedStock` directly on the item, but you ALSO have a [StockLedger](file:///c:/Users/HP/Desktop/nexbill/nexbill_backend/prisma/schema.prisma#L318-L334) that records every stock movement.

**Why this breaks:**
- **Dual-write anomaly**: If the app crashes between writing the StockLedger entry and updating Item.stockQuantity, they go out of sync. At billions of transactions, this WILL happen.
- **Race condition**: Two concurrent sales for the same item can both read `stockQuantity = 10`, both sell 3, and both write `stockQuantity = 7` instead of `4`.
- This violates **3NF** — `stockQuantity` is derivable from `SUM(stock_ledgers.quantity)`.

**Fix:**
```
Option A (Recommended for scale):
  - REMOVE stockQuantity and stockValue from Item
  - Compute on-demand: SELECT SUM(quantity) FROM stock_ledgers WHERE itemId = ?
  - Add a materialized view or cache layer for dashboard reads
  - Use DB-level locking on StockLedger INSERT for consistency

Option B (Keep as cache, but make it safe):
  - Keep the columns as a read-cache
  - ALWAYS derive the truth from StockLedger
  - Add a periodic reconciliation job that recalculates from ledger
  - Use SELECT ... FOR UPDATE on Item row during stock operations
```

---

### Issue #3: `BankAccount.currentBalance` — Same Denormalization Problem

[BankAccount](file:///c:/Users/HP/Desktop/nexbill/nexbill_backend/prisma/schema.prisma#L852-L871) stores `currentBalance`, but [BankingTransaction](file:///c:/Users/HP/Desktop/nexbill/nexbill_backend/prisma/schema.prisma#L879-L894) records every movement.

Same problem as Issue #2 — two systems of truth. At scale, they **will** diverge.

**Fix**: Same approach as Item — compute from transactions, cache if needed.

---

### Issue #4: `StockLedger` Uses Polymorphic Association — Cannot Be Indexed

```prisma
model StockLedger {
  referenceType String?   // "SalesInvoice", "PurchaseInvoice", etc.
  referenceId   Int?      // FK to... which table?
}
```

**Why this is a problem:**
- **No FK constraint** — the DB can't enforce that `referenceId` actually exists in the referenced table
- **Can't build an index** that's useful — you'd need a composite index `(referenceType, referenceId)` but it's still slow because it's a string comparison
- **Orphaned references** — if you delete a SalesInvoice, the StockLedger entries pointing to it are NOT cascade-deleted (no FK!)
- At billions of ledger rows, querying "all stock movements for invoice X" requires a full scan of the string column

**Fix — Use explicit nullable FKs:**
```prisma
model StockLedger {
  id               BigInt  @id @default(autoincrement())
  businessId       BigInt
  itemId           BigInt
  type             StockTransactionType
  quantity         Decimal @db.Decimal(12, 4)
  adjustedValue    Decimal? @db.Decimal(12, 2)
  description      String?
  
  // Explicit typed references instead of polymorphic
  salesInvoiceId      BigInt?
  purchaseInvoiceId   BigInt?
  salesReturnId       BigInt?
  purchaseReturnId    BigInt?
  manufacturingOrderId BigInt?
  adjustmentNote      String?   // for manual adjustments
  
  createdAt DateTime @default(now())

  business          Business           @relation(...)
  item              Item               @relation(...)
  salesInvoice      SalesInvoice?      @relation(fields: [salesInvoiceId], references: [id])
  purchaseInvoice   PurchaseInvoice?   @relation(fields: [purchaseInvoiceId], references: [id])
  salesReturn       SalesReturn?       @relation(fields: [salesReturnId], references: [id])
  purchaseReturn    PurchaseReturn?    @relation(fields: [purchaseReturnId], references: [id])
  manufacturingOrder ManufacturingOrder? @relation(fields: [manufacturingOrderId], references: [id])
  
  @@index([businessId, itemId])
  @@index([salesInvoiceId])
  @@index([purchaseInvoiceId])
  @@map("stock_ledgers")
}
```

Now every reference is a **real FK** with cascade behavior, proper indexing, and referential integrity.

---

### Issue #5: `DocumentAuditLog` — Same Polymorphic Problem

```prisma
model DocumentAuditLog {
  documentType  String    // "SalesInvoice", "PurchaseInvoice"...
  documentId    Int       // FK to... which table?
}
```

Same problem as #4. No FK enforcement, no index benefit, orphaned records.

**Fix**: Same — use explicit nullable FKs per document type, or keep polymorphic but add `@@index([documentType, documentId])` as a minimum compromise.

---

### Issue #6: `File` Model — Same Polymorphic Problem

```prisma
model File {
  referenceType String?
  referenceId   Int?
}
```

Third instance of the same anti-pattern.

---

## 🟠 MAJOR Issues (Performance disasters at scale)

### Issue #7: 8 Identical Row Tables — Massive Schema Redundancy

You have **8 row tables** that are structurally identical:

| Table | Parent FK |
|---|---|
| `SalesInvoiceRow` | `invoiceId` |
| `EstimateRow` | `estimateId` |
| `SalesReturnRow` | `salesReturnId` |
| `SalesOrderRow` | `salesOrderId` |
| `DeliveryChallanRow` | `deliveryChallanId` |
| `PurchaseInvoiceRow` | `purchaseInvoiceId` |
| `PurchaseReturnRow` | `purchaseReturnId` |

Every single one has the exact same columns: `itemId, itemName, hsn, qty, unit, unitMultiplier, price, discountValue, discountIsPercentage, taxRate, taxAmount, total, box`.

**Why this is a problem at scale:**
- 8 separate tables means 8× the index maintenance overhead
- 8× the migration effort for any column change
- Can't do cross-document queries (e.g., "all items sold AND returned") without UNION across 8 tables
- At billions of rows, you have 8 billion-row tables instead of 1

**Fix — Unified `DocumentRow` table:**
```prisma
enum DocumentType {
  SALES_INVOICE
  ESTIMATE
  SALES_RETURN
  SALES_ORDER
  DELIVERY_CHALLAN
  PURCHASE_INVOICE
  PURCHASE_RETURN
}

model DocumentRow {
  id                   BigInt       @id @default(autoincrement())
  documentType         DocumentType
  documentId           BigInt       // FK to parent (no Prisma polymorphic FK, enforce in app)
  itemId               BigInt?
  itemName             String
  hsn                  String?
  qty                  Decimal      @db.Decimal(12, 4)
  unit                 String?
  unitMultiplier       Decimal      @default(1) @db.Decimal(12, 4)
  price                Decimal      @db.Decimal(12, 2)
  discountValue        Decimal      @default(0) @db.Decimal(12, 2)
  discountIsPercentage Boolean      @default(false)
  taxRate              Decimal      @default(0) @db.Decimal(5, 2)
  taxAmount            Decimal      @default(0) @db.Decimal(12, 2)
  total                Decimal      @db.Decimal(12, 2)
  box                  Int?
  sortOrder            Int          @default(0)

  item Item? @relation(fields: [itemId], references: [id], onDelete: SetNull)

  @@index([documentType, documentId])
  @@index([itemId])
  @@map("document_rows")
}
```

> [!NOTE]
> **Tradeoff**: You lose Prisma-level FK to the parent document (since `documentId` is polymorphic), but gain massive query simplification and maintainability. Alternatively, keep separate tables but enforce consistent structure via a shared Prisma generator.
> 
> **My recommendation**: If you want to keep strong FKs (which is valid), keep separate row tables but **add the missing indexes** (Issue #10). The unified table is better for analytics but weaker on referential integrity.

---

### Issue #8: `SalesInvoice` Stores Party Snapshot Data — 3NF Violation

```prisma
model SalesInvoice {
  partyId    Int?
  partyName  String    // DUPLICATE of Party.partyName
  phone      String?   // DUPLICATE of Party.phone
}
```

Same pattern in `PurchaseInvoice`. The `partyName` and `phone` on the invoice are **copies** of the Party data at invoice creation time.

**Is this actually a problem?** It depends on your business rules:
- ✅ **If intentional** (snapshot at invoice time — party name at time of sale): This is a valid **denormalization for historical accuracy**. Keep it.
- ❌ **If unintentional**: It violates 3NF and will cause confusion when a party updates their name but old invoices show the old name.

**Recommendation**: This is likely **intentional and correct** for a billing system — you WANT the invoice to show the party name as it was when the invoice was created. **Keep it, but document this decision.** Optionally, create a `PartySnapshot` table if you need more historical fields.

---

### Issue #9: `Expense.expenseCategoryName` is a Raw String — Not Normalized

```prisma
model Expense {
  expenseCategoryName String   // "Travel", "Utilities", "Rent"...
}
```

At scale with billions of expense records, you're storing the full string `"Office Supplies"` on every single row instead of an integer FK.

**Why this matters:**
- String comparison is ~10× slower than integer comparison for WHERE/GROUP BY
- Storage waste: `"Office Supplies"` = 15 bytes × 1 billion = ~14 GB just for this column
- Typos create phantom categories: `"Office Suppleis"` vs `"Office Supplies"`

**Fix:**
```prisma
model ExpenseCategory {
  id         BigInt   @id @default(autoincrement())
  businessId BigInt
  name       String
  createdAt  DateTime @default(now())

  business   Business  @relation(fields: [businessId], references: [id], onDelete: Cascade)
  expenses   Expense[]

  @@unique([businessId, name])
  @@map("expense_categories")
}

model Expense {
  id           BigInt   @id @default(autoincrement())
  businessId   BigInt
  categoryId   BigInt           // FK instead of string
  amount       Decimal  @db.Decimal(12, 2)
  note         String?  @db.Text
  date         DateTime
  ...
  
  category ExpenseCategory @relation(fields: [categoryId], references: [id])
  @@map("expenses")
}
```

---

### Issue #10: ZERO Indexes on Any FK Column 🚨🚨🚨

**This is the single biggest performance killer.** Not a single table in your schema has `@@index()` on any FK or frequently-filtered column.

Every query like `WHERE businessId = X` or `WHERE partyId = Y` or `WHERE date >= X` does a **FULL TABLE SCAN** in MySQL/MariaDB. At billions of rows, this means:
- A simple "list invoices for this business" query takes **minutes to hours**
- `groupBy` aggregations in your reports take **forever**
- The DB server runs at 100% CPU and eventually times out

**Every table needs these indexes at minimum:**

```prisma
// Pattern for EVERY business-scoped table:
model SalesInvoice {
  ...
  @@index([businessId, date])          // Most queries filter by business + date range
  @@index([businessId, partyId])       // Filter by party within a business
  @@index([businessId, isArchived])    // Soft delete filtering
  @@map("sales_invoices")
}

model SalesInvoiceRow {
  ...
  @@index([invoiceId])                 // JOIN from parent
  @@index([itemId])                    // "What invoices contain item X?"
  @@map("sales_invoice_rows")
}

model StockLedger {
  ...
  @@index([businessId, itemId])        // "Stock history for item X"
  @@index([businessId, createdAt])     // Time-range queries
  @@map("stock_ledgers")
}

model Party {
  ...
  @@index([businessId])
  @@index([businessId, isArchived])
  @@map("parties")
}

model Item {
  ...
  @@index([businessId])
  @@index([businessId, isArchived])
  @@index([businessId, categoryId])
  @@map("items")
}

// ... and so on for EVERY table with a businessId FK
```

**Complete list of missing indexes to add:**

| Table | Indexes Needed |
|---|---|
| `business_members` | `[businessId, userId]` (unique), `[userId]` |
| `parties` | `[businessId]`, `[businessId, isArchived]` |
| `categories` | `[businessId]`, `[parentCategoryId]` |
| `units` | `[businessId]` |
| `items` | `[businessId]`, `[businessId, isArchived]`, `[businessId, categoryId]`, `[unitId]` |
| `stock_ledgers` | `[businessId, itemId]`, `[businessId, createdAt]` |
| `bom_components` | `[finishedGoodId]`, `[rawMaterialId]` |
| `manufacturing_orders` | `[businessId]`, `[finishedGoodId]` |
| `sales_invoices` | `[businessId, date]`, `[businessId, partyId]`, `[businessId, isArchived]` |
| `sales_invoice_rows` | `[invoiceId]`, `[itemId]` |
| `estimates` | `[businessId, date]`, `[businessId, partyId]` |
| `estimate_rows` | `[estimateId]`, `[itemId]` |
| `payments_in` | `[businessId, date]`, `[businessId, partyId]`, `[bankAccountId]` |
| `payment_in_allocations` | `[paymentInId]`, `[invoiceId]` |
| `payments_out` | `[businessId, date]`, `[businessId, partyId]`, `[bankAccountId]` |
| `payment_out_allocations` | `[paymentOutId]`, `[purchaseInvoiceId]` |
| `sales_returns` | `[businessId, date]`, `[businessId, partyId]`, `[originalInvoiceId]` |
| `sales_return_rows` | `[salesReturnId]`, `[itemId]` |
| `delivery_challans` | `[businessId, date]`, `[businessId, partyId]` |
| `delivery_challan_rows` | `[deliveryChallanId]`, `[itemId]` |
| `sales_orders` | `[businessId, date]`, `[businessId, partyId]` |
| `sales_order_rows` | `[salesOrderId]`, `[itemId]` |
| `purchase_invoices` | `[businessId, date]`, `[businessId, partyId]`, `[businessId, isArchived]` |
| `purchase_invoice_rows` | `[purchaseInvoiceId]`, `[itemId]` |
| `bank_accounts` | `[businessId]` |
| `banking_transactions` | `[businessId, date]`, `[bankAccountId]` |
| `expenses` | `[businessId, date]` |
| `discounts` | `[businessId]` |
| `files` | `[businessId]` |
| `document_audit_logs` | `[businessId, createdAt]`, `[businessId, documentType]` |
| `purchase_returns` | `[businessId, date]`, `[businessId, partyId]` |
| `purchase_return_rows` | `[purchaseReturnId]`, `[itemId]` |

That's **~60 missing indexes** across the schema.

---

### Issue #11: Global Unique Constraints on Document Numbers

Already covered in the SaaS plan, but worth repeating here as it's a normalization issue:

```prisma
// CURRENT — breaks multi-tenancy
invoiceNo String @unique    // Two businesses can't both have INV-001

// FIX
invoiceNo String
@@unique([businessId, invoiceNo])
```

This applies to **9 document number fields**.

---

### Issue #12: `BusinessMember` Missing Unique Constraint

```prisma
model BusinessMember {
  id         Int
  businessId Int
  userId     Int
  // NO @@unique([businessId, userId]) !!
}
```

Nothing prevents the same user from being added to the same business **twice** with different roles. At scale, this causes duplicate membership bugs and confusing permission states.

**Fix**: Add `@@unique([businessId, userId])`

---

### Issue #13: Report Queries Fetch ALL Rows Into JS Memory 🚨

This is a **code architecture** issue, not schema, but it's the #1 thing that will crash your server at scale.

Look at [report.service.js](file:///c:/Users/HP/Desktop/nexbill/nexbill_backend/src/services/report.service.js):

```javascript
// Line 381-385: Fetches ALL invoices for balance sheet
const invoices = await prisma.salesInvoice.findMany({
  where: { businessId, isArchived: false },
  select: { balance: true },
});
const accountsReceivable = invoices.reduce((sum, inv) => sum + Number(inv.balance), 0);
```

```javascript
// Line 522-541: Fetches ALL invoices with ALL rows for top selling items
const invoices = await prisma.salesInvoice.findMany({
  where: whereInvoice,
  select: { rows: { ... } },
});
// Then loops through in JS
```

**At scale**: A business with 1 million invoices × 5 rows each = **5 million row objects loaded into Node.js memory at once**. This will:
- OOM kill the Node process
- Take minutes to complete
- Block the event loop

**Fix**: Use database-level aggregation:
```javascript
// Instead of fetching all invoices:
const result = await prisma.salesInvoice.aggregate({
  where: { businessId, isArchived: false },
  _sum: { balance: true },
});
const accountsReceivable = Number(result._sum.balance || 0);

// For top selling items, use groupBy:
const topItems = await prisma.salesInvoiceRow.groupBy({
  by: ['itemId'],
  where: { invoice: { businessId, isArchived: false } },
  _sum: { total: true, qty: true },
  _count: true,
  orderBy: { _sum: { total: 'desc' } },
  take: 10,
});
```

---

## 📊 Severity Summary

| # | Issue | Severity | Data Loss Risk | Fix Effort |
|---|---|---|---|---|
| 1 | Business God Table (39 cols) | 🟠 Major | No | 1 day |
| 2 | Item.stockQuantity denormalized | 🔴 Critical | **Yes — data drift** | 2 days |
| 3 | BankAccount.currentBalance denormalized | 🔴 Critical | **Yes — data drift** | 1 day |
| 4 | StockLedger polymorphic refs | 🔴 Critical | **Yes — orphans** | 1 day |
| 5 | DocumentAuditLog polymorphic refs | 🟠 Major | Yes — orphans | 0.5 day |
| 6 | File polymorphic refs | 🟠 Major | Yes — orphans | 0.5 day |
| 7 | 8 identical row tables | 🟡 Moderate | No | 2 days (optional) |
| 8 | SalesInvoice party snapshot | ✅ Acceptable | No | None needed |
| 9 | Expense category string | 🟡 Moderate | No | 0.5 day |
| 10 | **ZERO indexes on FKs** | 🔴 **CRITICAL** | No | 1 day |
| 11 | Global unique doc numbers | 🔴 Critical | No | 0.5 day |
| 12 | Missing unique on BusinessMember | 🟠 Major | No | 5 min |
| 13 | Reports load all data to JS | 🔴 **CRITICAL** | No | 2-3 days |

---

## ✅ Recommended Fix Priority

```
1. ADD ALL MISSING INDEXES (#10)         ← Do this TODAY, biggest bang for zero risk
2. Fix unique constraints (#11, #12)      ← 30 minutes, prevents data bugs
3. Fix report queries (#13)               ← Before scale, or it OOMs
4. Fix polymorphic associations (#4,5,6)  ← Before billions of rows
5. Fix denormalized balances (#2, #3)     ← Before high-concurrency
6. Decompose Business table (#1)          ← Before adding more settings
7. Normalize expense categories (#9)      ← Nice to have
8. Row table unification (#7)             ← Optional, high-effort
```

> [!IMPORTANT]
> Issues #10 (missing indexes) and #13 (memory-loaded reports) will cause **complete system failure** well before a billion rows. At ~100K invoices per business, reports will start timing out. At ~1M, the dashboard will stop loading entirely.

Want me to start implementing these fixes? I'd recommend starting with the indexes since they're zero-risk, zero-downtime additions.
