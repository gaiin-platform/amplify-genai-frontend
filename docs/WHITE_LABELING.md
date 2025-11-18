# White Labeling Guide

This guide explains how to customize the branding of your deployment to match your company's identity.

## Overview

The application supports white labeling through environment variables, allowing you to customize:
- **Logo**: The logo displayed on the login screen
- **Primary Color**: The main brand color used for buttons and interactive elements
- **Hover Color**: The color used when hovering over interactive elements

## Configuration

### Environment Variables

Add the following variables to your `.env.local` file:

```bash
# Logo path relative to /public folder
NEXT_PUBLIC_BRAND_LOGO=/logos/company-logo.svg

# Primary brand color in hex format
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#48bb78

# Secondary brand color for hover states
NEXT_PUBLIC_BRAND_HOVER_COLOR=#38a169
```

### Logo Setup

1. **Add your logo file** to the `public/logos/` directory
   - Supported formats: SVG, PNG, JPG
   - Recommended size: 150x150 pixels
   - Example: `public/logos/company-logo.svg`

2. **Update the environment variable** to point to your logo:
   ```bash
   NEXT_PUBLIC_BRAND_LOGO=/logos/company-logo.svg
   ```

3. **Default logo**: If not configured, the app uses `/logos/default-logo.svg`

### Color Customization

1. **Choose your brand colors** in hex format (e.g., `#525364`)

2. **Set the primary color** for buttons and main interactive elements:
   ```bash
   NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364
   ```

3. **Set the hover color** for button hover states:
   ```bash
   NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d
   ```

4. **Default colors**: 
   - Primary: `#48bb78` (green)
   - Hover: `#38a169` (darker green)

## Usage in Code

### Using Brand Configuration in Components

The branding utility provides a React hook for accessing brand configuration:

```typescript
import { useBrandConfig } from '@/utils/app/branding';

function MyComponent() {
  const brandConfig = useBrandConfig();
  
  return (
    <div>
      <img src={brandConfig.logo} alt="Logo" />
      <button style={{ backgroundColor: brandConfig.primaryColor }}>
        Click Me
      </button>
    </div>
  );
}
```

### Using Tailwind Classes

You can also use Tailwind CSS classes with the brand colors:

```tsx
<button className="bg-brand-primary hover:bg-brand-hover">
  Click Me
</button>
```

## Deployment

### Docker

When deploying with Docker, pass the environment variables:

```bash
docker run -e NEXT_PUBLIC_BRAND_LOGO=/logos/my-logo.svg \
           -e NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364 \
           -e NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d \
           your-image
```

### Kubernetes

Add the environment variables to your deployment manifest:

```yaml
env:
  - name: NEXT_PUBLIC_BRAND_LOGO
    value: "/logos/company-logo.svg"
  - name: NEXT_PUBLIC_BRAND_PRIMARY_COLOR
    value: "#525364"
  - name: NEXT_PUBLIC_BRAND_HOVER_COLOR
    value: "#3d3e4d"
```

### AWS Amplify

Add the environment variables in the Amplify Console:
1. Go to App Settings > Environment variables
2. Add each variable with its value
3. Redeploy your application

## Examples

### Example 1: Blue Theme
```bash
NEXT_PUBLIC_BRAND_LOGO=/logos/acme-logo.svg
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#3b82f6
NEXT_PUBLIC_BRAND_HOVER_COLOR=#2563eb
```

### Example 2: Purple Theme
```bash
NEXT_PUBLIC_BRAND_LOGO=/logos/startup-logo.png
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#8b5cf6
NEXT_PUBLIC_BRAND_HOVER_COLOR=#7c3aed
```

### Example 3: Corporate Gray
```bash
NEXT_PUBLIC_BRAND_LOGO=/logos/enterprise-logo.svg
NEXT_PUBLIC_BRAND_PRIMARY_COLOR=#525364
NEXT_PUBLIC_BRAND_HOVER_COLOR=#3d3e4d
```

## Testing

After configuration:

1. **Restart your development server**:
   ```bash
   npm run dev
   ```

2. **Clear your browser cache** to see the changes

3. **Test the login screen** to verify:
   - Logo displays correctly
   - Button colors match your brand
   - Hover states work as expected

## Troubleshooting

### Logo not displaying
- Verify the file exists in `public/logos/`
- Check the path starts with `/logos/` not `public/logos/`
- Ensure the file format is supported (SVG, PNG, JPG)
- Clear browser cache and restart dev server

### Colors not applying
- Verify hex format includes the `#` symbol
- Restart the development server after changing env variables
- Check that variables start with `NEXT_PUBLIC_`
- Clear browser cache

### Changes not visible
- Environment variables require a server restart
- Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)
- Verify `.env.local` is in the root directory
- Check that the file is not named `.env.local.example`

## Best Practices

1. **Logo files**: Use SVG format for best quality at any size
2. **Color contrast**: Ensure sufficient contrast for accessibility
3. **Testing**: Test in both light and dark modes
4. **Version control**: Don't commit `.env.local` - use `.env.local.example` as a template
5. **Documentation**: Document your brand colors for your team

## Support

For additional customization needs or issues, please refer to the main documentation or contact your development team.
