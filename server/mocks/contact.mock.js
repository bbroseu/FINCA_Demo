const JSONStorage = require('../utils/jsonStorage');

// JSON file storage for registered users
const usersStorage = new JSONStorage('users.json');
const subscriptionsStorage = new JSONStorage('subscriptions.json');

const contactMocks = {
  // Mock for contact lookup
  getContact: (personalNumber) => {
    // Check if user was registered through mock
    if (usersStorage.has(personalNumber)) {
      const user = usersStorage.get(personalNumber);
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: [{
            ContactId: user.ContactId,
            ContactCode: user.ContactCode,
            FirstName: user.FirstName,
            LastName: user.LastName,
            PersonalNumber: user.PersonalNumber,
            BirthDate: user.BirthDate,
            Address: user.Address,
            Mobile: user.Mobile,
            ...(user.imagePaths && { imagePaths: user.imagePaths })
          }]
        }
      };
    }

    // Default hardcoded user for testing
    if (personalNumber === '12345678') {
      return {
        status: 200,
        data: {
          Id: 68283,
          Code: 200,
          Msg: "OK",
          Body: [{
            ContactId: 1228,
            ContactCode: "C-00000148",
            FirstName: "John",
            LastName: "Doe",
            PersonalNumber: "12345678",
            BirthDate: "14.03.1990",
            Address: "54/2 Drenas",
            Mobile: "0038343555333"
          }]
        }
      };
    } else {
      return {
        status: 402,
        data: {
          Id: 68283,
          Code: 402,
          Msg: "Contact not found"
        }
      };
    }
  },

  // Mock for contact registration
  createSubscription: (subscriptionData) => {
    if (subscriptionData) {
      // Check if personal number already exists
      if (usersStorage.has(subscriptionData.PersonalNumber) || subscriptionData.PersonalNumber === '12345678') {
        return {
          status: 409,
          data: {
            Id: 0,
            Code: 442,
            Msg: "Personal number already registered"
          }
        };
      }

      // Generate a unique contact code and ID
      const contactId = Math.floor(Math.random() * 10000) + 1000;
      const contactCode = `C-${String(contactId).padStart(8, '0')}`;

      // Store the user data for later retrieval
      const userData = {
        ContactId: contactId,
        ContactCode: contactCode,
        FirstName: subscriptionData.FirstName,
        LastName: subscriptionData.LastName,
        PersonalNumber: subscriptionData.PersonalNumber,
        BirthDate: subscriptionData.BirthDate,
        Address: subscriptionData.Address,
        Mobile: subscriptionData.Mobile,
        registrationDate: new Date().toISOString(),
        imagePaths: {}
      };

      usersStorage.set(subscriptionData.PersonalNumber, userData);

      // Store subscription data separately for tracking
      subscriptionsStorage.set(subscriptionData.SubscriptionId, {
        subscriptionId: subscriptionData.SubscriptionId,
        personalNumber: subscriptionData.PersonalNumber,
        status: 'Pending',
        contactCode: contactCode,
        createdAt: new Date().toISOString()
      });
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

  // Mock for subscription status checking
  checkSubscription: (() => {
    let callCount = 0;
    return (subscriptionId) => {
      callCount++;

      if (callCount === 1) {
        // First call returns pending
        return {
          status: 200,
          data: {
            Id: 0,
            Code: 201,
            Msg: "Pending",
            Body: {
              Status: "Pending"
            }
          }
        };
      } else {
        // Second and subsequent calls return approved
        return {
          status: 200,
          data: {
            Id: 0,
            Code: 200,
            Msg: "Approved",
            Body: {
              Status: "Approved",
              ContactCode: "C-00000149"
            }
          }
        };
      }
    };
  })(),

  // Mock for create contact
  createContact: (contactData) => {
    // Validate required fields
    if (!contactData || !contactData.FirstName || !contactData.LastName ||
        !contactData.PersonalNumber || !contactData.Mobile || !contactData.BirthDate) {
      return {
        status: 404,
        data: {
          Id: 0,
          Code: 404,
          Msg: "Null value"
        }
      };
    }

    // Check if contact already exists
    if (usersStorage.has(contactData.PersonalNumber) || contactData.PersonalNumber === '12345678') {
      return {
        status: 405,
        data: {
          Id: 0,
          Code: 405,
          Msg: "Existing Person"
        }
      };
    }

    // Validate birth date format (dd.mm.yyyy)
    const birthDateRegex = /^\d{2}\.\d{2}\.\d{4}$/;
    if (!birthDateRegex.test(contactData.BirthDate)) {
      return {
        status: 491,
        data: {
          Id: 0,
          Code: 491,
          Msg: "Invalid BirthDate format"
        }
      };
    }

    // Validate personal number (basic validation)
    if (contactData.PersonalNumber.length < 6) {
      return {
        status: 492,
        data: {
          Id: 0,
          Code: 492,
          Msg: "Invalid PersonalNumber"
        }
      };
    }

    // Validate mobile number format (numbers only)
    const mobileRegex = /^\d+$/;
    if (!mobileRegex.test(contactData.Mobile)) {
      return {
        status: 494,
        data: {
          Id: 0,
          Code: 494,
          Msg: "Invalid Mobile Number Format"
        }
      };
    }

    // Generate contact ID and code
    const contactId = Math.floor(Math.random() * 10000) + 1000;
    const contactCode = `C-${String(contactId).padStart(8, '0')}`;

    // Store the contact data
    const userData = {
      ContactId: contactId,
      ContactCode: contactCode,
      FirstName: contactData.FirstName,
      LastName: contactData.LastName,
      PersonalNumber: contactData.PersonalNumber,
      BirthDate: contactData.BirthDate,
      Address: contactData.Address || "",
      Mobile: contactData.Mobile,
      registrationDate: new Date().toISOString(),
      imagePaths: {}
    };

    usersStorage.set(contactData.PersonalNumber, userData);

    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK: Contact created successfully!"
      }
    };
  },

  // Mock for get all offices
  getAllOffices: () => {
    return {
      status: 200,
      data: {
        Id: 68283,
        Code: 200,
        Msg: "OK",
        Body: [
          {
            OfficeId: 1,
            OfficeName: "Main Branch Pristina",
            OfficeCode: "PR001",
            Place: {
              PlaceCode: 9,
              PlaceName: "Pristina Center"
            }
          },
          {
            OfficeId: 2,
            OfficeName: "Gjilan Branch",
            OfficeCode: "GJ001",
            Place: {
              PlaceCode: 10,
              PlaceName: "Gjilan Municipality"
            }
          },
          {
            OfficeId: 3,
            OfficeName: "Mitrovica Branch",
            OfficeCode: "MT001",
            Place: {
              PlaceCode: 11,
              PlaceName: "Mitrovica North"
            }
          },
          {
            OfficeId: 4,
            OfficeName: "Prizren Branch",
            OfficeCode: "PZ001",
            Place: {
              PlaceCode: 12,
              PlaceName: "Prizren Old Town"
            }
          }
        ]
      }
    };
  },

  // Mock for get all places
  getAllPlaces: () => {
    return {
      status: 200,
      data: {
        Id: 0,
        Code: 200,
        Msg: "OK",
        Body: [
          {
            PlaceCode: "0101001",
            PlaceName: "Pristina Center"
          },
          {
            PlaceCode: "0101002",
            PlaceName: "Pristina West"
          },
          {
            PlaceCode: "0102001",
            PlaceName: "Gjilan Municipality"
          },
          {
            PlaceCode: "0102002",
            PlaceName: "Gjilan Industrial Zone"
          },
          {
            PlaceCode: "0103001",
            PlaceName: "Mitrovica North"
          },
          {
            PlaceCode: "0103002",
            PlaceName: "Mitrovica South"
          },
          {
            PlaceCode: "0104001",
            PlaceName: "Prizren Old Town"
          },
          {
            PlaceCode: "0104002",
            PlaceName: "Prizren New District"
          },
          {
            PlaceCode: "0105001",
            PlaceName: "Peja Center"
          },
          {
            PlaceCode: "0105002",
            PlaceName: "Peja Rugova"
          }
        ]
      }
    };
  },

  // Utility function to link image paths to user by personal number
  linkImageToUser: (personalNumber, imageType, imagePath) => {
    if (usersStorage.has(personalNumber)) {
      const user = usersStorage.get(personalNumber);
      if (!user.imagePaths) {
        user.imagePaths = {};
      }
      user.imagePaths[imageType] = imagePath;
      user.lastUpdated = new Date().toISOString();
      usersStorage.set(personalNumber, user);
      return true;
    }
    return false;
  },

  // Utility function to get user with images
  getUserWithImages: (personalNumber) => {
    if (usersStorage.has(personalNumber)) {
      return usersStorage.get(personalNumber);
    }
    return null;
  }
};

module.exports = contactMocks;