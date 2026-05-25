// Jest shim — uuid v13 is ESM-only and breaks CommonJS test loading.
// Production code uses crypto.randomUUID under the hood anyway.
const { randomUUID } = require('crypto');
module.exports = {
  v4: () => randomUUID(),
};
