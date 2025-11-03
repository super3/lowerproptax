# PadTask Server

Backend API server for PadTask property management application with Clerk authentication.

## Features

- **Authentication**: Clerk JWT-based authentication middleware
- **Property Management**: CRUD operations for user properties
- **User Isolation**: Each user can only access their own properties
- **RESTful API**: Standard REST endpoints with proper HTTP status codes
- **Comprehensive Testing**: Unit and integration tests with Jest

## Setup

### Prerequisites

- Node.js 18+
- npm 10+
- Clerk account (https://clerk.com)

### Installation

```bash
npm install
```

### Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Add your Clerk keys to `.env`:
   ```bash
   PORT=3001
   CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
   CLERK_SECRET_KEY=sk_test_your_secret_here
   ```

## Running the Server

### Development Mode (with auto-restart)

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The server will start on http://localhost:3001 (or the PORT specified in .env).

## API Endpoints

All endpoints require authentication via Bearer token in the Authorization header.

### Properties

- `GET /api/properties` - Get all properties for authenticated user
- `GET /api/properties/:id` - Get single property by ID
- `POST /api/properties` - Create new property
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property

### Example Request

```bash
curl -X GET http://localhost:3001/api/properties \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

### Property Schema

```json
{
  "id": "prop_1234567890_abc123",
  "userId": "user_123",
  "address": "123 Main St",
  "city": "Atlanta",
  "state": "GA",
  "zipCode": "30301",
  "lat": 33.7490,
  "lng": -84.3880,
  "createdAt": "2025-11-03T12:00:00.000Z",
  "updatedAt": "2025-11-03T12:00:00.000Z"
}
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Test Structure

```
tests/
├── utils/
│   ├── mockClerk.js         # Mock Clerk SDK and test helpers
│   └── testServer.js        # Test server setup
├── middleware/
│   └── auth.test.js         # Authentication middleware tests
├── controllers/
│   └── propertyController.test.js  # Property controller tests
└── integration/
    └── api.test.js          # API integration tests
```

### Test Coverage

The test suite includes:

- **Authentication Middleware Tests** (8 tests)
  - Token validation
  - Session verification
  - User attachment to request
  - Error handling

- **Property Controller Tests** (15 tests)
  - CRUD operations
  - User isolation
  - Access control
  - Input validation

- **API Integration Tests** (17 tests)
  - End-to-end API testing
  - Authentication flow
  - Multi-user scenarios
  - HTTP status codes

**Total: 40 tests, 100% passing**

## Architecture

### Authentication Flow

1. Client sends request with `Authorization: Bearer <token>` header
2. `requireAuth` middleware extracts and validates JWT token
3. Middleware decodes token to get session/user ID
4. Uses Clerk SDK to verify session and retrieve user data
5. Attaches user info to `req.user`
6. Controller function executes with authenticated user context

### Data Storage

Currently uses in-memory Map for property storage. This should be replaced with a persistent database (PostgreSQL, MongoDB, etc.) for production use.

## Development

### Project Structure

```
server/
├── src/
│   ├── controllers/
│   │   └── propertyController.js   # Property CRUD logic
│   ├── middleware/
│   │   └── auth.js                 # Authentication middleware
│   ├── routes/
│   │   └── propertyRoutes.js       # API route definitions
│   └── index.js                    # Express server setup
├── tests/                          # Test files
├── jest.config.js                  # Jest configuration
├── package.json
└── .env                           # Environment variables (git-ignored)
```

### Adding New Features

1. Create controller function in `src/controllers/`
2. Add route in `src/routes/`
3. Apply `requireAuth` middleware if authentication is needed
4. Write tests in `tests/`
5. Run tests with `npm test`

## Troubleshooting

### Tests Failing

- Make sure you've installed dependencies: `npm install`
- Check that all test files are using ES module syntax
- Verify Jest is configured for ES modules in `jest.config.js`

### Authentication Not Working

- Verify Clerk keys are correctly set in `.env`
- Check that token is being sent in Authorization header
- Ensure Clerk session is active and not expired
- Review middleware logs for specific error messages

### CORS Issues

- CORS is enabled for all origins by default
- To restrict origins, modify the `cors()` configuration in `src/index.js`

## Production Deployment

### Environment Variables

Ensure these are set in your production environment:

- `PORT` - Server port (default: 3001)
- `CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key
- `NODE_ENV=production` - Set Node environment

### Database Migration

Replace the in-memory Map storage with a real database:

1. Choose a database (PostgreSQL, MongoDB, etc.)
2. Set up database connection
3. Update property controller to use database queries
4. Add database connection to `.env`
5. Run migrations if using a relational database

### Recommendations

- Use a process manager like PM2
- Enable rate limiting for API endpoints
- Add request logging (Morgan, Winston)
- Set up error monitoring (Sentry, etc.)
- Use HTTPS in production
- Implement database connection pooling

## License

MIT
