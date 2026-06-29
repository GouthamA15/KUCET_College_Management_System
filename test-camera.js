const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  
  await page.goto('https://kucet-new.onrender.com/');
  
  console.log("Page loaded");
  await new Promise(r => setTimeout(r, 2000));
  await browser.close();
})();
