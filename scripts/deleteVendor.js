// deleteVendor.js
// Deletes the vendor user (phone 0241111111) and related rows.
// Run with: node scripts/deleteVendor.js

require('dotenv').config({ path: '../.env' });
const mysql = require('mysql2/promise');

const VENDOR_PHONE = '0241111111'; // adjust if needed

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT,
    });

    // Find vendor user id
    const [userRows] = await conn.execute('SELECT id FROM users WHERE phone = ? AND role = "VENDOR"', [VENDOR_PHONE]);
    if (userRows.length === 0) {
      console.log('✅ No vendor with that phone found – nothing to delete.');
    } else {
      const vendorId = userRows[0].id;
      // Delete related rows first (foreign key constraints)
      await conn.execute('DELETE FROM vendor_balances WHERE vendor_id = ?', [vendorId]);
      await conn.execute('DELETE FROM vendors WHERE user_id = ?', [vendorId]);
      // Delete the user row
      await conn.execute('DELETE FROM users WHERE id = ?', [vendorId]);
      console.log(`✅ Vendor (id=${vendorId}, phone=${VENDOR_PHONE}) and related data removed.`);
    }
    await conn.end();
  } catch (err) {
    console.error('❌ Error during deletion:', err.message);
    process.exit(1);
  }
})();
