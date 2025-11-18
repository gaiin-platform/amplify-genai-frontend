# White Labeling Code Examples

This document provides practical examples of how to use the white labeling utilities throughout your application.

## Basic Usage

### Using the Brand Config Hook

```typescript
import { useBrandConfig } from '@/utils/app/branding';
import Image from 'next/image';

function MyComponent() {
  const brandConfig = useBrandConfig();
  
  return (
    <div>
      <Image 
        src={brandConfig.logo} 
        alt="Company Logo" 
        width={150} 
        height={150}
      />
      <button 
        style={{ backgroundColor: brandConfig.primaryColor }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = brandConfig.hoverColor}
      >
        Click Me
      </button>
    </div>
  );
}
```

### Using Brand Button Styles

```typescript
import { useBrandButtonStyles } from '@/utils/app/brandColors';

function LoginButton() {
  const buttonStyles = useBrandButtonStyles();
  
  return (
    <button
      style={buttonStyles.base}
      onMouseOver={buttonStyles.onMouseOver}
      onMouseOut={buttonStyles.onMouseOut}
    >
      Login
    </button>
  );
}
```

### Using Tailwind Classes

```tsx
// In your component
<button className="bg-brand-primary hover:bg-brand-hover text-white px-4 py-2 rounded">
  Submit
</button>

// For borders
<div className="border-2 border-brand-primary">
  Content
</div>

// For text color
<h1 className="text-brand-primary">
  Welcome
</h1>
```

## Advanced Usage

### Creating Color Variations

```typescript
import { lightenColor, darkenColor } from '@/utils/app/brandColors';
import { useBrandConfig } from '@/utils/app/branding';

function ColorVariations() {
  const { primaryColor } = useBrandConfig();
  
  const lightVariant = lightenColor(primaryColor, 20);
  const darkVariant = darkenColor(primaryColor, 20);
  
  return (
    <div>
      <div style={{ backgroundColor: lightVariant }}>Light</div>
      <div style={{ backgroundColor: primaryColor }}>Normal</div>
      <div style={{ backgroundColor: darkVariant }}>Dark</div>
    </div>
  );
}
```

### Using CSS Variables

```typescript
import { getBrandColorCSSVars } from '@/utils/app/brandColors';

function GlobalStyles() {
  const cssVars = getBrandColorCSSVars();
  
  return (
    <style jsx global>{`
      :root {
        --brand-primary: ${cssVars['--brand-primary']};
        --brand-hover: ${cssVars['--brand-hover']};
      }
      
      .custom-button {
        background-color: var(--brand-primary);
      }
      
      .custom-button:hover {
        background-color: var(--brand-hover);
      }
    `}</style>
  );
}
```

### Server-Side Usage

```typescript
import { getBrandConfig } from '@/utils/app/branding';
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  const brandConfig = getBrandConfig();
  
  return {
    props: {
      brandLogo: brandConfig.logo,
      brandColor: brandConfig.primaryColor,
    },
  };
};
```

## Component Examples

### Custom Header with Brand Logo

```typescript
import { useBrandConfig } from '@/utils/app/branding';
import Image from 'next/image';

export function BrandedHeader() {
  const { logo, primaryColor } = useBrandConfig();
  
  return (
    <header 
      className="flex items-center justify-between p-4"
      style={{ borderBottom: `3px solid ${primaryColor}` }}
    >
      <Image src={logo} alt="Logo" width={100} height={100} />
      <nav>
        <a 
          href="/home" 
          className="hover:opacity-80"
          style={{ color: primaryColor }}
        >
          Home
        </a>
      </nav>
    </header>
  );
}
```

### Branded Loading Spinner

```typescript
import { useBrandConfig } from '@/utils/app/branding';
import { IconLoader2 } from '@tabler/icons-react';

export function BrandedSpinner() {
  const { primaryColor } = useBrandConfig();
  
  return (
    <div className="flex items-center justify-center">
      <IconLoader2 
        className="animate-spin" 
        size={48}
        style={{ color: primaryColor }}
      />
    </div>
  );
}
```

### Branded Card Component

```typescript
import { useBrandConfig } from '@/utils/app/branding';
import { ReactNode } from 'react';

interface BrandedCardProps {
  title: string;
  children: ReactNode;
}

export function BrandedCard({ title, children }: BrandedCardProps) {
  const { primaryColor } = useBrandConfig();
  
  return (
    <div className="border rounded-lg overflow-hidden shadow-lg">
      <div 
        className="px-4 py-3 text-white font-bold"
        style={{ backgroundColor: primaryColor }}
      >
        {title}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}
```

