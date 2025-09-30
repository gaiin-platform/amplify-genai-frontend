// Global fix for hasOwnProperty errors
// This ensures objects always have hasOwnProperty available

export const initializeHasOwnPropertyFix = () => {
  if (typeof window === 'undefined') return;

  // Store original hasOwnProperty
  const originalHasOwnProperty = Object.prototype.hasOwnProperty;

  // Override Object.prototype.hasOwnProperty to be more defensive
  Object.defineProperty(Object.prototype, 'hasOwnProperty', {
    value: function(prop: PropertyKey) {
      // If this is null or undefined, return false
      if (this == null) {
        console.warn('hasOwnProperty called on null or undefined');
        return false;
      }
      
      // Use the original hasOwnProperty
      return originalHasOwnProperty.call(this, prop);
    },
    writable: true,
    configurable: true
  });

  // Also provide a global safe hasOwnProperty function
  (window as any).safeHasOwnProperty = (obj: any, prop: PropertyKey): boolean => {
    if (obj == null) return false;
    return originalHasOwnProperty.call(obj, prop);
  };
};

// Safe hasOwnProperty helper
export const safeHasOwnProperty = (obj: any, prop: PropertyKey): boolean => {
  if (obj == null) return false;
  return Object.prototype.hasOwnProperty.call(obj, prop);
};