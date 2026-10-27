/**
 * Curated colour themes for the offline ideas, frozen at load. Within equal fit, earlier
 * entries win, so the most situational themes come first.
 */
import type { Tags } from './menu-catalogue.ts';

/** A colour theme. */
export interface ThemeEntry extends Tags {
  readonly name: string;
  readonly palette: readonly string[];
  readonly why: string;
}

/** Themes, most situational first. */
export const THEMES: readonly ThemeEntry[] = Object.freeze([
  {
    name: 'Monsoon Jasmine',
    palette: ['jasmine white', 'rain grey', 'peacock blue', 'leaf green'],
    why: 'Fresh, rain-washed colours that still look bright under cloud.',
    seasons: ['monsoon'],
    when: { settings: ['outdoor', 'mixed'] },
  },
  {
    name: 'Winter Diyas',
    palette: ['ivory', 'marigold', 'deep maroon', 'gold'],
    why: 'Warm lamp-lit tones for a cool wedding-season evening.',
    types: ['wedding'],
    seasons: ['peak'],
    when: { styles: ['traditional'] },
  },
  {
    name: 'Earth and Leaf',
    palette: ['terracotta', 'leaf green', 'natural jute', 'cream'],
    why: 'Natural materials that can be reused or composted afterwards.',
    when: { anyConstraint: ['eco-friendly'] },
  },
  {
    name: 'Marigold and Brass',
    palette: ['marigold', 'vermilion', 'antique brass', 'leaf green'],
    why: 'Classic festive colours that glow under evening lights.',
    when: { styles: ['traditional'] },
  },
  {
    name: 'Ivory Garden',
    palette: ['ivory', 'sage', 'blush', 'gold'],
    why: 'Soft tones that keep the focus on a close circle of people.',
    when: { styles: ['intimate'] },
  },
  {
    name: 'Coastal Sunset',
    palette: ['coral', 'sand', 'teal', 'white'],
    why: 'Colours borrowed from the shoreline and the evening sky.',
    when: { styles: ['destination'] },
  },
  {
    name: 'Jungle Safari',
    palette: ['leaf green', 'sunflower yellow', 'sky blue', 'tangerine'],
    why: 'Bold, cheerful colours children recognise straight away.',
    when: { styles: ['kids'] },
  },
  {
    name: 'Golden Years',
    palette: ['gold', 'navy', 'ivory'],
    why: 'A timeless pairing that frames decades of photographs.',
    when: { styles: ['milestone'] },
  },
  {
    name: 'Midnight Blue',
    palette: ['midnight blue', 'silver', 'teal'],
    why: 'A grown-up evening palette that suits low, warm lighting.',
    when: { styles: ['adult'] },
  },
  {
    name: 'Rangoli Mela',
    palette: ['magenta', 'saffron', 'emerald', 'turquoise'],
    why: 'Festival colours that stand out across a crowded ground.',
    when: { styles: ['festival'] },
  },
  {
    name: 'Lantern of Hope',
    palette: ['warm amber', 'deep blue', 'cream'],
    why: 'Calm, hopeful tones that keep attention on the cause.',
    when: { styles: ['fundraiser'] },
  },
  {
    name: 'Chai and Conversation',
    palette: ['terracotta', 'cream', 'olive'],
    why: 'Homely colours that make strangers comfortable chatting.',
    when: { styles: ['meetup'] },
  },
  {
    name: 'Green Streets',
    palette: ['leaf green', 'earth brown', 'sky blue'],
    why: 'Colours of the clean neighbourhood the drive is working for.',
    when: { styles: ['clean-up'] },
  },
]);

/** Used when no theme is targeted at the event. */
export const DEFAULT_THEME: ThemeEntry = Object.freeze({
  name: 'Festive Classic',
  palette: ['saffron', 'ivory', 'deep green'],
  why: 'Warm, familiar celebration colours that suit any venue.',
});
