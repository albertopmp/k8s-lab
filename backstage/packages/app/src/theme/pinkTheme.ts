import {
  createBaseThemeOptions,
  createUnifiedTheme,
  palettes,
} from '@backstage/theme';

const pink = '#d63384';
const darkPink = '#ad1457';
const brightPink = '#ff70b5';
const deepPink = '#e05298';
const fontFamily =
  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export const pinkLightTheme = createUnifiedTheme({
  ...createBaseThemeOptions({
    palette: {
      ...palettes.light,
      primary: { main: pink },
      secondary: { main: darkPink },
      navigation: { ...palettes.light.navigation, indicator: pink },
    },
  }),
  fontFamily,
  defaultPageTheme: 'home',
});

export const pinkDarkTheme = createUnifiedTheme({
  ...createBaseThemeOptions({
    palette: {
      ...palettes.dark,
      primary: { main: brightPink },
      secondary: { main: deepPink },
      navigation: { ...palettes.dark.navigation, indicator: brightPink },
    },
  }),
  fontFamily,
  defaultPageTheme: 'home',
});
