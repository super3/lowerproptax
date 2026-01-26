import { chromium } from 'playwright';

const FULTON_SEARCH_URL = 'https://qpublic.schneidercorp.com/Application.aspx?AppID=936&LayerID=18251&PageTypeID=2&PageID=8154';

async function scrapeProperty(address) {
  const browser = await chromium.launch({
    headless: false, // Set to true for production
    args: ['--disable-blink-features=AutomationControlled']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {

    await page.goto(FULTON_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    await page.waitForTimeout(2000);

    // Accept Terms and Conditions modal
    try {
      await page.waitForSelector('.modal', { timeout: 5000 });
      await page.click('.modal a.btn-primary[data-dismiss="modal"]', { timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch (e) {
      // Modal may not appear if already accepted
    }

    // Search by address
    await page.waitForSelector('#ctlBodyPane_ctl01_ctl01_txtAddress', { timeout: 10000 });
    await page.fill('#ctlBodyPane_ctl01_ctl01_txtAddress', address);
    await page.click('#ctlBodyPane_ctl01_ctl01_btnSearch');
    await page.waitForTimeout(3000);

    // Extract data from results page
    const text = await page.evaluate(() => document.body.innerText);

    const bedroomMatch = text.match(/Bedroom[s]?\s*[:\s]*(\d+)/i);
    const bathroomMatch = text.match(/Full\s*Bath[s]?\s*[:\s]*(\d+)/i) || text.match(/Bath[s]?\s*[:\s]*(\d+)/i);
    const sqftMatch = text.match(/Res\s*Sq\s*Ft\s*\n?\s*([\d,]+)/i) ||
                      text.match(/Heated\s*(?:Sq\s*Ft|Area)\s*[:\s]*([\d,]+)/i);

    const result = {
      address,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : null,
      bathrooms: bathroomMatch ? parseInt(bathroomMatch[1]) : null,
      sqft: sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : null
    };

    console.log(JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    console.error('Error:', error.message);
    return null;
  } finally {
    await browser.close();
  }
}

// Run if called directly
const address = process.argv[2] || '6607 ARIA BLVD';
scrapeProperty(address);

export { scrapeProperty };
