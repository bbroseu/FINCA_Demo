const { v4: uuidv4 } = require('uuid');
const aspektClient = require('../middleware/aspektClient');

class LoanService {

  /**
   * Validates that a loan belongs to the authenticated user
   * @param {string} alias - User's alias (contact code or personal number)
   * @returns {Promise<Object>} - Response with active loans or error
   */
  async getActiveLoans(alias) {
    const requestId = uuidv4();

    try {
      const response = await aspektClient.get(`/api/getActiveLoans/${requestId}`, {
        data: {
          Alias: alias,
          OutputParams: ["Id", "Alias", "LoanNumber", "Amount", "DisbursementDate", "InterestRate", "Product", "ProductType", "FirstInstallmentDate", "MaturityDate", "NumberOfInstallments"] 
        }
      });

      return {
        status: response.status,
        data: response.data,
        requestId
      };
    } catch (error) {
      // Handle specific error responses
      if (error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          requestId
        };
      }

      throw new Error(`Failed to fetch active loans: ${error.message}`);
    }
  }

  /**
   * Fetches detailed loan information
   * @param {string} loanNumber - The loan number
   * @param {string} alias - User's alias
   * @returns {Promise<Object>} - Response with loan details or error
   */
  async getLoan(loanNumber, alias) {
    const requestId = uuidv4();

    try {
      const response = await aspektClient.get(`/api/getLoan/${requestId}`, {
        data: {
          LoanNumber: loanNumber,
          Alias: alias
        }
      });

      return {
        status: response.status,
        data: response.data,
        requestId
      };
    } catch (error) {
      if (error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          requestId
        };
      }

      throw new Error(`Failed to fetch loan details: ${error.message}`);
    }
  }

  /**
   * Fetches repayment plan for a loan
   * @param {string} alias - User's alias
   * @param {string} loanNumber - The loan number
   * @returns {Promise<Object>} - Response with repayment plan or error
   */
  async getRepaymentPlan(alias, loanNumber) {
    const requestId = uuidv4();

    try {
      const response = await aspektClient.get(`/api/repaymentPlan/${requestId}`, {
        data: {
          Alias: alias,
          LoanNumber: loanNumber
        }
      });

      return {
        status: response.status,
        data: response.data,
        requestId
      };
    } catch (error) {
      if (error.response) {
        return {
          status: error.response.status,
          data: error.response.data,
          requestId
        };
      }

      throw new Error(`Failed to fetch repayment plan: ${error.message}`);
    }
  }

  /**
   * Normalizes date from various formats to ISO 8601 (YYYY-MM-DD)
   * @param {string} dateString - Date in dd.mm.yyyy or dd/mm/yyyy format
   * @returns {string} - Date in YYYY-MM-DD format
   */
  normalizeDate(dateString) {
    if (!dateString) return null;

    // Handle both dot-separated (dd.mm.yyyy) and slash-separated (dd/mm/yyyy) formats
    const parts = dateString.split(/[./]/);
    if (parts.length !== 3) return dateString; // Return as-is if format doesn't match

    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  /**
   * Consolidated endpoint that fetches all loan details for a user
   * @param {string} alias - User's alias (contact code or personal number)
   * @param {string} loanNumber - The loan number to fetch details for
   * @returns {Promise<Object>} - Consolidated loan details response
   */
  async getLoanDetails(alias, loanNumber) {
    try {
      // Step 1: Validate loan ownership (CRITICAL for security)
      const activeLoansResponse = await this.getActiveLoans(alias);

      if (activeLoansResponse.status !== 200 || activeLoansResponse.data?.Code !== 200) {
        // Aspekt encodes business errors as Code !== 200 with HTTP 200
        // (e.g. 402 person doesn't exist, 420 no active loans).
        return {
          success: false,
          error: activeLoansResponse.data?.Msg || 'Failed to fetch active loans',
          code: activeLoansResponse.data?.Code ?? activeLoansResponse.status
        };
      }

      const userLoans = activeLoansResponse.data?.Body?.ActiveLoans?.Loans ?? [];
      const hasLoan = userLoans.some(loan => loan.LoanNumber === loanNumber);

      if (!hasLoan) {
        return {
          success: false,
          error: "Loan not found or access denied",
          code: 404
        };
      }

      // Step 2 & 3: Fetch loan details and repayment plan in parallel
      const [loanResponse, repaymentResponse] = await Promise.all([
        this.getLoan(loanNumber, alias),
        this.getRepaymentPlan(alias, loanNumber)
      ]);

      // Check for errors in loan details
      if (loanResponse.status !== 200) {
        return {
          success: false,
          error: loanResponse.data.Msg,
          code: loanResponse.data.Code
        };
      }

      // Check for errors in repayment plan
      if (repaymentResponse.status !== 200) {
        return {
          success: false,
          error: repaymentResponse.data.Msg,
          code: repaymentResponse.data.Code
        };
      }

      const loanData = loanResponse.data.Body;
      const repaymentPlan = repaymentResponse.data.Body[0].RepaymentPlan;

      // Calculate installments paid (not a direct field)
      const installmentsPaid = loanData.NumberOfInstallments - loanData.RemainingInstallments;

      // Build consolidated response with normalized dates
      return {
        success: true,
        data: {
          loanNumber: loanData.LoanNumber,
          disbursementAmount: loanData.Amount,
          numberOfInstallments: loanData.NumberOfInstallments,
          outstandingAmount: loanData.RemainingAmount, // Principal only
          installmentsPaid: installmentsPaid,
          installmentsRemaining: loanData.RemainingInstallments,
          pastDueAmount: loanData.TotalPastDueAmount,
          nextInstallmentAmount: loanData.NextInstallmentAmount,
          nextInstallmentPaymentDate: this.normalizeDate(loanData.NextInstallmentDate),
          totalToCloseAmount: loanData.TotalToCloseAmount, // Principal + interest + fees + penalty
          maturityDate: this.normalizeDate(loanData.MaturityDate),
          loanProduct: loanData.Product,
          loanStatus: loanData.LoanStatus,
          loanStatusCode: loanData.LoanStatusCode,
          repaymentPlan: repaymentPlan.map(installment => ({
            installmentNumber: installment.Installment,
            startDate: this.normalizeDate(installment.DateFrom.replace('/', '.')), // Normalize slash format
            dueDate: this.normalizeDate(installment.DateTo.replace('/', '.')),
            actualPaymentDate: installment.LastRepaymentDate ?
              this.normalizeDate(installment.LastRepaymentDate.replace('/', '.')) : null,
            totalAmount: installment.InstallmentAmount,
            principalAmount: installment.Principal,
            interestAmount: installment.Interest,
            remainingBalance: installment.Balance,
            isPaid: installment.LastRepaymentDate !== null
          }))
        }
      };

    } catch (error) {
      console.error('Error in getLoanDetails:', error);
      return {
        success: false,
        error: 'Internal server error',
        code: 500
      };
    }
  }
}

module.exports = new LoanService();