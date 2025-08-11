class TabManager {
  constructor() {
    this.suspendedTabs = new Map();
    this.storageManager = new StorageManager();
    this.initializeTabSuspension();
  }

  async initializeTabSuspension() {
    const data = await chrome.storage.local.get(['settings', 'suspendedTabs']);
    this.settings = data.settings || {};
    
    if (data.suspendedTabs) {
      data.suspendedTabs.forEach(tab => {
        this.suspendedTabs.set(tab.id, tab);
      });
    }

    // Migrate any existing local sessions to sync storage
    await this.storageManager.migrateLocalSessions();

    if (this.settings.suspendInactive) {
      this.startInactiveTabSuspension();
    }
  }

  async getAllTabs() {
    const windows = await chrome.windows.getAll({ populate: true });
    const allTabs = [];
    
    for (const window of windows) {
      for (const tab of window.tabs) {
        if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          allTabs.push({
            ...tab,
            windowId: window.id,
            suspended: this.suspendedTabs.has(tab.id)
          });
        }
      }
    }
    
    return allTabs;
  }

  async convertAllTabs() {
    try {
      const allTabs = await this.getAllTabs();
      const tabsToConvert = allTabs.filter(tab => !tab.suspended);
      
      const convertedTabs = [];
      
      for (const tab of tabsToConvert) {
        convertedTabs.push({
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl,
          windowId: tab.windowId,
          index: tab.index,
          saved: Date.now()
        });
        
        await chrome.tabs.remove(tab.id);
      }

      if (convertedTabs.length > 0) {
        await this.saveTabsAsSession('Converted Tabs', convertedTabs);
      }
      
      return convertedTabs;
    } catch (error) {
      console.error('Error converting tabs:', error);
      throw error;
    }
  }

  async suspendTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      
      if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
        return false;
      }

      const suspendedTab = {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        windowId: tab.windowId,
        index: tab.index,
        suspended: Date.now()
      };

      this.suspendedTabs.set(tab.id, suspendedTab);
      await this.saveSuspendedTabs();

      await chrome.tabs.update(tab.id, {
        url: chrome.runtime.getURL(`suspended.html?id=${tab.id}`)
      });

      return true;
    } catch (error) {
      console.error('Error suspending tab:', error);
      return false;
    }
  }

  async restoreTab(tabId) {
    try {
      const suspendedTab = this.suspendedTabs.get(tabId);
      if (!suspendedTab) {
        return false;
      }

      await chrome.tabs.update(tabId, { url: suspendedTab.url });
      this.suspendedTabs.delete(tabId);
      await this.saveSuspendedTabs();

      return true;
    } catch (error) {
      console.error('Error restoring tab:', error);
      return false;
    }
  }

  async saveTabsAsSession(sessionName, tabsData) {
    console.log('TabManager.saveTabsAsSession called:', { sessionName, tabCount: tabsData.length });
    try {
      const session = {
        id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: sessionName,
        tabs: tabsData,
        tabCount: tabsData.length,
        created: Date.now(),
        lastAccessed: Date.now()
      };

      console.log('Created session object:', {
        id: session.id,
        name: session.name,
        tabCount: session.tabCount,
        sessionSize: new Blob([JSON.stringify(session)]).size + ' bytes'
      });

      // Use StorageManager for persistent session storage
      const result = await this.storageManager.addSession(session);
      console.log('TabManager.saveTabsAsSession completed successfully');
      return result;
    } catch (error) {
      console.error('Error in TabManager.saveTabsAsSession:', error);
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

      const tabsToRestore = selectedTabs || session.tabs;
      const restoredTabs = [];

      for (const tabData of tabsToRestore) {
        try {
          const newTab = await chrome.tabs.create({
            url: tabData.url,
            active: false
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
              !tab.url.startsWith('chrome://') && 
              !tab.url.startsWith('chrome-extension://') &&
              !this.suspendedTabs.has(tab.id)) {
            
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

  async getTabLastAccessed(tabId) {
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
}

window.TabManager = TabManager;