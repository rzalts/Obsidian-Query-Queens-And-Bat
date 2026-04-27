/**
 * OBSIDIAN — Database-Level Security Setup
 * Run with: node run_security.js
 *
 * This creates two MySQL roles:
 *   developer  → full access
 *   coordinator → read/insert/update only (no DELETE on collections, no ALTER/DROP)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
  });

  const DB = process.env.DB_NAME; // defaultdb

  const statements = [

    // ── 1) DEVELOPER ROLE ───────────────────────────────────────────────
    `DROP ROLE IF EXISTS 'developer'`,
    `CREATE ROLE 'developer'`,
    `GRANT ALL PRIVILEGES ON ${DB}.* TO 'developer'`,

    `DROP USER IF EXISTS 'devuser'@'%'`,
    `CREATE USER 'devuser'@'%' IDENTIFIED BY 'devpass'`,
    `GRANT 'developer' TO 'devuser'@'%'`,
    `SET DEFAULT ROLE 'developer' TO 'devuser'@'%'`,

    // ── 2) COORDINATOR ROLE ─────────────────────────────────────────────
    `DROP ROLE IF EXISTS 'coordinator'`,
    `CREATE ROLE 'coordinator'`,

    // A) Show scheduling
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.show_event TO 'coordinator'`,
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.show_order TO 'coordinator'`,

    // B) Fashion production
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.fashion_look TO 'coordinator'`,
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.fit_collection TO 'coordinator'`,
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.item TO 'coordinator'`,
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.look_item TO 'coordinator'`,

    // C) Models & workflow
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.model TO 'coordinator'`,
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.fitting TO 'coordinator'`,
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.alteration TO 'coordinator'`,
    `GRANT SELECT, INSERT, UPDATE ON ${DB}.fit_location TO 'coordinator'`,

    // D) Restricted — read only on coordinator table
    `GRANT SELECT ON ${DB}.show_coordinator TO 'coordinator'`,

    // ── 3) END USER ACCOUNT ─────────────────────────────────────────────
    `DROP USER IF EXISTS 'showuser'@'%'`,
    `CREATE USER 'showuser'@'%' IDENTIFIED BY 'showpass'`,
    `GRANT 'coordinator' TO 'showuser'@'%'`,
    `SET DEFAULT ROLE 'coordinator' TO 'showuser'@'%'`,

    // ── 4) REVOKE DANGEROUS PRIVILEGES ─────────────────────────────────
    `REVOKE INSERT, UPDATE ON ${DB}.show_coordinator FROM 'coordinator'`,

    `FLUSH PRIVILEGES`,
  ];

  for (const sql of statements) {
    const label = sql.substring(0, 65);
    try {
      await conn.query(sql);
      console.log('✓', label);
    } catch (err) {
      // "already exists" errors are harmless — log and continue
      console.warn('⚠', label);
      console.warn('  →', err.message);
    }
  }

  // Verify
  const [roles] = await conn.query(`SELECT User, Host FROM mysql.user WHERE User IN ('devuser','showuser','developer','coordinator')`);
  console.log('\nUsers/Roles created:');
  roles.forEach(r => console.log(' •', r.User, '@', r.Host));

  await conn.end();
  console.log('\nSecurity setup complete.');
}

run().catch(err => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
