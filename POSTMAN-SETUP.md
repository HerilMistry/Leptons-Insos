# Postman Setup Instructions

## Quick Start

1. **Download the collection**:
   - File: `CortexFlow-API.postman_collection.json`
   - Location: Project root directory

2. **Import into Postman**:
   - Open Postman
   - Click "Import" (top-left)
   - Select the JSON file
   - Collection loads automatically

3. **Set Variables** (⚙️ Collection → Variables):
   - `access_token` → (leave blank, will auto-fill from Login response)
   - `session_id` → (leave blank, will auto-fill from Start Session response)

## Test Sequence

### Test 1: Register User
```
Request: POST /api/auth/register/
Method: POST
URL: https://cortex-flow.onrender.com/api/auth/register/
Headers: Content-Type: application/json
Body (raw):
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

✅ **Expected**: 201 Created
```json
{
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com"
  },
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc..."
}
```

**Remember**: Copy the `access` token value!

---

### Test 2: Save Token to Variable
1. In Postman, go to **Collection** → **Variables**
2. Find `access_token` row
3. Paste the token you copied from Register response
4. Hit Save

---

### Test 3: Login User
```
Request: POST /api/auth/login/
Method: POST
URL: https://cortex-flow.onrender.com/api/auth/login/
Headers: Content-Type: application/json
Body (raw):
{
  "username": "john_doe",
  "password": "SecurePass123!"
}
```

✅ **Expected**: 200 OK (same token as Register)

---

### Test 4: Start Session
```
Request: POST /api/session/start/
Method: POST
URL: https://cortex-flow.onrender.com/api/session/start/
Headers:
  - Content-Type: application/json
  - Authorization: Bearer {{access_token}}
Body (raw):
{
  "task": "coding",
  "duration_minutes": 60
}
```

✅ **Expected**: 201 Created
```json
{
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-02-28T17:00:00Z",
  "task": "coding",
  "duration_minutes": 60,
  "status": "active"
}
```

**Remember**: Copy the `session_id` value!

---

### Test 5: Save Session ID to Variable
1. In Postman, go to **Collection** → **Variables**
2. Find `session_id` row
3. Paste the session ID you copied from Start Session response
4. Hit Save

---

### Test 6: Get Session History
```
Request: GET /api/sessions/history/
Method: GET
URL: https://cortex-flow.onrender.com/api/sessions/history/
Headers:
  - Authorization: Bearer {{access_token}}
```

✅ **Expected**: 200 OK
```json
[
  {
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "task": "coding",
    "created_at": "2026-02-28T17:00:00Z",
    "status": "active",
    "duration_minutes": 60
  }
]
```

---

### Test 7: Get Session Details
```
Request: GET /api/sessions/{session_id}/detail/
Method: GET
URL: https://cortex-flow.onrender.com/api/sessions/{{session_id}}/detail/
Headers:
  - Authorization: Bearer {{access_token}}
```

✅ **Expected**: 200 OK - Full session details

---

### Test 8: Stop Session
```
Request: POST /api/sessions/stop/
Method: POST
URL: https://cortex-flow.onrender.com/api/sessions/stop/
Headers:
  - Content-Type: application/json
  - Authorization: Bearer {{access_token}}
Body (raw):
{
  "session_id": "{{session_id}}"
}
```

✅ **Expected**: 200 OK - Session stopped

---

### Test 9: Send Telemetry
```
Request: POST /api/telemetry/
Method: POST
URL: https://cortex-flow.onrender.com/api/telemetry/
Headers:
  - Content-Type: application/json
  - Authorization: Bearer {{access_token}}
Body (raw):
{
  "session_id": "{{session_id}}",
  "eye_gaze_x": 512,
  "eye_gaze_y": 384,
  "attention_score": 0.92,
  "timestamp": "2026-02-28T17:05:00Z"
}
```

✅ **Expected**: 201 Created

---

### Test 10: Get Dashboard Analytics
```
Request: GET /api/dashboard/analytics/
Method: GET
URL: https://cortex-flow.onrender.com/api/dashboard/analytics/
Headers:
  - Authorization: Bearer {{access_token}}
```

✅ **Expected**: 200 OK - Analytics data

---

## ✅ Success Indicators

- ✅ All endpoints return 2xx status codes (200, 201)
- ✅ Responses contain expected JSON data
- ✅ `Authorization: Bearer {{access_token}}` header works
- ✅ Session ID persists across requests
- ✅ Telemetry data accepted

## ❌ Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| 404 Not Found | Endpoint doesn't exist | Check exact URL path in api/urls.py |
| 400 Bad Request | Invalid JSON body | Validate JSON syntax |
| 401 Unauthorized | Missing/invalid token | Re-login, copy new token |
| 403 Forbidden | User lacks permission | Check authentication |
| 500 Internal Error | Server error | Check Render logs |

## 🔗 Frontend Integration

Your frontend (React) should:
1. Call `https://cortex-flow.onrender.com/api/{endpoint}`
2. Add `Authorization: Bearer {token}` header for protected routes
3. Handle 401 responses by redirecting to login

Example (TypeScript):
```typescript
const response = await fetch('https://cortex-flow.onrender.com/api/auth/register/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'john_doe',
    email: 'john@example.com',
    password: 'SecurePass123!'
  })
});
const data = await response.json();
localStorage.setItem('token', data.access);
```

---

**That's it! Your frontend and backend are now synced and ready.** 🎉
