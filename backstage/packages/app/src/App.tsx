import { createApp } from '@backstage/frontend-defaults';
import argocdPlugin, {
  argocdTranslationsModule,
} from '@backstage-community/plugin-argocd';
import githubActionsPlugin from '@backstage-community/plugin-github-actions/alpha';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    argocdPlugin,
    argocdTranslationsModule,
    githubActionsPlugin,
  ],
});