### Branded Alert Component

```typescript
import { useBrandConfig } from '@/utils/app/branding';
import { lightenColor } from '@/utils/app/brandColors';

interface BrandedAlertProps {
  message: string;
  type?: 'info' | 'success' | 'warning';
}

export function BrandedAlert({ message, type = 'info' }: BrandedAlertProps) {
  const { primaryColor } = useBrandConfig();
  const backgroundColor = lightenColor(primaryColor, 40);
  
  return (
    <div 
      className="p-4 rounded border-l-4"
      style={{ 
        backgroundColor,
        borderLeftColor: primaryColor 
      }}
    >
      <p style={{ color: primaryColor }}>{message}</p>
    </div>
  );
}
```

## Styling Patterns

### Pattern 1: Inline Styles with Brand Colors

```typescript
const { primaryColor, hoverColor } = useBrandConfig();

<button
  style={{
    backgroundColor: primaryColor,
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
  }}
  onMouseOver={(e) => e.currentTarget.style.backgroundColor = hoverColor}
  onMouseOut={(e) => e.currentTarget.style.backgroundColor = primaryColor}
>
  Action
</button>
```

### Pattern 2: Tailwind with Custom Classes

```typescript
// In your component
<button className="btn-brand">
  Action
</button>

// In your global CSS or styled-components
.btn-brand {
  @apply px-4 py-2 rounded font-bold text-white;
  background-color: var(--brand-primary);
}

.btn-brand:hover {
  background-color: var(--brand-hover);
}
```

### Pattern 3: Styled Components

```typescript
import styled from 'styled-components';
import { useBrandConfig } from '@/utils/app/branding';

const BrandButton = styled.button<{ $primaryColor: string; $hoverColor: string }>`
  background-color: ${props => props.$primaryColor};
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;
  
  &:hover {
    background-color: ${props => props.$hoverColor};
  }
`;

function MyComponent() {
  const { primaryColor, hoverColor } = useBrandConfig();
  
  return (
    <BrandButton $primaryColor={primaryColor} $hoverColor={hoverColor}>
      Click Me
    </BrandButton>
  );
}
```

## Testing Your White Label Implementation

### Test Component

```typescript
import { useBrandConfig } from '@/utils/app/branding';

export function BrandingTest() {
  const brandConfig = useBrandConfig();
  
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Branding Test Page</h1>
      
      <div>
        <h2 className="text-xl mb-2">Logo</h2>
        <img src={brandConfig.logo} alt="Brand Logo" width={150} height={150} />
      </div>
      
      <div>
        <h2 className="text-xl mb-2">Colors</h2>
        <div className="flex gap-4">
          <div>
            <p>Primary</p>
            <div 
              className="w-24 h-24 rounded"
              style={{ backgroundColor: brandConfig.primaryColor }}
            />
            <p className="text-sm">{brandConfig.primaryColor}</p>
          </div>
          <div>
            <p>Hover</p>
            <div 
              className="w-24 h-24 rounded"
              style={{ backgroundColor: brandConfig.hoverColor }}
            />
            <p className="text-sm">{brandConfig.hoverColor}</p>
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-xl mb-2">Button Test</h2>
        <button
          className="px-4 py-2 rounded text-white font-bold"
          style={{ backgroundColor: brandConfig.primaryColor }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = brandConfig.hoverColor}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = brandConfig.primaryColor}
        >
          Test Button
        </button>
      </div>
    </div>
  );
}
```

## Best Practices

1. **Consistency**: Use the brand config utilities consistently across your app
2. **Fallbacks**: Always provide fallback colors in case env vars aren't set
3. **Accessibility**: Ensure color contrast meets WCAG standards
4. **Performance**: Use CSS variables for frequently used colors
5. **Testing**: Create a test page to verify all brand elements
6. **Documentation**: Document any custom brand implementations for your team

## Migration Guide

If you have existing hardcoded colors (like `#48bb78`), replace them:

**Before:**
```typescript
<button style={{ backgroundColor: '#48bb78' }}>
  Click
</button>
```

**After:**
```typescript
const { primaryColor } = useBrandConfig();

<button style={{ backgroundColor: primaryColor }}>
  Click
</button>
```

Or use Tailwind:
```typescript
<button className="bg-brand-primary hover:bg-brand-hover">
  Click
</button>
```
