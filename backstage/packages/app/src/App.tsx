import { createApp } from '@backstage/frontend-defaults';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import argocdPlugin, {
  argocdTranslationsModule,
} from '@backstage-community/plugin-argocd';
import githubActionsPlugin from '@backstage-community/plugin-github-actions/alpha';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { UnifiedThemeProvider } from '@backstage/theme';
import WbSunnyIcon from '@material-ui/icons/WbSunny';
import Brightness3Icon from '@material-ui/icons/Brightness3';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';
import { pinkDarkTheme, pinkLightTheme } from './theme/pinkTheme';
import './styles.css';

const pinkLightThemeExtension = ThemeBlueprint.make({
  name: 'pink-light',
  params: {
    theme: {
      id: 'pink-light',
      title: 'Pink Light',
      variant: 'light',
      icon: <WbSunnyIcon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={pinkLightTheme} children={children} />
      ),
    },
  },
});

const pinkDarkThemeExtension = ThemeBlueprint.make({
  name: 'pink-dark',
  params: {
    theme: {
      id: 'pink-dark',
      title: 'Pink Dark',
      variant: 'dark',
      icon: <Brightness3Icon />,
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={pinkDarkTheme} children={children} />
      ),
    },
  },
});

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    homeModule,
    argocdPlugin,
    argocdTranslationsModule,
    githubActionsPlugin,
    createFrontendModule({
      pluginId: 'app',
      extensions: [pinkLightThemeExtension, pinkDarkThemeExtension],
    }),
  ],
});
