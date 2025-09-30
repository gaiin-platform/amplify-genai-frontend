// Client-side model override to ensure all providers are available
// This runs before the main app loads
(function() {
  if (typeof window !== 'undefined') {
    // Store the original fetch
    const originalFetch = window.fetch;
    
    // Override fetch for model endpoints
    window.fetch = function(...args) {
      const url = args[0];
      
      // Intercept calls to get available models
      if (typeof url === 'string' && url.includes('/available_models')) {
        console.log('Intercepting model fetch, ensuring all providers are available');
        
        // Call original fetch
        return originalFetch.apply(this, args).then(response => {
          // Clone response to read it
          return response.json().then(data => {
            // Check if we need to add missing providers
            if (data.success && data.data && data.data.models) {
              const models = data.data.models;
              const hasOpenAI = models.some(m => m.provider === 'openai');
              const hasGemini = models.some(m => m.provider === 'gemini');
              
              // Add missing providers
              if (!hasOpenAI) {
                models.push(
                  {
                    id: 'gpt-3.5-turbo',
                    name: 'GPT-3.5 Turbo',
                    provider: 'openai',
                    description: 'OpenAI GPT-3.5 Turbo - Fast and efficient',
                    inputContextWindow: 16385,
                    outputTokenLimit: 4096,
                    supportsImages: false,
                    supportsReasoning: false,
                    inputTokenCost: 0.0005,
                    outputTokenCost: 0.0015,
                    cachedTokenCost: 0.0
                  },
                  {
                    id: 'gpt-4',
                    name: 'GPT-4',
                    provider: 'openai',
                    description: 'OpenAI GPT-4 - Advanced reasoning',
                    inputContextWindow: 8192,
                    outputTokenLimit: 4096,
                    supportsImages: false,
                    supportsReasoning: true,
                    inputTokenCost: 0.03,
                    outputTokenCost: 0.06,
                    cachedTokenCost: 0.0
                  }
                );
              }
              
              if (!hasGemini) {
                models.push(
                  {
                    id: 'gemini-1.5-flash',
                    name: 'Gemini 1.5 Flash',
                    provider: 'gemini',
                    description: 'Google Gemini 1.5 Flash - Fast multimodal',
                    inputContextWindow: 1048576,
                    outputTokenLimit: 8192,
                    supportsImages: true,
                    supportsReasoning: false,
                    inputTokenCost: 0.00035,
                    outputTokenCost: 0.0007,
                    cachedTokenCost: 0.0001
                  },
                  {
                    id: 'gemini-1.5-pro',
                    name: 'Gemini 1.5 Pro',
                    provider: 'gemini',
                    description: 'Google Gemini 1.5 Pro - Advanced multimodal',
                    inputContextWindow: 2097152,
                    outputTokenLimit: 8192,
                    supportsImages: true,
                    supportsReasoning: true,
                    inputTokenCost: 0.00125,
                    outputTokenCost: 0.005,
                    cachedTokenCost: 0.0005
                  }
                );
              }
            }
            
            // Return modified response
            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          });
        });
      }
      
      // For all other requests, use original fetch
      return originalFetch.apply(this, args);
    };
  }
})();