class StorageManager {
  constructor() {
    this.SYNC_STORAGE_LIMIT = 100 * 1024; // 100KB total limit
    this.ITEM_SIZE_LIMIT = 8 * 1024; // 8KB per item limit
    this.MAX_SESSIONS = 15; // Reduced limit for sync storage
    this.MAX_SESSIONS_LOCAL = 50; // Higher limit for local storage
    
    // Add extension ID tracking for debugging
    this.extensionId = chrome.runtime.id;
    this.isUnpacked = chrome.runtime.getManifest().update_url === undefined;
    console.log('StorageManager initialized:', {
      extensionId: this.extensionId,
      isUnpacked: this.isUnpacked,
      persistenceWarning: this.isUnpacked ? 'Unpacked extension - storage may not persist across reloads' : 'Published extension - storage should persist'
    });

    this.initialize();
  }

  async initialize() {
    await this.migrateLocalSessions();
  }

  async getSessions() {
    try {
      console.log('StorageManager.getSessions() called');
      
      // Debug: Check what's actually in storage
      const [syncData, localData] = await Promise.all([
        chrome.storage.sync.get(null), // Get all sync data
        chrome.storage.local.get(null) // Get all local data
      ]);
      
      console.log('All sync storage data:', syncData);
      console.log('All local storage data:', Object.keys(localData));
      
      // Primary: Use sync storage for persistence across installs
      if (syncData.sessions && syncData.sessions.length > 0) {
        console.log(`✅ Loaded ${syncData.sessions.length} sessions from sync storage`);
        return syncData.sessions;
      }
      
      // Secondary: Use local storage (might have more complete data but not persistent)
      if (localData.sessions_backup && localData.sessions_backup.length > 0) {
        console.log(`⚠️ Loaded ${localData.sessions_backup.length} sessions from local storage (fallback)`);
        // If we found sessions in local storage, try to migrate them to sync
        this.migrateSessions(localData.sessions_backup);
        return localData.sessions_backup;
      }
      
      console.log('❌ No sessions found in any storage');
      return [];
      
    } catch (error) {
      console.error('Error accessing storage:', error);
      return [];
    }
  }

  async saveSessions(sessions) {
    try {
      console.log(`StorageManager.saveSessions() called with ${sessions.length} sessions`);
      console.log('Extension ID:', this.extensionId);
      
      // Primary: Save to sync storage for persistence (with size optimization)
      const syncSessions = this.optimizeSessionsForSync(sessions.slice(0, this.MAX_SESSIONS));
      
      // Estimate storage size
      const sessionsString = JSON.stringify({ sessions: syncSessions });
      const estimatedSize = new Blob([sessionsString]).size;
      console.log(`Attempting to save ${syncSessions.length} sessions to sync storage (${estimatedSize} bytes)`);
      
      let syncSuccess = false;
      if (estimatedSize <= this.SYNC_STORAGE_LIMIT * 0.8) { // Use 80% of limit as safety margin
        try {
          await chrome.storage.sync.set({ sessions: syncSessions });
          console.log(`✅ Successfully saved ${syncSessions.length} sessions to sync storage`);
          
          // Verify the save worked
          const verification = await chrome.storage.sync.get(['sessions']);
          console.log(`✅ Verification: ${verification.sessions?.length || 0} sessions found in sync storage after save`);
          syncSuccess = true;
        } catch (syncError) {
          console.error('❌ Failed to save to sync storage:', syncError);
        }
      } else {
        console.warn(`⚠️ Sessions data too large for sync storage (${estimatedSize} bytes)`);
      }
      
      // Secondary: Always backup to local storage (higher limit, more complete data)
      const localSessions = sessions.slice(0, this.MAX_SESSIONS_LOCAL);
      await chrome.storage.local.set({ sessions_backup: localSessions });
      console.log(`✅ Saved ${localSessions.length} sessions to local storage as backup`);
      
      if (!syncSuccess && this.isUnpacked) {
        console.warn('⚠️ Sessions saved to local storage only - may not persist across extension reinstalls');
        console.warn('⚠️ You\'re using an unpacked extension (development mode)');
        console.warn('⚠️ Use Export/Import functionality to backup sessions before reloading the extension');
        console.warn('⚠️ For automatic persistence, publish the extension to Chrome Web Store');
      } else if (!syncSuccess) {
        console.warn('⚠️ Sessions saved to local storage only - sync storage failed');
        console.warn('⚠️ Sessions may not sync across devices or persist perfectly');
      }
      
    } catch (error) {
      console.error('Critical error in saveSessions:', error);
      throw error;
    }
  }
  
