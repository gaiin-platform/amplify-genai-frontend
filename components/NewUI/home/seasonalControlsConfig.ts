/**
 * Per-holiday configuration for SeasonalControls (corner pill on the landing
 * page) and the matching Settings → General rows.
 */
import type { SeasonalControlsConfig } from '@/components/NewUI/home/SeasonalControls';
import {
  getHalloweenPartEnabled,
  setHalloweenPartEnabled,
  USER_HALLOWEEN_EFFECTS_CHANGED_EVENT,
} from '@/components/NewUI/shared/userHalloweenEffects';
import {
  getThanksgivingPartEnabled,
  setThanksgivingPartEnabled,
  USER_THANKSGIVING_EFFECTS_CHANGED_EVENT,
} from '@/components/NewUI/shared/userThanksgivingEffects';

export interface SeasonalSettingsCopy {
  themeLabel: string;
  themeHint: string;
  sendLabel: string;
  sendHint: string;
}

export const HALLOWEEN_CONTROLS: SeasonalControlsConfig & { settings: SeasonalSettingsCopy } = {
  idPrefix: 'hw',
  icon: '🎃',
  title: 'Halloween effects',
  themeLabel: 'Halloween theme',
  themeHint: 'Pumpkin, bats, cobweb and fog',
  sendLabel: 'Bat swarm on send',
  sendHint: 'Bats fly across when you send',
  accentRgb: '249,115,22',
  getEnabled: (part) => getHalloweenPartEnabled(part === 'send' ? 'swarm' : 'theme'),
  setEnabled: (part, v) => setHalloweenPartEnabled(part === 'send' ? 'swarm' : 'theme', v),
  changedEvent: USER_HALLOWEEN_EFFECTS_CHANGED_EVENT,
  settings: {
    themeLabel: 'Halloween theme 🎃',
    themeHint: 'Spooky home page: pumpkin, bats, cobweb and fog.',
    sendLabel: 'Bat swarm on send 🦇',
    sendHint: 'Bats fly across the screen when you send from the home page.',
  },
};

export const THANKSGIVING_CONTROLS: SeasonalControlsConfig & { settings: SeasonalSettingsCopy } = {
  idPrefix: 'tg',
  icon: '🦃',
  title: 'Thanksgiving effects',
  themeLabel: 'Thanksgiving theme',
  themeHint: 'Turkeys, falling leaves and warm glow',
  sendLabel: 'Leaf gust on send',
  sendHint: 'Leaves sweep across when you send',
  accentRgb: '217,119,6',
  getEnabled: (part) => getThanksgivingPartEnabled(part === 'send' ? 'gust' : 'theme'),
  setEnabled: (part, v) => setThanksgivingPartEnabled(part === 'send' ? 'gust' : 'theme', v),
  changedEvent: USER_THANKSGIVING_EFFECTS_CHANGED_EVENT,
  settings: {
    themeLabel: 'Thanksgiving theme 🦃',
    themeHint: 'Festive home page: turkeys, falling leaves and a warm glow.',
    sendLabel: 'Leaf gust on send 🍂',
    sendHint: 'A gust of leaves sweeps across the screen when you send from the home page.',
  },
};
