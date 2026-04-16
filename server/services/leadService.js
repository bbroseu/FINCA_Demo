const { v4: uuidv4 } = require('uuid');
const aspektClient = require('../middleware/aspektClient');
const leadMocks = require('../mocks/lead.mock');

const useMockAPI = process.env.USE_MOCK_API === 'true';

class LeadService {

  /**
   * Utility method to find mobile app lead source code
   * @returns {Promise<string|null>} - Lead source code for mobile app or null if not found
   */
  async getMobileAppLeadSourceCode() {
    try {
      const requestId = uuidv4();
      let response;

      if (useMockAPI) {
        response = leadMocks.getAllLeadSources();
      } else {
        response = await aspektClient.get(`/api/getAllLeadSources/${requestId}`, {
          data: {}
        });
      }

      if (response.status === 200 && response.data.Body) {
        const leadSources = response.data.Body;
        const mobileKeywords = ['mobile app', 'mobile application', 'mobile', 'app'];

        const mobileSource = leadSources.find(source => {
          const sourceName = source.LeadSourceName.toLowerCase();
          return mobileKeywords.some(keyword => sourceName.includes(keyword));
        });

        return mobileSource ? mobileSource.LeadSourceCode : null;
      }

      return null;
    } catch (error) {
      console.error('Error finding mobile app lead source:', error);
      return null;
    }
  }

  /**
   * Validate lead creation data
   * @param {Object} leadData - Lead data to validate
   * @returns {Object} - Validation result with success flag and errors
   */
  validateLeadData(leadData) {
    const errors = [];

    if (!leadData.Name || leadData.Name.trim() === '') {
      errors.push('Name is required');
    }

    if (!leadData.Mobile || leadData.Mobile.trim() === '') {
      errors.push('Mobile number is required');
    }

    if (!leadData.Email || leadData.Email.trim() === '') {
      errors.push('Email is required');
    }

    if (!leadData.PlaceCode || leadData.PlaceCode.trim() === '') {
      errors.push('Place/Branch code is required');
    }

    if (!leadData.LeadSourceCode || leadData.LeadSourceCode.trim() === '') {
      errors.push('Lead source code is required');
    }

    if (!leadData.LoanAmount || leadData.LoanAmount <= 0) {
      errors.push('Valid loan amount is required');
    }

    if (!leadData.InterestedInProducts || leadData.InterestedInProducts.length === 0) {
      errors.push('At least one product must be selected');
    }

    if (leadData.Email && !/\S+@\S+\.\S+/.test(leadData.Email)) {
      errors.push('Invalid email format');
    }

    if (leadData.Mobile && !/^\+?[\d\s\-\(\)]{7,15}$/.test(leadData.Mobile)) {
      errors.push('Invalid mobile number format');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = new LeadService();