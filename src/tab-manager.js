class TabManager {
  constructor() {
    this.suspendedTabs = new Map();
    this.suspendedTabIds = new Set();
    this.storageManager = new StorageManager();
    this.initializeTabSuspension();
  }

  async initializeTabSuspension() {
    const data = await chrome.storage.local.get(['settings', 'suspendedTabs']);
    this.settings = data.settings || {};
    
    if (data.suspendedTabs) {
      data.suspendedTabs.forEach(tab => {
        if (!tab.uniqueId || typeof tab.uniqueId !== 'string' || tab.uniqueId.trim() === '') {
          // Use unique migration ID to ensure no conflicts
          tab.uniqueId = `migration-${crypto.randomUUID()}`;
        }
        this.suspendedTabs.set(tab.uniqueId, tab);
        this.suspendedTabIds.add(tab.id);
      });
      
      await this.saveSuspendedTabs();
    }

    // Migrate any existing local sessions to sync storage
    await this.storageManager.migrateLocalSessions();

    await this.cleanupOrphanedSuspensions();

    // TODO: Implement proper tab activity tracking before enabling automatic suspension
    // if (this.settings.suspendInactive) {
    //   this.startInactiveTabSuspension();
    // }
  }

  async getAllTabs() {
    const windows = await chrome.windows.getAll({ populate: true });
    const allTabs = [];
    
    for (const window of windows) {
      for (const tab of window.tabs) {
        // Include regular web pages, new tab pages, and blank tabs
        // Exclude only internal Chrome settings/extension pages
        if (this.isUserTab(tab.url)) {
          allTabs.push({
            ...tab,
            windowId: window.id,
            suspended: this.suspendedTabIds.has(tab.id)
          });
        }
      }
    }
    
    return allTabs;
  }

  // Check if a tab URL represents a user-visible tab that should be counted
  isUserTab(url) {
    if (!url) return false;
    
    // Allow regular web pages (http/https)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    
    // Allow Chrome internal pages (settings, extensions, etc.) - users can see and interact with these
    if (url.startsWith('chrome://')) {
      return true;
    }
    
    // Allow blank tabs
    if (url === 'about:blank') {
      return true;
    }
    
    // Allow file URLs
    if (url.startsWith('file://')) {
      return true;
    }
    
    // Allow extension pages - users can see these (options pages, popups, etc.)
    if (url.startsWith('chrome-extension://')) {
      return true;
    }
    
    // Allow other protocols (ftp, data, etc.)
    return true;
  }

  // Check if a tab can be suspended (more restrictive than isUserTab)
  canSuspendTab(url) {
    if (!url) return false;
    
    // Allow regular web pages (http/https) - these can be suspended
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    
    // Allow file URLs - these can be suspended
    if (url.startsWith('file://')) {
      return true;
    }
    
    // Don't suspend Chrome internal pages - they can't be properly suspended
    if (url.startsWith('chrome://')) {
      return false;
    }
    
    // Don't suspend extension pages
    if (url.startsWith('chrome-extension://')) {
      return false;
    }
    
    // Don't suspend blank tabs - nothing meaningful to suspend
    if (url === 'about:blank') {
      return false;
    }
    
    // Allow other protocols that can be suspended (ftp, data, etc.)
    return true;
  }

  async convertAllTabs() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      const windowsData = [];
      
      for (const window of windows) {
        const tabsToConvert = window.tabs.filter(tab => 
          this.isUserTab(tab.url) && !this.suspendedTabIds.has(tab.id)
        );
        
        if (tabsToConvert.length === 0) continue;
        
        const convertedTabs = tabsToConvert.map(tab => ({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          windowId: tab.windowId,
          index: tab.index,
          pinned: tab.pinned,
          active: tab.active,
          saved: Date.now()
        }));
        
        // Simply preserve window grouping
        windowsData.push({
          windowId: window.id,
          tabs: convertedTabs
        });
        
        // Remove the tabs
        for (const tab of tabsToConvert) {
          await chrome.tabs.remove(tab.id);
        }
      }

      if (windowsData.length > 0) {
        await this.saveWindowsAsSession('Converted Tabs', windowsData);
      }
      
      return windowsData;
    } catch (error) {
      console.error('Error converting tabs:', error);
      throw error;
    }
  }

  async suspendTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      
      // Don't suspend tabs that can't be suspended (Chrome internal pages)
      // But allow suspending new tab pages and blank tabs
      if (!this.canSuspendTab(tab.url)) {
        return false;
      }

      const uniqueId = crypto.randomUUID();
      
      const suspendedTab = {
        id: tab.id,
        uniqueId: uniqueId,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        windowId: tab.windowId,
        index: tab.index,
        suspended: Date.now()
      };

      this.suspendedTabs.set(uniqueId, suspendedTab);
      this.suspendedTabIds.add(tab.id);
      await this.saveSuspendedTabs();

      await chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL(`suspended.html?uniqueId=${uniqueId}`)
      });

      return true;
    } catch (error) {
      console.error('Error suspending tab:', error);
      return false;
    }
  }

  async restoreTab(uniqueId) {
    try {
      const suspendedTab = this.suspendedTabs.get(uniqueId);
      if (!suspendedTab) {
        console.error('No suspended tab found for uniqueId:', uniqueId);
        return false;
      }

      // Use pattern matching to find suspended tabs more efficiently
      const suspendedUrlPattern = chrome.runtime.getURL('suspended.html') + '*';
      const possibleTabs = await chrome.tabs.query({ url: suspendedUrlPattern });
      
      // Find the specific tab by uniqueId parameter
      const targetTab = possibleTabs.find(tab => {
        const url = new URL(tab.url);
        return url.searchParams.get('uniqueId') === uniqueId;
      });
      
      if (!targetTab) {
        console.error('Could not find suspended tab to restore for uniqueId:', uniqueId);
        return false;
      }

      console.log('Restoring tab:', targetTab.id, 'to URL:', suspendedTab.url);
      await chrome.tabs.update(targetTab.id, { url: suspendedTab.url });
      this.suspendedTabs.delete(uniqueId);
      this.suspendedTabIds.delete(suspendedTab.id); // Remove original suspended tab's ID from suspendedTabIds
      await this.saveSuspendedTabs();

      return true;
    } catch (error) {
      console.error('Error restoring tab:', error);
      return false;
    }
  }

  async saveTabsAsSession(sessionName, tabsData) {
    try {
      // Group tabs by windowId
      const windowGroups = {};
      for (const tab of tabsData) {
        const windowId = tab.windowId || 'default';
        if (!windowGroups[windowId]) {
          windowGroups[windowId] = [];
        }
        windowGroups[windowId].push(tab);
      }
      
      // Convert to windows array
      const windowsData = Object.entries(windowGroups).map(([windowId, tabs]) => ({
        windowId: windowId,
        tabs: tabs
      }));
      
      return await this.saveWindowsAsSession(sessionName, windowsData);
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  }
  
  async saveWindowsAsSession(sessionName, windowsData) {
    try {
      const totalTabs = windowsData.reduce((sum, window) => sum + window.tabs.length, 0);
      
      const session = {
        id: `session_${crypto.randomUUID()}`,
        name: sessionName,
        windows: windowsData,
        tabs: windowsData.flatMap(w => w.tabs), // For backward compatibility
        tabCount: totalTabs,
        windowCount: windowsData.length,
        created: Date.now(),
        lastAccessed: Date.now()
      };

      // Use StorageManager for persistent session storage
      return await this.storageManager.addSession(session);
    } catch (error) {
      console.error('Error saving windows session:', error);
      throw error;
    }
  }

  async restoreTabsFromSession(sessionId, selectedTabs = null) {
    try {
      const sessions = await this.storageManager.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // If session has windows data, use the enhanced restoration
      if (session.windows && session.windows.length > 0) {
        return await this.restoreWindowsFromSession(sessionId, selectedTabs);
      }
      
      // Fallback for legacy sessions without window data
      const tabsToRestore = selectedTabs || session.tabs;
      const restoredTabs = [];

      for (const tabData of tabsToRestore) {
        try {
          const newTab = await chrome.tabs.create({
            url: tabData.url,
            active: false,
            pinned: tabData.pinned || false
          });
          
          restoredTabs.push(newTab);
        } catch (error) {
          console.error('Error restoring individual tab:', error);
        }
      }

      return restoredTabs;
    } catch (error) {
      console.error('Error restoring tabs from session:', error);
      throw error;
    }
  }
  
  async restoreWindowsFromSession(sessionId, selectedTabs = null) {
    try {
      const sessions = await this.storageManager.getSessions();
      const session = sessions.find(s => s.id === sessionId);
      
      if (!session) {
        throw new Error('Session not found');
      }

      const windowsToRestore = session.windows || [];
      const restoredWindows = [];
      
      for (const windowData of windowsToRestore) {
        try {
          let tabsToRestore = windowData.tabs;
          
          // Filter to selected tabs if specified
          if (selectedTabs) {
            const selectedUrls = new Set(selectedTabs.map(t => t.url));
            tabsToRestore = tabsToRestore.filter(tab => selectedUrls.has(tab.url));
          }
          
          if (tabsToRestore.length === 0) continue;
          
          // Create the window with the first tab
          const firstTab = tabsToRestore[0];
          const newWindow = await chrome.windows.create({
            url: firstTab.url
          });
          
          // Update the first tab properties
          if (firstTab.pinned) {
            await chrome.tabs.update(newWindow.tabs[0].id, { pinned: true });
          }
          
          // Create remaining tabs in the window
          for (let i = 1; i < tabsToRestore.length; i++) {
            const tabData = tabsToRestore[i];
            try {
              const newTab = await chrome.tabs.create({
                url: tabData.url,
                windowId: newWindow.id,
                index: tabData.index,
                active: false,
                pinned: tabData.pinned || false
              });
              
              newWindow.tabs.push(newTab);
            } catch (error) {
              console.error('Error restoring individual tab:', error);
            }
          }
          
          // Activate the originally active tab
          const originallyActiveTab = tabsToRestore.find(t => t.active);
          if (originallyActiveTab) {
            const activeTabIndex = tabsToRestore.findIndex(t => t.active);
            if (activeTabIndex >= 0 && newWindow.tabs[activeTabIndex]) {
              await chrome.tabs.update(newWindow.tabs[activeTabIndex].id, { active: true });
            }
          }
          
          restoredWindows.push(newWindow);
        } catch (error) {
          console.error('Error restoring window:', error);
        }
      }

      return restoredWindows;
    } catch (error) {
      console.error('Error restoring windows from session:', error);
      throw error;
    }
  }


  async saveSuspendedTabs() {
    const suspendedTabs = Array.from(this.suspendedTabs.values());
    await chrome.storage.local.set({ suspendedTabs });
  }

  startInactiveTabSuspension() {
    const timeoutMinutes = this.settings.suspendTimeoutMinutes || 30;
    
    setInterval(async () => {
      try {
        const tabs = await chrome.tabs.query({});
        const activeTab = await chrome.tabs.query({ active: true, currentWindow: true });
        const activeTabId = activeTab[0]?.id;
        
        for (const tab of tabs) {
          if (tab.id !== activeTabId && 
              this.canSuspendTab(tab.url) &&
              !this.suspendedTabIds.has(tab.id)) {
            
            const lastAccessed = await this.getTabLastAccessed(tab.id);
            const now = Date.now();
            
            if (now - lastAccessed > timeoutMinutes * 60 * 1000) {
              await this.suspendTab(tab.id);
            }
          }
        }
      } catch (error) {
        console.error('Error in inactive tab suspension:', error);
      }
    }, 60000);
  }

  async getTabLastAccessed(_tabId) {
    // TODO: Implement actual tab activity tracking using chrome.tabs.onActivated,
    // chrome.tabs.onUpdated, and chrome.windows.onFocusChanged events
    // For now, return current time to prevent automatic suspension
    return Date.now();
  }

  async searchTabs(query) {
    const allTabs = await this.getAllTabs();
    const sessions = await this.storageManager.getSessions();
    
    const results = {
      openTabs: [],
      sessionTabs: []
    };

    const searchQuery = query.toLowerCase();

    results.openTabs = allTabs.filter(tab => 
      tab.title.toLowerCase().includes(searchQuery) ||
      tab.url.toLowerCase().includes(searchQuery)
    );

    for (const session of sessions) {
      const matchingTabs = session.tabs.filter(tab =>
        tab.title.toLowerCase().includes(searchQuery) ||
        tab.url.toLowerCase().includes(searchQuery)
      );
      
      if (matchingTabs.length > 0) {
        results.sessionTabs.push({
          session: session,
          tabs: matchingTabs
        });
      }
    }

    return results;
  }

  async cleanupOrphanedSuspensions() {
    const now = Date.now();
    const threshold = 30 * 24 * 60 * 60 * 1000; // 30 days
    let cleanedCount = 0;
    const toDelete = [];
    
    for (const [uniqueId, suspendedTab] of this.suspendedTabs.entries()) {
      if (typeof suspendedTab.suspended === 'number' && 
          Number.isFinite(suspendedTab.suspended) && 
          (now - suspendedTab.suspended > threshold)) {
        toDelete.push(uniqueId);
        cleanedCount++;
      }
    }
    
    toDelete.forEach(uniqueId => {
      const suspendedTab = this.suspendedTabs.get(uniqueId);
      if (suspendedTab) {
        this.suspendedTabIds.delete(suspendedTab.id);
      }
      this.suspendedTabs.delete(uniqueId);
    });
    
    if (cleanedCount > 0) {
      await this.saveSuspendedTabs();
      console.log(`Cleaned up ${cleanedCount} old suspended tabs (older than 30 days)`);
    }
    
    return cleanedCount;
  }
}

// Make TabManager available globally in contexts that have window object
if (typeof window !== 'undefined') {
  window.TabManager = TabManager;
}
