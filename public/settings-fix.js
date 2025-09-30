// Settings fix for localStorage compatibility
(function() {
  try {
    const settingsKey = 'settings';
    const settingsJson = localStorage.getItem(settingsKey);
    
    if (settingsJson) {
      const settings = JSON.parse(settingsJson);
      
      // Ensure featureOptions exists
      if (!settings.featureOptions) {
        settings.featureOptions = {};
        localStorage.setItem(settingsKey, JSON.stringify(settings));
        console.log('Fixed settings: added missing featureOptions');
      }
    }
  } catch (e) {
    console.error('Settings fix error:', e);
  }
})();