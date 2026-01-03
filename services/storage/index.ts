/**
 * Storage module exports
 *
 * Main entry point for all storage-related functionality.
 * Use `hybridStorage` for cloud-synced operations or `storage` for local-only.
 */

export { storage, IndexedDBStorage } from './indexedDBStorage';
export { hybridStorage, STORAGE_REFRESH_EVENT } from './hybridStorage';
export type { HybridStorageService } from './hybridStorage';
export { db, isIndexedDBSupported, getStorageEstimate } from './database';
export type { AppSettings } from './database';
export type { StorageService, ExportData } from './storageService';
export { StorageError } from './storageService';
export { initializeStorage, seedDefaultData, migrateActivityLogFromLocalStorage } from './seedData';
