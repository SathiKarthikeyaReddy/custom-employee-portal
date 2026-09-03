const EmbeddedPostgres = require('embedded-postgres').default;
const { Client } = require('pg');

async function startDb() {
  console.log('Starting EmbeddedPostgres on port 5432...');
  const pg = new EmbeddedPostgres({
    port: 5432,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch (e) {}

  await pg.start();
  console.log('EmbeddedPostgres started on port 5432.');

  // Ensure employee_portal DB exists
  const rootClient = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await rootClient.connect();
  const res = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'employee_portal'");
  if (res.rows.length === 0) {
    await rootClient.query('CREATE DATABASE employee_portal');
    console.log("Database 'employee_portal' created.");
  }
  await rootClient.end();
  console.log('Ready for connections.');

  // Keep process alive
  process.on('SIGTERM', async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  });
  process.on('SIGINT', async () => {
    console.log('Stopping PostgreSQL...');
    await pg.stop();
    process.exit(0);
  });
}

startDb().catch(err => {
  console.error('Failed to start DB:', err);
  process.exit(1);
});
