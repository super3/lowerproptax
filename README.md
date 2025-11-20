# PadTask

Property tax assessment platform that helps homeowners discover if they're overpaying on property taxes and provides detailed assessment reports.

[![Frontend Status](https://img.shields.io/github/actions/workflow/status/super3/padtask/frontend.yml?branch=main&label=frontend)](https://github.com/super3/padtask/actions/workflows/frontend.yml)
[![Test Status](https://img.shields.io/github/actions/workflow/status/super3/padtask/tests.yml?branch=main&label=tests)](https://github.com/super3/padtask/actions/workflows/tests.yml)
[![Coverage Status](https://coveralls.io/repos/github/super3/padtask/badge.svg?branch=main)](https://coveralls.io/github/super3/padtask?branch=main)

## Installation

### Prerequisites
- Node.js v24 (LTS)
- Clerk account (https://clerk.com)
- Google Maps API key (https://console.cloud.google.com)
- PostgreSQL database (Railway, Supabase, etc.)

### From Source
```bash
git clone https://github.com/super3/padtask.git && cd padtask
npm install                        # Install dependencies
```

## Usage

```bash
npm start                          # Start server (production)
npm run dev                        # Start with auto-reload (development)
npm test                           # Run test suite
```

## Roadmap

- [x] Terms of Service page
- [x] Privacy Policy page
- [x] Help page
- [ ] Create support@padtask.com email account
- [ ] Email notifications for pending assessments (to admin)
- [ ] Email notifications for completed assessments
- [ ] Payment processing (Stripe) for report downloads
- [ ] Property tax appeal guidance
- [ ] Historical tax data tracking
- [ ] Tax deadlines tracking
- [ ] Mobile app (Android)
- [ ] Mobile app (iOS)
