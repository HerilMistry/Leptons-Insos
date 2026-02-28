# CortexFlow Frontend-Backend Sync Guide

## ✅ What's Done

1. **Backend Code Fixed** ✓
   - Commit `404a2fc` pushed to GitHub with correct ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS configuration
   - Render is auto-deploying the latest code

2. **Postman Collection Created** ✓
   - File: `CortexFlow-API.postman_collection.json`
   - Contains all endpoints with correct paths and headers
   - Use `{{access_token}}` and `{{session_id}}` variables for dynamic values

3. **Frontend Configuration** ✓
   - Local dev: Uses `http://localhost:8000/api` from `.env`
   - Production (Vercel): Uses `VITE_API_URL=https://cortex-flow.onrender.com` env var

## 🔧 Setup Instructions

### Step 1: Import Postman Collection
1. Open Postman
2. File → Import
3. Select: `CortexFlow-API.postman_collection.json`
4. Collection will load with all endpoints

### Step 2: Test Backend (Render)

#### Register a User
```
POST https://cortex-flow.onrender.com/api/auth/register/
Content-Type: application/json

{
  "username": "testuser",
  "email": "test@example.com",
  "password": "testpass123"
}
```

**Expected Response:**
```json
{
  "user": {
    "id": 1,
    "username": "testuser",
    "email": "test@example.com"
  },
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

#### Copy the Access Token
- Save the `access` token from the response
- In Postman, go to Collection → Variables
- Set `access_token` = (paste the token you copied)

#### Login (Optional - to verify)
```
POST https://cortex-flow.onrender.com/api/auth/login/
Content-Type: application/json

{
  "username": "testuser",
  "password": "testpass123"
}
```

#### Start a Session
```
POST https://cortex-flow.onrender.com/api/session/start/
Authorization: Bearer {{access_token}}
Content-Type: application/json

{
  "task": "coding",
  "duration_minutes": 30
}
```

**Copy session_id from response and save to Postman variables**

#### Get Session History
```
GET https://cortex-flow.onrender.com/api/sessions/history/
Authorization: Bearer {{access_token}}
```

### Step 3: Frontend Configuration

#### For Local Development (Testing locally against Render)
```bash
cd website/cortexmind-dashboard
# .env should have:
VITE_API_URL=https://cortex-flow.onrender.com
VITE_GROQ_API_KEY=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
```

Then run:
```bash
npm run dev
```

The frontend will use the Render backend.

#### For Vercel Deployment (Already Configured)
The environment variables are already set on Vercel:
- `VITE_API_URL=https://cortex-flow.onrender.com`
- `VITE_GROQ_API_KEY=gsk_...`

## 🌐 Backend Endpoints Reference

All endpoints require: `https://cortex-flow.onrender.com/api/`

### Auth
- `POST /auth/register/` - Register new user
- `POST /auth/login/` - Login user
- `POST /auth/logout/` - Logout user

### Sessions
- `POST /session/start/` - Start a focus session
- `POST /sessions/stop/` - Stop a session
- `GET /sessions/history/` - Get user session history
- `GET /sessions/{session_id}/detail/` - Get session details
- `GET /sessions/{session_id}/live/` - Get live session data

### Dashboard
- `GET /dashboard/analytics/` - Get analytics
- `GET /session/active/` - Get active session

### Telemetry
- `POST /telemetry/` - Send eye tracking / telemetry data

## 🔐 Authentication Flow

1. **Register or Login** → Get `access_token`
2. **Add to Headers**: `Authorization: Bearer {access_token}`
3. **Access Protected Endpoints** with the token
4. **If 401**: Token expired → Login again to get new token

## ✅ Testing Checklist

- [ ] Register endpoint returns 201 + token
- [ ] Login endpoint returns 200 + token
- [ ] Session/start returns 201 + session_id
- [ ] Session/history returns 200 + list of sessions
- [ ] Frontend can load from Vercel
- [ ] Frontend API calls hit the Render backend
- [ ] CORS headers allow requests from Vercel domain

## 🚨 Troubleshooting

### Getting 404 on Render backend
- Wait 2-3 minutes for Render to auto-deploy after git push
- Check Render dashboard Logs tab for build errors
- Verify ALLOWED_HOSTS = `cortex-flow.onrender.com`
- Verify CORS_ALLOWED_ORIGINS = `https://leptons-insos.vercel.app`

### Getting CORS errors in frontend
- Frontend must use `https://cortex-flow.onrender.com` (not http)
- Backend CORS_ALLOWED_ORIGINS must include frontend domain
- Check browser console for exact error

### Getting 401 Unauthorized
- Token might be expired → Login again
- Make sure Authorization header format is: `Bearer {token}`
- Check token hasn't been modified

## 📱 File Locations

- Postman Collection: `/home/brijesh-thakkar/Desktop/Leptons-Insos/CortexFlow-API.postman_collection.json`
- Frontend .env: `/home/brijesh-thakkar/Desktop/Leptons-Insos/website/cortexmind-dashboard/.env`
- Backend settings: `/home/brijesh-thakkar/Desktop/Leptons-Insos/backend/cortexflow/settings.py`
- API routes: `/home/brijesh-thakkar/Desktop/Leptons-Insos/backend/api/urls.py`

---

**Status**: ✅ All code deployed, waiting for Render to process. Frontend and backend are ready to sync.
