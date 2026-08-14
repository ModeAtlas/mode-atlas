/* Mode Atlas global release metadata source.
   Load this before mode-atlas-head-bootstrap.js.
   VERSION/CACHE_REVISION identify the deployed app build.
   SAVE_SCHEMA_VERSION identifies the local save-data schema.
   BACKUP_FORMAT_VERSION identifies exported backup envelopes.
   CLOUD_SNAPSHOT_VERSION identifies the Firestore snapshot envelope. */
(function ModeAtlasVersionSource(root){
  var VERSION = '2.31.0';
  var CACHE_REVISION = 'assets-2.31.0';
  var SAVE_SCHEMA_VERSION = 3;
  var BACKUP_FORMAT_VERSION = 2;
  var CLOUD_SNAPSHOT_VERSION = 2;
  var BUILD_DATE = '2026-08-14';

  root.ModeAtlasVersion = VERSION;
  root.MODE_ATLAS_VERSION = VERSION;
  root.ModeAtlasCacheRevision = CACHE_REVISION;
  root.MODE_ATLAS_CACHE_REVISION = CACHE_REVISION;
  root.ModeAtlasSaveSchemaVersion = SAVE_SCHEMA_VERSION;
  root.ModeAtlasBackupFormatVersion = BACKUP_FORMAT_VERSION;
  root.ModeAtlasCloudSnapshotVersion = CLOUD_SNAPSHOT_VERSION;
  root.ModeAtlasBuildDate = BUILD_DATE;
  root.ModeAtlasRelease = Object.freeze({
    appVersion: VERSION,
    cacheRevision: CACHE_REVISION,
    saveSchemaVersion: SAVE_SCHEMA_VERSION,
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    cloudSnapshotVersion: CLOUD_SNAPSHOT_VERSION,
    buildDate: BUILD_DATE
  });
})(typeof self !== 'undefined' ? self : window);
