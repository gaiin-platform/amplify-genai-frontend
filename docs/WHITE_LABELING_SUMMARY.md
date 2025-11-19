# White Labeling Summary

Simple guide to customizing your app's branding.

## What You Can Customize

### 1. Logo
- **Build arg**: `NEXT_PUBLIC_BRAND_LOGO`
- **Default**: `/favicon.ico`
- **Example**: `/logos/nc-state.svg`
- **Where**: Login screen, loading screens

### 2. Colors
- **File**: `tailwind.config.js`
- **Section**: `theme.extend.colors.brand`
- **Edit directly**: `primary`, `hover`, `dark-bg`

### 3. Default Theme
- **Build arg**: `NEXT_PUBLIC_DEFAULT_THEME`
- **Options**: `light` or `dark`
- **Default**: `dark`

## Quick Start

### 1. Add Your Logo
```bash
cp ~/your-logo.svg public/logos/your-logo.svg
```

### 2. Edit Colors
In `tailwind.config.js`:
```javascript
colors: {
  brand: {
    primary: '#CC0000',
    hover: '#990000',
    
    // Dark mode
    'dark-bg': '#8B0000',
    'dark-sidebar': '#8B0000',
    // ... other dark variants
    
    // Light mode
    'light-bg': '#FFF5F5',
    'light-sidebar': '#FEE2E2',
    // ... other light variants
  },
}
```

### 3. Build

**Local dev:**
```bash
# .env.local
NEXT_PUBLIC_BRAND_LOGO=/logos/your-logo.svg
npm run dev
```

**Docker:**
```bash
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/your-logo.svg \
  --build-arg NEXT_PUBLIC_DEFAULT_THEME=dark \
  -t your-app .
```

## Files Modified

- `tailwind.config.js` - Color definitions
- `utils/app/branding.ts` - Logo utility
- `Dockerfile` - Build args for logo/theme
- `pages/api/home/home.state.tsx` - Default theme
- `utils/app/settings.ts` - Settings default theme
- All component files - Use `dark:bg-brand-dark-bg` classes

