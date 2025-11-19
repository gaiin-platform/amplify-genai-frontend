import { useBrandConfig } from '@/utils/app/branding';

/**
 * Component that injects brand colors as CSS variables
 * Include this once in your app layout
 */
export const BrandStyles = () => {
  const brandConfig = useBrandConfig();
  
  // Convert hex to RGB for Tailwind compatibility
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result 
      ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
      : '52 53 65'; // fallback
  };
  
  const rgbBg = hexToRgb(brandConfig.darkBackground);

  return (
    <style jsx global>{`
      :root {
        --brand-primary: ${brandConfig.primaryColor};
        --brand-hover: ${brandConfig.hoverColor};
        --brand-dark-bg: ${brandConfig.darkBackground};
        --brand-dark-bg-rgb: ${rgbBg};
      }
      
      /* Override all dark mode background colors with brand color */
      .dark .bg-\\[\\#343541\\],
      .dark.bg-\\[\\#343541\\],
      .dark .bg-\\[\\#202123\\],
      .dark.bg-\\[\\#202123\\],
      .dark .bg-\\[\\#444654\\],
      .dark.bg-\\[\\#444654\\],
      .dark .bg-\\[\\#40414F\\],
      .dark.bg-\\[\\#40414F\\],
      .dark .bg-\\[\\#40414f\\],
      .dark.bg-\\[\\#40414f\\],
      .dark .bg-\\[\\#3d3e4c\\],
      .dark.bg-\\[\\#3d3e4c\\] {
        background-color: ${brandConfig.darkBackground} !important;
      }
      
      /* Override Tailwind's RGB format backgrounds */
      .dark [style*="background-color: rgb(52 53 65"],
      .dark [style*="background-color: rgb(52, 53, 65"],
      .dark [style*="background-color: rgb(32 33 35"],
      .dark [style*="background-color: rgb(32, 33, 35"],
      .dark [style*="background-color: rgb(68 70 84"],
      .dark [style*="background-color: rgb(68, 70, 84"],
      .dark [style*="background-color: rgb(64 65 79"],
      .dark [style*="background-color: rgb(64, 65, 79"],
      .dark [style*="background-color: rgb(61 62 76"],
      .dark [style*="background-color: rgb(61, 62, 76"] {
        background-color: ${brandConfig.darkBackground} !important;
      }
      
      /* Override CSS class backgrounds */
      .dark .amplify-sidebar,
      .dark .amplify-header {
        background-color: ${brandConfig.darkBackground} !important;
      }
      
      .dark .amplify-assistant-message {
        background-color: ${brandConfig.darkBackground} !important;
      }
      
      /* Override html background */
      html.dark {
        background-color: ${brandConfig.darkBackground} !important;
      }
      
      /* Override gradient backgrounds in chat input */
      .dark .dark\\:via-\\[\\#343541\\] {
        --tw-gradient-to: ${brandConfig.darkBackground} !important;
        --tw-gradient-from: ${brandConfig.darkBackground} !important;
      }
      
      .dark .dark\\:to-\\[\\#343541\\] {
        --tw-gradient-to: ${brandConfig.darkBackground} !important;
      }
    `}</style>
  );
};
