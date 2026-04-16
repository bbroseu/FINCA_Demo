const contactMocks = require('./contact.mock');
const JSONStorage = require('../utils/jsonStorage');

// JSON file storage for leads
const leadsStorage = new JSONStorage('leads.json');

const leadMocks = {

  // Step 3.1 - Mock for getProducts
  getProducts: (alias) => {
    // Check if user exists first
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse; // Return the same error (402: Person doesn't exist)
    }

    return {
      status: 200,
      data: {
        Id: 68284,
        Code: 200,
        Msg: "OK",
        Body: {
          Products: [
            {
              Product: "STD001",
              ProductName: "Standard Business Loan",
              Installments: "12-60",
              Margin: "8.5-12.0",
              ArrangementFee: "2.0-3.5"
            },
            {
              Product: "EMG001",
              ProductName: "Emergency Loan",
              Installments: "6-24",
              Margin: "10.0-15.0",
              ArrangementFee: "1.5-2.5"
            },
            {
              Product: "AGR001",
              ProductName: "Agriculture Loan",
              Installments: "12-72",
              Margin: "7.5-11.0",
              ArrangementFee: "2.5-4.0"
            },
            {
              Product: "WOM001",
              ProductName: "Women Entrepreneur Loan",
              Installments: "12-60",
              Margin: "7.0-10.5",
              ArrangementFee: "1.8-3.0"
            },
            {
              Product: "YTH001",
              ProductName: "Youth Business Loan",
              Installments: "12-48",
              Margin: "6.5-9.5",
              ArrangementFee: "1.5-2.8"
            },
            {
              Product: "SME001",
              ProductName: "Small & Medium Enterprise Loan",
              Installments: "18-84",
              Margin: "8.0-13.5",
              ArrangementFee: "3.0-5.0"
            },
            {
              Product: "EQP001",
              ProductName: "Equipment Financing Loan",
              Installments: "24-96",
              Margin: "9.0-14.0",
              ArrangementFee: "3.5-6.0"
            },
            {
              Product: "EDU001",
              ProductName: "Education Loan",
              Installments: "12-72",
              Margin: "7.0-11.5",
              ArrangementFee: "2.0-4.5"
            },
            {
              Product: "HOM001",
              ProductName: "Home Improvement Loan",
              Installments: "12-84",
              Margin: "8.5-12.5",
              ArrangementFee: "2.5-4.0"
            },
            {
              Product: "MIC001",
              ProductName: "Microfinance Loan",
              Installments: "6-36",
              Margin: "12.0-18.0",
              ArrangementFee: "1.0-2.0"
            }
          ]
        }
      }
    };
  },

  // Step 3.1 - Mock for getProductsWithLevels
  getProductsWithLevels: (alias) => {
    // Check if user exists first
    const contactResponse = contactMocks.getContact(alias);
    if (contactResponse.status !== 200) {
      return contactResponse; // Return the same error (402: Person doesn't exist)
    }

    return {
      status: 200,
      data: {
        Id: 68285,
        Code: 200,
        Msg: "OK",
        Body: {
          Products: [
            {
              Product: "STD001",
              ProductName: "Standard Business Loan",
              Levels: [
                {
                  Level: 1,
                  MinAmount: 10000,
                  MaxAmount: 50000,
                  MinInstallments: 12,
                  MaxInstallments: 36,
                  InterestRateMin: 8.5,
                  InterestRateMax: 10.0,
                  AdminFee: 2.0
                },
                {
                  Level: 2,
                  MinAmount: 50001,
                  MaxAmount: 150000,
                  MinInstallments: 24,
                  MaxInstallments: 60,
                  InterestRateMin: 9.0,
                  InterestRateMax: 12.0,
                  AdminFee: 3.5
                }
              ]
            },
            {
              Product: "EMG001",
              ProductName: "Emergency Loan",
              Levels: [
                {
                  Level: 1,
                  MinAmount: 5000,
                  MaxAmount: 25000,
                  MinInstallments: 6,
                  MaxInstallments: 18,
                  InterestRateMin: 10.0,
                  InterestRateMax: 13.0,
                  AdminFee: 1.5
                },
                {
                  Level: 2,
                  MinAmount: 25001,
                  MaxAmount: 75000,
                  MinInstallments: 12,
                  MaxInstallments: 24,
                  InterestRateMin: 12.0,
                  InterestRateMax: 15.0,
                  AdminFee: 2.5
                }
              ]
            },
            {
              Product: "AGR001",
              ProductName: "Agriculture Loan",
              Levels: [
                {
                  Level: 1,
                  MinAmount: 15000,
                  MaxAmount: 100000,
                  MinInstallments: 12,
                  MaxInstallments: 48,
                  InterestRateMin: 7.5,
                  InterestRateMax: 9.5,
                  AdminFee: 2.5
                },
                {
                  Level: 2,
                  MinAmount: 100001,
                  MaxAmount: 300000,
                  MinInstallments: 24,
                  MaxInstallments: 72,
                  InterestRateMin: 8.5,
                  InterestRateMax: 11.0,
                  AdminFee: 4.0
                }
              ]
            },
            {
              Product: "WOM001",
              ProductName: "Women Entrepreneur Loan",
              Levels: [
                {
                  Level: 1,
                  MinAmount: 8000,
                  MaxAmount: 40000,
                  MinInstallments: 12,
                  MaxInstallments: 36,
                  InterestRateMin: 7.0,
                  InterestRateMax: 9.0,
                  AdminFee: 1.8
                },
                {
                  Level: 2,
                  MinAmount: 40001,
                  MaxAmount: 120000,
                  MinInstallments: 24,
                  MaxInstallments: 60,
                  InterestRateMin: 8.0,
                  InterestRateMax: 10.5,
                  AdminFee: 3.0
                }
              ]
            },
            {
              Product: "YTH001",
              ProductName: "Youth Business Loan",
              Levels: [
                {
                  Level: 1,
                  MinAmount: 5000,
                  MaxAmount: 30000,
                  MinInstallments: 12,
                  MaxInstallments: 30,
                  InterestRateMin: 6.5,
                  InterestRateMax: 8.5,
                  AdminFee: 1.5
                },
                {
                  Level: 2,
                  MinAmount: 30001,
                  MaxAmount: 80000,
                  MinInstallments: 18,
                  MaxInstallments: 48,
                  InterestRateMin: 7.5,
                  InterestRateMax: 9.5,
                  AdminFee: 2.8
                }
              ]
            }
          ]
        }
      }
    };
  },

  // Step 3.2 - Mock for getLoanPurposes
  getLoanPurposes: (productCode) => {
    const purposes = {
      "STD001": [
        { LoanPurposeId: "WC001", LoanPurposeName: "Working Capital" },
        { LoanPurposeId: "EQ001", LoanPurposeName: "Equipment Purchase" },
        { LoanPurposeId: "EX001", LoanPurposeName: "Business Expansion" }
      ],
      "EMG001": [
        { LoanPurposeId: "EM001", LoanPurposeName: "Emergency Expenses" },
        { LoanPurposeId: "UR001", LoanPurposeName: "Urgent Repairs" }
      ],
      "AGR001": [
        { LoanPurposeId: "SE001", LoanPurposeName: "Seeds & Fertilizers" },
        { LoanPurposeId: "AG001", LoanPurposeName: "Agricultural Equipment" },
        { LoanPurposeId: "LS001", LoanPurposeName: "Livestock Purchase" }
      ]
    };

    if (!purposes[productCode]) {
      return {
        status: 404,
        data: {
          Id: 68286,
          Code: 504,
          Msg: "LoanPurpose not found"
        }
      };
    }

    return {
      status: 200,
      data: {
        Id: 68286,
        Code: 200,
        Msg: "OK",
        Body: purposes[productCode]
      }
    };
  },

  // Step 3.2 - Mock for getBusinessTypes
  getBusinessTypes: (productCode) => {
    const businessTypes = {
      "STD001": [
        { BusinessTypeId: "RT001", BusinessTypeName: "Retail Trade" },
        { BusinessTypeId: "SV001", BusinessTypeName: "Services" },
        { BusinessTypeId: "MF001", BusinessTypeName: "Manufacturing" }
      ],
      "EMG001": [
        { BusinessTypeId: "RT001", BusinessTypeName: "Retail Trade" },
        { BusinessTypeId: "SV001", BusinessTypeName: "Services" }
      ],
      "AGR001": [
        { BusinessTypeId: "AG001", BusinessTypeName: "Agriculture" },
        { BusinessTypeId: "LV001", BusinessTypeName: "Livestock" },
        { BusinessTypeId: "FI001", BusinessTypeName: "Fisheries" }
      ]
    };

    if (!businessTypes[productCode]) {
      return {
        status: 404,
        data: {
          Id: 68287,
          Code: 503,
          Msg: "BusinessType not found"
        }
      };
    }

    return {
      status: 200,
      data: {
        Id: 68287,
        Code: 200,
        Msg: "OK",
        Body: businessTypes[productCode]
      }
    };
  },

  // Step 3.3 - Mock for getAllOffices
  getAllOffices: () => {
    return {
      status: 200,
      data: {
        Id: 68288,
        Code: 200,
        Msg: "OK",
        Body: [
          {
            OfficeId: 1,
            OfficeCode: "10",
            OfficeName: "PRIZREN Zyrja / PRIZREN Office ",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 2,
            OfficeCode: "11",
            OfficeName: "SUHAREKA Zyrja / SUHAREKA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 3,
            OfficeCode: "14",
            OfficeName: "XERXE Zyrja / XERXE Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 4,
            OfficeCode: "15",
            OfficeName: "MALISHEVA Zyrja / MALISHEVA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 5,
            OfficeCode: "16",
            OfficeName: "RAHOVEC Zyrja / RAHOVEC Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 6,
            OfficeCode: "17",
            OfficeName: "DRENAS Zyrja / DRENAS Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 7,
            OfficeCode: "18",
            OfficeName: "SKENDERAJ Zyrja / SKENDERAJ Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 8,
            OfficeCode: "19",
            OfficeName: "MITROVICA Zyrja / MITROVICA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 9,
            OfficeCode: "20",
            OfficeName: "GJAKOVA Zyrja / GJAKOVA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 10,
            OfficeCode: "21",
            OfficeName: "KLINA Zyrja / KLINA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 11,
            OfficeCode: "25",
            OfficeName: "PEJA Zyrja / PEJA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 12,
            OfficeCode: "26",
            OfficeName: "ISTOG Zyrja / ISTOG Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 13,
            OfficeCode: "27",
            OfficeName: "DECAN Zyrja / DECAN Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 14,
            OfficeCode: "30",
            OfficeName: "FERIZAJ Zyrja / FERIZAJ Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 15,
            OfficeCode: "32",
            OfficeName: "LIPJAN Zyrja / LIPJAN Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 16,
            OfficeCode: "33",
            OfficeName: "SHTIME Zyrja / SHTIME Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 17,
            OfficeCode: "34",
            OfficeName: "PRISHTINA2 Zyrja / PRISHTINA2 Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 18,
            OfficeCode: "35",
            OfficeName: "GJILAN Zyrja / GJILAN Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 19,
            OfficeCode: "36",
            OfficeName: "KAMENICA Zyrja / KAMENICA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 20,
            OfficeCode: "37",
            OfficeName: "VITIA-GJILAN Zyrja / VITIA-GJILAN Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 21,
            OfficeCode: "38",
            OfficeName: "GRACANICA Zyrja / GRACANICA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 22,
            OfficeCode: "39",
            OfficeName: "SHTRPCE Zyrja / SHTRPCE Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 23,
            OfficeCode: "40",
            OfficeName: "PRISHTINA Zyrja / PRISHTINA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 24,
            OfficeCode: "41",
            OfficeName: "PODUJEVA Zyrja / PODUJEVA Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 25,
            OfficeCode: "42",
            OfficeName: "FUSHE KOSOVE Zyrja / FUSHE KOSOVE Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 26,
            OfficeCode: "43",
            OfficeName: "VUSHTRI Zyrja / VUSHTRI Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 27,
            OfficeCode: "44",
            OfficeName: "KAQANIK Zyrja / KAQANIK Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 28,
            OfficeCode: "45",
            OfficeName: "OBILIQ Zyrja / OBILIQ Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 29,
            OfficeCode: "46",
            OfficeName: "PRIZREN2 Zyrja / PRIZREN2 Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 30,
            OfficeCode: "47",
            OfficeName: "PEJA2 Zyrja / PEJA2 Office",
            Place: {
              PlaceCode: "20000",
              PlaceName: "Prizren"
            }
          },
          {
            OfficeId: 32,
            OfficeCode: "01",
            OfficeName: "Head Office",
            Place: {
              PlaceCode: "10000",
              PlaceName: "Prishtina"
            }
          },
          {
            OfficeId: 33,
            OfficeCode: "12",
            OfficeName: "DRAGASH   Zyrja/   Dragash Office             ",
            Place: {
              PlaceCode: "-",
              PlaceName: "Migration"
            }
          },
          {
            OfficeId: 34,
            OfficeCode: "13",
            OfficeName: "RECAN  Zyrja /  Recan Office        ",
            Place: {
              PlaceCode: "-",
              PlaceName: "Migration"
            }
          },
          {
            OfficeId: 35,
            OfficeCode: "31",
            OfficeName: "VITI   Zyrja / Viti Office                      ",
            Place: {
              PlaceCode: "-",
              PlaceName: "Migration"
            }
          },
          {
            OfficeId: 36,
            OfficeCode: "02",
            OfficeName: "L&D",
            Place: {
              PlaceCode: "10000",
              PlaceName: "Prishtina"
            }
          },
          {
            OfficeId: 37,
            OfficeCode: "48",
            OfficeName: "MITROVICA NORTH Zyrja / MITROVICA NORTH Office",
            Place: {
              PlaceCode: "38220",
              PlaceName: "Mitrovice e Veriut"
            }
          },
          {
            OfficeId: 38,
            OfficeCode: "49",
            OfficeName: "Prishtina3 Zyrja / Prishtina3 Office",
            Place: {
              PlaceCode: "10000",
              PlaceName: "Prishtina"
            }
          },
          {
            OfficeId: 39,
            OfficeCode: "50",
            OfficeName: "Gjilan2 Zyrja / Gjilan2 Office",
            Place: {
              PlaceCode: "60000",
              PlaceName: "Gjilan"
            }
          }
        ]
      }
    };
  },

  // Step 3.3 - Mock for getAllPlaces
  getAllPlaces: () => {
    return {
      status: 200,
      data: {
        Id: 68289,
        Code: 200,
        Msg: "OK",
        Body: [
          { PlaceCode: "PRR001", PlaceName: "Prishtine" },
          { PlaceCode: "FUSH001", PlaceName: "Fushe Kosove" },
          { PlaceCode: "PRZ001", PlaceName: "Prizren" },
          { PlaceCode: "VLO001", PlaceName: "Vlore" },
          { PlaceCode: "ELB001", PlaceName: "Elbasan" }
        ]
      }
    };
  },

  // Step 3.4 - Mock for getAllLeadSources
  getAllLeadSources: () => {
    return {
      status: 200,
      data: {
        Id: 68290,
        Code: 200,
        Msg: "OK",
        Body: [
          { LeadSourceCode: "WEB001", LeadSourceName: "Website" },
          { LeadSourceCode: "REF001", LeadSourceName: "Customer Referral" },
          { LeadSourceCode: "MOB001", LeadSourceName: "Mobile Application" },
          { LeadSourceCode: "PHN001", LeadSourceName: "Phone Inquiry" },
          { LeadSourceCode: "NEWS001", LeadSourceName: "News/Media" },
          { LeadSourceCode: "ADV001", LeadSourceName: "Advertisement" }
        ]
      }
    };
  },

  // Step 3.7 - Mock for createLead
  createLead: (leadData) => {
    // Generate a mock lead number and ID
    const leadNumber = `${Math.floor(100000 + Math.random() * 900000)}/26`;
    const leadId = Math.floor(1000000 + Math.random() * 900000);

    // Extract personalNumber from leadData (could be in LeadDdc or as separate field)
    let personalNumber = leadData.PersonalNumber;

    // If not provided directly, look for it in LeadDdc
    if (!personalNumber && leadData.LeadDdc) {
      const personalNumberEntry = leadData.LeadDdc.find(item =>
        item.Key && (item.Key.toLowerCase().includes('personalnumber') ||
                    item.Key.toLowerCase().includes('personal_number') ||
                    item.Key.toLowerCase().includes('uniqueid'))
      );
      if (personalNumberEntry) {
        personalNumber = personalNumberEntry.Value;
      }
    }

    // Store lead data in JSON storage
    const leadRecord = {
      leadId: leadId,
      leadNumber: leadNumber,
      personalNumber: personalNumber,
      name: leadData.Name || 'Anonymous Customer',
      mobile: leadData.Mobile || '044000000',
      email: leadData.Email || 'noreply@finca.com',
      placeCode: leadData.PlaceCode || 'PRR001',
      leadSourceCode: leadData.LeadSourceCode || 'WEB001',
      leadCategoryCode: leadData.LeadCategoryCode || '001',
      note: leadData.Note || 'Lead created without specific note',
      loanAmount: leadData.LoanAmount || 5000,
      priority: leadData.Priority || 'Normal',
      interestedInProducts: leadData.InterestedInProducts || [{ ProductCode: 'STD001' }],
      leadDdc: leadData.LeadDdc || [],
      createdAt: new Date().toISOString(),
      status: 'Active'
    };

    leadsStorage.set(leadId.toString(), leadRecord);

    // If personalNumber is available, also link it to the user
    if (personalNumber && contactMocks.getUserWithImages) {
      const user = contactMocks.getUserWithImages(personalNumber);
      if (user) {
        if (!user.leads) {
          user.leads = [];
        }
        user.leads.push({
          leadId: leadId,
          leadNumber: leadNumber,
          createdAt: leadRecord.createdAt,
          status: leadRecord.status,
          loanAmount: leadRecord.loanAmount
        });
        // Update user record with lead reference
        const JSONStorage = require('../utils/jsonStorage');
        const usersStorage = new JSONStorage('users.json');
        usersStorage.set(personalNumber, user);
      }
    }

    return {
      status: 200,
      data: {
        Id: 68291,
        Code: 200,
        Msg: "OK",
        Body: {
          LeadNumber: leadNumber,
          LeadId: leadId
        }
      }
    };
  },

  // Utility function to get all leads
  getAllLeads: () => {
    return leadsStorage.getAll();
  },

  // Utility function to get lead by ID
  getLeadById: (leadId) => {
    return leadsStorage.get(leadId.toString());
  },

  // Utility function to update lead status
  updateLeadStatus: (leadId, status) => {
    const lead = leadsStorage.get(leadId.toString());
    if (lead) {
      lead.status = status;
      lead.updatedAt = new Date().toISOString();
      leadsStorage.set(leadId.toString(), lead);

      // Also update the user's lead reference if personalNumber exists
      if (lead.personalNumber && contactMocks.getUserWithImages) {
        const user = contactMocks.getUserWithImages(lead.personalNumber);
        if (user && user.leads) {
          const userLead = user.leads.find(l => l.leadId === parseInt(leadId));
          if (userLead) {
            userLead.status = status;
            userLead.updatedAt = lead.updatedAt;
            const JSONStorage = require('../utils/jsonStorage');
            const usersStorage = new JSONStorage('users.json');
            usersStorage.set(lead.personalNumber, user);
          }
        }
      }

      return true;
    }
    return false;
  },

  // Utility function to get leads by personalNumber/alias
  getLeadsByPersonalNumber: (personalNumber) => {
    const allLeads = leadsStorage.getAll();
    const userLeads = [];

    // Find all leads with matching personalNumber
    Object.values(allLeads).forEach(lead => {
      if (lead.personalNumber === personalNumber) {
        userLeads.push(lead);
      }
    });

    return userLeads;
  },

  // Utility function to get user with their leads
  getUserWithLeads: (personalNumber) => {
    const user = contactMocks.getUserWithImages ? contactMocks.getUserWithImages(personalNumber) : null;
    if (!user) return null;

    // Get full lead details for this user
    const userLeads = leadMocks.getLeadsByPersonalNumber(personalNumber);

    return {
      ...user,
      leads: userLeads
    };
  }

};

module.exports = leadMocks;