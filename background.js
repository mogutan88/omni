class OmniBackground {
  constructor() {
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    chrome.runtime.onInstalled.addListener(() => {
      this.initializeStorage();
    });

    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    chrome.windows.onRemoved.addListener((windowId) => {
      this.handleWindowRemoved(windowId);
    });
  }

  async initializeStorage() {
    const defaultData = {
      sessions: [],
      workspaces: [{
        id: 'default',
        name: 'Default Workspace',
        tabs: [],
        created: Date.now(),
        lastAccessed: Date.now()
      }],
      suspendedTabs: [],
      settings: {
        autoSave: true,
        suspendInactive: true,
        suspendTimeoutMinutes: 30
      }
    };

    const existing = await chrome.storage.local.get();
    if (Object.keys(existing).length === 0) {
      await chrome.storage.local.set(defaultData);
    }
  }

  async handleCommand(command) {
    switch (command) {
      case 'convert-all-tabs':
        await this.convertAllTabs();
        break;
      case 'open-popup':
        chrome.action.openPopup();
        break;
    }
  }

  async convertAllTabs() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      const allTabs = [];
      
      for (const window of windows) {
        for (const tab of window.tabs) {
          if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
            allTabs.push({
              id: tab.id,
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl,
              windowId: window.id,
              index: tab.index,
              saved: Date.now()
            });
            
            await chrome.tabs.remove(tab.id);
          }
        }
      }

      if (allTabs.length > 0) {
        await this.saveSession('Converted Session', allTabs);
        
        chrome.tabs.create({
          url: chrome.runtime.getURL('popup.html')
        });
      }
    } catch (error) {
      console.error('Error converting tabs:', error);
    }
  }

  async saveSession(name, tabs) {
    try {
      // Try sync storage with fallback to local
      const data = await chrome.storage.sync.get(['sessions']);
      const sessions = data.sessions || [];
      
      const session = {
        id: Date.now().toString(),
        name: name || `Session ${sessions.length + 1}`,
        tabs: tabs,
        created: Date.now(),
        tabCount: tabs.length
      };
      
      sessions.unshift(session);
      
      // Limit to 20 sessions for sync storage
      if (sessions.length > 20) {
        sessions.splice(20);
      }
      
      await chrome.storage.sync.set({ sessions });
      // Also backup to local storage
      await chrome.storage.local.set({ sessions_backup: sessions });
      
      return session;
    } catch (error) {
      console.warn('Sync storage failed, using local storage:', error);
      
      // Fallback to local storage
      const data = await chrome.storage.local.get(['sessions_backup']);
      const sessions = data.sessions_backup || [];
      
      const session = {
        id: Date.now().toString(),
        name: name || `Session ${sessions.length + 1}`,
        tabs: tabs,
        created: Date.now(),
        tabCount: tabs.length
      };
      
      sessions.unshift(session);
      if (sessions.length > 20) {
        sessions.splice(20);
      }
      
      await chrome.storage.local.set({ sessions_backup: sessions });
      return session;
    }
  }

  async handleTabRemoved(tabId) {
    const data = await chrome.storage.local.get(['suspendedTabs']);
    const suspendedTabs = data.suspendedTabs || [];
    
    const updatedTabs = suspendedTabs.filter(tab => tab.id !== tabId);
    if (updatedTabs.length !== suspendedTabs.length) {
      await chrome.storage.local.set({ suspendedTabs: updatedTabs });
    }
  }

  async handleWindowRemoved(windowId) {
    const data = await chrome.storage.local.get(['suspendedTabs']);
    const suspendedTabs = data.suspendedTabs || [];
    
    const updatedTabs = suspendedTabs.filter(tab => tab.windowId !== windowId);
    if (updatedTabs.length !== suspendedTabs.length) {
      await chrome.storage.local.set({ suspendedTabs: updatedTabs });
    }
  }
}

new OmniBackground();