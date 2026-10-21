# Ryappar API Documentation

This document describes all the API endpoints, parameters, constraints, headers, and request/response payloads available in the Ryappar backend.

## General Information

- **Base URL**: `http://localhost:5000/api/v1` (Default port: `5000`, API prefix: `/api/v1`)
- **Content Type**: `application/json` (required for all `POST` / `PUT` requests)

---

## Global Headers

| Header Name | Type | Description | Required On |
| :--- | :--- | :--- | :--- |
| `Content-Type` | String | Must be set to `application/json` | All requests with request bodies (`POST`, `PUT`, `PATCH`) |
| `Authorization` | String | Bearer token format: `Bearer <JWT_TOKEN>` | All guarded endpoints (requires authentication) |
| `x-business-id` | Number | Active Business ID. If omitted, falls back to the user's first business | All tenant-guarded endpoints |

---

## Endpoints

### 1. System Health

#### `GET /health`
Verifies that the API service is active and running.

- **Authentication**: None
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Service is healthy",
  "timestamp": "2026-07-01T18:58:39.000Z"
}
```

---

### 2. Authentication Services (`/auth`)

#### `POST /auth/register`
Creates a new user account and registers their default business.

- **Request Body Constraints**:
  - `name` (String): Optional.
  - `email` (String): Required. Must be a valid email format.
  - `businessName` (String): Required. Name of their initial business.
  - `password` (String): Required. Minimum length `8`.
- **Response**: `201 Created`
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "name": "Verification Bot",
      "email": "test@example.com",
      "roles": ["USER"],
      "permissions": ["read:profile", "write:profile"],
      "activeBusiness": {
        "id": 4,
        "name": "Verification Labs Inc.",
        "role": "OWNER"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
  }
}
```

#### `POST /auth/login`
Authenticates a user's credentials and returns their active business context.

- **Request Body Constraints**:
  - `email` (String): Required. Must be a valid email format.
  - `password` (String): Required.
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "name": "Verification Bot",
      "email": "test@example.com",
      "roles": ["USER"],
      "permissions": ["read:profile", "write:profile"],
      "activeBusiness": {
        "id": 4,
        "name": "Verification Labs Inc.",
        "role": "OWNER"
      }
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5c..."
  }
}
```

---

### 3. User Resources (`/users`)

#### `GET /users/me`
Retrieves the profile of the currently logged-in user.

- **Authentication**: Required (`Authorization: Bearer <token>`)
- **Response**: `200 OK`

---

### 4. Company & Settings APIs (`/company` / `/settings`)

#### `GET /company/profile`
Fetches the current business profile configuration.

- **Authentication**: Required, Active Business required (`x-business-id`)
- **Response**: `200 OK`

#### `PUT /company/profile`
Updates company business profile.

- **Request Body**: `name`, `gstin`, `phone`, `email`, `billingAddress`, `state`, `businessType`.
- **Response**: `200 OK`

#### `POST /company/logo`
Uploads company logo image.

- **Content-Type**: `multipart/form-data` (file field: `logo`)
- **Response**: `200 OK`

#### `GET /settings`
Fetches general tax and printing template configurations.

- **Response**: `200 OK`

#### `GET /settings/numbering`
Retrieves current numbering prefix and next ID configuration.

- **Response**: `200 OK`

#### `POST /settings/numbering/next`
Returns the next document identifier for a given document type.

- **Query Parameters**:
  - `type` (String): Document type (`sales`, `purchase`, `estimate`, `challan`, `order`, `return`, `receipt`).
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Next number retrieved successfully",
  "data": {
    "prefix": "INV-4-",
    "nextNumber": 1,
    "formatted": "INV-4-1"
  }
}
```

---

### 5. Parties Module (`/parties`)

#### `GET /parties`
Lists all customers/suppliers and computes their dynamic outstanding balance.

- **Query Parameters**:
  - `search` (String): Filters by name or phone.
- **Response**: `200 OK`
```json
{
  "success": true,
  "message": "Parties listed successfully",
  "data": [
    {
      "id": 1,
      "partyName": "Tech Supplies Corp",
      "phone": "9876543210",
      "email": null,
      "billingAddress": null,
      "gstType": "UNREGISTERED",
      "gstin": null,
      "openingBalance": "0.00",
      "balanceType": "RECEIVABLE",
      "state": null,
      "isArchived": false,
      "outstanding": 3000,
      "createdAt": "2026-07-01T13:54:55.000Z"
    }
  ]
}
```

#### `POST /parties`
Creates a new customer/supplier.

- **Request Body**: `partyName`, `phone`, `email`, `billingAddress`, `gstType`, `gstin`, `openingBalance`, `balanceType`, `state`.
- **Response**: `201 Created`

#### `GET /parties/:id/ledger`
Fetches a list of all transactions involving the specified party (Invoices, Purchases, Payments In, Payments Out, Returns).

- **Response**: `200 OK`

---

### 6. Inventory Module (`/items`, `/categories`, `/units`)

#### `GET /items`
Lists products/services.

