// vendorLoginTest.js
// Simple script to test the vendor login endpoint.
// Run with: node scripts/vendorLoginTest.js

require('dotenv').config({ path: '../.env' });
const fetch = require('node-fetch');

const phone = '0241111111';
const password = 'Vendor@123';

(async () => {
  try {
    const response = await fetch(`${process.env.API_URL || 'http://localhost:5000/api'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ phone, password }),
    });
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
})();
