class StorageManager {
  constructor() {
    this.SYNC_STORAGE_LIMIT = 100 * 1024; // 100KB total limit
    this.ITEM_SIZE_LIMIT = 8 * 1024; // 8KB per item limit
    this.MAX_SESSIONS = 15; // Reduced limit for sync storage
    this.MAX_SESSIONS_LOCAL = 50; // Higher limit for local storage
  }

  async getSessions() {
    try {
      // Always use local storage as primary source (has more complete data)
      const localData = await chrome.storage.local.get(['sessions_backup']);
      if (localData.sessions_backup && localData.sessions_backup.length > 0) {
        return localData.sessions_backup;
      }
      
      // Fallback to sync storage if local is empty (for backwards compatibility)
      const syncData = await chrome.storage.sync.get(['sessions']);
      return syncData.sessions || [];
      
    } catch (error) {
      console.error('Error accessing storage:', error);
      return [];
    }
  }

  async saveSessions(sessions) {
    console.log('StorageManager.saveSessions called with', sessions.length, 'sessions');
    
    try {
      // Always store in local storage with higher limit
      const localSessions = sessions.slice(0, this.MAX_SESSIONS_LOCAL);
      console.log('Saving to local storage:', localSessions.length, 'sessions');
      await chrome.storage.local.set({ sessions_backup: localSessions });
      console.log('Successfully saved to local storage');
      
      // Try to save a smaller subset to sync storage for cross-device sync
      const syncSessions = this.optimizeSessionsForSync(sessions.slice(0, this.MAX_SESSIONS));
      
      // Estimate storage size
      const sessionsString = JSON.stringify({ sessions: syncSessions });
      const estimatedSize = new Blob([sessionsString]).size;
      console.log('Sync storage size estimate:', estimatedSize, 'bytes for', syncSessions.length, 'sessions');
      
      if (estimatedSize <= this.SYNC_STORAGE_LIMIT * 0.8) { // Use 80% of limit as safety margin
        try {
          await chrome.storage.sync.set({ sessions: syncSessions });
          console.log(`Successfully saved ${syncSessions.length} sessions to sync storage (${estimatedSize} bytes)`);
        } catch (syncError) {
          console.warn('Failed to save to sync storage, continuing with local storage only:', syncError);
        }
      } else {
        console.warn(`Sessions data too large for sync storage (${estimatedSize} bytes), using local storage only`);
      }
      
    } catch (error) {
      console.error('Critical error in saveSessions:', error);
      
      // Try to save at least to local storage as absolute fallback
      try {
        const fallbackSessions = sessions.slice(0, 10); // Even smaller fallback
        await chrome.storage.local.set({ sessions_backup: fallbackSessions });
        console.log('Saved fallback sessions to local storage');
      } catch (fallbackError) {
        console.error('Even fallback storage failed:', fallbackError);
        throw fallbackError;
      }
    }
  }
  
  // Optimize sessions for sync storage by reducing data size
  optimizeSessionsForSync(sessions) {
    return sessions.map(session => ({
      ...session,
      tabs: session.tabs.slice(0, 10).map(tab => ({ // Limit to 10 tabs per session for sync
        url: tab.url,
        title: tab.title.length > 50 ? tab.title.substring(0, 50) + '...' : tab.title, // Even shorter titles
        windowId: tab.windowId,
        saved: tab.saved
      }))
    }));
  }

  async addSession(session) {
    console.log('StorageManager.addSession called with session:', session.name);
    try {
      const sessions = await this.getSessions();
      console.log('Current sessions count:', sessions.length);
      sessions.unshift(session);
      await this.saveSessions(sessions);
      console.log('Successfully added session:', session.name);
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

  // Migration helper: move local sessions to sync storage
  async migrateLocalSessions() {
    try {
      const localData = await chrome.storage.local.get(['sessions']);
      if (localData.sessions && localData.sessions.length > 0) {
        console.log('Migrating local sessions to sync storage...');
        await this.saveSessions(localData.sessions);
        
        // Remove old local sessions after successful migration
        await chrome.storage.local.remove(['sessions']);
        console.log('Migration completed successfully');
      }
    } catch (error) {
      console.warn('Error during migration:', error);
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
window.StorageManager = StorageManager;