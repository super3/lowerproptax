# LowerPropTax

Property tax assessment platform that helps homeowners discover if they're overpaying on property taxes and provides detailed assessment reports.

[![Frontend Status](https://img.shields.io/github/actions/workflow/status/super3/lowerproptax/frontend.yml?branch=main&label=frontend)](https://github.com/super3/lowerproptax/actions/workflows/frontend.yml)
[![Test Status](https://img.shields.io/github/actions/workflow/status/super3/lowerproptax/tests.yml?branch=main&label=tests)](https://github.com/super3/lowerproptax/actions/workflows/tests.yml)
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

- [ ] Automate finding 3 comps
- [ ] Allow user to generate report by themselves
- [ ] Handle 2025, 2026 assessment years
- [ ] Tax deadlines tracking
- [ ] Property tax appeal guidance
- [ ] Payment processing (Stripe) - require payment before viewing assessment reports
- [ ] Mobile app (iOS & Android)
