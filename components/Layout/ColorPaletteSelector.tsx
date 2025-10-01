import React, { useState, useEffect } from 'react';
import { IconPalette } from '@tabler/icons-react';

export interface ColorPalette {
  id: string;
  name: string;
  userPrimary: string;
  userSecondary: string;
  assistantPrimary: string;
  assistantSecondary: string;
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'warm-browns',
    name: 'Warm Browns',
    userPrimary: '#B45309',
    userSecondary: '#FBD570',
    assistantPrimary: '#CA8A04',
    assistantSecondary: '#FEF08A',
  },
  {
    id: 'blue-green',
    name: 'Blue & Green',
    userPrimary: '#3B82F6',
    userSecondary: '#22C55E',
    assistantPrimary: '#10B981',
    assistantSecondary: '#A7F3D0',
  },
  {
    id: 'purple-pink',
    name: 'Purple & Pink',
    userPrimary: '#8B5CF6',
    userSecondary: '#C4B5FD',
    assistantPrimary: '#E879F9',
    assistantSecondary: '#F699CE',
  },
  {
    id: 'cool-grays',
    name: 'Cool Grays',
    userPrimary: '#4B5563',
    userSecondary: '#D1D5DB',
    assistantPrimary: '#6B7280',
    assistantSecondary: '#E5E7EB',
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    userPrimary: '#06B6D4',
    userSecondary: '#93C5FD',
    assistantPrimary: '#22C55E',
    assistantSecondary: '#BBF7D0',
  },
  {
    id: 'high-contrast',
    name: 'High Contrast',
    userPrimary: '#2D2D32',
    userSecondary: '#232328',
    assistantPrimary: '#292524',
    assistantSecondary: '#1C1917',
  },
];

interface ColorPaletteSelectorProps {
  onPaletteChange?: (paletteId: string) => void;
  onToneCycle?: (paletteId: string) => void;
}

export const ColorPaletteSelector: React.FC<ColorPaletteSelectorProps> = ({ onPaletteChange, onToneCycle }) => {
  const [selectedPalette, setSelectedPalette] = useState('warm-browns');

  useEffect(() => {
    // Load saved palette from localStorage
    const savedPalette = localStorage.getItem('chatColorPalette');
    if (savedPalette && COLOR_PALETTES.find(p => p.id === savedPalette)) {
      setSelectedPalette(savedPalette);
      applyChatPalette(savedPalette);
    }
  }, []);

  const applyChatPalette = (paletteId: string) => {
    document.body.setAttribute('data-chat-palette', paletteId);
    localStorage.setItem('chatColorPalette', paletteId);
  };

  const handlePaletteSelect = (paletteId: string) => {
    setSelectedPalette(paletteId);
    applyChatPalette(paletteId);
    
    // Check if this is a click on the same palette (for tone cycling) or different palette
    if (onToneCycle && paletteId === selectedPalette) {
      // Same palette clicked - cycle through tones
      onToneCycle(paletteId);
    } else {
      // Different palette or first time - just change palette
      onPaletteChange?.(paletteId);
      if (onToneCycle) {
        onToneCycle(paletteId);
      }
    }
  };

  return (
    <div className="color-palette-selector">
      <div className="color-palette-title">
        <IconPalette size={14} className="enhanced-icon" />
        Color Scheme
      </div>
      <div className="color-palette-grid">
        {COLOR_PALETTES.map((palette) => (
          <button
            key={palette.id}
            className={`color-palette-option ${selectedPalette === palette.id ? 'selected' : ''}`}
            id={palette.name}
            onClick={() => handlePaletteSelect(palette.id)}
            title={palette.name}
          >
            <div className="color-palette-preview">
              <div 
                className="color-palette-swatch" 
                style={{ backgroundColor: palette.userPrimary }}
              />
              <div 
                className="color-palette-swatch" 
                style={{ backgroundColor: palette.assistantPrimary }}
              />
            </div>
            <div className="color-palette-name">{palette.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ColorPaletteSelector;