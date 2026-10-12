/** English diagnostics surfaced by the viewer. */
export const en = {
  invalidPixelRatio: 'maxPixelRatio must be finite and positive',
  destroyed: 'Engine has been destroyed',
  noMap: 'Load a map first',
  viewIdentityMismatch: 'View state belongs to another map',
  snapshotIdentityMismatch: 'Data source returned the wrong snapshot',
  invalidFitBoundsOrPadding: 'Invalid fit bounds or padding',
  entityNotFound: 'Entity not found',
  layerNotFound: 'Layer not found',
  invalidVisibility: 'Visibility must be boolean',
  invalidOpacity: 'Opacity must be in [0,1]',
  contentReferenceNotFound: 'Content reference not found',
  unsupportedCameraIgnored: 'Ignored camera outside the Web Mercator domain',
  entityNoLongerExists: (value: string) => `Entity ${value} no longer exists`,
};
