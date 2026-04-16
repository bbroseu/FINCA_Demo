const express = require('express');
const { v4: uuid } = require('uuid');
const aspektClient = require('../middleware/aspektClient');
const loanService = require('../services/loanService');
const router = express.Router();

// GET /api/loan/details/:alias/:loanNumber
// Main endpoint to get consolidated loan details for an authenticated user
router.get('/details/:alias/:loanNumber', async (req, res) => {
  try {
    const { alias, loanNumber } = req.params;

    if (!alias || !loanNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: alias and loanNumber'
      });
    }

    const result = await loanService.getLoanDetails(alias, loanNumber);

    if (!result.success) {
      const statusCode = result.code === 402 ? 404 : // Person doesn't exist -> Not Found
                         result.code === 420 ? 404 : // No loans/loan not found -> Not Found
                         result.code === 500 ? 500 : // Internal server error
                         403; // Default to Forbidden for other cases

      return res.status(statusCode).json({
        success: false,
        error: result.error
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Error in loan details endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get active loans for ownership validation (can be used independently)
router.get('/active/:alias', async (req, res) => {
  try {
    const { alias } = req.params;


    if (!alias) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: alias'
      });
    }

    const result = await loanService.getActiveLoans(alias);

    // Check for API errors (both HTTP status and API response code)
    if (result.status !== 200 || result.data.Code !== 200) {
      const statusCode = result.data.Code === 402 ? 404 : // Person doesn't exist -> Not Found
                         result.data.Code === 420 ? 404 : // No active loans -> Not Found
                         400; // Other client errors

      return res.status(statusCode).json({
        success: false,
        error: result.data.Msg
      });
    }

    // Ensure the response structure is valid (only check when API call is successful)
    if (!result.data || !result.data.Body || !result.data.Body.ActiveLoans || !result.data.Body.ActiveLoans.Loans) {
      return res.status(500).json({
        success: false,
        error: 'Invalid response structure from active loans API'
      });
    }

    res.json({
      success: true,
      data: {
        loans: result.data.Body.ActiveLoans.Loans.map(loan => ({
          loanNumber: loan.LoanNumber,
          product: loan.Product,
          productType: loan.ProductType,
          disbursementAmount: loan.Amount,
          disbursementDate: loanService.normalizeDate(loan.DisbursementDate)
        }))
      }
    });

  } catch (error) {
    console.error('Error in active loans endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/loan/info/:alias/:loanNumber
// Get basic loan information (without repayment plan)
router.get('/info/:alias/:loanNumber', async (req, res) => {
  try {
    const { alias, loanNumber } = req.params;

    if (!alias || !loanNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: alias and loanNumber'
      });
    }

    // First validate ownership
    const activeLoansResponse = await loanService.getActiveLoans(alias);

    if (activeLoansResponse.status !== 200 || activeLoansResponse.data.Code !== 200) {
      const statusCode = activeLoansResponse.data.Code === 402 ? 404 : 404;
      return res.status(statusCode).json({
        success: false,
        error: activeLoansResponse.data.Msg
      });
    }

    // Check loan ownership
    if (!activeLoansResponse.data || !activeLoansResponse.data.Body ||
        !activeLoansResponse.data.Body.ActiveLoans || !activeLoansResponse.data.Body.ActiveLoans.Loans) {
      return res.status(500).json({
        success: false,
        error: 'Invalid active loans response structure'
      });
    }

    const userLoans = activeLoansResponse.data.Body.ActiveLoans.Loans;
    const hasLoan = userLoans.some(loan => loan.LoanNumber === loanNumber);

    if (!hasLoan) {
      return res.status(404).json({
        success: false,
        error: "Loan not found or access denied"
      });
    }

    // Get loan details
    const loanResponse = await loanService.getLoan(loanNumber, alias);

    if (loanResponse.status !== 200) {
      return res.status(400).json({
        success: false,
        error: loanResponse.data.Msg
      });
    }

    const loanData = loanResponse.data.Body;
    const installmentsPaid = loanData.NumberOfInstallments - loanData.RemainingInstallments;

    res.json({
      success: true,
      data: {
        loanNumber: loanData.LoanNumber,
        disbursementAmount: loanData.Amount,
        numberOfInstallments: loanData.NumberOfInstallments,
        outstandingAmount: loanData.RemainingAmount,
        installmentsPaid: installmentsPaid,
        installmentsRemaining: loanData.RemainingInstallments,
        pastDueAmount: loanData.TotalPastDueAmount,
        nextInstallmentAmount: loanData.NextInstallmentAmount,
        nextInstallmentPaymentDate: loanService.normalizeDate(loanData.NextInstallmentDate),
        totalToCloseAmount: loanData.TotalToCloseAmount,
        maturityDate: loanService.normalizeDate(loanData.MaturityDate),
        loanProduct: loanData.Product,
        loanStatus: loanData.LoanStatus,
        loanStatusCode: loanData.LoanStatusCode
      }
    });

  } catch (error) {
    console.error('Error in loan info endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// GET /api/loan/repayment/:alias/:loanNumber
// Get repayment plan for a loan
router.get('/repayment/:alias/:loanNumber', async (req, res) => {
  try {
    const { alias, loanNumber } = req.params;

    if (!alias || !loanNumber) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: alias and loanNumber'
      });
    }

    // First validate ownership
    const activeLoansResponse = await loanService.getActiveLoans(alias);

    if (activeLoansResponse.status !== 200 || activeLoansResponse.data.Code !== 200) {
      const statusCode = activeLoansResponse.data.Code === 402 ? 404 : 404;
      return res.status(statusCode).json({
        success: false,
        error: activeLoansResponse.data.Msg
      });
    }

    // Check loan ownership
    if (!activeLoansResponse.data || !activeLoansResponse.data.Body ||
        !activeLoansResponse.data.Body.ActiveLoans || !activeLoansResponse.data.Body.ActiveLoans.Loans) {
      return res.status(500).json({
        success: false,
        error: 'Invalid active loans response structure'
      });
    }

    const userLoans = activeLoansResponse.data.Body.ActiveLoans.Loans;
    const hasLoan = userLoans.some(loan => loan.LoanNumber === loanNumber);

    if (!hasLoan) {
      return res.status(404).json({
        success: false,
        error: "Loan not found or access denied"
      });
    }

    // Get repayment plan
    const repaymentResponse = await loanService.getRepaymentPlan(alias, loanNumber);

    if (repaymentResponse.status !== 200) {
      return res.status(400).json({
        success: false,
        error: repaymentResponse.data.Msg
      });
    }

    const repaymentPlan = repaymentResponse.data.Body[0].RepaymentPlan;

    res.json({
      success: true,
      data: {
        loanNumber: loanNumber,
        repaymentPlan: repaymentPlan.map(installment => ({
          installmentNumber: installment.Installment,
          startDate: loanService.normalizeDate(installment.DateFrom.replace('/', '.')),
          dueDate: loanService.normalizeDate(installment.DateTo.replace('/', '.')),
          actualPaymentDate: installment.LastRepaymentDate ?
            loanService.normalizeDate(installment.LastRepaymentDate.replace('/', '.')) : null,
          totalAmount: installment.InstallmentAmount,
          principalAmount: installment.Principal,
          interestAmount: installment.Interest,
          remainingBalance: installment.Balance,
          isPaid: installment.LastRepaymentDate !== null
        }))
      }
    });

  } catch (error) {
    console.error('Error in repayment plan endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Test endpoint - Check loan status
router.post('/test-loan-status', async (_req, res) => {
  try {
    const testData = {
      "Alias": "1403990450033",
      "LoanNumber": "01150000001-01-0336411-00001"
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    console.log('=== TEST LOAN STATUS ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/checkLoanStatus/${requestId}`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('========================');

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for loan status
      response = {
        status: 200,
        data: {
          Id: 26902,
          Code: 200,
          Msg: "OK",
          Body: {
            LoanNumber: testData.LoanNumber,
            Status: "Repayment",
            StatusCode: 200
          }
        }
      };
    } else {
      const aspektClient = require('../middleware/aspektClient');
      response = await aspektClient.get(`/api/checkLoanStatus/${requestId}`, {
        data: testData
      });
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status,
      debug: {
        testData: testData,
        url: `${process.env.API_BASE_URL}/api/checkLoanStatus/${requestId}`
      }
    });

  } catch (error) {
    console.error('Test loan status error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to test loan status',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint - Get active loans
router.post('/test-active-loans', async (_req, res) => {
  try {
    const testData = {
      "Alias": "1403990450033",
      "OutputParams": [
        "Id",
        "Alias",
        "LoanNumber",
        "Amount",
        "DisbursementDate",
        "InterestRate",
        "Product",
        "ProductType",
        "FirstInstallmentDate",
        "MaturityDate",
        "NumberOfInstallments"
      ]
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    console.log('=== TEST ACTIVE LOANS ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/getActiveLoans/${requestId}`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('========================');

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for active loans
      response = {
        status: 200,
        data: {
          Id: 37199,
          Code: 200,
          Msg: "OK",
          Body: {
            ActiveLoans: {
              Loans: [
                {
                  Alias: testData.Alias,
                  LoanNumber: "01150000001-01-0337421-00001",
                  Amount: 1500000.0,
                  Product: "04-03 MF AGRICULTURE",
                  ProductType: "Standard",
                  FirstInstallmentDate: "31.07.2020",
                  MaturityDate: "30.09.2020",
                  NumberOfInstallments: 3,
                  RemainingInstallments: 3,
                  NextInstallmentAmount: 520937.0,
                  NextInstallmentDate: "31.07.2020",
                  TotalToCloseAmount: 1500000.0,
                  TotalPastDueAmount: 0.0,
                  DaysInArrears: 0
                }
              ]
            }
          }
        }
      };
    } else {
      const aspektClient = require('../middleware/aspektClient');
      response = await aspektClient.get(`/api/getActiveLoans/${requestId}`, {
        data: testData
      });
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status,
      debug: {
        testData: testData,
        url: `${process.env.API_BASE_URL}/api/getActiveLoans/${requestId}`
      }
    });

  } catch (error) {
    console.error('Test active loans error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to test active loans',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint - Get loan details
router.post('/test-loan-details', async (_req, res) => {
  try {
    const testData = {
      "LoanNumber": "01150000013-01-0088251-00002",
      "Alias": "1403990450033"
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    console.log('=== TEST LOAN DETAILS ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/getLoan/${requestId}`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('=========================');

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for loan details
      response = {
        status: 200,
        data: {
          Id: 37379,
          Code: 200,
          Msg: "OK",
          Body: {
            Loans: [
              {
                Alias: testData.Alias,
                LoanNumber: testData.LoanNumber,
                LoanStatus: "Repayment",
                LoanStatusCode: 4,
                Amount: 1027000.0,
                Fees: 22500.0,
                Product: "04-02 MF SERVICES ET PRODUCTION",
                ProductType: "Standard",
                FirstInstallmentDate: "27.04.2020",
                MaturityDate: "25.03.2021",
                NumberOfInstallments: 12,
                RemainingInstallments: 12,
                NextInstallmentAmount: 101442.0,
                NextInstallmentDate: "27.07.2020",
                TotalToCloseAmount: 1032449.54,
                TotalPastDueAmount: 206762.29,
                RemainingAmount: 955382.08,
                RemainingFees: 0.0,
                Penalty: 174.89,
                DaysInArrears: 55,
                DaysInArrearsOD: 55
              }
            ]
          }
        }
      };
    } else {
      const aspektClient = require('../middleware/aspektClient');
      response = await aspektClient.get(`/api/getLoan/${requestId}`, {
        data: testData
      });
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status,
      debug: {
        testData: testData,
        url: `${process.env.API_BASE_URL}/api/getLoan/${requestId}`
      }
    });

  } catch (error) {
    console.error('Test loan details error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to test loan details',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint - Get repayment plan
router.post('/test-repayment-plan', async (_req, res) => {
  try {
    const testData = {
      "Alias": "1403990450033",
      "LoanNumber": "12345/123"
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    console.log('=== TEST REPAYMENT PLAN ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/repaymentPlan/${requestId}`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('===========================');

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for repayment plan
      response = {
        status: 200,
        data: {
          Id: 0,
          Code: 200,
          Msg: "OK",
          Body: [
            {
              Alias: testData.Alias,
              LoanNumber: testData.LoanNumber,
              Amount: 5000,
              Product: "PR001",
              RepaymentPlan: [
                {
                  Installment: "1",
                  DateFrom: "08/08/2018",
                  DateTo: "08/09/2018",
                  LastRepaymentDate: "08/09/2018",
                  InstallmentAmount: "3223",
                  Principal: "3000",
                  Interest: "223",
                  Balance: "6446"
                },
                {
                  Installment: "2",
                  DateFrom: "08/09/2018",
                  DateTo: "08/10/2018",
                  LastRepaymentDate: "08/10/2018",
                  InstallmentAmount: "3223",
                  Principal: "3000",
                  Interest: "223",
                  Balance: "3223"
                },
                {
                  Installment: "3",
                  DateFrom: "08/10/2018",
                  DateTo: "08/11/2018",
                  LastRepaymentDate: "08/11/2018",
                  InstallmentAmount: "3223",
                  Principal: "3000",
                  Interest: "223",
                  Balance: "0"
                }
              ]
            }
          ]
        }
      };
    } else {
      const aspektClient = require('../middleware/aspektClient');
      response = await aspektClient.get(`/api/repaymentPlan/${requestId}`, {
        data: testData
      });
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status,
      debug: {
        testData: testData,
        url: `${process.env.API_BASE_URL}/api/repaymentPlan/${requestId}`
      }
    });

  } catch (error) {
    console.error('Test repayment plan error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to test repayment plan',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint - Loan repayment
router.post('/test-loan-repayment', async (_req, res) => {
  try {
    const testData = {
      "Alias": "1403990450033",
      "LoanNumber": "12345/123",
      "Amount": 3223
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    console.log('=== TEST LOAN REPAYMENT ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/loanRepayment/${requestId}`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('===========================');

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for loan repayment
      response = {
        status: 200,
        data: {
          Id: 0,
          Code: 200,
          Msg: "OK"
        }
      };
    } else {
      const aspektClient = require('../middleware/aspektClient');
      response = await aspektClient.post(`/api/loanRepayment/${requestId}`, testData);
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status,
      debug: {
        testData: testData,
        url: `${process.env.API_BASE_URL}/api/loanRepayment/${requestId}`
      }
    });

  } catch (error) {
    console.error('Test loan repayment error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to test loan repayment',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Get all ongoing loan applications
router.get('/applications/:alias', async (req, res) => {
  const { alias } = req.params;

  if (!alias) {
    return res.status(400).json({
      success: false,
      error: 'Alias parameter is required'
    });
  }

  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for ongoing loan applications
      response = {
        status: 200,
        data: {
          Id: 68291,
          Code: 200,
          Msg: "OK",
          Body: {
            Applications: [
              {
                Alias: alias,
                Product: "04-05 MF GCV",
                ApplicationNumber: "APL-2847597/21",
                Amount: 20000.0,
                NumberOfInstallments: "12",
                ApplicationDate: "15.01.2024",
                InterestRate: 12.5,
                ArrangementFee: 2.5,
                Status: "Under Review"
              },
              {
                Alias: alias,
                Product: "04-03 MF AGRICULTURE",
                ApplicationNumber: "APL-2847598/21",
                Amount: 35000.0,
                NumberOfInstallments: "24",
                ApplicationDate: "20.01.2024",
                InterestRate: 10.0,
                ArrangementFee: 3.0,
                Status: "Approved"
              }
            ]
          }
        }
      };
    } else {
      response = await aspektClient.get(`/api/getAllOngoingLoanApplications/${requestId}`, {
        data: { Alias: alias }
      });
    }

    // Check for API errors (both HTTP status and API response code)
    if (response.status !== 200 || response.data.Code !== 200) {
      const statusCode = response.data.Code === 402 ? 404 : // Person doesn't exist -> Not Found
                         response.data.Code === 420 ? 404 : // No ongoing applications -> Not Found
                         response.data.Code === 900 ? 500 : // General error -> Internal Server Error
                         400; // Other client errors

      return res.status(statusCode).json({
        success: false,
        error: response.data.Msg
      });
    }

    res.json({
      success: true,
      data: {
        applications: response.data.Body.Applications.map(app => ({
          alias: app.Alias,
          product: app.Product,
          applicationNumber: app.ApplicationNumber,
          amount: app.Amount,
          numberOfInstallments: parseInt(app.NumberOfInstallments),
          applicationDate: app.ApplicationDate,
          interestRate: app.InterestRate,
          arrangementFee: app.ArrangementFee,
          status: app.Status
        }))
      }
    });

  } catch (error) {
    console.error('Get ongoing loan applications error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch ongoing loan applications',
      details: error.message
    });
  }
});

// Create loan application
router.post('/application/create', async (_req, res) => {
  const requestId = uuid();

  try {

    // Use predefined mock data for the loan application
    const applicationData = {
      "Alias": "12341564413",
      "Product": "04-05",
      "Amount": 500000,
      "NumberOfInstallments": 12,
      "LoanPurposeId": 1,
      "BusinessTypeId": 1
    };

    let response;

    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for loan application creation
      response = {
        status: 200,
        data: {
          Id: 26838,
          Code: 200,
          Msg: "OK",
          Body: {
            Alias: applicationData.Alias,
            ApplicationNumber: `APL-${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}/20`
          }
        }
      };
    } else {
      console.log('=== CREATE LOAN APPLICATION DEBUG ===');
      console.log('URL:', `/api/createLoanApplication/${requestId}`);
      console.log('Data being sent:', JSON.stringify(applicationData, null, 2));
      console.log('=====================================');

      response = await aspektClient.post(`/api/createLoanApplication/${requestId}`, applicationData);
    }

    // Check for API errors (both HTTP status and API response code)
    if (response.status !== 200 || response.data.Code !== 200) {
      const statusCode = response.data.Code === 401 ? 409 : // Duplicate requestId -> Conflict
                         response.data.Code === 402 ? 404 : // Person doesn't exist -> Not Found
                         response.data.Code === 403 ? 400 : // Incorrect amount -> Bad Request
                         response.data.Code === 404 ? 400 : // Null value -> Bad Request
                         response.data.Code === 432 ? 400 : // Product Code not found -> Bad Request
                         response.data.Code === 433 ? 400 : // Amount out of range -> Bad Request
                         response.data.Code === 434 ? 400 : // Total number of installments out of range -> Bad Request
                         response.data.Code === 503 ? 400 : // BusinessType not found -> Bad Request
                         response.data.Code === 504 ? 400 : // LoanPurpose not found -> Bad Request
                         400; // Other client errors

      return res.status(statusCode).json({
        success: false,
        error: response.data.Msg,
        code: response.data.Code
      });
    }

    res.json({
      success: true,
      data: {
        alias: response.data.Body.Alias,
        applicationNumber: response.data.Body.ApplicationNumber,
        message: 'Loan application created successfully'
      }
    });

  } catch (error) {
    console.error('Create loan application error:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        details: `The endpoint /api/createLoanApplication/${requestId} was not found on the server`,
        url: `/api/createLoanApplication/${requestId}`
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to create loan application',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Get all loan applications on date
router.post('/applications-on-date', async (req, res) => {
  const { Date } = req.body;

  if (!Date) {
    return res.status(400).json({
      success: false,
      error: 'Date is required in format dd.mm.yyyy'
    });
  }

  // Validate date format (dd.mm.yyyy)
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(Date)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid date format. Use dd.mm.yyyy',
      received: Date
    });
  }

  try {
    let response;
    const requestId = uuid();

    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for loan applications on date
      response = {
        status: 200,
        data: {
          Id: 68292,
          Code: 200,
          Msg: "OK",
          Body: [
            {
              Alias: "USR000000345",
              ApplicationNumber: "APL-2847597/21",
              LoanNumber: "LN001234567",
              Amount: 25000,
              FirstInstallmentDate: "15.01.2024",
              MaturityDate: "15.01.2025",
              InstallmentAmount: 2250.50,
              NumberOfInstallments: 12,
              StatusCode: "200",
              Status: "Approved",
              Note: "OK"
            },
            {
              Alias: "USR000000346",
              ApplicationNumber: "APL-2847598/21",
              Amount: 15000,
              FirstInstallmentDate: "20.01.2024",
              MaturityDate: "20.07.2024",
              InstallmentAmount: 2750.00,
              NumberOfInstallments: 6,
              StatusCode: "201",
              Status: "Pending",
              Note: "Under review"
            },
            {
              Alias: "USR000000347",
              ApplicationNumber: "APL-2847599/21",
              Amount: 50000,
              StatusCode: "202",
              Status: "Rejected",
              Note: "Insufficient credit score"
            }
          ]
        }
      };
    } else {
      console.log('=== GET LOAN APPLICATIONS ON DATE DEBUG ===');
      console.log('URL:', `/api/getAllLoanApplicationsOnDate/${requestId}`);
      console.log('Date being sent:', Date);
      console.log('==========================================');

      response = await aspektClient.get(`/api/getAllLoanApplicationsOnDate/${requestId}`, {
        data: { Date: Date }
      });
    }

    // Check for API errors
    if (response.status !== 200 || response.data.Code !== 200) {
      return res.status(400).json({
        success: false,
        error: response.data.Msg,
        code: response.data.Code
      });
    }

    // Transform the response data
    const applications = response.data.Body.map(app => ({
      alias: app.Alias,
      contactCode: app.ContactCode || null,
      applicationNumber: app.ApplicationNumber,
      loanNumber: app.LoanNumber || null, // Only present if approved
      amount: app.Amount,
      firstInstallmentDate: app.FirstInstallmentDate || null,
      maturityDate: app.MaturityDate || null,
      installmentAmount: app.InstallmentAmount || null,
      numberOfInstallments: app.NumberOfInstallments || null,
      status: app.Status,
      statusCode: app.StatusCode,
      note: app.Note
    }));

    res.json({
      success: true,
      data: {
        date: Date,
        applications: applications,
        totalCount: applications.length
      }
    });

  } catch (error) {
    console.error('Get loan applications on date error:', error.message);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);

    return res.status(500).json({
      success: false,
      error: 'Failed to fetch loan applications on date',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

// Test endpoint - Create loan application
router.post('/test-create-loan-application', async (_req, res) => {
  try {
    const testData = {
      "Alias": "1403990450033",
      "Product": "04-05",
      "Amount": 500000,
      "NumberOfInstallments": 12,
      "LoanPurposeId": 1,
      "BusinessTypeId": 1
    };

    const requestId = Math.floor(Math.random() * 10000).toString();

    console.log('=== TEST CREATE LOAN APPLICATION ===');
    console.log('URL:', `${process.env.API_BASE_URL}/api/createLoanApplication/${requestId}`);
    console.log('Data:', JSON.stringify(testData, null, 2));
    console.log('=====================================');

    let response;
    if (process.env.USE_MOCK_API === 'true') {
      // Mock response for create loan application
      response = {
        status: 200,
        data: {
          Id: 26838,
          Code: 200,
          Msg: "OK",
          Body: {
            Alias: testData.Alias,
            ApplicationNumber: "APL-005051/20"
          }
        }
      };
    } else {
      const aspektClient = require('../middleware/aspektClient');
      response = await aspektClient.post(`/api/createLoanApplication/${requestId}`, testData);
    }

    return res.json({
      success: true,
      requestId: requestId,
      response: response.data,
      status: response.status,
      debug: {
        testData: testData,
        url: `${process.env.API_BASE_URL}/api/createLoanApplication/${requestId}`
      }
    });

  } catch (error) {
    console.error('Test create loan application error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to test create loan application',
      details: error.message,
      fullError: error.response?.data || error.message
    });
  }
});

module.exports = router;