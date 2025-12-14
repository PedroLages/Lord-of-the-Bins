/**
 * Storage module exports
 *
 * Main entry point for all storage-related functionality.
 * Use `storage` singleton for all data operations.
 */

export { storage, SupabaseStorageService } from './supabaseStorage';
export { db, isIndexedDBSupported, getStorageEstimate } from './database';
export type { AppSettings } from './database';
export type { StorageService, ExportData } from './storageService';
export { StorageError } from './storageService';
export { initializeStorage, seedDefaultData, migrateActivityLogFromLocalStorage } from './seedData';