  // Optimize sessions for sync storage by reducing data size
  optimizeSessionsForSync(sessions) {
    return sessions.map(session => ({
      id: session.id,
      name: session.name,
      created: session.created,
      lastAccessed: session.lastAccessed,
      tabCount: session.tabCount,
      tabs: session.tabs.slice(0, 15).map(tab => ({ // Limit to 15 tabs per session for sync
        url: tab.url,
        title: tab.title && tab.title.length > 60 ? tab.title.substring(0, 60) + '...' : (tab.title || 'Untitled'),
        windowId: tab.windowId,
        saved: tab.saved,
        favIconUrl: tab.favIconUrl && tab.favIconUrl.startsWith('data:') ? null : tab.favIconUrl // Remove base64 favicons
      }))
    }));
  }
  
  // Migrate sessions from local to sync storage
  async migrateSessions(sessions) {
    console.log('Attempting to migrate', sessions.length, 'sessions from local to sync storage');
    try {
      await this.saveSessions(sessions);
      console.log('Successfully migrated sessions to sync storage');
    } catch (error) {
      console.warn('Failed to migrate sessions to sync storage:', error);
    }
  }

  async addSession(session) {
    try {
      const sessions = await this.getSessions();
      sessions.unshift(session);
      await this.saveSessions(sessions);
      return session;
    } catch (error) {
      console.error('Error adding session:', error);
      throw error;
    }
  }

  async removeSession(sessionId) {
    try {
      const sessions = await this.getSessions();
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      await this.saveSessions(updatedSessions);
      return updatedSessions;
    } catch (error) {
      console.error('Error removing session:', error);
      throw error;
    }
  }

  // Migration helper: move old local sessions to sync storage
  async migrateLocalSessions() {
    try {
      // Check for old 'sessions' key in local storage (from previous versions)
      const localData = await chrome.storage.local.get(['sessions']);
      if (localData.sessions && localData.sessions.length > 0) {
        console.log('Migrating old local sessions to sync storage...');
        await this.saveSessions(localData.sessions);
        
        // Remove old local sessions after successful migration
        await chrome.storage.local.remove(['sessions']);
        console.log('Migration completed successfully');
      }
      
      // Also check if we have backup sessions but no sync sessions (for recovery)
      const syncData = await chrome.storage.sync.get(['sessions']);
      const backupData = await chrome.storage.local.get(['sessions_backup']);
      
      if ((!syncData.sessions || syncData.sessions.length === 0) && 
          backupData.sessions_backup && backupData.sessions_backup.length > 0) {
        console.log('No sync sessions found but backup exists - attempting recovery migration');
        await this.migrateSessions(backupData.sessions_backup);
      }
    } catch (error) {
      console.warn('Error during migration:', error);
    }
  }

  // Export all sessions to JSON format
  async exportSessions() {
    try {
      const sessions = await this.getSessions();
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        extensionId: this.extensionId,
        isUnpacked: this.isUnpacked,
        sessions: sessions
      };
      
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `omni-sessions-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log(`✅ Exported ${sessions.length} sessions to JSON file`);
      return true;
    } catch (error) {
      console.error('❌ Failed to export sessions:', error);
      throw error;
    }
  }
  
  // Import sessions from JSON file
  async importSessions(jsonString, mergeWithExisting = true) {
    try {
      const importData = JSON.parse(jsonString);
      
      // Validate import data structure
      if (!importData.version || !importData.sessions || !Array.isArray(importData.sessions)) {
        throw new Error('Invalid import file format');
      }
      
      console.log(`📥 Importing ${importData.sessions.length} sessions from ${importData.exportDate}`);
      
      let sessionsToSave;
      
      if (mergeWithExisting) {
        // Merge with existing sessions (avoid duplicates by ID)
        const existingSessions = await this.getSessions();
        const existingIds = new Set(existingSessions.map(s => s.id));
        
        const newSessions = importData.sessions.filter(s => !existingIds.has(s.id));
        sessionsToSave = [...existingSessions, ...newSessions];
        
        console.log(`📥 Merging: ${existingSessions.length} existing + ${newSessions.length} new = ${sessionsToSave.length} total`);
      } else {
        // Replace all existing sessions
        sessionsToSave = importData.sessions;
        console.log(`📥 Replacing all sessions with ${sessionsToSave.length} imported sessions`);
      }
      
      await this.saveSessions(sessionsToSave);
      console.log(`✅ Successfully imported ${importData.sessions.length} sessions`);
      
      return {
        imported: importData.sessions.length,
        total: sessionsToSave.length,
        merged: mergeWithExisting
      };
    } catch (error) {
      console.error('❌ Failed to import sessions:', error);
      throw error;
    }
  }

  // For backwards compatibility - keep local storage for temporary data
  async getSuspendedTabs() {
    const data = await chrome.storage.local.get(['suspendedTabs']);
    return data.suspendedTabs || [];
  }

  async saveSuspendedTabs(suspendedTabs) {
    await chrome.storage.local.set({ suspendedTabs });
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}