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

const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'warm-browns',
    name: 'Warm Browns',
    userPrimary: '#B45309',
    userSecondary: '#92400E',
    assistantPrimary: '#CA8A04',
    assistantSecondary: '#A16207',
  },
  {
    id: 'blue-green',
    name: 'Blue & Green',
    userPrimary: '#3B82F6',
    userSecondary: '#1E3A8A',
    assistantPrimary: '#10B981',
    assistantSecondary: '#047857',
  },
  {
    id: 'purple-pink',
    name: 'Purple & Pink',
    userPrimary: '#8B5CF6',
    userSecondary: '#7C3AED',
    assistantPrimary: '#EC4899',
    assistantSecondary: '#DB2777',
  },
  {
    id: 'cool-grays',
    name: 'Cool Grays',
    userPrimary: '#737373',
    userSecondary: '#525252',
    assistantPrimary: '#9CA3AF',
    assistantSecondary: '#6B7280',
  },
  {
    id: 'ocean-depths',
    name: 'Ocean Depths',
    userPrimary: '#06B6D4',
    userSecondary: '#0891B2',
    assistantPrimary: '#22C55E',
    assistantSecondary: '#15803D',
  },
];

interface ColorPaletteSelectorProps {
  onPaletteChange?: (paletteId: string) => void;
}

export const ColorPaletteSelector: React.FC<ColorPaletteSelectorProps> = ({ onPaletteChange }) => {
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
    onPaletteChange?.(paletteId);
  };

  return (
    <div className="color-palette-selector">
      <div className="color-palette-title">
        <IconPalette size={14} className="enhanced-icon" />
        Chat Colors
      </div>
      <div className="color-palette-grid">
        {COLOR_PALETTES.map((palette) => (
          <button
            key={palette.id}
            className={`color-palette-option ${selectedPalette === palette.id ? 'selected' : ''}`}
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