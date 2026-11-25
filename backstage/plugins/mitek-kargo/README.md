# mitek-kargo

Mitek frontend plugin for [Kargo](https://kargo.io).

- `entity-card:mitek-kargo/promote`: a "Promote with Kargo" button for the
  entity Overview that opens the Kargo promotion template
  (`mitek-kargo-promote`) with the component preselected (`?formData=`).
  Placement and filter are set in app-config.yaml.

Scaffolder fields:

- `MitekFreightPicker`: the 10 newest Freight of the component chosen in
  another field (`ui:options.entityField`, default `component`), with where
  each one runs. Stores the Freight name.
- `MitekStagePicker`: the Stages the chosen Freight can be promoted to
  (`ui:options.entityField`, `ui:options.freightField`, default `freight`).

Both use `KargoSelect` (loading, errors, empty states) and `useMitekKargo`
(calls to `mitek-kargo-backend`). The Kargo Project comes from the component's
`kargo/project` annotation; the Warehouse is the component's name. Installed
through app feature discovery (`app.packages: all`).
