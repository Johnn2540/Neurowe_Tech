import { chromium } from 'playwright';
const SCRATCHPAD = 'C:/Users/johns/AppData/Local/Temp/claude/c--Users-johns-OneDrive-Desktop-My-Projects-neurowex-postgres/5d2d405f-ce86-4614-9c35-1688cef772f2/scratchpad';

const b  = await chromium.launch({ headless: true });
const pg = await b.newPage();
await pg.setViewportSize({ width: 1400, height: 900 });

// 1. /learn page above the fold
await pg.goto('http://localhost:3000/learn', { waitUntil: 'networkidle', timeout: 25000 });
await pg.screenshot({ path: SCRATCHPAD + '/01-learn-hero.png' });
console.log('01 ✓');

// 2. Course cards
await pg.evaluate(() => document.getElementById('courses')?.scrollIntoView({ behavior:'instant' }));
await pg.waitForTimeout(500);
await pg.screenshot({ path: SCRATCHPAD + '/02-learn-cards.png' });
console.log('02 ✓');

// 3. Payment modal (STK tab)
await pg.evaluate(() => openPayModal(1, 'Full Stack Web Development', 4999));
await pg.waitForTimeout(500);
await pg.screenshot({ path: SCRATCHPAD + '/03-pay-modal-stk.png' });
console.log('03 ✓');

// 4. Payment modal (WhatsApp tab)
await pg.click('#tabWa');
await pg.waitForTimeout(400);
await pg.screenshot({ path: SCRATCHPAD + '/04-pay-modal-wa.png' });
console.log('04 ✓');

// 5. Login prompt modal
await pg.evaluate(() => closePayModal());
await pg.waitForTimeout(300);
await pg.evaluate(() => showLoginPrompt('Python for Beginners'));
await pg.waitForTimeout(400);
await pg.screenshot({ path: SCRATCHPAD + '/05-login-modal.png' });
console.log('05 ✓');

await b.close();
console.log('done');
