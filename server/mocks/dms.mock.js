// DMS (Document Management System) Mock Data following Aspekt API structure
const dmsMocks = {
  // Mock for document creation
  createDocument: (source, sourceKey, documentDefinitionCode, description, file) => {
    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK: Document created successfully!",
        Body: {
          DocumentFileId: Math.floor(Math.random() * 10000) + 1000
        }
      }
    };
  },

  // Mock for getting document data
  getDocumentData: (documentId) => {
    const documents = {
      15: {
        DocumentName: "Contact Picture.jpg",
        Description: "Profile picture for customer onboarding",
        CreatedAt: "2024-07-11 13:24:53.1800000"
      },
      16: {
        DocumentName: "Identity Card.pdf",
        Description: "Government issued identification document",
        CreatedAt: "2024-07-11 14:15:22.3200000"
      },
      17: {
        DocumentName: "Utility Bill.pdf",
        Description: "Proof of residence document",
        CreatedAt: "2024-07-12 09:30:15.7500000"
      }
    };

    const docInfo = documents[documentId] || {
      DocumentName: "Sample Document.pdf",
      Description: "Sample document description",
      CreatedAt: new Date().toISOString().replace('T', ' ').substring(0, 23) + "0000"
    };

    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK",
        Body: {
          DocumentId: parseInt(documentId),
          ...docInfo,
          File: {
            Name: docInfo.DocumentName,
            Base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==" // 1x1 transparent pixel
          }
        }
      }
    };
  },

  // Mock for getting document definitions
  getDocumentDefinitions: () => {
    return {
      status: 200,
      data: {
        Id: 68283,
        Code: 200,
        Msg: "OK",
        Body: [
          {
            DocumentDefinitionId: 1,
            DocumentDefinitionCode: "ContactPicture",
            DocumentDefinitionName: "Contact Picture",
            DocumentDefinitionGroup: {
              DocumentDefinitionGroupId: 9,
              DocumentDefinitionGroupCode: "PersonDetail",
              DocumentDefinitionGroupName: "PersonDetail"
            }
          },
          {
            DocumentDefinitionId: 2,
            DocumentDefinitionCode: "IdentityCard",
            DocumentDefinitionName: "Identity Card",
            DocumentDefinitionGroup: {
              DocumentDefinitionGroupId: 9,
              DocumentDefinitionGroupCode: "PersonDetail",
              DocumentDefinitionGroupName: "PersonDetail"
            }
          },
          {
            DocumentDefinitionId: 3,
            DocumentDefinitionCode: "UtilityBill",
            DocumentDefinitionName: "Utility Bill",
            DocumentDefinitionGroup: {
              DocumentDefinitionGroupId: 10,
              DocumentDefinitionGroupCode: "ProofOfAddress",
              DocumentDefinitionGroupName: "Proof of Address"
            }
          },
          {
            DocumentDefinitionId: 4,
            DocumentDefinitionCode: "Passport",
            DocumentDefinitionName: "Passport",
            DocumentDefinitionGroup: {
              DocumentDefinitionGroupId: 9,
              DocumentDefinitionGroupCode: "PersonDetail",
              DocumentDefinitionGroupName: "PersonDetail"
            }
          },
          {
            DocumentDefinitionId: 5,
            DocumentDefinitionCode: "BankStatement",
            DocumentDefinitionName: "Bank Statement",
            DocumentDefinitionGroup: {
              DocumentDefinitionGroupId: 11,
              DocumentDefinitionGroupCode: "FinancialInfo",
              DocumentDefinitionGroupName: "Financial Information"
            }
          }
        ]
      }
    };
  },

  // Mock for getting documents by source
  getDocuments: (source, sourceKey) => {
    // Generate some sample documents based on the source
    const documents = [
      {
        DocumentId: 15,
        DocumentName: "Contact Picture.jpg",
        Description: "Profile picture",
        CreatedAt: "2024-07-11 13:24:53.1800000"
      },
      {
        DocumentId: 16,
        DocumentName: "Identity Card.pdf",
        Description: "Identity document",
        CreatedAt: "2024-07-11 14:15:22.3200000"
      }
    ];

    // Add different documents based on source type
    if (source === "Person") {
      documents.push({
        DocumentId: 17,
        DocumentName: "Utility Bill.pdf",
        Description: "Proof of residence",
        CreatedAt: "2024-07-12 09:30:15.7500000"
      });
    } else if (source === "Loan") {
      documents.push({
        DocumentId: 18,
        DocumentName: "Loan Agreement.pdf",
        Description: "Signed loan agreement",
        CreatedAt: "2024-07-13 16:45:30.2100000"
      });
    }

    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK",
        Body: documents
      }
    };
  }
};

module.exports = dmsMocks;