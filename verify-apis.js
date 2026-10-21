import http from 'http';

const BASE_URL = 'http://localhost:5000/api/v1';



// Color logging helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
};

const logSuccess = (message) => console.log(`${colors.green}✔ ${message}${colors.reset}`);
const logError = (message) => console.error(`${colors.red}✘ ${message}${colors.reset}`);
const logStep = (message) => console.log(`\n${colors.cyan}--- ${message} ---${colors.reset}`);

// Helper to make HTTP request
const makeRequest = (method, path, body = null, token = null, businessId = null) => {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const headers = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (businessId) {
      headers['x-business-id'] = String(businessId);
    }

    const options = {
      method,
      headers,
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runTestSuite() {
  console.log(`${colors.yellow}=============================================`);
  console.log(`         RYAPPAR FULL API TEST SUITE        `);
  console.log(`=============================================${colors.reset}`);

  const email = `verifier-${Date.now()}@example.com`;
  const password = 'testpassword123';
  const businessName = 'Verification Labs Inc.';
  let token;
  let businessId;
  let partyId;
  let itemId;
  let categoryId;
  let bankAccountId;
  let invoiceId;

  try {
    // 1. Auth Module
    logStep('TESTING AUTHENTICATION MODULE');
    
    // Register
    const regRes = await makeRequest('POST', '/auth/register', {
      name: 'Verification Bot',
      email,
      businessName,
      password,
    });
    if (regRes.status === 201 && regRes.body.success) {
      logSuccess('POST /auth/register: User & default business created.');
      token = regRes.body.data.token;
      businessId = regRes.body.data.user.activeBusiness.id;
    } else {
      throw new Error(`Register failed: ${JSON.stringify(regRes.body)}`);
    }

    // Login
    const loginRes = await makeRequest('POST', '/auth/login', { email, password });
    if (loginRes.status === 200 && loginRes.body.success) {
      logSuccess('POST /auth/login: User successfully authenticated.');
    } else {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.body)}`);
    }

    // 2. Company & Settings Module
    logStep('TESTING COMPANY & SETTINGS MODULE');
    
    // Fetch Profile
    const profileRes = await makeRequest('GET', '/company/profile', null, token, businessId);
    if (profileRes.status === 200 && profileRes.body.data.name === businessName) {
      logSuccess('GET /company/profile: Business profile configuration verified.');
    } else {
      throw new Error(`Profile fetch failed: ${JSON.stringify(profileRes.body)}`);
    }

    // Fetch Next Number Series
    const numRes = await makeRequest('POST', '/settings/numbering/next?type=sales', {}, token, businessId);
    if (numRes.status === 200 && numRes.body.data.formatted) {
      logSuccess(`POST /settings/numbering/next: Resolved sales series: ${numRes.body.data.formatted}`);
    } else {
      throw new Error(`Numbering failed: ${JSON.stringify(numRes.body)}`);
    }

    // 3. Parties Module
    logStep('TESTING PARTIES MODULE');
    
    // Create Party
    const partyRes = await makeRequest('POST', '/parties', {
      partyName: 'Global Distributors Ltd',
      phone: '9988776655',
      gstType: 'REGULAR',
      gstin: '29AAAAA0000A1Z5',
      openingBalance: 0,
      balanceType: 'RECEIVABLE',
    }, token, businessId);
    if (partyRes.status === 201 && partyRes.body.success) {
      partyId = partyRes.body.data.id;
      logSuccess(`POST /parties: Created customer party (ID: ${partyId}).`);
    } else {
      throw new Error(`Create party failed: ${JSON.stringify(partyRes.body)}`);
    }

    // 4. Banking Module
    logStep('TESTING BANKING MODULE');
    
    // Create Bank Account
    const bankRes = await makeRequest('POST', '/banking/accounts', {
      name: 'Corporate Petty Cash',
      accountType: 'CASH',
      openingBalance: 5000,
    }, token, businessId);
    if (bankRes.status === 201 && bankRes.body.success) {
      bankAccountId = bankRes.body.data.id;
      logSuccess(`POST /banking/accounts: Created bank account (ID: ${bankAccountId}).`);
    } else {
      throw new Error(`Create account failed: ${JSON.stringify(bankRes.body)}`);
    }

    // 5. Inventory Module
    logStep('TESTING INVENTORY MODULE');
    
    // Create Category
    const catRes = await makeRequest('POST', '/categories', { name: 'Semiconductors' }, token, businessId);
    if (catRes.status === 201) {
      categoryId = catRes.body.data.id;
      logSuccess(`POST /categories: Category created.`);
    }

    // Create Item
    const itemRes = await makeRequest('POST', '/items', {
      name: 'IC NE555 Timer Chip',
      type: 'PRODUCT',
      categoryId,
      salePrice: 15,
      purchasePrice: 10,
      stockQuantity: 500,
      stockValue: 5000,
    }, token, businessId);
    if (itemRes.status === 201) {
      itemId = itemRes.body.data.id;
      logSuccess(`POST /items: Inventory product item created with 500 units.`);
    } else {
      throw new Error(`Create item failed: ${JSON.stringify(itemRes.body)}`);
    }

    // 6. Sales Invoicing & Stock Operations
    logStep('TESTING SALES & STOCK DEDUCTION');
    
    // Generate Invoice
    const invoiceRes = await makeRequest('POST', '/invoices', {
      date: new Date().toISOString(),
      partyId,
      partyName: 'Global Distributors Ltd',
      subtotal: 1500,
      grandTotal: 1500,
      paid: 500,
      balance: 1000,
      bankAccountId,
      rows: [
        {
          itemId,
          itemName: 'IC NE555 Timer Chip',
          qty: 100,
          price: 15,
          total: 1500,
        }
      ]
    }, token, businessId);

    if (invoiceRes.status === 201 && invoiceRes.body.success) {
      invoiceId = invoiceRes.body.data.id;
      logSuccess(`POST /invoices: Created sales invoice (ID: ${invoiceId}).`);
    } else {
      throw new Error(`Create invoice failed: ${JSON.stringify(invoiceRes.body)}`);
    }

    // Verify Stock Level Decrement
    const checkItem = await makeRequest('GET', `/items/${itemId}`, null, token, businessId);
    const stock = Number(checkItem.body.data.stockQuantity);
    if (stock === 400) {
      logSuccess(`Item stock level decremented correctly from 500 ➔ ${stock}.`);
    } else {
      throw new Error(`Stock deduction mismatch! Expected 400, found: ${stock}`);
    }

    // 6b. Purchases & Purchase Returns (Debit Note)
    logStep('TESTING PURCHASES & PURCHASE RETURNS (DEBIT NOTE)');

    // Create Purchase Bill
    const purchaseRes = await makeRequest('POST', '/purchases/invoices', {
      date: new Date().toISOString(),
      partyId,
      partyName: 'Global Distributors Ltd',
      paymentType: 'CREDIT',
      subtotal: 1000,
      grandTotal: 1000,
      paid: 0,
      balance: 1000,
      rows: [
        {
          itemId,
          itemName: 'IC NE555 Timer Chip',
          qty: 100,
          price: 10,
          total: 1000,
        }
      ]
    }, token, businessId);

    let purchaseId;
    if (purchaseRes.status === 201 && purchaseRes.body.success) {
      purchaseId = purchaseRes.body.data.id;
      logSuccess(`POST /purchases/invoices: Created purchase invoice (ID: ${purchaseId}).`);
    } else {
      throw new Error(`Create purchase invoice failed: ${JSON.stringify(purchaseRes.body)}`);
    }

    // Verify Stock Level Increment
    const checkItemPur = await makeRequest('GET', `/items/${itemId}`, null, token, businessId);
    const stockPur = Number(checkItemPur.body.data.stockQuantity);
    if (stockPur === 500) {
      logSuccess(`Item stock level incremented correctly after purchase from 400 ➔ ${stockPur}.`);
    } else {
      throw new Error(`Purchase stock increment mismatch! Expected 500, found: ${stockPur}`);
    }

    // Create Purchase Return (Debit Note)
    const returnRes = await makeRequest('POST', '/purchases/returns', {
      date: new Date().toISOString(),
      partyId,
      partyName: 'Global Distributors Ltd',
      originalBillId: purchaseId,
      returnType: 'DEBIT_NOTE',
      grandTotal: 500,
      isCashRefund: false,
      rows: [
        {
          itemId,
          itemName: 'IC NE555 Timer Chip',
          qty: 50,
          price: 10,
          taxRate: 0,
          taxAmount: 0,
          total: 500,
        }
      ]
    }, token, businessId);

    if (returnRes.status === 201 && returnRes.body.success) {
      logSuccess(`POST /purchases/returns: Created purchase return debit note.`);
    } else {
      throw new Error(`Create purchase return failed: ${JSON.stringify(returnRes.body)}`);
    }

    // Verify Stock Level Decrement
    const checkItemRet = await makeRequest('GET', `/items/${itemId}`, null, token, businessId);
    const stockRet = Number(checkItemRet.body.data.stockQuantity);
    if (stockRet === 450) {
      logSuccess(`Item stock level decremented correctly after return from 500 ➔ ${stockRet}.`);
    } else {
      throw new Error(`Return stock decrement mismatch! Expected 450, found: ${stockRet}`);
    }

    // 7. Analytical Reports & Daybooks
    logStep('TESTING REPORT & GROWTH ANALYTICS');
    
    // Dashboard Summary
    const summaryRes = await makeRequest('GET', '/dashboard/summary', null, token, businessId);
    const summary = summaryRes.body.data;
    if (Number(summary.receivable) === 1000 && Number(summary.cashBalance) === 5500) {
      logSuccess('GET /dashboard/summary: Financial aggregation parameters validated.');
    } else {
      throw new Error(`Summary mismatch! ${JSON.stringify(summary)}`);
    }

    // Daybook Report
    const daybookRes = await makeRequest('GET', `/reports/daybook?date=${new Date().toISOString()}`, null, token, businessId);
    if (daybookRes.status === 200 && daybookRes.body.data.totalIn === 500) {
      logSuccess(`GET /reports/daybook: Verified daily inflow aggregate (Total: Rs. ${daybookRes.body.data.totalIn}).`);
    } else {
      throw new Error(`Daybook query failed: ${JSON.stringify(daybookRes.body)}`);
    }

    // Profit & Loss Statement
    const plRes = await makeRequest('GET', '/reports/profit-loss', null, token, businessId);
    if (plRes.status === 200 && Number(plRes.body.data.grossProfit) === 500) {
      logSuccess(`GET /reports/profit-loss: Gross profit matches (Rs. 1500 revenue - Rs. 1000 COGS = Rs. 500).`);
    } else {
      throw new Error(`P&L logic error: ${JSON.stringify(plRes.body)}`);
    }

    // Growth Summary
    const growthRes = await makeRequest('GET', '/growth/summary', null, token, businessId);
    if (growthRes.status === 200) {
      logSuccess('GET /growth/summary: Growth indicators loaded.');
    }

    // 8. Backups
    logStep('TESTING DATA BACKUP SCHEMAS');
    
    // Export Backup
    const backupRes = await makeRequest('POST', '/backup/export', {}, token, businessId);
    if (backupRes.status === 200 && backupRes.body.data.data.items.length > 0) {
      logSuccess('POST /backup/export: Complete database state successfully serialized.');
    } else {
      throw new Error(`Backup export failed: ${JSON.stringify(backupRes.body)}`);
    }

    console.log(`\n${colors.green}=============================================`);
    console.log('       ALL API SUITE TESTS PASSED WORK!       ');
    console.log(`=============================================${colors.reset}\n`);
    process.exit(0);
  } catch (error) {
    logError(`API Test Suite failed: ${error.stack || error}`);
    process.exit(1);
  }
}

runTestSuite();