- **Query Parameters**:
  - `search` (String)
  - `type` (String): `PRODUCT` or `SERVICE`
- **Response**: `200 OK`

#### `POST /items`
Creates a new inventory product or service.

- **Request Body**: `name`, `type`, `hsn`, `itemCode`, `categoryId`, `unitId`, `description`, `salePrice`, `salePriceType`, `purchasePrice`, `purchasePriceType`, `taxRate`, `stockQuantity`, `stockValue`, `minStock`, `asOfDate`.
- **Response**: `201 Created`

#### `POST /items/:id/stock-adjustments`
Adjusts item stock levels.

- **Request Body**: `type` (`IN`, `OUT`, `ADJUSTMENT`), `quantity`, `adjustedValue` (optional), `description` (optional).
- **Response**: `200 OK`

#### `GET /items/:id/transactions`
Fetches all sales and purchase transactions referencing this item.

- **Response**: `200 OK`

#### `GET /categories` | `POST /categories` | `DELETE /categories/:id`
CRUD for categories.

#### `GET /units` | `POST /units` | `DELETE /units/:id`
CRUD for inventory unit codes.

---

### 7. Sales Module (`/invoices`, `/estimates`, `/payments-in`, `/returns`, `/challans`, `/orders`)

#### `POST /invoices`
Creates a sales invoice. Decrements stock levels, adds a StockLedger `OUT` line, and records payments.

- **Request Body**: `invoiceNo`, `date`, `partyId`, `partyName`, `phone`, `stateOfSupply`, `isCash`, `subtotal`, `cgst`, `sgst`, `igst`, `totalTax`, `grandTotal`, `paid`, `balance`, `roundOff`, `termsText`, `rows` (Array of items), `bankAccountId`.
- **Response**: `201 Created`

#### `DELETE /invoices/:id`
Soft deletes invoice, replenishes stock levels, and reverses cash/bank account adjustments.

- **Response**: `200 OK`

#### `POST /estimates/:id/convert-to-invoice`
Converts estimate to invoice.

- **Response**: `201 Created`

#### `POST /payments-in`
Records a customer payment receipt and dynamically allocates it against outstanding sales invoices using a FIFO waterfall.

- **Request Body**: `partyId`, `bankAccountId`, `receiptNo`, `date`, `receivedAmount`, `paymentMode` (`CASH`, `BANK`, `UPI`, `CHEQUE`, `CARD`, `OTHER`), `referenceNo`, `description`.
- **Response**: `201 Created`

#### `POST /returns`
Logs sales return credit note, restocking the returned product.

- **Request Body**: `partyId`, `originalInvoiceId`, `returnNo`, `date`, `returnType` (`CREDIT_NOTE`, `REPLACEMENT`), `grandTotal`, `notes`, `rows`.
- **Response**: `201 Created`

#### `POST /challans` | `POST /challans/:id/convert-to-invoice`
Challan dispatch and conversion.

#### `POST /orders` | `POST /orders/:id/convert-to-invoice`
Order booking, stock allocations, advance receipt collection, and conversion.

---

### 8. Purchase Module (`/purchases/invoices`)

#### `POST /purchases/invoices`
Creates purchase bill. Increments stock, logs StockLedger `IN` transaction, and records payments out.

- **Request Body**: `billNo`, `date`, `partyId`, `partyName`, `phone`, `stateOfSupply`, `paymentType` (`CASH`, `CREDIT`, `BANK`), `subtotal`, `cgst`, `sgst`, `igst`, `totalTax`, `grandTotal`, `paid`, `balance`, `termsText`, `rows`, `bankAccountId`.
- **Response**: `201 Created`

#### `DELETE /purchases/invoices/:id`
Soft deletes bill, reduces stock, and reverses banking transactions.

---

### 9. Banking & Expense APIs (`/banking`, `/expenses`)

#### `POST /banking/accounts`
Creates a bank account.

#### `POST /banking/transactions`
Logs deposits and withdrawals, updating the account's balance.

#### `GET /expenses` | `POST /expenses` | `DELETE /expenses/:id`
CRUD for expense lines.

---

### 10. Reports & Dashboard APIs

#### `GET /dashboard/summary`
Dashboard card metrics.
- **Response**: `200 OK` (includes `receivable`, `payable`, `cashBalance`, `salesToday`, `expensesToday`).

#### `GET /dashboard/sales-trend`
Sales trend aggregates by date range.

#### `GET /reports/daybook`
Daily money inflows (Receipts) and outflows (Payments + Expenses).

#### `GET /reports/profit-loss`
Revenue - cost of goods sold (COGS) - expenses.

#### `GET /reports/balance-sheet`
Financial asset valuation vs liabilities.

#### `GET /growth/summary`
Collection rate, low-stock count, overdue parties count, net capital margins.

#### `GET /growth/overdue-parties`
List of parties with outstanding balances and a WhatsApp message template.

---

### 11. Backup / Restore APIs (`/backup`)

#### `POST /backup/export`
Exports the entire business data as a portable JSON document.

#### `POST /backup/restore`
Transactionally overrides the business's records with the provided JSON dump.
