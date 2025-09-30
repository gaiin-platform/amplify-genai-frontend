# Quality Assurance Checklist for Authentication Fix

## Pre-Deployment Verification

### Environment Configuration
- [ ] `.env.production` file contains correct values
  - [ ] `NEXTAUTH_URL=https://hfu-amplify.org` (NOT the ALB URL)
  - [ ] `COGNITO_CLIENT_ID=2rq8ekafegrh5mcd51q80rt0bh`
  - [ ] `COGNITO_CLIENT_SECRET` is present and correct
  - [ ] `COGNITO_ISSUER` points to correct Cognito pool
  - [ ] `COGNITO_DOMAIN` is set correctly

### Code Changes Verification
- [ ] `[...nextauth].ts` includes the header handling fix
- [ ] `getCorrectUrl` function is implemented
- [ ] `trustHost: true` is set in authOptions
- [ ] Debug logging is enabled for troubleshooting
- [ ] Dynamic NEXTAUTH_URL setting is in place

### Build Verification
- [ ] `npm run build` completes without errors
- [ ] No TypeScript errors in build output
- [ ] Build size is reasonable (no unexpected increases)
- [ ] All dependencies are resolved

## Deployment Verification

### Docker Image
- [ ] Docker image builds successfully
- [ ] Image is tagged with correct version/latest
- [ ] Image pushed to ECR successfully
- [ ] ECR shows new image timestamp

### ECS Service Update
- [ ] ECS service update initiated
- [ ] New task definition created
- [ ] Tasks are transitioning to RUNNING state
- [ ] Old tasks are draining properly
- [ ] Target group shows healthy targets

### Infrastructure Validation
- [ ] ALB health checks passing
- [ ] DNS resolves correctly to ALB
- [ ] SSL certificate is valid and active
- [ ] Route 53 records point to correct ALB

## Functional Testing

### Basic Authentication Flow
- [ ] Homepage loads without authentication
- [ ] Login button is visible and clickable
- [ ] Clicking login redirects to Cognito
- [ ] Cognito login page displays correctly
- [ ] Redirect URI in Cognito URL is `https://hfu-amplify.org/api/auth/callback/cognito`

### Login Process
- [ ] Valid credentials allow login
- [ ] Invalid credentials show error message
- [ ] After successful login, user returns to hfu-amplify.org
- [ ] User's name/email displayed in UI
- [ ] Session cookie is set correctly

### Callback Handling
- [ ] No infinite redirect loops
- [ ] Callback URL uses custom domain (not ALB)
- [ ] State parameter is validated correctly
- [ ] No "too many redirects" browser errors

### Session Management
- [ ] Session persists across page refreshes
- [ ] Session API endpoint returns user data when logged in
- [ ] Protected routes require authentication
- [ ] Session timeout redirects to login

### Logout Functionality
- [ ] Logout button is accessible
- [ ] Clicking logout clears session
- [ ] User redirected to homepage after logout
- [ ] Cannot access protected routes after logout
- [ ] Cognito session also terminated

## Cross-Browser Testing

### Desktop Browsers
- [ ] Chrome/Chromium (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Microsoft Edge (latest)

### Mobile Browsers
- [ ] iOS Safari
- [ ] Chrome on Android
- [ ] Samsung Internet Browser

### Browser-Specific Checks
- [ ] Cookies enabled works correctly
- [ ] Third-party cookies blocked handles gracefully
- [ ] Private/Incognito mode works
- [ ] No browser console errors

## Performance Testing

### Load Times
- [ ] Homepage loads < 3 seconds
- [ ] Login redirect < 2 seconds
- [ ] Complete auth flow < 10 seconds
- [ ] No unnecessary redirects

### Network Efficiency
- [ ] Minimal redirect chain (< 5 redirects)
- [ ] Proper caching headers set
- [ ] No duplicate requests
- [ ] Efficient cookie usage

## Security Testing

### Authentication Security
- [ ] HTTPS enforced throughout flow
- [ ] Secure cookie flags set
- [ ] CSRF protection active
- [ ] State parameter prevents CSRF
- [ ] No sensitive data in URLs

### Error Handling
- [ ] Auth errors don't expose system details
- [ ] Failed logins don't reveal valid usernames
- [ ] Rate limiting prevents brute force
- [ ] Session fixation prevented

## Monitoring & Logging

### Application Logs
- [ ] NextAuth debug logs show correct URLs
- [ ] No error logs during normal operation
- [ ] Header values logged correctly
- [ ] Performance metrics captured

### Infrastructure Monitoring
- [ ] CloudWatch alarms configured
- [ ] ALB metrics look normal
- [ ] ECS task metrics stable
- [ ] No spike in 4xx/5xx errors

### User Experience Monitoring
- [ ] No increase in support tickets
- [ ] User feedback positive
- [ ] Analytics show normal patterns
- [ ] No drop in user engagement

## Rollback Readiness

### Rollback Plan
- [ ] Previous ECS task definition noted
- [ ] Rollback procedure documented
- [ ] Team aware of rollback process
- [ ] Rollback tested in staging

### Post-Deployment Monitoring
- [ ] Monitor for 24 hours post-deployment
- [ ] Check logs every 2 hours initially
- [ ] User feedback channel active
- [ ] On-call engineer designated

## Sign-Off

### Technical Lead
- [ ] Code review completed
- [ ] Architecture approved
- [ ] Performance acceptable
- Name: _________________ Date: _________

### QA Engineer
- [ ] All tests passed
- [ ] No critical issues found
- [ ] User experience validated
- Name: _________________ Date: _________

### Operations
- [ ] Deployment successful
- [ ] Monitoring in place
- [ ] Rollback plan ready
- Name: _________________ Date: _________

### Product Owner
- [ ] Feature works as expected
- [ ] User impact acceptable
- [ ] Business requirements met
- Name: _________________ Date: _________

## Post-Deployment Tasks

### Documentation
- [ ] Update deployment runbook
- [ ] Document any issues encountered
- [ ] Update architecture diagrams
- [ ] Create knowledge base article

### Cleanup
- [ ] Remove debug logging if enabled
- [ ] Clean up test accounts
- [ ] Archive deployment artifacts
- [ ] Update JIRA/tracking tickets

### Lessons Learned
- [ ] Hold retrospective meeting
- [ ] Document improvement suggestions
- [ ] Update testing procedures
- [ ] Share knowledge with team

---

**Deployment Status**: ⬜ Not Started | ⬜ In Progress | ⬜ Completed | ⬜ Rolled Back

**Overall Result**: ⬜ Success | ⬜ Partial Success | ⬜ Failed

**Notes**:
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________