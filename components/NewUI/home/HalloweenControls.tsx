/**
 * HalloweenControls — the Halloween instance of the shared SeasonalControls
 * corner pill (see SeasonalControls.tsx for behaviour).
 */
import React from 'react';
import { SeasonalControls } from '@/components/NewUI/home/SeasonalControls';
import { HALLOWEEN_CONTROLS } from '@/components/NewUI/home/seasonalControlsConfig';

export const HalloweenControls: React.FC = () => <SeasonalControls config={HALLOWEEN_CONTROLS} />;
