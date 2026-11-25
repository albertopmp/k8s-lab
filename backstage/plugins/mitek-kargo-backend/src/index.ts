/**
 * Mitek: Kargo integration for the Backstage backend.
 *
 * - default export: the mitek-kargo plugin (/api/mitek-kargo)
 * - mitekKargoScaffolderModule: the `mitek:kargo:promote` scaffolder action
 *
 * @packageDocumentation
 */
export { mitekKargoPlugin as default } from './plugin';
export { mitekKargoScaffolderModule } from './scaffolderModule';
