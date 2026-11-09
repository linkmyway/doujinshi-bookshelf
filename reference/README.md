# Reference implementation

The code in this folder is a **reference implementation written from the
documented method** in [`../docs/IMPLEMENTATION.md`](../docs/IMPLEMENTATION.md).
The production app runs on a hosted platform whose source is not
exportable; these files re-implement the core mechanisms — data model,
session-locked reader failover, two-tier candidate judging — in plain,
readable TypeScript so the design can be studied and re-built elsewhere.

They are intentionally framework-light: types and pure logic, with the
platform seams (database, blob store, fetch) expressed as small
interfaces you can adapt.

## Type-check the skeleton

```bash
npm install
npm run typecheck   # tsc --noEmit, strict
```
