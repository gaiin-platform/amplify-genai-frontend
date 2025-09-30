# Browser Network Tab Debugging Guide for Authentication

## Chrome DevTools Network Tab Analysis

### 1. Initial Setup
1. Open Chrome and navigate to https://hfu-amplify.org
2. Press `F12` or right-click → "Inspect" to open DevTools
3. Click on the **Network** tab
4. **IMPORTANT**: Check these options:
   - ✅ **Preserve log** (keeps history across page loads)
   - ✅ **Disable cache** (ensures fresh requests)
   - 🔴 Clear existing logs (click the clear button)

### 2. Capture Authentication Flow
1. With Network tab open and recording, click the **Login** button
2. Let the authentication flow complete (or fail)
3. Stop recording once redirected back (or error appears)

### 3. What to Look For

#### ✅ Correct Authentication Flow Pattern:
```
Request #1: GET /api/auth/signin
├── Status: 302 Found
├── Response Headers:
│   └── Location: /api/auth/signin/cognito
└── Request Headers:
    └── Host: hfu-amplify.org

Request #2: GET /api/auth/signin/cognito  
├── Status: 302 Found
├── Response Headers:
│   └── Location: https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com/oauth2/authorize?...
└── Notes: Redirect to Cognito

Request #3: GET https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com/oauth2/authorize
├── Status: 200 OK
├── Notes: Cognito login page loads
└── Query Parameters:
    ├── client_id: 2rq8ekafegrh5mcd51q80rt0bh
    ├── redirect_uri: https://hfu-amplify.org/api/auth/callback/cognito
    └── response_type: code

Request #4: POST https://amplify-prod-auth-1753145624.auth.us-east-1.amazoncognito.com/login
├── Status: 302 Found
├── Response Headers:
│   └── Location: https://hfu-amplify.org/api/auth/callback/cognito?code=xxx&state=yyy
└── Notes: After successful login

Request #5: GET /api/auth/callback/cognito?code=xxx&state=yyy
├── Status: 302 Found
├── Response Headers:
│   └── Location: https://hfu-amplify.org
└── Notes: Processing callback

Request #6: GET https://hfu-amplify.org
├── Status: 200 OK
└── Notes: Authenticated homepage
```

#### ❌ Signs of Callback Loop:
1. **Repeating URLs**: Same URL appears multiple times
2. **ALB URLs**: Seeing `dev-amplifygenai-alb-1330217324.us-east-1.elb.amazonaws.com` in redirects
3. **Endless redirects**: More than 10 redirects
4. **Failed state checks**: Callback returns to signin instead of homepage
5. **Browser error**: "ERR_TOO_MANY_REDIRECTS"

### 4. Key Headers to Examine

Click on any request and check the **Headers** tab:

#### Request Headers (what browser sends):
```
Host: hfu-amplify.org
Cookie: next-auth.session-token=xxx
X-Forwarded-Proto: https
X-Forwarded-Host: hfu-amplify.org
```

#### Response Headers (what server returns):
```
Location: <redirect URL>
Set-Cookie: next-auth.callback-url=xxx
Set-Cookie: next-auth.csrf-token=xxx
```

### 5. Common Issues and Their Network Signatures

#### Issue 1: ALB URL in Redirects
**Network signature**: 
- Location header contains `elb.amazonaws.com`
- Host header shows ALB domain

**Example**:
```
Location: https://dev-amplifygenai-alb-1330217324.us-east-1.elb.amazonaws.com/api/auth/callback/cognito
```

#### Issue 2: Infinite Redirect Loop
**Network signature**:
- Same sequence of URLs repeating
- Status codes all 302/301
- No final 200 status

**Example pattern**:
```
/api/auth/signin → /api/auth/callback/cognito → /api/auth/signin → (repeats)
```

#### Issue 3: State Mismatch
**Network signature**:
- Callback returns 302 to error page
- Query parameters show `error=OAuthCallbackError`

### 6. Using Browser Console

While on Network tab, also check Console for errors:

```javascript
// Common console errors during auth issues:
"Failed to fetch"
"NextAuth error: OAuthCallbackError"
"Too many redirects"
```

### 7. Export Network Log

To share debugging info:
1. Right-click in Network tab
2. Select "Save all as HAR with content"
3. This creates a file with all network activity
4. **IMPORTANT**: Remove sensitive data (tokens, cookies) before sharing

### 8. Quick Debugging Checklist

- [ ] Network tab shows "Preserve log" is checked
- [ ] First request goes to `/api/auth/signin`
- [ ] Redirects use `hfu-amplify.org` domain (not ALB)
- [ ] Cognito redirect_uri parameter shows correct domain
- [ ] No URL appears more than once in the flow
- [ ] Final destination is the app homepage
- [ ] Total redirects < 10
- [ ] No console errors about authentication

### 9. Advanced Debugging with cURL

Replicate what you see in browser with cURL:

```bash
# Follow the exact redirect chain from browser
curl -v -L -c cookies.txt -b cookies.txt https://hfu-amplify.org/api/auth/signin
```

Compare browser vs cURL results to identify client-specific issues.

### 10. Recording a Session for Support

If you need to document an issue:

1. **Video Recording**:
   - Use Chrome DevTools Recorder
   - Or screen recording software
   - Show both Network tab and main window

2. **HAR File**:
   - Export as described above
   - Sanitize sensitive data

3. **Screenshots**:
   - Capture each redirect in sequence
   - Include both Headers and Response tabs
   - Highlight any error messages

Remember: The Network tab is your best friend for debugging authentication flows!