// Import the registered users from contact mock to share the same user base
const contactMocks = require('./contact.mock');

const loanMocks = {
  // Mock for getActiveLoans - validates loan ownership
  getActiveLoans: (alias) => {
    // Check if this is a registered user (either through contact registration or default user)
    // This ensures loan access is tied to authenticated/registered users only

    // First check the contact system to see if this user exists
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      // User doesn't exist in the contact system
      return contactResponse; // Return the same error (402: Person doesn't exist)
    }

    // User exists in contact system, now check if they have loans
    // For demo purposes, we'll assign loans based on user patterns

    if (alias === '12345678') {
      // Default user with multiple loans
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: {
            ActiveLoans: {
              Loans: [
                {
                  LoanNumber: "LN001234567",
                  Product: "Standard Loan",
                  ProductType: "Standard",
                  Amount: 50000.00,
                  DisbursementDate: "15.02.2024"
                },
                {
                  LoanNumber: "LN009876543",
                  Product: "Emergency Loan",
                  ProductType: "Emergency",
                  Amount: 15000.00,
                  DisbursementDate: "10.03.2024"
                }
              ]
            }
          }
        }
      };
    } else {
      // For any other registered user, assign a single demo loan
      // This allows newly registered users to also have loan data for testing
      const contact = contactResponse.data.Body[0];
      const personalNumber = contact.PersonalNumber;

      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: {
            ActiveLoans: {
              Loans: [
                {
                  LoanNumber: `LN${personalNumber}001`,
                  Product: "Personal Loan",
                  ProductType: "Standard",
                  Amount: 25000.00,
                  DisbursementDate: "01.03.2024"
                }
              ]
            }
          }
        }
      };
    }

  },

  // Mock for getLoan - fetches detailed loan information
  getLoan: (loanNumber, alias) => {
    // Verify ownership first
    const activeLoans = loanMocks.getActiveLoans(alias);
    if (activeLoans.status !== 200) {
      return activeLoans;
    }

    const userLoans = activeLoans.data.Body.ActiveLoans.Loans;
    const hasLoan = userLoans.some(loan => loan.LoanNumber === loanNumber);

    if (!hasLoan) {
      return {
        status: 420,
        data: {
          Id: 68283,
          Code: 420,
          Msg: "LoanNumber not found"
        }
      };
    }

    // Return detailed loan data based on loan number
    if (loanNumber === "LN001234567") {
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: {
            LoanNumber: "LN001234567",
            Amount: 50000.00,
            Product: "Standard Loan",
            ProductType: "Standard",
            LoanStatus: "Active",
            LoanStatusCode: 1,
            NumberOfInstallments: 12,
            RemainingInstallments: 8,
            RemainingAmount: 28500.50,
            TotalPastDueAmount: 0.00,
            NextInstallmentAmount: 4583.33,
            NextInstallmentDate: "25.04.2024",
            TotalToCloseAmount: 30234.75,
            MaturityDate: "15.02.2025",
            DisbursementDate: "15.02.2024"
          }
        }
      };
    } else if (loanNumber === "LN009876543") {
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: {
            LoanNumber: "LN009876543",
            Amount: 15000.00,
            Product: "Emergency Loan",
            ProductType: "Emergency",
            LoanStatus: "Active",
            LoanStatusCode: 1,
            NumberOfInstallments: 6,
            RemainingInstallments: 4,
            RemainingAmount: 8200.00,
            TotalPastDueAmount: 500.00,
            NextInstallmentAmount: 2750.00,
            NextInstallmentDate: "20.04.2024",
            TotalToCloseAmount: 8950.25,
            MaturityDate: "10.09.2024",
            DisbursementDate: "10.03.2024"
          }
        }
      };
    } else if (loanNumber.startsWith("LN") && loanNumber.endsWith("001")) {
      // Handle dynamically generated loan numbers for registered users (format: LN{personalNumber}001)
      const personalNumber = loanNumber.substring(2, loanNumber.length - 3); // Extract personalNumber from loan number

      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: {
            LoanNumber: loanNumber,
            Amount: 25000.00,
            Product: "Personal Loan",
            ProductType: "Standard",
            LoanStatus: "Active",
            LoanStatusCode: 1,
            NumberOfInstallments: 10,
            RemainingInstallments: 7,
            RemainingAmount: 17500.00,
            TotalPastDueAmount: 0.00,
            NextInstallmentAmount: 2750.00,
            NextInstallmentDate: "05.05.2024",
            TotalToCloseAmount: 18125.50,
            MaturityDate: "01.01.2025",
            DisbursementDate: "01.03.2024"
          }
        }
      };
    } else {
      return {
        status: 420,
        data: {
          Id: 68283,
          Code: 420,
          Msg: "LoanNumber not found"
        }
      };
    }
  },

  // Mock for repaymentPlan - fetches installment schedule
  getRepaymentPlan: (alias, loanNumber) => {
    // Verify ownership first
    const activeLoans = loanMocks.getActiveLoans(alias);
    if (activeLoans.status !== 200) {
      return activeLoans;
    }

    const userLoans = activeLoans.data.Body.ActiveLoans.Loans;
    const hasLoan = userLoans.some(loan => loan.LoanNumber === loanNumber);

    if (!hasLoan) {
      return {
        status: 420,
        data: {
          Id: 68283,
          Code: 420,
          Msg: "LoanNumber not found"
        }
      };
    }

    // Return repayment schedule based on loan number
    if (loanNumber === "LN001234567") {
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: [{
            RepaymentPlan: [
              {
                Installment: 1,
                DateFrom: "15/02/2024",
                DateTo: "15/03/2024",
                LastRepaymentDate: "15/03/2024",
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 45833.33
              },
              {
                Installment: 2,
                DateFrom: "15/03/2024",
                DateTo: "15/04/2024",
                LastRepaymentDate: "15/04/2024",
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 41666.66
              },
              {
                Installment: 3,
                DateFrom: "15/04/2024",
                DateTo: "15/05/2024",
                LastRepaymentDate: "15/05/2024",
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 37500.00
              },
              {
                Installment: 4,
                DateFrom: "15/05/2024",
                DateTo: "15/06/2024",
                LastRepaymentDate: "15/06/2024",
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 33333.33
              },
              {
                Installment: 5,
                DateFrom: "15/06/2024",
                DateTo: "15/07/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 29166.66
              },
              {
                Installment: 6,
                DateFrom: "15/07/2024",
                DateTo: "15/08/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 25000.00
              },
              {
                Installment: 7,
                DateFrom: "15/08/2024",
                DateTo: "15/09/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 20833.33
              },
              {
                Installment: 8,
                DateFrom: "15/09/2024",
                DateTo: "15/10/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 16666.66
              },
              {
                Installment: 9,
                DateFrom: "15/10/2024",
                DateTo: "15/11/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 12500.00
              },
              {
                Installment: 10,
                DateFrom: "15/11/2024",
                DateTo: "15/12/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 8333.33
              },
              {
                Installment: 11,
                DateFrom: "15/12/2024",
                DateTo: "15/01/2025",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 4166.66
              },
              {
                Installment: 12,
                DateFrom: "15/01/2025",
                DateTo: "15/02/2025",
                LastRepaymentDate: null,
                InstallmentAmount: 4583.33,
                Principal: 4166.67,
                Interest: 416.66,
                Balance: 0.00
              }
            ]
          }]
        }
      };
    } else if (loanNumber === "LN009876543") {
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: [{
            RepaymentPlan: [
              {
                Installment: 1,
                DateFrom: "10/03/2024",
                DateTo: "10/04/2024",
                LastRepaymentDate: "10/04/2024",
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 12500.00
              },
              {
                Installment: 2,
                DateFrom: "10/04/2024",
                DateTo: "10/05/2024",
                LastRepaymentDate: "10/05/2024",
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 10000.00
              },
              {
                Installment: 3,
                DateFrom: "10/05/2024",
                DateTo: "10/06/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 7500.00
              },
              {
                Installment: 4,
                DateFrom: "10/06/2024",
                DateTo: "10/07/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 5000.00
              },
              {
                Installment: 5,
                DateFrom: "10/07/2024",
                DateTo: "10/08/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 2500.00
              },
              {
                Installment: 6,
                DateFrom: "10/08/2024",
                DateTo: "10/09/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 0.00
              }
            ]
          }]
        }
      };
    } else if (loanNumber.startsWith("LN") && loanNumber.endsWith("001")) {
      // Handle dynamically generated loan numbers for registered users
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: [{
            RepaymentPlan: [
              {
                Installment: 1,
                DateFrom: "01/03/2024",
                DateTo: "01/04/2024",
                LastRepaymentDate: "01/04/2024",
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 22500.00
              },
              {
                Installment: 2,
                DateFrom: "01/04/2024",
                DateTo: "01/05/2024",
                LastRepaymentDate: "01/05/2024",
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 20000.00
              },
              {
                Installment: 3,
                DateFrom: "01/05/2024",
                DateTo: "05/05/2024",
                LastRepaymentDate: "05/05/2024",
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 17500.00
              },
              {
                Installment: 4,
                DateFrom: "05/05/2024",
                DateTo: "05/06/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 15000.00
              },
              {
                Installment: 5,
                DateFrom: "05/06/2024",
                DateTo: "05/07/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 12500.00
              },
              {
                Installment: 6,
                DateFrom: "05/07/2024",
                DateTo: "05/08/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 10000.00
              },
              {
                Installment: 7,
                DateFrom: "05/08/2024",
                DateTo: "05/09/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 7500.00
              },
              {
                Installment: 8,
                DateFrom: "05/09/2024",
                DateTo: "05/10/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 5000.00
              },
              {
                Installment: 9,
                DateFrom: "05/10/2024",
                DateTo: "05/11/2024",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 2500.00
              },
              {
                Installment: 10,
                DateFrom: "05/11/2024",
                DateTo: "01/01/2025",
                LastRepaymentDate: null,
                InstallmentAmount: 2750.00,
                Principal: 2500.00,
                Interest: 250.00,
                Balance: 0.00
              }
            ]
          }]
        }
      };
    } else {
      return {
        status: 420,
        data: {
          Id: 68283,
          Code: 420,
          Msg: "LoanNumber not found"
        }
      };
    }
  },

  // Mock for loan applications status
  checkLoanApplicationsStatus: (alias, applicationNumber) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    return {
      status: 200,
      data: {
        Id: 20635,
        Code: 200,
        Msg: "OK",
        Body: {
          Alias: alias,
          LoanNumber: `0115${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}-01-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}-00001`,
          ApplicationNumber: applicationNumber || `APL-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}/20`,
          Amount: Math.floor(Math.random() * 100000) + 20000,
          FirstInstallmentDate: "30.01.2025",
          MaturityDate: "30.01.2026",
          NumberOfInstallments: Math.floor(Math.random() * 24) + 6,
          StatusCode: "200",
          Status: "Approved",
          Note: "OK"
        }
      }
    };
  },

  // Mock for loan status
  checkLoanStatus: (alias, loanNumber) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    return {
      status: 200,
      data: {
        Id: 26902,
        Code: 200,
        Msg: "OK",
        Body: {
          LoanNumber: loanNumber,
          Status: "Active",
          StatusCode: 200
        }
      }
    };
  },

  // Mock for grantable amount
  checkGrantableAmount: (alias, merchantClientCode, data) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    const baseAmount = Math.floor(Math.random() * 50000) + 20000;
    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK",
        Body: {
          GrantableAmount: String(baseAmount),
          Reason: "Approved based on credit assessment and transaction history"
        }
      }
    };
  },

  // Mock for loan application creation
  createLoanApplication: (alias, product, amount, numberOfInstallments, loanPurposeId, businessTypeId) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    return {
      status: 200,
      data: {
        Id: 26838,
        Code: 200,
        Msg: "OK",
        Body: {
          Alias: alias,
          ApplicationNumber: `APL-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}/20`
        }
      }
    };
  },

  // Mock for loan business types
  getBusinessTypes: (product) => {
    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK",
        Body: {
          BusinessTypes: [
            { BusinessTypeId: 46, BusinessTypeName: "Agriculture" },
            { BusinessTypeId: 63, BusinessTypeName: "Manufacturing" },
            { BusinessTypeId: 62, BusinessTypeName: "Services" },
            { BusinessTypeId: 64, BusinessTypeName: "Retail" },
            { BusinessTypeId: 65, BusinessTypeName: "Trading" },
            { BusinessTypeId: 66, BusinessTypeName: "Construction" }
          ]
        }
      }
    };
  },

  // Mock for loan purposes
  getLoanPurposes: (product) => {
    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK",
        Body: {
          LoanPurposes: [
            { LoanPurposeId: 1, LoanPurposeName: "Business Expansion" },
            { LoanPurposeId: 2, LoanPurposeName: "Equipment Purchase" },
            { LoanPurposeId: 3, LoanPurposeName: "Working Capital" },
            { LoanPurposeId: 4, LoanPurposeName: "Inventory Purchase" },
            { LoanPurposeId: 5, LoanPurposeName: "Debt Consolidation" },
            { LoanPurposeId: 6, LoanPurposeName: "Emergency Expenses" }
          ]
        }
      }
    };
  },

  // Mock for loan repayment
  loanRepayment: (alias, loanNumber, amount) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK"
      }
    };
  },

  // Mock for loan repayment by alias
  loanRepaymentByAlias: (alias, amount) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    const loans = [
      { LoanNumber: "0002-01-0347586-00002", Amount: Math.floor(amount * 0.7) },
      { LoanNumber: "0002-01-0347586-00001", Amount: Math.floor(amount * 0.3) }
    ];

    return {
      status: 200,
      data: {
        Id: 20771,
        Code: 200,
        Msg: "OK",
        Body: {
          LoanList: loans
        }
      }
    };
  },

  // Mock for total to pay
  totalToPay: (alias) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "",
        Body: {
          Alias: alias,
          Loans: [
            {
              LoanNumber: "12345/123",
              TotalToPay: Math.floor(Math.random() * 10000) + 2000,
              NextInstallmentAmount: Math.floor(Math.random() * 3000) + 1000,
              NextInstallmentDate: "30.01.2025",
              PastDueAmount: Math.floor(Math.random() * 1000),
              Prepaid: 0,
              TotalToCloseAmount: Math.floor(Math.random() * 50000) + 20000,
              MaturityDate: "30.12.2025",
              NumberOfInstallments: Math.floor(Math.random() * 24) + 6
            }
          ]
        }
      }
    };
  },

  // Mock for all delinquents
  getAllDelinquents: (daysInArrearsFrom, daysInArrearsTo) => {
    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK",
        Body: {
          LoanList: [
            {
              ContactName: "John Doe",
              MobileNumber: "(389) 070-233755",
              AgreementNumber: "0010-11-0347641-00005",
              TotalPastDue: 2500.0,
              DaysInArrears: Math.floor(Math.random() * (daysInArrearsTo - daysInArrearsFrom)) + daysInArrearsFrom
            },
            {
              ContactName: "Jane Smith",
              MobileNumber: "(389) 070-445566",
              AgreementNumber: "0010-11-0347641-00006",
              TotalPastDue: 1200.0,
              DaysInArrears: Math.floor(Math.random() * (daysInArrearsTo - daysInArrearsFrom)) + daysInArrearsFrom
            }
          ]
        }
      }
    };
  },

  // Mock for all payments
  getAllPayments: (alias, loanNumber, filters, limit, offset) => {
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse;
    }

    const payments = Array.from({ length: Math.min(limit || 5, 10) }, (_, i) => ({
      PaymentDate: new Date(Date.now() - (i * 30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0].split('-').reverse().join('.'),
      Note: `Loan Payment (Merchant): ${loanNumber}`,
      LoanNumber: loanNumber,
      Amount: Math.floor(Math.random() * 3000) + 1000
    }));

    return {
      status: 200,
      data: {
        Id: 37200,
        Code: 200,
        Msg: "OK",
        Body: {
          PaymentsList: payments,
          TotalCount: payments.length
        }
      }
    };
  }
};

module.exports = loanMocks;