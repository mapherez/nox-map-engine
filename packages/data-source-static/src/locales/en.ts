/** English diagnostics surfaced by the viewer. */
export const en = {
  httpError: (status: number) => `${status} while loading resource`,
  missingCatalogMaps: 'Catalog must contain maps[]',
  invalidCatalogIdentity: 'Invalid map identity or current snapshot',
  invalidSnapshotLocations: 'Snapshot locations must be strings',
  mapNotFound: 'Map not found',
  snapshotNotFound: 'Snapshot not found',
  identityMismatch: 'Manifest identity does not match catalog',
  duplicateMapSnapshot: 'Duplicate map snapshot',
  mapOrSnapshotNotFound: 'Map or snapshot not found',
  assetNotFound: 'Asset not found',
};
