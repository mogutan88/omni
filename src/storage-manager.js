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
    // Best-effort: if storage is empty, try recovering from bookmarks backup
    try {
      await this.tryBookmarksRecoveryIfEmpty();
    } catch (e) {
      // ignore recovery errors
    }
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

      // Optional bookmark backup that survives uninstall (controlled by settings)
      try {
        const { settings } = await chrome.storage.local.get(['settings']);
        const enableBackup = settings?.bookmarksBackup !== false; // default ON
        if (enableBackup) {
          await this.backupSessionsToBookmarks(sessions);
          console.log('✅ Sessions backed up to bookmarks');
        } else {
          console.log('ℹ️ Bookmarks backup disabled in settings');
        }
      } catch (bmError) {
        console.warn('⚠️ Failed to backup sessions to bookmarks (permission missing or other error):', bmError);
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
      windowCount: session.windowCount,
      // Preserve window data if available, otherwise use legacy tabs format
      windows: session.windows ? session.windows.slice(0, 3).map(window => ({ // Limit to 3 windows per session
        id: window.id,
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
        state: window.state,
        focused: window.focused,
        incognito: window.incognito,
        type: window.type,
        tabs: window.tabs.slice(0, 8).map(tab => ({ // Limit to 8 tabs per window for sync
          url: tab.url,
          title: tab.title && tab.title.length > 60 ? tab.title.substring(0, 60) + '...' : (tab.title || 'Untitled'),
          windowId: tab.windowId,
          index: tab.index,
          pinned: tab.pinned,
          active: tab.active,
          saved: tab.saved,
          favIconUrl: tab.favIconUrl && tab.favIconUrl.startsWith('data:') ? null : tab.favIconUrl // Remove base64 favicons
        }))
      })) : undefined,
      // Keep legacy tabs format for backward compatibility
      tabs: session.tabs ? session.tabs.slice(0, 15).map(tab => ({ // Limit to 15 tabs per session for sync
        url: tab.url,
        title: tab.title && tab.title.length > 60 ? tab.title.substring(0, 60) + '...' : (tab.title || 'Untitled'),
        windowId: tab.windowId,
        index: tab.index,
        pinned: tab.pinned,
        active: tab.active,
        saved: tab.saved,
        favIconUrl: tab.favIconUrl && tab.favIconUrl.startsWith('data:') ? null : tab.favIconUrl // Remove base64 favicons
      })) : []
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

  // ============ Bookmarks Backup/Recovery ============
  async ensureBookmarksRoot() {
    const ROOT_TITLE = 'Omni Sessions';
    // Try to find existing root folder
    const found = await chrome.bookmarks.search({ title: ROOT_TITLE });
    const existingFolder = (found || []).find(n => !n.url && n.title === ROOT_TITLE);
    if (existingFolder) return existingFolder.id;

    // Find a reasonable parent folder under the real roots (never use the absolute root id)
    const tree = await chrome.bookmarks.getTree();
    const root = tree[0];
    const folders = (root.children || []).filter(n => !n.url);

    // Prefer known root folders by ID regardless of locale: '2' (Other), '1' (Bookmarks Bar), '3' (Mobile)
    const other = folders.find(n => n.id === '2');
    const bar = folders.find(n => n.id === '1');
    const mobile = folders.find(n => n.id === '3');
    const fallback = folders[0];

    const parentId = (other || bar || mobile || fallback)?.id;
    if (!parentId || parentId === root.id) {
      throw new Error('No valid bookmarks parent folder found');
    }

    const created = await chrome.bookmarks.create({ parentId, title: ROOT_TITLE });
    return created.id;
  }

  async ensureAutoBackupFolder(rootId) {
    const AUTO_BACKUP_TITLE = 'Auto Backup';
    const children = await chrome.bookmarks.getChildren(rootId);
    let folder = (children || []).find(n => !n.url && n.title === AUTO_BACKUP_TITLE);
    if (folder) return folder.id;
    const created = await chrome.bookmarks.create({ parentId: rootId, title: AUTO_BACKUP_TITLE });
    return created.id;
  }

  async clearFolderChildren(folderId) {
    const kids = await chrome.bookmarks.getChildren(folderId);
    for (const k of kids || []) {
      if (!k.url) {
        await chrome.bookmarks.removeTree(k.id);
      } else {
        await chrome.bookmarks.remove(k.id);
      }
    }
  }

  async backupSessionsToBookmarks(sessions) {
    // No-op if API not available
    if (!chrome.bookmarks?.create) return;
    const rootId = await this.ensureBookmarksRoot();
    const backupId = await this.ensureAutoBackupFolder(rootId);
    await this.clearFolderChildren(backupId);

    for (const session of sessions) {
      const folderTitle = `${session.name || 'Session'} [${session.id || ''}]`;
      const sessionFolder = await chrome.bookmarks.create({ parentId: backupId, title: folderTitle });
      
      // Handle sessions with window data
      if (session.windows && session.windows.length > 0) {
        for (let i = 0; i < session.windows.length; i++) {
          const window = session.windows[i];
          const windowFolder = session.windows.length > 1 ? 
            await chrome.bookmarks.create({ 
              parentId: sessionFolder.id, 
              title: `Window ${i + 1} (${window.tabs.length} tabs)` 
            }) : sessionFolder;
            
          for (const tab of window.tabs || []) {
            if (tab?.url) {
              await chrome.bookmarks.create({ 
                parentId: windowFolder.id, 
                title: tab.title || tab.url, 
                url: tab.url 
              });
            }
          }
        }
      } else {
        // Handle legacy sessions with just tabs
        const tabs = session.tabs || [];
        for (const t of tabs) {
          if (t?.url) {
            await chrome.bookmarks.create({ parentId: sessionFolder.id, title: t.title || t.url, url: t.url });
          }
        }
      }
    }
  }

  async tryBookmarksRecoveryIfEmpty() {
    // Skip if bookmarks API unavailable
    if (!chrome.bookmarks?.getChildren) return { recovered: false, recoveredCount: 0 };
    const existing = await chrome.storage.sync.get(['sessions']);
    if (existing.sessions && existing.sessions.length > 0) {
      return { recovered: false, recoveredCount: 0 };
    }

    // Try reading from Auto Backup
    const rootId = await this.ensureBookmarksRoot().catch(() => null);
    if (!rootId) return { recovered: false, recoveredCount: 0 };
    const children = await chrome.bookmarks.getChildren(rootId);
    const backupFolder = (children || []).find(n => !n.url && n.title === 'Auto Backup');
    if (!backupFolder) return { recovered: false, recoveredCount: 0 };

    const sessionFolders = await chrome.bookmarks.getChildren(backupFolder.id);
    const recoveredSessions = [];
    for (const sf of sessionFolders || []) {
      if (sf.url) continue; // skip bookmarks at this level
      const tabNodes = await chrome.bookmarks.getChildren(sf.id);
      const tabs = (tabNodes || []).filter(n => n.url).map(n => ({
        url: n.url,
        title: n.title,
        saved: Date.now()
      }));
      if (tabs.length === 0) continue;

      // Extract id from folder title if present: "... [id]"
      const idMatch = /\[(.*?)\]$/.exec(sf.title || '');
      const recoveredId = idMatch?.[1] || `session_${crypto.randomUUID()}`;
      const name = (sf.title || '').replace(/\s*\[.*?\]$/, '') || 'Recovered Session';
      recoveredSessions.push({
        id: recoveredId,
        name,
        tabs,
        tabCount: tabs.length,
        created: Date.now(),
        lastAccessed: Date.now()
      });
    }

    if (recoveredSessions.length > 0) {
      await this.saveSessions(recoveredSessions);
      return { recovered: true, recoveredCount: recoveredSessions.length };
    }
    return { recovered: false, recoveredCount: 0 };
  }

  async cleanBookmarksBackup() {
    if (!chrome.bookmarks?.removeTree) {
      return { deleted: false, reason: 'bookmarks_api_unavailable' };
    }
    try {
      const rootId = await this.ensureBookmarksRoot().catch(() => null);
      if (!rootId) return { deleted: false, reason: 'root_not_found' };
      const children = await chrome.bookmarks.getChildren(rootId);
      const backupFolder = (children || []).find(n => !n.url && n.title === 'Auto Backup');
      if (!backupFolder) return { deleted: false, reason: 'backup_folder_not_found' };
      await chrome.bookmarks.removeTree(backupFolder.id);
      return { deleted: true };
    } catch (e) {
      return { deleted: false, reason: e?.message || 'unknown_error' };
    }
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.StorageManager = StorageManager;
}
