importScripts('src/storage-manager.js');

class OmniBackground {
  constructor() {
    this.storageManager = new StorageManager();
    this.lastNotificationTime = 0;
    this.notificationThrottle = 500; // 500ms throttle
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    chrome.commands.onCommand.addListener((command) => {
      this.handleCommand(command);
    });

    // Tab lifecycle events
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      this.handleTabRemoved(tabId);
      this.notifyTabCountChanged();
    });

    chrome.tabs.onCreated.addListener((tab) => {
      this.notifyTabCountChanged();
    });

    chrome.windows.onRemoved.addListener((windowId) => {
      this.handleWindowRemoved(windowId);
      this.notifyTabCountChanged();
    });

    chrome.windows.onCreated.addListener((window) => {
      this.notifyTabCountChanged();
    });
  }

  async saveSession(name, tabs) {
    const session = {
      id: Date.now().toString(),
      name: name || `Session ${new Date().toLocaleString()}`,
      tabs: tabs,
      created: Date.now(),
      tabCount: tabs.length
    };
    return await this.storageManager.addSession(session);
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

  // Check if a tab can be converted (saved and closed)
  canConvertTab(url) {
    if (!url) return false;
    
    // Allow regular web pages (http/https) - these can be meaningfully saved
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }
    
    // Allow file URLs - these can be meaningfully saved
    if (url.startsWith('file://')) {
      return true;
    }
    
    // Don't convert Chrome internal pages - not meaningful to save chrome://settings etc.
    if (url.startsWith('chrome://')) {
      return false;
    }
    
    // Don't convert extension pages
    if (url.startsWith('chrome-extension://')) {
      return false;
    }
    
    // Don't convert blank tabs - nothing meaningful to save
    if (url === 'about:blank') {
      return false;
    }
    
    // Allow other protocols that can be converted (ftp, etc.)
    return true;
  }

  // Notify manager page about tab count changes (with throttling)
  async notifyTabCountChanged() {
    const now = Date.now();
    
    // Throttle notifications to avoid spam
    if (now - this.lastNotificationTime < this.notificationThrottle) {
      return;
    }
    
    this.lastNotificationTime = now;
    
    try {
      // Send message to all extension pages
      chrome.runtime.sendMessage({
        type: 'TAB_COUNT_CHANGED',
        timestamp: now
      }).catch(() => {
        // Ignore errors if no listeners are active
      });
    } catch (error) {
      // Ignore messaging errors when no listeners
    }
  }
}

new OmniBackground();