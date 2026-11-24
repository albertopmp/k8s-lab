import { createApp } from '@backstage/frontend-defaults';
import argocdPlugin, {
  argocdTranslationsModule,
} from '@backstage-community/plugin-argocd';
import githubActionsPlugin from '@backstage-community/plugin-github-actions/alpha';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';

export default createApp({
  features: [
    catalogPlugin,
    navModule,
    homeModule,
    argocdPlugin,
    argocdTranslationsModule,
    githubActionsPlugin,
  ],
});
