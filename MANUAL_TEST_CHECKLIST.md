# Amplify Platform Manual Test Checklist

## Pre-Deployment Validation
Use this checklist to manually validate the platform before and after deployment.

---

## 🔐 Authentication Tests

### Login Flow
- [ ] Navigate to https://hfu-amplify.org
- [ ] Verify redirect to login page if not authenticated
- [ ] Enter test credentials (test@hfu-amplify.org)
- [ ] Click login button
- [ ] **CRITICAL**: Verify NO 403 error on /home after login
- [ ] Verify successful redirect to home page
- [ ] Check browser console for errors (F12 → Console)
- [ ] **CRITICAL**: Verify NO "localhost:3001" errors in console

### Session Persistence
- [ ] After login, refresh the page (F5)
- [ ] Verify session is maintained (no redirect to login)
- [ ] Open new tab and navigate to site
- [ ] Verify session is shared across tabs
- [ ] Wait 5 minutes and verify session still active

### Logout Flow
- [ ] Click logout button/link
- [ ] Verify redirect to login page
- [ ] Try to access /home directly
- [ ] Verify redirect to login (protected route working)

---

## 💬 Chat Interface Tests

### Basic Chat Functionality
- [ ] Verify chat input field is visible
- [ ] Verify model selector dropdown is populated
- [ ] Type a test message: "Hello, can you help me test the system?"
- [ ] Press Enter or click Send
- [ ] Verify message appears in chat history
- [ ] Verify "typing" indicator appears
- [ ] Verify AI response appears within 30 seconds
- [ ] Check response formatting (markdown rendering)

### Model Selection
- [ ] Click model selector dropdown
- [ ] Verify all models are listed with provider badges:
  - [ ] Claude 3 Sonnet (Bedrock)
  - [ ] Claude 3 Haiku (Bedrock)
  - [ ] GPT-4 Turbo (OpenAI)
  - [ ] GPT-3.5 Turbo (OpenAI)
  - [ ] Gemini Pro (Google)
  - [ ] Mistral 7B (Bedrock)
- [ ] Select each model and send a test message
- [ ] Verify each model responds correctly

### Streaming Responses
- [ ] Send message: "Write a short story about a robot"
- [ ] Verify response streams in character by character
- [ ] Verify no UI freezing during streaming
- [ ] Verify stop button appears during streaming
- [ ] Test stop button functionality

---

## 🌐 API & Network Tests

### API Endpoints (DevTools Network Tab)
- [ ] Open browser DevTools (F12) → Network tab
- [ ] Send a chat message
- [ ] **CRITICAL**: Verify API call goes to https://api.hfu-amplify.org/proxy/llm
- [ ] **CRITICAL**: Verify NO calls to localhost:3001
- [ ] Verify request includes Authorization header
- [ ] Verify response status is 200
- [ ] Check for proper CORS headers in response

### Error Handling
- [ ] Disconnect internet/use offline mode
- [ ] Try to send a message
- [ ] Verify user-friendly error message appears
- [ ] Reconnect and verify recovery
- [ ] Send very long message (1000+ characters)
- [ ] Verify proper handling (no crash)

---

## 📱 Responsive Design Tests

### Mobile View
- [ ] Open DevTools → Toggle device toolbar
- [ ] Select iPhone 12 Pro
- [ ] Verify layout adjusts properly
- [ ] Verify chat input is accessible
- [ ] Verify model selector works on mobile
- [ ] Test sending messages on mobile view

### Tablet View
- [ ] Select iPad Air from device list
- [ ] Verify layout utilizes tablet space
- [ ] Verify sidebar (if any) behavior
- [ ] Test all interactions

### Desktop View
- [ ] Return to desktop view
- [ ] Verify full layout is restored
- [ ] Test window resizing
- [ ] Verify no horizontal scroll at any size

---

## ⚡ Performance Tests

### Page Load
- [ ] Clear browser cache (Ctrl+Shift+Del)
- [ ] Navigate to site
- [ ] Verify page loads within 3 seconds
- [ ] Check DevTools for any failed resource loads

### Response Times
- [ ] Send simple message: "Hi"
- [ ] Measure time to first response byte
- [ ] Should be under 2 seconds for simple queries
- [ ] Send complex message requesting code
- [ ] Verify response begins within 5 seconds

### Memory Usage
- [ ] Open DevTools → Performance → Memory
- [ ] Send 10 messages in succession
- [ ] Verify no significant memory leaks
- [ ] Verify old messages can be scrolled

---

## 🔍 Specific Issue Validation

### Critical Issues from Agent Reports

#### 1. ALB /home Routing (Agent 1 Fix)
- [ ] After login, verify /home loads without 403 error
- [ ] Check Network tab for /home request
- [ ] Verify response is 200 OK
- [ ] Verify page content loads properly

#### 2. Localhost:3001 References (Agent 2 Fix)
- [ ] Open browser console
- [ ] Clear console
- [ ] Navigate through the app
- [ ] Search console for "localhost" (Ctrl+F)
- [ ] **MUST BE**: Zero matches for "localhost:3001"
- [ ] Check Network tab for any localhost requests
- [ ] **MUST BE**: All API calls go to api.hfu-amplify.org

#### 3. API Gateway CORS (Agent 3 Validation)
- [ ] In Network tab, find OPTIONS requests
- [ ] Verify CORS headers present:
  - Access-Control-Allow-Origin
  - Access-Control-Allow-Methods
  - Access-Control-Allow-Headers
- [ ] Verify no CORS errors in console

#### 4. JWT Authentication (All Agents)
- [ ] In Network tab, inspect chat API calls
- [ ] Verify Authorization header present
- [ ] Verify format: "Bearer eyJ..."
- [ ] Verify no 401 Unauthorized errors

---

## 📋 Test Summary

### Pass/Fail Criteria
- **PASS**: All critical issues resolved:
  - ✅ No 403 errors on /home
  - ✅ No localhost:3001 references
  - ✅ All API calls use correct domain
  - ✅ Authentication working properly
  - ✅ All AI models responding

- **FAIL**: Any of these present:
  - ❌ 403 Forbidden on /home
  - ❌ Console shows localhost:3001 errors
  - ❌ API calls failing
  - ❌ Cannot send messages
  - ❌ Models not loading

### Test Results Recording

| Test Category | Pass | Fail | Notes |
|--------------|------|------|-------|
| Authentication | ☐ | ☐ | |
| Chat Interface | ☐ | ☐ | |
| API Endpoints | ☐ | ☐ | |
| Responsive Design | ☐ | ☐ | |
| Performance | ☐ | ☐ | |
| Critical Issues | ☐ | ☐ | |

**Overall Result**: ☐ PASS / ☐ FAIL

**Tested By**: _________________
**Date/Time**: _________________
**Environment**: _________________

---

## 🔧 Quick Troubleshooting

If any tests fail:

1. **403 on /home**: ALB routing rule may not be applied
2. **localhost:3001 errors**: Frontend JS not updated 
3. **API failures**: Check API Gateway configuration
4. **Auth issues**: Verify Cognito secrets in ECS
5. **Model issues**: Check Lambda environment variables

Report any failures immediately to the deployment team with:
- Screenshot of error
- Browser console output
- Network tab HAR file
- Exact steps to reproduce