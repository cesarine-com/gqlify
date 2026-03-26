# Release Notes

## 3.5.0

### Dependency upgrades

- **MongoDB driver**: `^3.5.11` → `^6.12.0`
- **TypeScript**: `^3.1.3` / `^4.3.5` → `^5.7.3` (all packages)
- **@types/node**: `9.4.6` → `^20.17.0`
- **tsconfig target**: `es6` → `es2020`

### Breaking changes (internal to MongoDB driver)

These changes affect only the internal implementation of `@gqlify-legacy/mongodb`. The public API of both `@gqlify-legacy/server` and `@gqlify-legacy/mongodb` remains unchanged.

- `MongoClient` connection: replaced deprecated `MongoClient.connect()` static method with `new MongoClient()` + `connect()`. Removed `useNewUrlParser` and `useUnifiedTopology` options (default in v4+).
- `ObjectID` replaced with `ObjectId` (lowercase d) — the old export was removed in driver v6.
- `FilterQuery<T>` replaced with `Filter<T>` — renamed in driver v4.
- `findOneAndUpdate` option `returnOriginal: false` replaced with `returnDocument: 'after'`.
- `findOneAndUpdate` return value: in v6 it returns the document directly instead of `{ value: document }`.

### Bug fixes

- **ManyToMany relations: missing context in `create()` and `delete()` calls** — `createAndAddIdForModelA`, `createAndAddIdForModelB`, `deleteAndRemoveIdFromModelA`, and `deleteAndRemoveIdFromModelB` in `manyToMany.ts` were not passing the `graphQlContext` to the underlying DataSource `create()` and `delete()` methods. This caused `Cannot read properties of undefined (reading 'user')` errors when creating or deleting related items through many-to-many relations with the MongoDB data source.

- **`MongodbDataSource.findOneByRelation` returned an array instead of a single object** — The `ToOneRelation` interface defines `findOneByRelation` as returning a single document. The `MemoryDataSource` correctly returned `first(data)`, but `MongodbDataSource` returned the raw array from `.toArray()`. This caused `Cannot return null for non-nullable field` errors when resolving bidirectional one-to-one relations from the non-owning side with MongoDB.

### CI

- Added GitHub Actions workflow (`ci.yml`) with MongoDB 7 service container.
- Runs build and all test suites (gqlify-mongodb integration tests + gqlify Memory/MongoDB tests).

### Tests

- Added 21 integration tests for `@gqlify-legacy/mongodb` covering: connection, CRUD, regex filters, ordering, one-to-one/one-to-many relations, many-to-many relations, activity logging, and map operations.
