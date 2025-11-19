# White Labeling Summary

This document provides a quick overview of all white labeling capabilities.

## Available Customizations

### 1. Logo
- **Variable**: `NEXT_PUBLIC_BRAND_LOGO`
- **Default**: `/favicon.ico`
- **Example**: `/logos/company-logo.svg`
- **Appears on**: Login screen, loading screens, dialogs

### 2. Primary Brand Color
- **Variable**: `NEXT_PUBLIC_BRAND_PRIMARY_COLOR`
- **Default**: `#48bb78`
- **Example**: `#CC0000`
- **Used for**: Buttons, interactive elements, accents

### 3. Hover Color
- **Variable**: `NEXT_PUBLIC_BRAND_HOVER_COLOR`
- **Default**: `#38a169`
- **Example**: `#990000`
- **Used for**: Button hover states

### 4. Dark Mode Background
- **Variable**: `NEXT_PUBLIC_BRAND_DARK_BG`
- **Default**: `#343541`
- **Example**: `#8B0000`
- **Used for**: All dark mode backgrounds

### 5. Default Theme
- **Variable**: `NEXT_PUBLIC_DEFAULT_THEME`
- **Default**: `dark`
- **Options**: `light` or `dark`
- **Used for**: Initial theme for new users

## Quick Start

### Local Development

Add to `.env.local`:
```bash
NEXT_PUBLIC_BRAND_LOGO=/logos/your-logo.svg
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000
NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000
NEXT_PUBLIC_BRAND_DARK_BG=#8B0000
NEXT_PUBLIC_DEFAULT_THEME=dark
```

### Docker Build

```bash
docker build \
  --build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/your-logo.svg \
  --build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000 \
  --build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000 \
  --build-arg NEXT_PUBLIC_BRAND_DARK_BG=#8B0000 \
  --build-arg NEXT_PUBLIC_DEFAULT_THEME=dark \
  -t your-app:branded \
  .
```

## Files Modified

### Core Implementation
- `utils/app/branding.ts` - Branding configuration utility
- `components/BrandStyles.tsx` - CSS injection for brand colors
- `Dockerfile` - Build arguments for white labeling
- `.env.local.example` - Environment variable examples

### Integration Points
- `pages/api/home/home.tsx` - Main app with BrandStyles
- `pages/api/home/home.state.tsx` - Default theme state
- `pages/assistants/[assistantSlug].tsx` - Assistant login screen
- `components/Loader/LoadingDialog.tsx` - Loading dialog with logo
- `utils/app/settings.ts` - Settings default theme
- `tailwind.config.js` - Brand color theme support

### Assets
- `public/logos/default-logo.svg` - Default logo file
- `public/logos/nc-state.svg` - Example custom logo

## Documentation

- **Quick Start**: `docs/WHITELABEL_QUICKSTART.md`
- **Complete Guide**: `docs/WHITE_LABELING.md`
- **Build Instructions**: `docs/WHITE_LABELING_BUILD.md`
- **Code Examples**: `docs/WHITE_LABELING_EXAMPLES.md`
- **Implementation Checklist**: `docs/WHITE_LABELING_CHECKLIST.md`
- **Default Theme**: `docs/DEFAULT_THEME.md`
- **AWS ECS Deployment**: `docs/DEPLOYMENT_AWS_ECS.md` (Note: ECS Task Definition env vars don't work for NEXT_PUBLIC_* variables)

## Example Configurations

### NC State
```bash
--build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/nc-state.svg
--build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#CC0000
--build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#990000
--build-arg NEXT_PUBLIC_BRAND_DARK_BG=#8B0000
--build-arg NEXT_PUBLIC_DEFAULT_THEME=dark
```

### Corporate Blue
```bash
--build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/company-logo.svg
--build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#0066CC
--build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#0052A3
--build-arg NEXT_PUBLIC_BRAND_DARK_BG=#1A1B26
--build-arg NEXT_PUBLIC_DEFAULT_THEME=light
```

### Tech Startup
```bash
--build-arg NEXT_PUBLIC_BRAND_LOGO=/logos/startup-logo.svg
--build-arg NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#3b82f6
--build-arg NEXT_PUBLIC_BRAND_HOVER_COLOR=#2563eb
--build-arg NEXT_PUBLIC_BRAND_DARK_BG=#1e293b
--build-arg NEXT_PUBLIC_DEFAULT_THEME=dark
```

## Important Notes

1. **Build-time variables**: All `NEXT_PUBLIC_*` variables must be set at Docker build time, not runtime
2. **Rebuild required**: Changes require rebuilding the Docker image
3. **User preferences**: Returning users keep their theme preference regardless of default
4. **Logo location**: Logo files must be in `public/logos/` directory
5. **Color format**: Use hex format with `#` symbol (e.g., `#CC0000`)

## Testing

1. **Build the image** with your brand configuration
2. **Clear browser cache** and localStorage
3. **Test in incognito mode** to see new user experience
4. **Verify all screens**: Login, loading, main app, dialogs
5. **Test both themes**: Switch between light and dark mode

## Support

For issues or questions:
- Check the troubleshooting sections in the documentation
- Verify environment variables are set correctly
- Ensure Docker image was rebuilt after changes
- Clear browser cache and test in incognito mode
