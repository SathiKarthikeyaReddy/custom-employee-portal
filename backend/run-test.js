const EmbeddedPostgres = require('embedded-postgres').default;
const { Client } = require('pg');
const runEndToEndVerification = require('./test-e2e');

async function main() {
  console.log('Starting local PostgreSQL server...');
  const pg = new EmbeddedPostgres({
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (e) {
    // If already initialized, ignore
  }

  try {
    await pg.start();
    console.log('PostgreSQL 18.4 is live on localhost:5432!\n');

    // Create database 'employee_portal' if not exists
    const rootClient = new Client({
      connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
    });
    await rootClient.connect();
    const checkDb = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'employee_portal'");
    if (checkDb.rows.length === 0) {
      console.log("Creating database 'employee_portal'...");
      await rootClient.query('CREATE DATABASE employee_portal');
      console.log("Database 'employee_portal' created.\n");
    }
    await rootClient.end();

    // Run full End-to-End Verification
    await runEndToEndVerification();

  } catch (err) {
    console.error('Execution error:', err);
    process.exitCode = 1;
  } finally {
    console.log('Closing database connection pool...');
    try {
      const { pool } = require('./src/config/db');
      await pool.end();
    } catch (e) {}
    console.log('Shutting down local PostgreSQL...');
    await pg.stop();
    console.log('PostgreSQL shutdown complete.');
  }
}

main();
