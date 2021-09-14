# edge-sync-client

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