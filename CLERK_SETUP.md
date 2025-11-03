# Clerk Authentication Setup Guide for PadTask

This guide will help you configure Clerk authentication for your PadTask application.

## Prerequisites

- A Clerk account (sign up at https://clerk.com)
- Node.js installed (v18 or higher)
- The PadTask repository

## Step 1: Create a Clerk Application

1. Go to https://dashboard.clerk.com/
2. Click "Add application"
3. Choose your authentication methods (Email, Google, GitHub, etc.)
4. Create the application

## Step 2: Get Your Clerk Keys

From your Clerk dashboard:

1. Navigate to "API Keys" in the sidebar
2. Copy your **Publishable Key** (starts with `pk_test_` or `pk_live_`)
3. Copy your **Secret Key** (starts with `sk_test_` or `sk_live_`)

## Step 3: Configure Backend Environment Variables

1. Navigate to the `server` directory:
   ```bash
   cd server
   ```

2. Open the `.env` file (created from `.env.example`)

3. Replace the placeholder values:
   ```bash
   PORT=3001

   CLERK_PUBLISHABLE_KEY=pk_test_YOUR_ACTUAL_KEY_HERE
   CLERK_SECRET_KEY=sk_test_YOUR_ACTUAL_SECRET_HERE
   ```

## Step 4: Configure Frontend Clerk.js

You need to update the Clerk script tag in your HTML files with your actual keys.

### Update `index.html`

Find this line (around line 10-15):
```html
<script
    async
    crossorigin="anonymous"
    data-clerk-publishable-key="your_clerk_publishable_key_here"
    src="https://your-clerk-domain.clerk.accounts.dev/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
    type="text/javascript"
></script>
```

Replace with:
```html
<script
    async
    crossorigin="anonymous"
    data-clerk-publishable-key="pk_test_YOUR_ACTUAL_KEY_HERE"
    src="https://YOUR_CLERK_FRONTEND_API_URL/npm/@clerk/clerk-js@5/dist/clerk.browser.js"
    type="text/javascript"
></script>
```

**To find your Frontend API URL:**
1. Go to your Clerk Dashboard
2. Click "API Keys"
3. Look for "Frontend API" - it will look like: `boss-tarpon-23.clerk.accounts.dev`

### Update `dashboard.html`

Make the same changes to `dashboard.html` (around line 10-15).

## Step 5: Start the Backend Server

1. Make sure you're in the `server` directory:
   ```bash
   cd server
   ```

2. Install dependencies (if not already done):
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

4. You should see:
   ```
   PadTask server running on http://localhost:3001
   Environment: development
   ```

## Step 6: Serve the Frontend

Since the frontend is static HTML, you can serve it using any method:

### Option 1: VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"

### Option 2: Python HTTP Server
```bash
# Python 3
python3 -m http.server 8000

# Python 2
python -m SimpleHTTPServer 8000
```

Then visit http://localhost:8000

### Option 3: Node.js http-server
```bash
npx http-server -p 8000
```

## Step 7: Test the Application

1. Open your browser to the frontend URL (e.g., http://localhost:8000)
2. Click "Get Started" or "Log In"
3. The Clerk sign-up/sign-in modal should appear
4. Create an account or sign in
5. You should be redirected to the dashboard
6. Try adding a property - it should save to the backend!

## Troubleshooting

### "No authorization token provided" Error
- Make sure the backend server is running on port 3001
- Check that your Clerk keys are correctly set in `server/.env`
- Verify the API_BASE URL in `dashboard.html` matches your backend URL

### Clerk.js Not Loading
- Check your Clerk Publishable Key is correct in the HTML files
- Verify your Frontend API URL is correct
- Check browser console for errors

### Properties Not Saving
- Open browser DevTools → Network tab
- Check if API calls are reaching `http://localhost:3001/api/properties`
- Look for any CORS errors (should be handled by the backend)
- Verify you're signed in by checking `window.Clerk.user` in the console

### CORS Issues
- The backend already has CORS enabled
- If you still see CORS errors, make sure the frontend is on the same domain or add your frontend URL to the CORS configuration

## Architecture Overview

### Backend Flow
1. Client sends request with `Authorization: Bearer <token>` header
2. `requireAuth` middleware extracts and validates the JWT token
3. Middleware decodes token to get user session/ID
4. Uses Clerk SDK to verify the session with Clerk's API
5. Attaches user info to `req.user`
6. Controller function executes with authenticated user context

### Frontend Flow
1. User signs in via Clerk modal
2. Clerk.js manages session and tokens
3. `Clerk.session.getToken()` gets fresh JWT for API calls
4. Token sent in Authorization header to backend
5. Backend validates token and processes request

## Next Steps

- Add a database (PostgreSQL, MongoDB) to replace in-memory storage
- Implement additional property management features
- Add financial tracking and maintenance request features
- Deploy to production (Railway, Render, Vercel, etc.)

## Support

For Clerk-specific issues, check:
- Clerk Documentation: https://clerk.com/docs
- Clerk Discord: https://clerk.com/discord

For PadTask issues, refer to the main README.md
