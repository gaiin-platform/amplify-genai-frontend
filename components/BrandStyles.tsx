import { useBrandConfig } from '@/utils/app/branding';
import { useEffect } from 'react';

/**
 * Component that injects brand colors as CSS variables
 * Include this once in your app layout
 */
export const BrandStyles = () => {
  const brandConfig = useBrandConfig();
  
  useEffect(() => {
    // Set CSS variables on the root element
    document.documentElement.style.setProperty('--brand-primary', brandConfig.primaryColor);
    document.documentElement.style.setProperty('--brand-hover', brandConfig.hoverColor);
    document.documentElement.style.setProperty('--brand-dark-bg', brandConfig.darkBackground);
    
    console.log('Brand colors set:', {
      primary: brandConfig.primaryColor,
      hover: brandConfig.hoverColor,
      darkBg: brandConfig.darkBackground
    });
  }, [brandConfig]);

  return (
    <style dangerouslySetInnerHTML={{
      __html: `
        /* Brand color overrides */
        .dark,
        .dark body,
        html.dark {
          background-color: ${brandConfig.darkBackground} !important;
        }
        
        /* Override all Tailwind dark background classes */
        .dark [class*="bg-[#343541]"],
        .dark [class*="bg-[#202123]"],
        .dark [class*="bg-[#444654]"],
        .dark [class*="bg-[#40414"],
        .dark [class*="bg-[#3d3e4c]"] {
          background-color: ${brandConfig.darkBackground} !important;
        }
        
        /* Override specific Tailwind classes */
        .dark .dark\\:bg-\\[\\#343541\\],
        .dark .dark\\:bg-\\[\\#202123\\],
        .dark .dark\\:bg-\\[\\#444654\\],
        .dark .dark\\:bg-\\[\\#40414F\\],
        .dark .dark\\:bg-\\[\\#40414f\\],
        .dark .dark\\:bg-\\[\\#3d3e4c\\] {
          background-color: ${brandConfig.darkBackground} !important;
        }
        
        /* Override component backgrounds */
        .dark .amplify-sidebar,
        .dark .amplify-header,
        .dark .amplify-assistant-message {
          background-color: ${brandConfig.darkBackground} !important;
        }
      `
    }} />
  );
};
