import { StyleSheet } from 'react-native';

export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/**
 * Serif display for titles and hero numbers, Inter for everything you read
 * or tap. Body copy stays at 15 pt so it reads easily at arm's length.
 */
export const type = StyleSheet.create({
  hero: { fontFamily: fonts.display, fontSize: 46, lineHeight: 50, letterSpacing: -0.4 },
  title: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.display, fontSize: 26, lineHeight: 30 },
  subheading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 1.6 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.semibold, fontSize: 14 },
  caption: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  micro: { fontFamily: fonts.medium, fontSize: 11.5 },
});
