# LowerPropTax API Documentation

Backend API server for LowerPropTax property tax assessment platform with Clerk authentication.

## API Endpoints

### Health Check

#### `GET /health`
- No authentication required
- Returns server status
- Response: `{ status: 'ok', message: 'LowerPropTax server is running' }`

---

### Property Routes

All property routes require authentication via Bearer token in the Authorization header.

#### `GET /api/properties`
- Get all properties for authenticated user
- Includes latest assessment for each property
- Returns array of properties with details and latest assessment data

#### `GET /api/properties/:id`
- Get single property by ID
- Verifies user ownership
- Returns property with all assessments (ordered by year DESC)
- Returns 404 if property not found, 403 if user doesn't own the property

#### `POST /api/properties`
- Create new property for authenticated user
- Required: `address` in request body
- Optional: `city`, `state`, `zipCode`, `country`, `lat`, `lng`
- Returns created property with ID, userId, address, and timestamps
- Returns 400 if address is missing

#### `PUT /api/properties/:id`
- Update existing property
- Verifies user ownership
- Can update: `address`, `city`, `state`, `zipCode`, `country`, `lat`, `lng`
- Returns updated property or error if not found/not owned

#### `DELETE /api/properties/:id`
- Delete property owned by authenticated user
- Verifies user ownership
- Returns success message or error

---

### Admin Routes

All admin routes require both authentication and admin role.

#### `GET /api/admin/pending-properties`
- Get all properties with "preparing" status or no assessment
- Returns list of pending properties with basic info
- Sorted by creation date

#### `GET /api/admin/completed-properties`
- Get all properties with "ready" status
- Returns list sorted by updated_at DESC (most recent first)

#### `GET /api/admin/properties/:id`
- Get full property details for admin editing
- Returns property details including all assessments
- Includes current year's assessment or default values

#### `PUT /api/admin/properties/:id`
- Update property details and assessment information
- Can update property: `bedrooms`, `bathrooms`, `sqft`
- Can update assessment: `year`, `appraised_value`, `annual_tax`, `estimated_appraised_value`, `estimated_annual_tax`, `report_url`, `status`
- Creates or updates assessment for specified year (or current year)
- Returns combined property and assessment data

#### `PUT /api/admin/properties/:id/mark-ready`
- Mark property assessment as ready
- Updates status to "ready" and sets updated_at timestamp
- Legacy endpoint maintained for backward compatibility

---

## Authentication

All API endpoints (except `/health`) require authentication via Clerk JWT tokens:

```bash
curl -X GET http://localhost:3001/api/properties \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN"
```

## Example Response

### Property with Assessment
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "user_id": "user_2abc123def",
  "address": "123 Main St",
  "city": "Atlanta",
  "state": "GA",
  "zip_code": "30301",
  "country": "US",
  "lat": 33.7490,
  "lng": -84.3880,
  "bedrooms": 3,
  "bathrooms": 2,
  "sqft": 1500,
  "created_at": "2025-01-13T12:00:00.000Z",
  "updated_at": "2025-01-13T12:00:00.000Z",
  "latestAssessment": {
    "id": "456e7890-e89b-12d3-a456-426614174000",
    "property_id": "123e4567-e89b-12d3-a456-426614174000",
    "year": 2025,
    "appraised_value": 250000,
    "annual_tax": 3500,
    "estimated_appraised_value": 230000,
    "estimated_annual_tax": 3220,
    "report_url": "https://example.com/report.pdf",
    "status": "ready",
    "created_at": "2025-01-13T12:00:00.000Z",
    "updated_at": "2025-01-13T13:00:00.000Z"
  }
}
```

---

## Database Schema

### Properties Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(255) | PRIMARY KEY | Unique property identifier |
| user_id | VARCHAR(255) | NOT NULL | Clerk user ID (owner) |
| address | VARCHAR(500) | NOT NULL | Property street address |
| city | VARCHAR(255) | | City name |
| state | VARCHAR(100) | | State/province |
| zip_code | VARCHAR(20) | | Postal code |
| country | VARCHAR(100) | | Country |
| lat | DECIMAL(10, 8) | | Latitude coordinate |
| lng | DECIMAL(11, 8) | | Longitude coordinate |
| bedrooms | INTEGER | | Number of bedrooms |
| bathrooms | DECIMAL(3, 1) | | Number of bathrooms |
| sqft | INTEGER | | Square footage |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes:** `user_id`

### Assessments Table

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(255) | PRIMARY KEY | Unique assessment identifier |
| property_id | VARCHAR(255) | NOT NULL, FOREIGN KEY | References properties(id) |
| year | INTEGER | NOT NULL | Tax assessment year |
| appraised_value | DECIMAL(15, 2) | | Current appraised value |
| annual_tax | DECIMAL(15, 2) | | Current annual tax amount |
| estimated_appraised_value | DECIMAL(15, 2) | | Estimated appraised value |
| estimated_annual_tax | DECIMAL(15, 2) | | Estimated annual tax amount |
| report_url | VARCHAR(500) | | URL to assessment report PDF |
| status | VARCHAR(50) | DEFAULT 'preparing' | Status: 'preparing' or 'ready' |
| created_at | TIMESTAMP | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMP | DEFAULT NOW() | Last update timestamp |

**Indexes:** `property_id`, `year`
**Constraints:** UNIQUE(property_id, year), CASCADE DELETE on property deletion

### Relationships
- One property can have multiple assessments (one per year)
- Deleting a property cascades to delete all its assessments
