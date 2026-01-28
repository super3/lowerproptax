import { chromium } from 'playwright';
import { PDFParse } from 'pdf-parse';

// Scrape 2025 property tax from Gwinnett County Tax Commissioner PDF
async function scrapeGwinnettPropertyTax(parcelNumber) {
  // URL encode the parcel number (spaces become %20)
  // Parcel format: "R7058 149" -> "R7058%20149"
  const encodedParcel = encodeURIComponent(parcelNumber);
  const url = `https://www.gwinnetttaxcommissioner.com/PropTaxBill/${encodedParcel}.pdf`;

  let parser = null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const pdfBuffer = Buffer.from(arrayBuffer);

    parser = new PDFParse({ data: pdfBuffer });
    const pdfResult = await parser.getText();
    const pdfText = pdfResult.text;

    // Look for the total tax amount in the PDF
    // Format varies but typically shows "Total Due" or similar with amount
    const taxMatch = pdfText.match(/Total\s*(?:Due|Tax|Amount)[:\s]*\$?([\d,]+\.\d{2})/i) ||
                     pdfText.match(/(?:Annual|2025)\s*Tax[:\s]*\$?([\d,]+\.\d{2})/i) ||
                     pdfText.match(/\$?([\d,]+\.\d{2})\s*$/m);

    if (taxMatch) {
      return taxMatch[1]; // Return as string with commas, e.g., "4,911.54"
    }

    return null;
  } catch (e) {
    console.error('Error scraping Gwinnett property tax:', e.message);
    return null;
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (e) {
        // Ignore destroy errors
      }
    }
  }
}

// Scrape 2025 property tax from Fulton County Taxes website
async function scrapeFultonPropertyTax(parcelNumber, browser) {
  // URL encode the parcel number (spaces become %20)
  const encodedParcel = encodeURIComponent(parcelNumber);
  const url = `https://fultoncountytaxes.org/propertytax/details/${encodedParcel}/2025/`;

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();

  try {
    // Use load to wait for full page, then wait for JavaScript data to load
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });

    // Wait for the actual tax data to load (page uses JavaScript to fetch data)
    // Look for "Total Amount Billed" which indicates data has loaded
    try {
      await page.waitForFunction(
        () => document.body.innerText.includes('Total Amount Billed'),
        { timeout: 45000 }
      );
    } catch (e) {
      // If data doesn't load, wait a bit more and try once more
      await page.waitForTimeout(10000);
    }

    const text = await page.evaluate(() => document.body.innerText);

    // Look for 2025 tax amount on details page
    // Format: "Total Amount Billed	 	$15,262.32"
    const taxMatch = text.match(/Total Amount Billed[\s\t]*\$?([\d,]+\.\d{2})/i);
    if (taxMatch) {
      return taxMatch[1]; // Return as string with commas, e.g., "15,262.32"
    }

    return null;
  } finally {
    await context.close();
  }
}

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

    // Handle various bathroom formats
    let bathrooms = null;

    // Format 1: "Full Bath/Half Bath 3/1" (Fulton)
    const bathMatch1 = text.match(/Full\s*Bath\/Half\s*Bath\s*\n?\s*(\d+)\/(\d+)/i);
    if (bathMatch1) {
      bathrooms = parseInt(bathMatch1[1]) + (parseInt(bathMatch1[2]) * 0.5);
    }

    // Format 2: "Bathrooms 2" and "Half Bathrooms 1" on separate lines (Cobb)
    if (!bathrooms) {
      const fullBathMatch = text.match(/Bathrooms\s*\n?\s*(\d+)/i);
      const halfBathMatch = text.match(/Half\s*Bathrooms\s*\n?\s*(\d+)/i);
      if (fullBathMatch) {
        const fullBaths = parseInt(fullBathMatch[1]);
        const halfBaths = halfBathMatch ? parseInt(halfBathMatch[1]) : 0;
        bathrooms = fullBaths + (halfBaths * 0.5);
      }
    }

    // Format 3: Simple "Full Bath 3" or "Bath 3"
    if (!bathrooms) {
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

      // Second try: Check for PDF button directly on page (Cobb style)
      if (!assessment2025PdfUrl) {
        assessment2025PdfUrl = await page.evaluate(() => {
          const btn = document.querySelector('input[value*="2025"][value*="Notice"][value*="PDF"]');
          if (btn) {
            const onclick = btn.getAttribute('onclick');
            const match = onclick?.match(/window\.open\('([^']+)'/);
            if (match) return match[1].replace(/ /g, '%20');
          }
          return null;
        });
      }

      // Third try: Fulton style - need to navigate to Assessment Notices page
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
          // Fulton: "2025 Assessment Notice (PDF)", Cobb: "2025 Notice (PDF)"
          assessment2025PdfUrl = await page.evaluate(() => {
            const btn = document.querySelector('input[value*="2025"][value*="Notice"][value*="PDF"]');
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

    // For Cobb, extract homestead from PDF since it's not on the page
    if (county.toLowerCase() === 'cobb' && assessment2025PdfUrl && homesteadExemption === null) {
      let parser = null;
      try {
        // Fetch PDF as buffer to avoid worker issues
        const response = await fetch(assessment2025PdfUrl);
        const arrayBuffer = await response.arrayBuffer();
        const pdfBuffer = Buffer.from(arrayBuffer);

        parser = new PDFParse({ data: pdfBuffer });
        const pdfResult = await parser.getText();
        const pdfText = pdfResult.text;

        // Look for homestead pattern in PDF
        // Cobb PDF format: "YES - 413" or "NO" after property details
        const pdfHomesteadMatch = pdfText.match(/\t(YES|NO)\s*(?:-\s*\d+)?[\r\n]/i);
        if (pdfHomesteadMatch) {
          homesteadExemption = pdfHomesteadMatch[1].toLowerCase() === 'yes';
        }
      } catch (e) {
        // PDF parsing may fail
        console.error('Error parsing PDF for homestead:', e.message);
      } finally {
        if (parser) {
          try {
            await parser.destroy();
          } catch (e) {
            // Ignore destroy errors
          }
        }
      }
    }

    // Get the current page URL (qpublic property page)
    const qpublicUrl = page.url();

    // Extract parcel number from the URL KeyValue parameter
    // This preserves the exact spacing (e.g., "17 0034  LL3967" with double space)
    let parcelNumber = null;
    const urlKeyValueMatch = qpublicUrl.match(/KeyValue=([^&]+)/i);
    if (urlKeyValueMatch) {
      // URL uses + for spaces, decode to get actual parcel number
      parcelNumber = decodeURIComponent(urlKeyValueMatch[1].replace(/\+/g, ' '));
    }

    // Try to get 2025 property tax payment based on county
    let propertyTax2025 = null;
    if (county.toLowerCase() === 'fulton' && parcelNumber) {
      try {
        propertyTax2025 = await scrapeFultonPropertyTax(parcelNumber, browser);
      } catch (e) {
        console.error('Error scraping Fulton property tax:', e.message);
      }
    } else if (county.toLowerCase() === 'gwinnett' && parcelNumber) {
      try {
        propertyTax2025 = await scrapeGwinnettPropertyTax(parcelNumber);
      } catch (e) {
        console.error('Error scraping Gwinnett property tax:', e.message);
      }
    }

    const result = {
      address,
      county,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : null,
      bathrooms,
      sqft: sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : null,
      homesteadExemption,
      assessment2025Pdf: assessment2025PdfUrl,
      qpublicUrl,
      parcelNumber,
      propertyTax2025
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
