import 'dotenv/config';
import * as readline from 'node:readline/promises';
import { chromium } from 'playwright';

const authStatePath = process.env['INDEED_AUTH_STATE_PATH'] ?? './indeed-auth.json';

async function main(): Promise<void> {
  // Launch browser with anti-detection measures to avoid Google/Indeed blocking
  const browser = await chromium.launch({
    headless: false,
    args: [
      // Disable Chromium automation detection
      '--disable-blink-features=AutomationControlled',
      '--disable-web-resources',
      '--disable-sync',
      '--disable-default-apps',
    ],
  });

  const context = await browser.newContext({
    // Use a realistic user agent
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Disable WebDriver detection
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const page = await context.newPage();

  // Inject script to hide automation detection markers
  await page.addInitScript(() => {
    (window as any).chrome = {
      runtime: {},
    };
  });

  // Navigate to Indeed homepage (not auth page - let it redirect naturally)
  await page.goto('https://www.indeed.com', { waitUntil: 'domcontentloaded' });

  console.log('\n✓ A visible browser window has opened.');
  console.log('✓ You can now log in to your Indeed account using your real credentials.\n');
  console.log('Steps:');
  console.log('  1. Click "Sign in" on the Indeed website');
  console.log('  2. Enter your email and password');
  console.log('  3. Complete any 2FA if prompted');
  console.log('  4. Once you are logged in and see the Indeed dashboard,');
  console.log('     come back to this terminal and press Enter.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await rl.question('Press Enter once you are logged in and on the Indeed dashboard... ');
  rl.close();

  console.log('\nWaiting for cookies to settle...');
  // Wait a bit to ensure all cookies are properly set
  await page.waitForTimeout(2000);

  // Save the authenticated session (cookies and local storage)
  await context.storageState({ path: authStatePath });
  await browser.close();

  console.log(`\n✓ Successfully saved your logged-in session to "${authStatePath}".`);
  console.log('✓ This file contains session cookies — keep it private and never commit it.');
  console.log('\nYou can now run: npm run apply -- --url "<job-url>" --title "<job-title>" --desc "<job-description>"\n');
}

main().catch((err) => {
  console.error('✗ Failed to save session:', err);
  process.exit(1);
});
