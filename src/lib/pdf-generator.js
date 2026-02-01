import puppeteer from 'puppeteer';

export async function htmlToPdfBuffer(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm',
      },
    });

    return buffer;
  } finally {
    try {
      if (browser) await browser.close();
    } catch (e) {
      // swallow close errors
      console.error('Error closing browser:', e);
    }
  }
}
