require('dotenv').config();

const buildApp = require('./app');

const app = buildApp();
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`FINCA Demo server running on port ${PORT}`);
});
