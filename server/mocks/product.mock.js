// Product Mock Data following Aspekt API structure
const productMocks = {
  // Mock for getting products info
  getProducts: (alias) => {
    return {
      status: 200,
      data: {
        Id: 26835,
        Code: 200,
        Msg: "OK",
        Body: {
          Products: [
            {
              Product: "04-03",
              ProductName: "MICROFINANCE AGRICULTURE LOAN",
              Installments: "6-36",
              Margin: "12.5-18.5",
              ArrangementFee: "2-5%",
              InsuranceFee: "1-3%",
              TaxOnInterest: "0%"
            },
            {
              Product: "04-05",
              ProductName: "MICROFINANCE BUSINESS LOAN",
              Installments: "3-24",
              Margin: "15.0-22.0",
              ArrangementFee: "3-7%",
              InsuranceFee: "2-4%",
              TaxOnInterest: "0%"
            },
            {
              Product: "04-02",
              ProductName: "MICROFINANCE SERVICES LOAN",
              Installments: "1-18",
              Margin: "18.0-25.0",
              ArrangementFee: "5-10%",
              InsuranceFee: "3-5%",
              TaxOnInterest: "0%"
            },
            {
              Product: "04-01",
              ProductName: "EMERGENCY LOAN",
              Installments: "1-6",
              Margin: "25.0-35.0",
              ArrangementFee: "10-15%",
              InsuranceFee: "5%",
              TaxOnInterest: "0%"
            }
          ]
        }
      }
    };
  },

  // Mock for getting products with levels
  getProductsWithLevels: () => {
    return {
      status: 200,
      data: {
        Code: 200,
        Msg: "OK",
        Body: {
          Products: [
            {
              Product: "04-03",
              ProductName: "Microfinance Agriculture Loan",
              Levels: [
                {
                  Level: 1,
                  Amount: "5000-50000",
                  NoInstallments: "6-24",
                  InterestRate: "12-18",
                  AdminFee: "300"
                },
                {
                  Level: 2,
                  Amount: "50001-150000",
                  NoInstallments: "12-36",
                  InterestRate: "10-16",
                  AdminFee: "500"
                }
              ]
            },
            {
              Product: "04-05",
              ProductName: "Microfinance Business Loan",
              Levels: [
                {
                  Level: 1,
                  Amount: "10000-75000",
                  NoInstallments: "3-18",
                  InterestRate: "15-22",
                  AdminFee: "400"
                },
                {
                  Level: 2,
                  Amount: "75001-200000",
                  NoInstallments: "12-24",
                  InterestRate: "12-20",
                  AdminFee: "750"
                }
              ]
            },
            {
              Product: "04-02",
              ProductName: "Microfinance Services Loan",
              Levels: [
                {
                  Level: 1,
                  Amount: "3000-25000",
                  NoInstallments: "1-12",
                  InterestRate: "18-25",
                  AdminFee: "250"
                },
                {
                  Level: 2,
                  Amount: "25001-100000",
                  NoInstallments: "6-18",
                  InterestRate: "16-22",
                  AdminFee: "500"
                }
              ]
            },
            {
              Product: "04-01",
              ProductName: "Emergency Loan",
              Levels: [
                {
                  Level: 1,
                  Amount: "1000-15000",
                  NoInstallments: "1-3",
                  InterestRate: "25-35",
                  AdminFee: "150"
                },
                {
                  Level: 2,
                  Amount: "15001-50000",
                  NoInstallments: "3-6",
                  InterestRate: "20-30",
                  AdminFee: "300"
                }
              ]
            }
          ]
        }
      }
    };
  }
};

module.exports = productMocks;