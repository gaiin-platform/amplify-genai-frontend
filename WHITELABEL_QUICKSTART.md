# White Label Quick Start

## 🎨 Customize Your Branding in 3 Steps

### Step 1: Add Your Logo
Place your logo file in `public/logos/`:
```bash
public/logos/your-company-logo.svg
```

### Step 2: Configure Environment Variables
Add to `.env.local`:
```bash
# Your company logo
NEXT_PUBLIC_BRAND_LOGO=/logos/your-company-logo.svg

# Your brand colors (hex format)
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364
NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d
```

### Step 3: Restart & Test
```bash
npm run dev
```

Visit the login screen to see your branding!

---

## 📋 What Gets Customized

✅ Login screen logo  
✅ Login button primary color  
✅ Login button hover color  
✅ Brand colors available throughout the app via Tailwind classes

## 🔧 Files Modified

- `.env.local.example` - Added white label environment variables
- `utils/app/branding.ts` - New branding configuration utility
- `pages/api/home/home.tsx` - Updated login screen with configurable logo/colors
- `pages/assistants/[assistantSlug].tsx` - Updated assistant login screen
- `tailwind.config.js` - Added brand color theme support
- `public/logos/default-logo.svg` - Default logo file

## 📚 Full Documentation

See `docs/WHITE_LABELING.md` for complete details, examples, and troubleshooting.

## 🎯 Example Configurations

**Tech Startup (Blue)**
```bash
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#3b82f6
NEXT_PUBLIC_BRAND_HOVER_COLOR=#2563eb
```

**Enterprise (Gray)**
```bash
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364
NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d
```

**Creative Agency (Purple)**
```bash
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#8b5cf6
NEXT_PUBLIC_BRAND_HOVER_COLOR=#7c3aed
```
