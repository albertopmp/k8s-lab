# mitek-kargo

Mitek frontend plugin for [Kargo](https://kargo.io): two scaffolder fields.

- `MitekFreightPicker`: the 10 newest Freight of the component chosen in
  another field (`ui:options.entityField`, default `component`), with where
  each one runs. Stores the Freight name.
- `MitekStagePicker`: the Stages the chosen Freight can be promoted to
  (`ui:options.entityField`, `ui:options.freightField`, default `freight`).

Both use `KargoSelect` (loading, errors, empty states) and `useMitekKargo`
(calls to `mitek-kargo-backend`). The Kargo Project comes from the component's
`kargo/project` annotation; the Warehouse is the component's name. Installed
through app feature discovery (`app.packages: all`).
