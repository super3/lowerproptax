# TODO

## Automated County Data Pulls

Fetch property assessment data from Fulton, Gwinnett, and Cobb county websites.

### Data Sources

- **Fulton:** https://qpublic.schneidercorp.com/Application.aspx?AppID=936&LayerID=18251&PageTypeID=2&PageID=8154
- **Gwinnett:** https://qpublic.schneidercorp.com/Application.aspx?AppID=1282&LayerID=43872&PageTypeID=2&PageID=16058
- **Cobb:** https://qpublic.schneidercorp.com/Application.aspx?AppID=1051&LayerID=23951&PageTypeID=2&PageID=9967

### Implementation

- [x] Research county website structures and APIs
- [x] Build base scraper with error handling
- [x] Fulton County scraper
- [x] Gwinnett County scraper
- [ ] Cobb County scraper
- [ ] Integrate with admin property flow
- [x] Tests and monitoring

### Data Extracted

- [x] Bedrooms
- [x] Bathrooms (including half baths)
- [x] Square footage
- [x] Homestead exemption status
- [x] 2025 Assessment PDF URL
