// Load environment variables from .env.production if it exists
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.production');
if (fs.existsSync(envPath)) {
  console.log('Loading environment variables from .env.production');
  require('dotenv').config({ path: envPath });
}

// Log which auth provider will be used
console.log('Auth Configuration:');
console.log('- COGNITO_CLIENT_ID:', process.env.COGNITO_CLIENT_ID ? 'Set' : 'Not set');
console.log('- COGNITO_CLIENT_SECRET:', process.env.COGNITO_CLIENT_SECRET ? 'Set (hidden)' : 'Not set');
console.log('- COGNITO_ISSUER:', process.env.COGNITO_ISSUER || 'Not set');
console.log('- NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'Set (hidden)' : 'Not set');
console.log('- NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'Not set');

// Start the Next.js standalone server
require('./server.js');