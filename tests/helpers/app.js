// Returns a fresh Express app instance bound to the test DB + aspekt mock.
// Call after the aspekt mock has been registered via jest.mock so the routes
// pull in the mocked module.
const buildApp = require('../../server/app');

module.exports = function makeApp() {
  return buildApp();
};
