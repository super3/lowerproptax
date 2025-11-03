# PadTask

Virtual property management platform that handles what traditional property managers won't for just $25/month per property.

[![Test Status](https://img.shields.io/github/actions/workflow/status/super3/padtask/tests.yml?branch=main&label=tests)](https://github.com/super3/padtask/actions/workflows/tests.yml)
[![Server Tests](https://img.shields.io/badge/server%20tests-40%20passing-brightgreen)](https://github.com/super3/padtask)

## Features

- 🏠 Track properties, rent, and expenses in one place
- 💰 Financial tracking with rent payment and expense categorization
- 🔧 Maintenance request coordination and work order tracking
- 🔐 Secure authentication with Clerk
- 📊 Real-time property dashboard
- 🗺️ Google Maps integration for property management

## Installation

### Prerequisites
- Node.js 18+ and npm 10+
- Clerk account (https://clerk.com)
- Google Maps API key

### From Source
```bash
git clone https://github.com/super3/padtask.git && cd padtask
cd server && npm install           # Install backend dependencies
```

## Usage

```bash
cd server
npm start                          # Start server (production)
npm run dev                        # Start with auto-reload (development)
npm test                           # Run test suite
```

## Development

### Adding New Features

1. Create controller function in `server/src/controllers/`
2. Add route in `server/src/routes/`
3. Apply `requireAuth` middleware for protected routes
4. Write tests in `server/__tests__/`
5. Run tests with `npm test`

### Current Features

- ✅ User authentication with Clerk
- ✅ Property CRUD operations
- ✅ Google Maps address autocomplete
- ✅ User-specific data isolation
- ✅ Responsive dashboard design

### Roadmap

- [ ] Database integration (PostgreSQL/MongoDB)
- [ ] Financial tracking (rent, expenses, taxes)
- [ ] Maintenance request system
- [ ] Email notifications
- [ ] Document storage
- [ ] Tenant management
- [ ] Payment processing integration
- [ ] Mobile app
