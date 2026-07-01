const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.info('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.info('BROWSER ERROR:', err));
  
  await page.goto('https://kucet-new.onrender.com/');
  
  console.info("Page loaded");
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
