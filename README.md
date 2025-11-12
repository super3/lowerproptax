# PadTask

Property tax assessment platform that helps homeowners discover if they're overpaying on property taxes and provides detailed assessment reports.

[![Frontend Status](https://img.shields.io/github/actions/workflow/status/super3/padtask/frontend.yml?branch=main&label=frontend)](https://github.com/super3/padtask/actions/workflows/frontend.yml)
[![Test Status](https://img.shields.io/github/actions/workflow/status/super3/padtask/tests.yml?branch=main&label=tests)](https://github.com/super3/padtask/actions/workflows/tests.yml)
[![Coverage Status](https://coveralls.io/repos/github/super3/padtask/badge.svg?branch=main)](https://coveralls.io/github/super3/padtask?branch=main)

## Features

- 🏠 Free property tax assessments
- 💰 Identify potential annual tax savings
- 📊 Track property assessment status (preparing/ready)
- 📧 Email notifications when assessments are complete
- 📄 Downloadable PDF reports ($49)
- 🔐 Secure authentication with Clerk (Google, Apple, Email)
- 🗺️ Google Maps address autocomplete
- 👨‍💼 Admin dashboard for assessment management
- 💾 PostgreSQL database for persistent storage

## Installation

### Prerequisites
- Node.js 18+ and npm 10+
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

## Development

### Current Features

- ✅ User authentication with Clerk (Google, Apple, Email)
- ✅ Property management (add, view, delete)
- ✅ Google Maps address autocomplete
- ✅ Assessment status tracking (preparing/ready)
- ✅ User-specific data isolation
- ✅ Responsive dashboard design
- ✅ Admin dashboard for assessment management
- ✅ Admin role-based access control
- ✅ PostgreSQL database integration

### Roadmap
- [ ] Automated property data collection (assessor records)
- [ ] PDF report generation
- [ ] Email notifications for completed assessments
- [ ] Payment processing (Stripe) for report downloads
- [ ] Property tax appeal guidance
- [ ] Historical tax data tracking
- [ ] Multi-property portfolio analysis
- [ ] Mobile app
