// CRM Mock Data following Aspekt API structure
const crmMocks = {
  // Mock for case status checking
  checkCaseStatus: (alias, caseNumber) => {
    const cases = {
      "000033/21": {
        Description: "Customer service inquiry resolved successfully",
        Status: "Resolved",
        StatusCode: "200"
      },
      "000034/21": {
        Description: "Product information request",
        Status: "In Progress",
        StatusCode: "201"
      }
    };

    const caseInfo = cases[caseNumber] || {
      Description: "General customer inquiry",
      Status: "New",
      StatusCode: "201"
    };

    return {
      status: 200,
      data: {
        Id: 43608,
        Code: 200,
        Msg: "OK",
        Body: {
          Alias: alias,
          CaseNumber: caseNumber,
          ...caseInfo
        }
      }
    };
  },

  // Mock for lead status checking
  checkLeadStatus: (leadNumber) => {
    const leads = {
      "000250/21": {
        Name: "BUSINESS EXPANSION LEAD",
        Status: "Active",
        StatusCode: "200",
        Note: "Lead is being processed"
      },
      "000251/21": {
        Name: "AGRICULTURE LOAN LEAD",
        Status: "Qualified",
        StatusCode: "200",
        Note: "Ready for loan application"
      }
    };

    const leadInfo = leads[leadNumber] || {
      Name: "GENERAL BUSINESS LEAD",
      Status: "New",
      StatusCode: "201",
      Note: "Initial lead created"
    };

    return {
      status: 200,
      data: {
        Id: 43903,
        Code: 200,
        Msg: "OK",
        Body: {
          LeadNumber: leadNumber,
          ...leadInfo
        }
      }
    };
  },

  // Mock for activity creation
  createActivity: (sourceKey, activityTypeCode, activityDescription) => {
    return {
      status: 200,
      data: {
        Code: 200,
        Msg: "OK",
        Body: [{
          crmActivityID: Math.floor(Math.random() * 10000),
          crmActivityTypeID: parseInt(activityTypeCode) || 4,
          crmActivityTypeCode: activityTypeCode || "001",
          crmActivityTypeName: "Phone Call"
        }]
      }
    };
  },

  // Mock for case creation
  createCase: (alias, email, subject, description) => {
    const caseNumber = `${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}/21`;

    return {
      status: 200,
      data: {
        Id: 43584,
        Code: 200,
        Msg: "OK",
        Body: {
          Alias: alias,
          CaseNumber: caseNumber
        }
      }
    };
  },

  // Mock for lead creation
  createLead: (leadData) => {
    const leadNumber = `${String(Math.floor(Math.random() * 999999)).padStart(6, '0')}/21`;

    return {
      status: 200,
      data: {
        Id: 43868,
        Code: 200,
        Msg: "OK",
        Body: {
          LeadNumber: leadNumber,
          LeadId: Math.floor(Math.random() * 10000)
        }
      }
    };
  },

  // Mock for activity types
  getActivityTypes: () => {
    return {
      status: 200,
      data: {
        Id: 43868,
        Code: 200,
        Msg: "OK",
        Body: {
          ActivityTypes: [
            { ActivityTypeCode: "01", ActivityTypeName: "Marketing Promotion" },
            { ActivityTypeCode: "02", ActivityTypeName: "Email" },
            { ActivityTypeCode: "03", ActivityTypeName: "Meeting" },
            { ActivityTypeCode: "04", ActivityTypeName: "Phone Call" },
            { ActivityTypeCode: "05", ActivityTypeName: "Checking the target use of the loan" },
            { ActivityTypeCode: "06", ActivityTypeName: "Current monitoring (including collateral monitoring)" },
            { ActivityTypeCode: "07", ActivityTypeName: "Emergency monitoring" }
          ]
        }
      }
    };
  },

  // Mock for lead sources
  getLeadSources: () => {
    return {
      status: 200,
      data: {
        Id: 43921,
        Code: 200,
        Msg: "OK",
        Body: [
          { LeadSourceCode: "01", LeadSourceName: "Phone inquiry" },
          { LeadSourceCode: "02", LeadSourceName: "Website" },
          { LeadSourceCode: "03", LeadSourceName: "Referral" },
          { LeadSourceCode: "04", LeadSourceName: "Social Media" },
          { LeadSourceCode: "05", LeadSourceName: "Walk-in" },
          { LeadSourceCode: "06", LeadSourceName: "Branch Visit" }
        ]
      }
    };
  }
};

module.exports = crmMocks;