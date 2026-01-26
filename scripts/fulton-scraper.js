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

    // Handle "Full Bath/Half Bath 3/1" format
    const bathMatch = text.match(/Full\s*Bath\/Half\s*Bath\s*\n?\s*(\d+)\/(\d+)/i);
    let bathrooms = null;
    if (bathMatch) {
      const fullBaths = parseInt(bathMatch[1]);
      const halfBaths = parseInt(bathMatch[2]);
      bathrooms = fullBaths + (halfBaths * 0.5);
    } else {
      const simpleBathMatch = text.match(/Full\s*Bath[s]?\s*[:\s]*(\d+)/i) || text.match(/Bath[s]?\s*[:\s]*(\d+)/i);
      if (simpleBathMatch) bathrooms = parseInt(simpleBathMatch[1]);
    }

    const sqftMatch = text.match(/Res\s*Sq\s*Ft\s*\n?\s*([\d,]+)/i) ||
                      text.match(/Heated\s*(?:Sq\s*Ft|Area)\s*[:\s]*([\d,]+)/i);

    // Click on Assessment Notices link to get PDF URL
    let assessmentPdfUrl = null;
    try {
      const assessmentLink = await page.$('a:has-text("Assessment Notices")');
      if (assessmentLink) {
        await assessmentLink.click();
        await page.waitForTimeout(3000);

        // Click on "Assessment Notices" header to expand it
        const expandButton = await page.$('text=Assessment Notices');
        if (expandButton) {
          await expandButton.click();
          await page.waitForTimeout(2000);
        }

        // Find the PDF button and extract URL from onclick attribute
        assessmentPdfUrl = await page.evaluate(() => {
          const btn = document.querySelector('input[value*="Assessment Notice"][value*="PDF"]');
          if (btn) {
            const onclick = btn.getAttribute('onclick');
            const match = onclick.match(/window\.open\('([^']+)'/);
            if (match) {
              // Encode spaces in the URL
              return match[1].replace(/ /g, '%20');
            }
          }
          return null;
        });
      }
    } catch (e) {
      // Assessment notices page may not be available
    }

    const result = {
      address,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : null,
      bathrooms,
      sqft: sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : null,
      assessmentPdf: assessmentPdfUrl
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
