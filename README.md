# LowerPropTax

Property tax savings platform that helps homeowners discover savings they might be missing. Currently serving Georgia.

[![Frontend Status](https://img.shields.io/github/actions/workflow/status/super3/lowerproptax/frontend.yml?branch=main&label=frontend)](https://github.com/super3/lowerproptax/actions/workflows/frontend.yml)
[![Test Status](https://img.shields.io/github/actions/workflow/status/super3/lowerproptax/tests.yml?branch=main&label=tests)](https://github.com/super3/lowerproptax/actions/workflows/tests.yml)
[![Scraper Status](https://img.shields.io/github/actions/workflow/status/super3/lowerproptax/scrapers.yml?branch=main&label=scrapers)](https://github.com/super3/lowerproptax/actions/workflows/scrapers.yml)
[![Coverage Status](https://coveralls.io/repos/github/super3/lowerproptax/badge.svg?branch=main)](https://coveralls.io/github/super3/lowerproptax?branch=main)

## Installation

### Prerequisites
- Node.js v22 (LTS)
- Clerk account (https://clerk.com)
- Google Maps API key (https://console.cloud.google.com)
- PostgreSQL database (Railway, Supabase, etc.)
- Resend account (https://resend.com)

### From Source
```bash
git clone https://github.com/super3/lowerproptax.git && cd lowerproptax
npm install                        # Install dependencies
```

## Usage

```bash
npm start                          # Start server (production)
npm run dev                        # Start with auto-reload (development)
npm test                           # Run test suite
```

## Roadmap

- [x] Payment processing (Stripe) - $49 educational video calls
- [x] Test ads (Google Ads campaign for user acquisition)
- [x] Automated pulls from 3 largest counties websites (Fulton, Gwinnett, Cobb)
  - [ ] Integrate homestead checking on admin flow
  - [ ] Automate homestead checking on website
- [ ] Allow users to put in address before signing up
- [ ] Mobile app (iOS & Android)
