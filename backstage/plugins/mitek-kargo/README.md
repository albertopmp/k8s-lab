# mitek-kargo

Mitek frontend plugin for [Kargo](https://kargo.io).

- `MitekFreightPicker` scaffolder field: lists the Kargo Freight of the
  Component selected in another field (`ui:options.entityField`, default
  `component`). The Kargo Project comes from the component's `kargo/project`
  annotation; the Warehouse is the component's name.

Data comes from `@internal/backstage-plugin-mitek-kargo-backend`. Installed
automatically through app feature discovery (`app.packages: all`).
