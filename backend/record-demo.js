const puppeteer = require('puppeteer-core');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const EmbeddedPostgres = require('embedded-postgres').default;
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const FFMPEG_PATH = path.resolve(__dirname, 'node_modules/ffmpeg-static/ffmpeg.exe');
const OUTPUT_VIDEO = path.resolve('C:/Users/sathi/.gemini/antigravity/brain/c7095754-5610-48bc-b8a2-707b9bdff03e/demo_walkthrough.mp4');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runRecording() {
  console.log('================================================================');
  console.log('   STARTING FULL SCREEN RECORDING OF EMPLOYEE PORTAL (2.5 MIN)');
  console.log('================================================================\n');

  // Step 1: Start Postgres
  console.log('1. Starting Embedded PostgreSQL server...');
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
  console.log('✓ PostgreSQL live on port 5432.');

  const rootClient = new Client({
    connectionString: 'postgresql://postgres:postgres@localhost:5432/postgres',
  });
  await rootClient.connect();
  const dbRes = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'employee_portal'");
  if (dbRes.rows.length === 0) {
    await rootClient.query('CREATE DATABASE employee_portal');
  }
  await rootClient.end();

  const initDb = require('./src/config/initDb');
  const seed = require('./src/config/seed');
  await initDb();
  await seed();

  // Ensure test personas: HR, Sales, Support
  const userModel = require('./src/models/userModel');
  const roleModel = require('./src/models/roleModel');
  const allRoles = await roleModel.listAllWithPermissions();
  const roleMap = {};
  allRoles.forEach(r => { roleMap[r.name.toLowerCase()] = r.id; });

  const defaultPw = await bcrypt.hash('TestPassword123!', 12);
  const personas = [
    { name: 'Helen HR', email: 'hr@brainwave.io', role: 'hr' },
    { name: 'Sam Sales', email: 'sales@brainwave.io', role: 'sales' },
    { name: 'Stan Support', email: 'support@brainwave.io', role: 'support' },
  ];

  for (const p of personas) {
    let u = await userModel.findByEmail(p.email);
    if (!u) {
      await userModel.createUser({
        name: p.name,
        email: p.email,
        passwordHash: defaultPw,
        roleIds: [roleMap[p.role]],
      });
    }
  }

  // Step 2: Start Express Backend
  process.env.DISABLE_RATE_LIMIT = 'true';
  const { app } = require('./server');
  const server = app.listen(4000);
  console.log('✓ Express server running on port 4000.');

  // Step 3: Launch Puppeteer with Chrome
  console.log('2. Launching browser for screencast capture...');
  const width = 1280;
  const height = 800;

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    defaultViewport: { width, height },
    args: [
      `--window-size=${width},${height}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    window.open = (url) => { console.log('Simulated window.open:', url); };
  });

  async function signOut() {
    await page.evaluate(() => {
      localStorage.clear();
      window.location.href = '/login';
    });
    await sleep(1500);
  }

  // Helper for natural mouse cursor animation and typing
  async function visualClick(selector) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });
      const el = await page.$(selector);
      const box = await el.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
        await sleep(150);
      }
      await el.click();
    } catch (e) {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (el) el.click();
      }, selector);
    }
    await sleep(250);
  }

  async function visualType(selector, text, delay = 50) {
    await visualClick(selector);
    await page.type(selector, text, { delay });
    await sleep(200);
  }

  // Step 4: Setup FFmpeg Screencast Pipeline
  console.log('3. Spawning FFmpeg video encoder...');
  console.log('   Output file:', OUTPUT_VIDEO);

  const ffmpeg = spawn(FFMPEG_PATH, [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-r', '25',
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-preset', 'fast',
    '-crf', '22',
    '-movflags', '+faststart',
    OUTPUT_VIDEO,
  ]);

  ffmpeg.stderr.on('data', (data) => {
    // Suppress verbose frame logs unless error
    const str = data.toString();
    if (str.includes('Error') || str.includes('fatal')) {
      console.error('[FFmpeg Error]', str);
    }
  });

  const client = await page.target().createCDPSession();
  await client.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 85,
    everyNthFrame: 1,
  });

  client.on('Page.screencastFrame', async ({ data, sessionId }) => {
    try {
      if (ffmpeg.stdin.writable) {
        ffmpeg.stdin.write(Buffer.from(data, 'base64'));
      }
      await client.send('Page.screencastFrameAck', { sessionId });
    } catch (e) {}
  });

  console.log('✓ Recording in progress...\n');

  try {
    // -------------------------------------------------------------
    // SCENE 1: AUTHENTICATION & FORM VALIDATION (0:00 - 0:25)
    // -------------------------------------------------------------
    console.log('--- SCENE 1: Login Form & Deliberate Animation ---');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0' });
    await sleep(2000);

    // Empty validation
    await visualClick('button[type="submit"]');
    await sleep(2000);

    // Invalid credentials inline error
    await visualType('input[type="email"]', 'admin@brainwave.io');
    await visualType('input[type="password"]', 'WrongPassword!');
    await visualClick('button[type="submit"]');
    await sleep(2500);

    // Valid admin credentials & checkmark draw-in animation
    await page.click('input[type="password"]', { clickCount: 3 });
    await page.keyboard.press('Backspace');
    await visualType('input[type="password"]', 'ChangeMe123!');
    await visualClick('button[type="submit"]');

    // Wait for checkmark and dashboard navigation
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    await sleep(2500);

    // -------------------------------------------------------------
    // SCENE 2: ADMIN DIRECTORY & 3-STATE APP TILES (0:25 - 0:55)
    // -------------------------------------------------------------
    console.log('--- SCENE 2: Admin Directory & Three-State Visual Verification ---');
    await page.waitForSelector('.border.px-5.py-4', { timeout: 10000 });
    await sleep(2000);

    // Hover over provisioned Zoho People tile
    const tiles = await page.$$('.border.px-5.py-4');
    if (tiles[0]) {
      const box = await tiles[0].boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await sleep(1500);
    }

    // Hover over Zoho Desk (Pending Setup in Amber)
    if (tiles[2]) {
      const box = await tiles[2].boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
      await sleep(2500);
    }

    // Click Launch App on Zoho CRM
    await page.evaluate(() => {
      const launchBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Launch App'));
      if (launchBtns[1]) launchBtns[1].click();
    });
    await sleep(2000);

    // -------------------------------------------------------------
    // SCENE 3: PERSONA SWITCHING (HR, SALES, SUPPORT) (0:55 - 1:40)
    // -------------------------------------------------------------
    console.log('--- SCENE 3: Persona Switching & RBAC Boundaries ---');

    // Sign Out Admin
    await signOut();

    // Login Helen HR
    await visualType('input[type="email"]', 'hr@brainwave.io');
    await visualType('input[type="password"]', 'TestPassword123!');
    await visualClick('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    await sleep(2500);

    // Test direct navigation to /admin/users -> Inline Access Denied
    await page.goto('http://localhost:5173/admin/users', { waitUntil: 'networkidle0' });
    await sleep(3500);

    // Return to dashboard
    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle0' });
    await sleep(2000);

    // Sign Out HR
    await signOut();

    // Login Stan Support (Desk Pending Setup state)
    await visualType('input[type="email"]', 'support@brainwave.io');
    await visualType('input[type="password"]', 'TestPassword123!');
    await visualClick('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    await sleep(3500);

    // Hover on Desk tile in Amber
    const supportTiles = await page.$$('.border.px-5.py-4');
    if (supportTiles[2]) {
      const box = await supportTiles[2].boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
      await sleep(2500);
    }

    // -------------------------------------------------------------
    // SCENE 4: ADMIN USERS CRUD OPERATIONS (1:40 - 2:10)
    // -------------------------------------------------------------
    console.log('--- SCENE 4: Admin Users CRUD Suite ---');
    await signOut();
    await sleep(1000);

    // Login Admin
    await visualType('input[type="email"]', 'admin@brainwave.io');
    await visualType('input[type="password"]', 'ChangeMe123!');
    await visualClick('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/dashboard', { timeout: 10000 });
    await sleep(1000);

    // Navigate to Staff Users
    await visualClick('a[href="/admin/users"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await sleep(2000);

    // 4a. Add New User
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('add new user'));
      if (btn) btn.click();
    });
    await page.waitForSelector('input[placeholder="e.g. John Doe"]', { timeout: 10000 });
    await sleep(1000);
    await visualType('input[placeholder="e.g. John Doe"]', 'Fiona Finance', 40);
    await visualType('input[placeholder="user@brainwave.io"]', 'finance@brainwave.io', 40);
    await visualType('input[placeholder="Minimum 8 characters"]', 'FinancePass123!', 40);
    // Check Finance role
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const fl = labels.find(l => l.textContent.toLowerCase().includes('finance'));
      if (fl) {
        const cb = fl.querySelector('input[type="checkbox"]');
        if (cb && !cb.checked) cb.click();
      }
    });
    await sleep(800);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('create user'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // 4b. Edit User
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const fr = rows.find(r => r.textContent.toLowerCase().includes('finance@brainwave.io'));
      if (fr) {
        const editBtn = fr.querySelector('button[title="Edit User"]');
        if (editBtn) editBtn.click();
      }
    });
    await page.waitForSelector('input[value="Fiona Finance"]', { timeout: 10000 });
    await page.click('input[value="Fiona Finance"]', { clickCount: 3 });
    await page.type('input[value="Fiona Finance"]', 'Fiona Senior Finance', { delay: 40 });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('save changes'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // 4c. Reset Password
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const fr = rows.find(r => r.textContent.toLowerCase().includes('finance@brainwave.io'));
      if (fr) {
        const keyBtn = fr.querySelector('button[title="Reset Password"]');
        if (keyBtn) keyBtn.click();
      }
    });
    await page.waitForSelector('input[placeholder="Minimum 8 characters"]', { timeout: 10000 });
    await visualType('input[placeholder="Minimum 8 characters"]', 'NewFinancePass123!', 40);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('update password'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // 4d. Delete User with ConfirmDialog
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const fr = rows.find(r => r.textContent.toLowerCase().includes('finance@brainwave.io'));
      if (fr) {
        const delBtn = fr.querySelector('button[title="Delete User"]');
        if (delBtn) delBtn.click();
      }
    });
    await page.waitForSelector('.bg-red-700', { timeout: 10000 });
    await sleep(1000);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('delete user') && b.classList.contains('bg-red-700'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // -------------------------------------------------------------
    // SCENE 5: ADMIN ROLES MATRIX & CORE LOCKS (2:10 - 2:30)
    // -------------------------------------------------------------
    console.log('--- SCENE 5: Admin Roles Matrix & Core Role Protection ---');
    await visualClick('a[href="/admin/roles"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await sleep(2000);

    // Create custom role "Auditor"
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('create custom role'));
      if (btn) btn.click();
    });
    await page.waitForSelector('input[placeholder="e.g. Operations"]', { timeout: 10000 });
    await visualType('input[placeholder="e.g. Operations"]', 'Auditor', 40);
    await visualType('textarea', 'Security compliance auditor', 30);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('create role'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // Edit permissions on Auditor
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const ar = rows.find(r => r.textContent.toLowerCase().includes('auditor'));
      if (ar) {
        const permBtn = ar.querySelector('button[title="Edit Permissions"]');
        if (permBtn) permBtn.click();
      }
    });
    await sleep(1000);
    await page.evaluate(() => {
      const labels = Array.from(document.querySelectorAll('label'));
      const auditLabel = labels.find(l => l.textContent.toLowerCase().includes('admin.audit.view'));
      if (auditLabel) {
        const cb = auditLabel.querySelector('input[type="checkbox"]');
        if (cb && !cb.checked) cb.click();
      }
    });
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('save permissions'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // Delete custom role Auditor
    await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      const ar = rows.find(r => r.textContent.toLowerCase().includes('auditor'));
      if (ar) {
        const delBtn = ar.querySelector('button[title="Delete Custom Role"]');
        if (delBtn) delBtn.click();
      }
    });
    await sleep(1000);
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.toLowerCase().includes('delete role') && b.classList.contains('bg-red-700'));
      if (btn) btn.click();
    });
    await sleep(2000);

    // -------------------------------------------------------------
    // SCENE 6: SYSTEM AUDIT TRAIL (2:30 - 2:45)
    // -------------------------------------------------------------
    console.log('--- SCENE 6: System Audit Trail with Timestamps & Client IPs ---');
    await visualClick('a[href="/admin/audit"]');
    await page.waitForSelector('table', { timeout: 10000 });
    await sleep(3500);

    // Scroll down audit table smoothly
    await page.evaluate(() => window.scrollBy({ top: 300, behavior: 'smooth' }));
    await sleep(2000);
    await page.evaluate(() => window.scrollBy({ top: -300, behavior: 'smooth' }));
    await sleep(1500);

    // -------------------------------------------------------------
    // SCENE 7: SESSION EXPIRATION NOTICE & LOGOUT (2:45 - 2:55)
    // -------------------------------------------------------------
    console.log('--- SCENE 7: Session Expiration & Sign Out ---');
    await page.goto('http://localhost:5173/login?reason=session_expired', { waitUntil: 'networkidle0' });
    await sleep(3500);

    console.log('\n✓ Screen recording script finished successfully!');

  } catch (err) {
    console.error('Error during recording execution:', err);
  } finally {
    try {
      await client.send('Page.stopScreencast');
    } catch (e) {}

    await sleep(1000);
    ffmpeg.stdin.end();

    await new Promise((resolve) => ffmpeg.on('close', resolve));
    console.log('✓ FFmpeg finished encoding video file.');

    await browser.close();
    server.close();
    try {
      const { pool } = require('./src/config/db');
      await pool.end();
    } catch (e) {}
    await pg.stop();
  }

  const stat = fs.statSync(OUTPUT_VIDEO);
  console.log(`\n================================================================`);
  console.log(`   RECORDING COMPLETE: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`   SAVED TO: ${OUTPUT_VIDEO}`);
  console.log(`================================================================\n`);
}

runRecording();
