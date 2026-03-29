const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.test') });
process.env.ROUTES_FILE = 'routes.test.json';
