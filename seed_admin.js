/**
 * OBSIDIAN — Seed default admin/developer account
 * Run with: node seed_admin.js
 *
 * Creates a default developer login:
 *   Email:    admin@obsidian.com
 *   Password: obsidian2024
 *   Role:     developer
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const email    = 'admin@obsidian.com';
  const password = 'obsidian2024';
  const role     = 'developer';

  // Check if already exists
  const [existing] = await conn.query(
    'SELECT user_id FROM show_coordinator WHERE email = ?', [email]
  );

  if (existing.length) {
    console.log('Admin account already exists — updating password.');
    const hashed = await bcrypt.hash(password, 10);
    await conn.query(
      'UPDATE show_coordinator SET reg_password = ?, reg_role = ? WHERE email = ?',
      [hashed, role, email]
    );
  } else {
    const hashed = await bcrypt.hash(password, 10);
    await conn.query(
      `INSERT INTO show_coordinator (first_name, last_name, email, phone_number, reg_password, reg_role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Admin', 'OBSIDIAN', email, '000-000-0000', hashed, role]
    );
    console.log('Admin account created.');
  }

  console.log('\n--- Default Developer Login ---');
  console.log('Email:   ', email);
  console.log('Password:', password);
  console.log('Role:    ', role);
  console.log('------------------------------\n');

  await conn.end();
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
