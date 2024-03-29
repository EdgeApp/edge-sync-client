# edge-sync-client

## Unreleased

## 0.2.9 (2024-02-26)

- added: Detect conflicts while creating repos, and report these with a new `ConflictError` type.

## 0.2.8 (2023-09-06)

- Added: Allow for customization of info and sync servers via edgeServers option.

## 0.2.7 (2022-07-26)

- fixed: Change info-server client to not block on server request for server list

## 0.2.6 (2022-01-14)

- fixed: Gracefully fallback to current/default server info when info-server requests fail

## 0.2.5 (2022-01-07)

- add: Optional `apiKey` parameter to `createRepo`

## 0.2.4 (2021-10-19)

- fixed: Do not include raw sync keys in error messages.

## 0.2.3 (2021-10-14)

- fixed: Do not include raw sync keys in log messages.
- changed: Simplify the `log` option to only take strings.
- changed: Simplify the `fetch` option to be a subset of the fetch API.

This release isn't a breaking change because we now take a subset of what we took before, so previous options would still be acceptable.

## 0.2.2 (2021-09-14)

### Added

- `syncKeyToRepoId` utility function added and exposed as public API.

## 0.2.1 (2021-09-09)

### Fixed

- Shuffle sync server list before trying requests instead of using the same order

## 0.2.0 (2021-09-07)

### Fixed

- API change to allow `hash` field to be optional in `GetStoreResponse`

### Changed

- New `makeSyncClient` and `SyncClient` interface replaces `createRepo` method

## 0.1.0 (2021-07-9)

### Added

- Export public V2 REST API types
- Add createRepo
