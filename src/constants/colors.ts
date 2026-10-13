/**
 * Perform's palette: warm ivory type on near-black, hairline borders,
 * one lime accent for action and progress, champagne for competition,
 * soft sky for recovery. Dark-only by design.
 */
const colors = {
  background: '#0A0B0A',
  foreground: '#F4F1EA',
  card: '#131514',
  cardRaised: '#1A1D1B',
  cardForeground: '#F4F1EA',
  border: 'rgba(244, 241, 234, 0.08)',
  borderStrong: 'rgba(244, 241, 234, 0.16)',
  primary: '#D4F171',
  primaryForeground: '#0A0B0A',
  primarySoft: 'rgba(212, 241, 113, 0.12)',
  secondary: '#1C1F1D',
  secondaryForeground: '#D2CEC5',
  muted: '#1C1F1D',
  mutedForeground: '#8C918C',
  accent: '#E5C38C',
  accentForeground: '#1B1408',
  accentSoft: 'rgba(229, 195, 140, 0.12)',
  sky: '#9DC3E6',
  skySoft: 'rgba(157, 195, 230, 0.12)',
  success: '#A3E2B0',
  destructive: '#F0897D',
  overlay: 'rgba(4, 5, 4, 0.72)',
};

export type Colors = typeof colors;

export default colors;
