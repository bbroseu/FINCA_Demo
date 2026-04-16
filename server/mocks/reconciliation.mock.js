// Reconciliation Mock Data following Aspekt API structure
const reconciliationMocks = {
  // In-memory storage for reconciliation items
  reconciliationItems: new Map(),

  // Generate mock reconciliation items
  generateMockItems: (dates) => {
    const items = [];
    const types = ["ACCOUNT_TO_LOAN", "LOAN_PAYMENT", "ACCOUNT_WITHDRAWAL", "LOAN_DISBURSEMENT"];
    const statuses = ["OK", "PENDING", "FAILED"];
    const reconciliationStatuses = ["UNRECONCILED", "RECONCILED", "DISPUTED"];

    dates.forEach(dateStr => {
      // Generate 2-5 items per date
      const itemCount = Math.floor(Math.random() * 4) + 2;

      for (let i = 0; i < itemCount; i++) {
        const id = String(Math.floor(Math.random() * 100000) + 25000);
        const requestId = String(Math.floor(Math.random() * 10000000000000000000));
        const type = types[Math.floor(Math.random() * types.length)];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const reconciliationStatus = reconciliationStatuses[Math.floor(Math.random() * reconciliationStatuses.length)];

        const item = {
          Id: id,
          CreatedAt: dateStr,
          Type: type,
          RequestId: requestId,
          Status: status,
          ReconciliationStatus: reconciliationStatus,
          Alias: String(Math.floor(Math.random() * 1000000000000)),
          Amount: Math.floor(Math.random() * 10000) + 100
        };

        // Add specific fields based on type
        if (type === "ACCOUNT_TO_LOAN" || type === "LOAN_PAYMENT") {
          item.LoanNumber = `01150000001-01-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}-00001`;
        }

        if (type === "ACCOUNT_TO_LOAN" || type === "ACCOUNT_WITHDRAWAL") {
          item.AccountNumber = `00115 00001 ${String(Math.floor(Math.random() * 10000000000)).padStart(10, '0')} ${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
        }

        items.push(item);
        // Store in memory for individual retrieval
        reconciliationMocks.reconciliationItems.set(requestId, item);
      }
    });

    return items;
  },

  // Mock for getting all reconciliation items
  getAllReconciliationItems: (dates) => {
    const items = reconciliationMocks.generateMockItems(dates);

    return {
      status: 200,
      data: {
        Id: 25361,
        Code: 200,
        Msg: "OK",
        Body: items
      }
    };
  },

  // Mock for getting one reconciliation item
  getReconciliationItem: (reconciliationRequestId) => {
    // Check if we have this item in memory
    let item = reconciliationMocks.reconciliationItems.get(reconciliationRequestId);

    if (!item) {
      // Generate a new item if not found
      const types = ["LOAN_PAYMENT", "ACCOUNT_TO_LOAN"];
      const type = types[Math.floor(Math.random() * types.length)];

      item = {
        Id: String(Math.floor(Math.random() * 1000) + 200),
        CreatedAt: new Date().toISOString(),
        Type: type,
        RequestId: reconciliationRequestId,
        Status: "OK",
        ReconciliationStatus: "UNRECONCILED",
        Alias: String(Math.floor(Math.random() * 1000000000000)),
        Amount: Math.floor(Math.random() * 5000) + 500
      };

      if (type === "LOAN_PAYMENT") {
        item.LoanNumber = `xxxxx-xxxxx-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
      } else {
        item.LoanNumber = `01150000001-01-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}-00001`;
        item.AccountNumber = `00115 00001 ${String(Math.floor(Math.random() * 10000000000)).padStart(10, '0')} ${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`;
      }

      reconciliationMocks.reconciliationItems.set(reconciliationRequestId, item);
    }

    return {
      status: 200,
      data: {
        Id: 504,
        Code: 200,
        Msg: "",
        Body: [item]
      }
    };
  },

  // Mock for reconciling all items
  reconciliateAllItems: (operations) => {
    // Update the status of items in memory
    operations.forEach(op => {
      const item = reconciliationMocks.reconciliationItems.get(op.ReconciliationRequestId);
      if (item) {
        item.ReconciliationStatus = op.ReconciliationStatus === "OK" ? "RECONCILED" : "DISPUTED";
      }
    });

    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK"
      }
    };
  },

  // Mock for reconciling one item
  reconciliateOneItem: (reconciliationRequestId, reconciliationStatus) => {
    const item = reconciliationMocks.reconciliationItems.get(reconciliationRequestId);

    if (!item) {
      return {
        status: 461,
        data: {
          Id: 0,
          Code: 461,
          Msg: "Reconciliation Item not found"
        }
      };
    }

    // Update the item status
    item.ReconciliationStatus = reconciliationStatus === "OK" ? "RECONCILED" : "DISPUTED";

    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK"
      }
    };
  }
};

module.exports = reconciliationMocks;