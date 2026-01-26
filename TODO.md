# TODO

## Automated County Data Pulls

Fetch property assessment data from Fulton, Gwinnett, and Cobb county websites.

### Data Sources

- **Fulton:** https://qpublic.schneidercorp.com/Application.aspx?AppID=936&LayerID=18251&PageTypeID=2&PageID=8154
- **Gwinnett:** https://qpublic.schneidercorp.com/Application.aspx?AppID=1282&LayerID=43872&PageTypeID=2&PageID=16058
- **Cobb:** https://qpublic.schneidercorp.com/Application.aspx?AppID=1051&LayerID=23951&PageTypeID=2&PageID=9967

### Implementation

- [ ] Research county website structures and APIs
- [ ] Build base scraper with error handling and rate limiting
- [ ] Fulton County scraper
- [ ] Gwinnett County scraper
- [ ] Cobb County scraper
- [ ] Scheduled jobs for regular pulls
- [ ] Integrate with property submission flow
- [ ] Tests and monitoring

### Data to Extract

- Parcel ID & address
- Current assessed value
- Homestead exemption status
- Assessment history (3-5 years)
