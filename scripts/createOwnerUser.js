// createOwnerUser.js
// Usage: node scripts/createOwnerUser.js <phone> <password> [name]
// This will insert a new OWNER user (role='OWNER', status='ACTIVE') into the MySQL database.
// It reads connection info from backend/.env (already present in the project).

require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node scripts/createOwnerUser.js <phone> <password> [name]');
  process.exit(1);
}
const [phone, plainPassword, name = 'OwnerUser'] = args;

(async () => {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT || '3306', 10),
    });

    // Check if phone already exists
    const [existing] = await connection.execute('SELECT id FROM users WHERE phone = ?', [phone]);
    if (existing.length > 0) {
      console.error(`❌ A user with phone ${phone} already exists (id=${existing[0].id}).`);
      await connection.end();
      process.exit(1);
    }

    const hashed = await bcrypt.hash(plainPassword, 10);
    const insertSql = `INSERT INTO users (name, phone, password, role, status, created_at, updated_at)
                      VALUES (?, ?, ?, 'OWNER', 'ACTIVE', NOW(), NOW())`;
    const [res] = await connection.execute(insertSql, [name, phone, hashed]);
    console.log('✅ Owner user created');
    console.log(`   id   : ${res.insertId}`);
    console.log(`   name : ${name}`);
    console.log(`   phone: ${phone}`);
    console.log('   password: (bcrypt hash stored)');
    await connection.end();
  } catch (e) {
    console.error('❌ Error:', e.message);
    process.exit(1);
  }
})();
