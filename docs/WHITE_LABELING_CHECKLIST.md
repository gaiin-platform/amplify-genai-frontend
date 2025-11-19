# White Labeling Implementation Checklist

Use this checklist to ensure your white labeling implementation is complete and working correctly.

## Pre-Implementation

- [ ] Review the white labeling documentation (`docs/WHITE_LABELING.md`)
- [ ] Identify your brand colors (primary and hover)
- [ ] Prepare your logo file (SVG recommended, 150x150px)
- [ ] Determine deployment environment (Docker, K8s, Amplify, etc.)

## Logo Setup

- [ ] Logo file is in the correct format (SVG, PNG, or JPG)
- [ ] Logo file is placed in `public/logos/` directory
- [ ] Logo file name is documented
- [ ] Logo displays correctly at 150x150 pixels
- [ ] Logo works on both light and dark backgrounds

## Environment Configuration

- [ ] `NEXT_PUBLIC_BRAND_LOGO` is set with correct path
- [ ] `NEXT_PUBLIC_BRAND_PRIMARY_COLOR` is set with hex color
- [ ] `NEXT_PUBLIC_BRAND_HOVER_COLOR` is set with hex color
- [ ] `NEXT_PUBLIC_BRAND_DARK_BG` is set with hex color for dark mode background color
- [ ] All environment variables start with `NEXT_PUBLIC_`
- [ ] Hex colors include the `#` symbol

## Testing - Local Development

- [ ] Development server restarted after env changes
- [ ] Browser cache cleared
- [ ] Login screen displays custom logo
- [ ] Login button shows primary color
- [ ] Login button hover shows hover color
- [ ] Assistant login screen displays custom logo
- [ ] Assistant login button colors work correctly
- [ ] No console errors related to branding

## Testing - Visual Verification

- [ ] Logo is centered and properly sized
- [ ] Logo is not distorted or pixelated
- [ ] Primary color has sufficient contrast with white text
- [ ] Hover color is visually distinct from primary color
- [ ] Colors match brand guidelines
- [ ] Tested in Chrome/Edge
- [ ] Tested in Firefox
- [ ] Tested in Safari
- [ ] Tested on mobile devices

## Testing - Accessibility

- [ ] Color contrast ratio meets WCAG AA standards (4.5:1 for normal text)
- [ ] Logo has appropriate alt text
- [ ] Interactive elements are keyboard accessible
- [ ] Focus states are visible
- [ ] Screen reader testing completed

## Deployment Configuration

### Docker
- [ ] Environment variables added to Dockerfile or docker-compose.yml
- [ ] Logo file included in Docker image
- [ ] Container tested with brand configuration
- [ ] Image rebuilt after changes

### Kubernetes
- [ ] Environment variables added to deployment manifest
- [ ] ConfigMap created if needed
- [ ] Logo file accessible in pod
- [ ] Deployment tested in staging environment

### AWS Amplify
- [ ] Environment variables added in Amplify Console
- [ ] Logo file committed to repository
- [ ] Build completed successfully
- [ ] Deployed app tested

### Other Platforms
- [ ] Platform-specific environment variable configuration completed
- [ ] Logo file deployment verified
- [ ] Application tested in production-like environment

## Documentation

- [ ] Team members informed of white labeling capabilities
- [ ] Brand colors documented in team wiki/docs
- [ ] Logo usage guidelines shared
- [ ] Deployment process documented
- [ ] Troubleshooting guide accessible

## Code Integration (Optional)

If extending white labeling to other components:

- [ ] Import `useBrandConfig` hook where needed
- [ ] Replace hardcoded colors with brand config
- [ ] Update Tailwind classes to use `bg-brand-primary`
- [ ] Test all modified components
- [ ] Update component documentation

## Production Readiness

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No console warnings
- [ ] Performance impact assessed
- [ ] Staging environment approved
- [ ] Stakeholder sign-off received

## Post-Deployment

- [ ] Production deployment verified
- [ ] Logo displays correctly in production
- [ ] Colors match brand guidelines in production
- [ ] No errors in production logs
- [ ] User acceptance testing completed
- [ ] Monitoring alerts configured
- [ ] Rollback plan documented

## Maintenance

- [ ] Process for updating logo documented
- [ ] Process for changing colors documented
- [ ] Brand guidelines kept up to date
- [ ] Regular visual regression testing scheduled

## Troubleshooting Completed

If you encountered issues, verify these were resolved:

- [ ] Logo not displaying → Path corrected
- [ ] Colors not applying → Server restarted
- [ ] Changes not visible → Cache cleared
- [ ] Build errors → TypeScript issues resolved
- [ ] Environment variables not loading → Prefix verified

## Sign-Off

- [ ] Developer: _________________ Date: _______
- [ ] QA: _________________ Date: _______
- [ ] Product Owner: _________________ Date: _______
- [ ] Stakeholder: _________________ Date: _______

## Notes

Use this section to document any custom implementations, issues encountered, or deviations from the standard setup:

```
[Add your notes here]
```

---

**Quick Reference:**
- Documentation: `docs/WHITE_LABELING.md`
- Quick Start: `WHITELABEL_QUICKSTART.md`
- Examples: `docs/WHITE_LABELING_EXAMPLES.md`
- Utilities: `utils/app/branding.ts`, `utils/app/brandColors.ts`
