import { IconInfoCircle } from '@tabler/icons-react';
import { FC, ReactElement, useState } from 'react';


interface Props {
  content: ReactElement;
  size?: number;
  color?: string;
  rounded?: boolean;
  padding?: string;
}

export const InfoBox: FC<Props> = ({content, size=20, color = "#7b7e96", rounded=false, padding=""}) => {
  // Parse color to RGB values for CSS custom properties
  const getRGBValues = (hexColor: string) => {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  };

  const rgbValues = getRGBValues(color);

  return (
    <div 
      className={`info-banner ${rounded ? 'rounded-lg' : ''} ${padding}`}
      style={{
        '--info-color-rgb': rgbValues,
        '--info-color-hex': color
      } as React.CSSProperties}
    >
            <div className={"info-icon"}>
              <IconInfoCircle size={size} />
            </div>
            {content}
      </div>
  )
}