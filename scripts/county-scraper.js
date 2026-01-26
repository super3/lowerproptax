import { chromium } from 'playwright';

const COUNTY_CONFIG = {
  fulton: {
    url: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=936&LayerID=18251&PageTypeID=2&PageID=8154',
    addressInput: '#ctlBodyPane_ctl01_ctl01_txtAddress',
    searchButton: '#ctlBodyPane_ctl01_ctl01_btnSearch'
  },
  gwinnett: {
    url: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1282&LayerID=43872&PageTypeID=2&PageID=16058',
    addressInput: '#ctlBodyPane_ctl02_ctl01_txtAddress',
    searchButton: '#ctlBodyPane_ctl02_ctl01_btnSearch'
  },
  cobb: {
    url: 'https://qpublic.schneidercorp.com/Application.aspx?AppID=1051&LayerID=23951&PageTypeID=2&PageID=9967',
    addressInput: '#ctlBodyPane_ctl01_ctl01_txtAddress',
    searchButton: '#ctlBodyPane_ctl01_ctl01_btnSearch'
  }
};

async function scrapeProperty(address, county = 'fulton') {
  const config = COUNTY_CONFIG[county.toLowerCase()];
  if (!config) {
    throw new Error(`Unknown county: ${county}. Supported: ${Object.keys(COUNTY_CONFIG).join(', ')}`);
  }

  const browser = await chromium.launch({
    headless: false,
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
    await page.goto(config.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

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
    await page.waitForSelector(config.addressInput, { timeout: 10000 });
    await page.fill(config.addressInput, address);
    await page.click(config.searchButton);
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
                      text.match(/GrossSqft\s*\n?\s*([\d,]+)/i) ||
                      text.match(/Heated\s*(?:Sq\s*Ft|Area)\s*[:\s]*([\d,]+)/i);

    // Check for homestead exemption
    const homesteadMatch = text.match(/Homestead\s*Exemption\s*\n?\s*(Yes|No)/i) ||
                           text.match(/Homestead\s*\n?\s*(Y|N)\b/i);
    let homesteadExemption = null;
    if (homesteadMatch) {
      const value = homesteadMatch[1].toLowerCase();
      homesteadExemption = value === 'yes' || value === 'y';
    }

    // Get Assessment PDF URL
    let assessment2025PdfUrl = null;
    try {
      // First try: Gwinnett style - direct link with href
      assessment2025PdfUrl = await page.evaluate(() => {
        const link = document.querySelector('a[href*="assessmentnotice"][href*="2025"]');
        if (link) {
          return link.href.replace(/ /g, '%20');
        }
        return null;
      });

      // Second try: Fulton style - need to navigate to Assessment Notices page
      if (!assessment2025PdfUrl) {
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
          assessment2025PdfUrl = await page.evaluate(() => {
            const btn = document.querySelector('input[value*="Assessment Notice"][value*="PDF"]');
            if (btn) {
              const onclick = btn.getAttribute('onclick');
              const match = onclick.match(/window\.open\('([^']+)'/);
              if (match) {
                return match[1].replace(/ /g, '%20');
              }
            }
            return null;
          });
        }
      }
    } catch (e) {
      // Assessment notices may not be available
    }

    const result = {
      address,
      county,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : null,
      bathrooms,
      sqft: sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : null,
      homesteadExemption,
      assessment2025Pdf: assessment2025PdfUrl
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

// Run if called directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  const address = process.argv[2] || '6607 ARIA BLVD';
  const county = process.argv[3] || 'fulton';
  scrapeProperty(address, county);
}

export { scrapeProperty };
