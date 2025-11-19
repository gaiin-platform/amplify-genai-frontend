import { useBrandConfig } from '@/utils/app/branding';

/**
 * Component that injects brand colors as CSS variables
 * Include this once in your app layout
 */
export const BrandStyles = () => {
  const brandConfig = useBrandConfig();

  return (
    <style jsx global>{`
      :root {
        --brand-primary: ${brandConfig.primaryColor};
        --brand-hover: ${brandConfig.hoverColor};
        --brand-dark-bg: ${brandConfig.darkBackground};
      }
      
      /* Override dark mode background colors with brand color */
      .dark .bg-\[#343541\] {
        background-color: ${brandConfig.darkBackground} !important;
      }
      
      .dark.bg-\[#343541\] {
        background-color: ${brandConfig.darkBackground} !important;
      }
    `}</style>
  );
};
