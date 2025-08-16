class OmniManager {
  constructor() {
    this.currentView = 'overview';
    this.tabManager = null;
    this.searchManager = null;
    this.storageManager = new StorageManager();
    this.sidebarCollapsed = false;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize managers
      this.tabManager = new TabManager();
      this.searchManager = new SearchManager(this.tabManager, null);
      
      await this.initializeManagers();
      this.setupEventListeners();
      this.setupMessageListeners();
      await this.loadSettings();
      this.loadOverview();
      this.updateSidebarBadges();
      
      // Check for URL parameters to navigate to specific view
      this.handleUrlNavigation();
    } catch (error) {
      console.error('Error initializing manager:', error);
      this.showToast('Failed to initialize extension', 'error');
    }
  }

  async initializeManagers() {
    await Promise.all([
      this.tabManager.initializeTabSuspension(),
      this.searchManager.loadSearchHistory()
    ]);
  }

  setupMessageListeners() {
    // Listen for tab count changes from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'TAB_COUNT_CHANGED') {
        // Update badges when tab count changes
        this.updateSidebarBadges();
        
        // If we're currently viewing All Tabs, refresh the view
        if (this.currentView === 'tabs') {
          this.loadTabs();
        }
        
        // If we're currently viewing Overview, refresh the view
        if (this.currentView === 'overview') {
          this.loadOverview();
        }
      }
      return true; // Keep the message channel open for async response
    });
  }

  setupEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        const view = e.currentTarget.dataset.view;
        this.switchView(view);
      });
    });

    // Menu toggle
    document.getElementById('menuToggle')?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // Quick actions in sidebar
    document.getElementById('quickSave')?.addEventListener('click', () => {
      this.quickSaveSession();
    });

    document.getElementById('quickConvert')?.addEventListener('click', () => {
      this.convertAllTabs();
    });

    document.getElementById('openPopup')?.addEventListener('click', () => {
      chrome.action.openPopup();
    });

    // Header actions
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
      this.refreshCurrentView();
    });

    document.getElementById('helpBtn')?.addEventListener('click', () => {
      this.showHelp();
    });

    // Global search
    document.getElementById('globalSearch')?.addEventListener('input', (e) => {
      this.handleGlobalSearch(e.target.value);
    });

    // Tab item click handlers (event delegation)
    this.setupTabItemHandlers();

    // View-specific actions
    this.setupOverviewActions();
    this.setupSessionActions();
    this.setupTabActions();
    this.setupSearchActions();
    this.setupPreferencesActions();
    this.setupSessionModalActions();
    
    // Modal close handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    document.getElementById('modalOverlay')?.addEventListener('click', () => {
      this.closeModals();
    });

    // Window resize handler
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        this.sidebarCollapsed = false;
        document.querySelector('.sidebar')?.classList.remove('collapsed');
      }
    });
  }

  setupOverviewActions() {
    // Quick action cards
    document.querySelectorAll('.quick-action-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const label = e.currentTarget.querySelector('.action-label').textContent;
        switch (label) {
          case 'Save Current Window':
            this.showSessionModal(true);
            break;
          case 'Save Session':
            this.showSessionModal();
            break;
          case 'Sync Data':
            this.syncData();
            break;
          case 'Export':
            this.exportData();
            break;
        }
      });
    });
  }

  setupSessionActions() {
    document.getElementById('saveSessionBtn')?.addEventListener('click', () => {
      this.showSessionModal();
    });

    // Select all checkbox
    document.querySelector('.select-all')?.addEventListener('change', (e) => {
      const checkboxes = document.querySelectorAll('.session-checkbox');
      checkboxes.forEach(cb => cb.checked = e.target.checked);
      this.updateBulkActions();
    });
  }

  setupTabActions() {
    // Filter chips
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        e.target.classList.add('active');
        this.filterTabs(e.target.textContent.toLowerCase());
      });
    });
  }

  setupSearchActions() {
    // Search filter checkboxes - no separate search input needed since we use global search
    const filterCheckboxes = document.querySelectorAll('.filter-checkbox input[type="checkbox"]');
    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        // Re-perform search if there's an active query in global search
        const globalQuery = document.getElementById('globalSearch').value;
        if (globalQuery && globalQuery.length >= 2) {
          this.performSearch(globalQuery);
        }
      });
    });
  }

  setupPreferencesActions() {
    // Save settings
    document.querySelector('.settings-actions .btn-primary')?.addEventListener('click', () => {
      this.saveSettings();
    });

    // Reset settings
    document.querySelector('.settings-actions .btn-secondary')?.addEventListener('click', () => {
      this.resetSettings();
    });

    // Export sessions
    document.getElementById('exportSessionsBtn')?.addEventListener('click', () => {
      this.exportSessions();
    });

    // Import sessions
    document.getElementById('importSessionsBtn')?.addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });

    // Handle file input for import
    document.getElementById('importFileInput')?.addEventListener('change', (e) => {
      this.handleImportFile(e);
    });

    // Clear all data
    document.getElementById('clearAllDataBtn')?.addEventListener('click', () => {
      this.clearAllData();
    });

    // Clean bookmarks backups
    document.getElementById('cleanBackupsBtn')?.addEventListener('click', async () => {
      if (!confirm('Remove the bookmarks backup folder (Auto Backup) under Omni Sessions?')) return;
      try {
        const result = await this.storageManager.cleanBookmarksBackup();
        if (result.deleted) {
          this.showToast('Bookmarks backups cleaned', 'success');
        } else {
          this.showToast('No backups found to clean', 'info');
        }
      } catch (e) {
        console.error('Error cleaning bookmarks backups:', e);
        this.showToast('Failed to clean backups', 'error');
      }
    });
  }

  setupSessionModalActions() {
    // Session modal actions
    document.getElementById('cancelSession')?.addEventListener('click', () => {
      this.closeModals();
    });

    document.getElementById('saveSessionConfirm')?.addEventListener('click', () => {
      this.saveSession();
    });
  }

  setupTabItemHandlers() {
    // Event delegation for tab items and action buttons
    document.addEventListener('click', (e) => {
      // Handle tab item clicks
      const tabItem = e.target.closest('.tab-item');
      if (tabItem && !e.target.closest('.tab-actions')) {
        const tabId = parseInt(tabItem.dataset.tabId);
        const isSuspended = tabItem.dataset.suspended === 'true';
        this.handleTabItemClick(tabId, isSuspended);
        return;
      }

      // Handle tab action button clicks
      const tabActionButton = e.target.closest('.btn-icon[data-tab-id]');
      if (tabActionButton) {
        const tabIdentifier = tabActionButton.dataset.tabId;
        
        if (tabActionButton.classList.contains('tab-action-switch')) {
          this.switchToTab(parseInt(tabIdentifier));
        } else if (tabActionButton.classList.contains('tab-action-restore')) {
          this.restoreTab(tabIdentifier);
        } else if (tabActionButton.classList.contains('tab-action-suspend')) {
          this.suspendTab(parseInt(tabIdentifier));
        } else if (tabActionButton.classList.contains('tab-action-close')) {
          this.closeTab(parseInt(tabIdentifier));
        }
        return;
      }

      // Handle session action button clicks
      const sessionActionButton = e.target.closest('.btn-icon[data-session-id]');
      if (sessionActionButton) {
        const sessionId = sessionActionButton.dataset.sessionId;
        
        if (sessionActionButton.classList.contains('session-action-restore')) {
          this.restoreSession(sessionId);
        }
        return;
      }
      
      // Handle session restore button clicks
      const sessionRestoreBtn = e.target.closest('.session-restore-btn');
      if (sessionRestoreBtn) {
        const sessionId = sessionRestoreBtn.dataset.sessionId;
        console.log('Session restore button clicked for:', sessionId);
        this.restoreSession(sessionId);
        return;
      }
      
      // Handle session restore windows button clicks
      const sessionRestoreWindowBtn = e.target.closest('.session-restore-window-btn');
      if (sessionRestoreWindowBtn) {
        const sessionId = sessionRestoreWindowBtn.dataset.sessionId;
        console.log('Session restore windows button clicked for:', sessionId);
        this.restoreSessionWindows(sessionId);
        return;
      }
      
      // Handle session delete button clicks
      const sessionDeleteBtn = e.target.closest('.session-delete-btn');
      if (sessionDeleteBtn) {
        const sessionId = sessionDeleteBtn.dataset.sessionId;
        console.log('Session delete button clicked for:', sessionId);
        this.deleteSession(sessionId);
        return;
      }

    });
  }

  switchView(viewName) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');

    // Update content
    document.querySelectorAll('.view-container').forEach(view => {
      view.classList.remove('active');
    });
    document.getElementById(`${viewName}View`)?.classList.add('active');

    // Update page title
    const titles = {
      overview: 'Overview',
      sessions: 'Sessions',
      tabs: 'All Tabs',
      search: 'Search',
      history: 'History',
      analytics: 'Analytics',
      preferences: 'Preferences',
      development: 'Development'
    };
    
    document.getElementById('pageTitle').textContent = titles[viewName] || viewName;
    this.currentView = viewName;

    // Load view-specific data
    this.loadViewData(viewName);
  }

  async loadViewData(viewName) {
    switch (viewName) {
      case 'overview':
        await this.loadOverview();
        break;
      case 'sessions':
        await this.loadSessions();
        break;
      case 'tabs':
        await this.loadTabs();
        break;
      case 'search':
        await this.loadSearch();
        break;
      case 'history':
        await this.loadHistory();
        break;
      case 'analytics':
        await this.loadAnalytics();
        break;
      case 'development':
        await this.loadDevelopment();
        break;
    }
  }

  async loadOverview() {
    try {
      // Load statistics
      const [tabs, sessions, suspendedTabs] = await Promise.all([
        this.tabManager.getAllTabs(),
        this.getSessions(),
        this.getSuspendedTabs()
      ]);

      // Update stat cards
      // Count unique windows from tabs
      const uniqueWindows = new Set(tabs.map(tab => tab.windowId));
      const windowsCount = uniqueWindows.size;

      document.getElementById('activeTabs').textContent = tabs.filter(t => !t.suspended).length;
      document.getElementById('totalWindows').textContent = windowsCount;
      document.getElementById('suspendedTabs').textContent = suspendedTabs.length;
      document.getElementById('totalSessions').textContent = sessions.length;

      // Calculate memory saved (approximate)
      const memorySaved = suspendedTabs.length * 50; // Assume 50MB per tab
      document.getElementById('memorySaved').textContent = `${memorySaved} MB`;

      // Load recent activity
      this.loadRecentActivity();
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  }

  async loadSessions() {
    try {
      const sessions = await this.getSessions();
      const tbody = document.getElementById('sessionsTableBody');
      
      if (sessions.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="empty-state">
              <div>No saved sessions</div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = sessions.map(session => `
        <tr data-session-id="${session.id}">
          <td><input type="checkbox" class="session-checkbox" data-id="${session.id}"></td>
          <td>
            <div>${this.escapeHtml(session.name)}</div>
            ${session.windowCount ? `<small class="text-muted">${session.windowCount} windows</small>` : ''}
          </td>
          <td>${session.tabCount}</td>
          <td>${this.formatDate(session.created)}</td>
          <td>${this.formatDate(session.created)}</td>
          <td>
            <button class="btn btn-sm session-restore-btn" data-session-id="${session.id}">Restore</button>
            ${session.windows && session.windows.length > 1 ? 
              `<button class="btn btn-sm session-restore-window-btn" data-session-id="${session.id}">Restore Windows</button>` : 
              ''}
            <button class="btn btn-sm session-delete-btn" data-session-id="${session.id}">Delete</button>
          </td>
        </tr>
      `).join('');

      // Setup checkbox listeners
      document.querySelectorAll('.session-checkbox').forEach(cb => {
        cb.addEventListener('change', () => this.updateBulkActions());
      });
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  async loadTabs() {
    try {
      const tabs = await this.tabManager.getAllTabs();
      const container = document.getElementById('tabsContainer');
      
      // Update stats
      document.getElementById('totalTabCount').textContent = tabs.length;
      document.getElementById('activeTabCount').textContent = tabs.filter(t => !t.suspended).length;
      document.getElementById('suspendedTabCount').textContent = tabs.filter(t => t.suspended).length;

      // Group tabs by window
      const tabsByWindow = {};
      tabs.forEach(tab => {
        if (!tabsByWindow[tab.windowId]) {
          tabsByWindow[tab.windowId] = [];
        }
        tabsByWindow[tab.windowId].push(tab);
      });

      // Render tabs
      container.innerHTML = Object.entries(tabsByWindow).map(([windowId, windowTabs]) => `
        <div class="tab-group">
          <div class="tab-group-header">
            <h3>Window ${windowId}</h3>
            <span class="tab-count">${windowTabs.length} tabs</span>
          </div>
          <div class="tab-list">
            ${windowTabs.map(tab => `
              <div class="tab-item ${tab.suspended ? 'suspended' : ''}" data-tab-id="${tab.id}" data-suspended="${tab.suspended}">
                <img class="tab-favicon favicon-img" src="${this.getFaviconUrl(tab)}" alt="">
                <div class="tab-content">
                  <div class="tab-title">${this.escapeHtml(tab.title)}</div>
                  <div class="tab-url">${this.escapeHtml(this.extractDomain(tab.url))}</div>
                </div>
                <div class="tab-actions">
                  <button class="btn-icon tab-action-switch" data-tab-id="${tab.id}" title="Switch to tab">
                    <span class="icon">↗️</span>
                  </button>
                  ${tab.suspended ? `
                    <button class="btn-icon tab-action-restore" data-tab-id="${tab.id}" title="Restore">
                      <span class="icon">▶️</span>
                    </button>
                  ` : `
                    <button class="btn-icon tab-action-suspend" data-tab-id="${tab.id}" title="Suspend">
                      <span class="icon">⏸️</span>
                    </button>
                  `}
                  <button class="btn-icon tab-action-close" data-tab-id="${tab.id}" title="Close">
                    <span class="icon">❌</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
      this.addFaviconErrorHandlers();
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }

  async loadRecentActivity() {
    const activities = [
      { icon: '💾', text: 'Session saved', time: '2 minutes ago' },
      { icon: '😴', text: '5 tabs suspended', time: '3 hours ago' },
      { icon: '↗️', text: 'Session restored', time: 'Yesterday' }
    ];

    const container = document.getElementById('activityList');
    container.innerHTML = activities.map(activity => `
      <div class="activity-item">
        <span class="activity-icon">${activity.icon}</span>
        <span class="activity-text">${activity.text}</span>
        <span class="activity-time">${activity.time}</span>
      </div>
    `).join('');
  }

  async loadHistory() {
    // Implement history loading
    const container = document.getElementById('historyTimeline');
    container.innerHTML = '<p>History feature coming soon...</p>';
  }

  async loadAnalytics() {
    // Implement analytics loading
    // This would integrate with Chart.js or similar library
    const container = document.querySelector('.analytics-dashboard');
    if (!container.querySelector('p')) {
      container.insertAdjacentHTML('afterbegin', '<p>Analytics visualization coming soon...</p>');
    }
  }

  async loadDevelopment() {
    // Copy development functionality from popup
    const container = document.querySelector('.dev-container');
    container.innerHTML = '<p>Development tools (same as in popup Dev tab)</p>';
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    const sidebar = document.querySelector('.sidebar');
    if (this.sidebarCollapsed) {
      sidebar.classList.add('collapsed');
    } else {
      sidebar.classList.remove('collapsed');
    }
  }

  async updateSidebarBadges() {
    try {
      const [tabs, sessions] = await Promise.all([
        this.tabManager.getAllTabs(),
        this.getSessions()
      ]);

      document.getElementById('tabCount').textContent = tabs.length;
      document.getElementById('sessionCount').textContent = sessions.length;
    } catch (error) {
      console.error('Error updating badges:', error);
    }
  }

  showSessionModal(currentWindowOnly = false) {
    document.getElementById('sessionModal').classList.remove('hidden');
    document.getElementById('modalOverlay').classList.remove('hidden');
    
    const nameInput = document.getElementById('sessionName');
    const includeAllWindows = document.getElementById('includeAllWindows');
    
    if (!nameInput || !includeAllWindows) {
      console.error('Session modal elements not found');
      return;
    }
    
    nameInput.value = `Session ${new Date().toLocaleString()}`;
    includeAllWindows.checked = !currentWindowOnly;
    nameInput.focus();
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
    });
    document.getElementById('modalOverlay').classList.add('hidden');
  }

  async quickSaveSession() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      const windowsData = [];
      
      for (const window of windows) {
        const userTabs = window.tabs.filter(tab => this.tabManager.isUserTab(tab.url));
        
        if (userTabs.length > 0) {
          windowsData.push({
            windowId: window.id,
            tabs: userTabs.map(tab => ({
              id: tab.id,
              url: tab.url,
              title: tab.title,
              favIconUrl: tab.favIconUrl,
              windowId: tab.windowId,
              index: tab.index,
              pinned: tab.pinned,
              active: tab.active,
              saved: Date.now()
            }))
          });
        }
      }
      
      if (windowsData.length > 0) {
        const sessionName = `Quick Save ${new Date().toLocaleString()}`;
        await this.tabManager.saveWindowsAsSession(sessionName, windowsData);
        this.showToast('Session saved successfully', 'success');
        await this.updateSidebarBadges();
      } else {
        this.showToast('No tabs to save', 'warning');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      this.showToast('Failed to save session', 'error');
    }
  }

  async convertAllTabs() {
    try {
      await this.tabManager.convertAllTabs();
      this.showToast('All tabs converted', 'success');
      await this.refreshCurrentView();
    } catch (error) {
      console.error('Error converting tabs:', error);
      this.showToast('Failed to convert tabs', 'error');
    }
  }

  async refreshCurrentView() {
    await this.loadViewData(this.currentView);
    await this.updateSidebarBadges();
    this.showToast('Refreshed', 'success');
  }

  async handleGlobalSearch(query) {
    // Switch to search view
    this.switchView('search');
    
    // Perform search (will show all items if query is empty)
    await this.performSearch(query);
  }

  async performSearch(query = '') {
    try {
      // Get search filter options
      const filterCheckboxes = document.querySelectorAll('.filter-checkbox input[type="checkbox"]');
      const searchOptions = {};
      
      filterCheckboxes.forEach((checkbox, index) => {
        const isChecked = checkbox.checked;
        switch (index) {
          case 0: // Tabs
            searchOptions.excludeOpenTabs = !isChecked;
            searchOptions.excludeSuspended = !isChecked;
            break;
          case 1: // Sessions
            searchOptions.excludeSessions = !isChecked;
            break;
          case 2: // History
            // History functionality can be implemented later
            break;
        }
      });

      let results;
      if (!query || query.trim().length === 0) {
        // Show all items when no search query
        results = await this.getAllItemsForSearch(searchOptions);
      } else {
        // Perform actual search
        results = await this.searchManager.universalSearch(query, searchOptions);
      }
      const container = document.getElementById('searchResults');
      
      if (results.total === 0) {
        container.innerHTML = '<p>No results found</p>';
        return;
      }

      // Render search results
      const displayMessage = query && query.trim().length > 0 ? 
        `${results.total} results found for "${this.escapeHtml(query)}"` :
        `Showing all ${results.total} items`;
      
      container.innerHTML = `
        <div class="search-result-count">${displayMessage}</div>
        ${results.openTabs.length > 0 ? `
          <div class="result-section">
            <h3>Open Tabs (${results.openTabs.length})</h3>
            ${this.renderTabsGroupedByWindow(results.openTabs, false)}
          </div>
        ` : ''}
        ${results.suspendedTabs.length > 0 ? `
          <div class="result-section">
            <h3>Suspended Tabs (${results.suspendedTabs.length})</h3>
            ${this.renderTabsGroupedByWindow(results.suspendedTabs, true)}
          </div>
        ` : ''}
        ${results.sessions.length > 0 ? `
          <div class="result-section">
            <h3>Sessions (${results.sessions.length})</h3>
            ${results.sessions.map(item => `
              <div class="session-item" data-session-id="${item.session.id}">
                <div class="item-icon">💾</div>
                <div class="item-content">
                  <div class="item-title">${this.escapeHtml(item.session.name)}</div>
                  <div class="item-subtitle">${item.totalMatches} matching tabs • ${this.formatDate(item.session.created)}</div>
                </div>
                <div class="item-actions">
                  <button class="btn-icon session-action-restore" data-session-id="${item.session.id}" title="Restore Session">
                    <span class="icon">↗️</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
      this.addFaviconErrorHandlers();
    } catch (error) {
      console.error('Error performing search:', error);
    }
  }

  async restoreSession(sessionId) {
    try {
      await this.tabManager.restoreTabsFromSession(sessionId);
      this.showToast('Session restored', 'success');
    } catch (error) {
      console.error('Error restoring session:', error);
      this.showToast('Failed to restore session: ' + error.message, 'error');
    }
  }

  async restoreSessionWindows(sessionId) {
    try {
      const result = await this.tabManager.restoreWindowsFromSession(sessionId);
      this.showToast(`Restored ${result.length} windows`, 'success');
    } catch (error) {
      console.error('Error restoring session windows:', error);
      this.showToast('Failed to restore session windows: ' + error.message, 'error');
    }
  }

  async deleteSession(sessionId) {
    if (!confirm('Delete this session?')) return;

    try {
      await this.storageManager.removeSession(sessionId);
      
      this.showToast('Session deleted', 'success');
      await this.loadSessions();
      await this.updateSidebarBadges();
    } catch (error) {
      console.error('Error deleting session:', error);
      this.showToast('Failed to delete session: ' + error.message, 'error');
    }
  }

  async switchToTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
    } catch (error) {
      console.error('Error switching to tab:', error);
    }
  }

  async handleTabItemClick(tabIdentifier, isSuspended) {
    try {
      if (isSuspended) {
        // If tab is suspended, restore it (which will also switch to it)
        await this.restoreTab(tabIdentifier);
      } else {
        // If tab is active, just switch to it
        await this.switchToTab(parseInt(tabIdentifier));
      }
    } catch (error) {
      console.error('Error handling tab item click:', error);
    }
  }

  async suspendTab(tabId) {
    try {
      await this.tabManager.suspendTab(tabId);
      await this.loadTabs();
      this.showToast('Tab suspended', 'success');
    } catch (error) {
      console.error('Error suspending tab:', error);
    }
  }

  async restoreTab(uniqueId) {
    try {
      await this.tabManager.restoreTab(uniqueId);
      await this.loadTabs();
      this.showToast('Tab restored', 'success');
    } catch (error) {
      console.error('Error restoring tab:', error);
      this.showToast('Error restoring tab', 'error');
    }
  }

  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      await this.loadTabs();
      this.showToast('Tab closed', 'success');
    } catch (error) {
      console.error('Error closing tab:', error);
    }
  }

  async saveSession() {
    const name = document.getElementById('sessionName').value.trim() || `Session ${Date.now()}`;
    const includeAllWindows = document.getElementById('includeAllWindows').checked;

    try {
      let tabs;
      if (includeAllWindows) {
        tabs = await this.tabManager.getAllTabs();
      } else {
        // Get only current window tabs
        const currentWindow = await chrome.windows.getCurrent();
        const allTabs = await this.tabManager.getAllTabs();
        tabs = allTabs.filter(tab => tab.windowId === currentWindow.id);
      }
      
      const tabsData = tabs.map(tab => ({
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        windowId: tab.windowId,
        index: tab.index,
        saved: Date.now()
      }));

      await this.tabManager.saveTabsAsSession(name, tabsData);
      
      this.closeModals();
      this.showToast('Session saved successfully', 'success');
      
      // Refresh current view if it's sessions
      if (this.currentView === 'sessions') {
        await this.loadSessions();
      }
      
      await this.updateSidebarBadges();
    } catch (error) {
      console.error('Error saving session in manager:', error);
      this.showToast('Failed to save session: ' + error.message, 'error');
    }
  }

  async loadSettings() {
    try {
      const { settings } = await chrome.storage.local.get(['settings']);
      const bookmarksBackup = settings?.bookmarksBackup !== false; // default ON
      const bbEl = document.getElementById('bookmarksBackup');
      if (bbEl) bbEl.checked = bookmarksBackup;
    } catch (e) {
      // ignore
    }
  }

  async saveSettings() {
    try {
      const { settings: existing } = await chrome.storage.local.get(['settings']);
      const updated = { ...(existing || {}) };
      const bbEl = document.getElementById('bookmarksBackup');
      if (bbEl) updated.bookmarksBackup = !!bbEl.checked;
      await chrome.storage.local.set({ settings: updated });
      this.showToast('Settings saved', 'success');
    } catch (e) {
      console.error('Error saving settings:', e);
      this.showToast('Failed to save settings', 'error');
    }
  }

  async resetSettings() {
    if (!confirm('Reset all settings to defaults?')) return;
    try {
      const defaults = { bookmarksBackup: true };
      await chrome.storage.local.set({ settings: defaults });
      await this.loadSettings();
      this.showToast('Settings reset', 'success');
    } catch (e) {
      console.error('Error resetting settings:', e);
      this.showToast('Failed to reset settings', 'error');
    }
  }

  async exportData() {
    try {
      const data = await chrome.storage.local.get();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omni-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('Data exported', 'success');
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showToast('Export failed', 'error');
    }
  }

  async exportSessions() {
    try {
      await this.storageManager.exportSessions();
      this.showToast('Sessions exported successfully', 'success');
    } catch (error) {
      console.error('Error exporting sessions:', error);
      this.showToast('Failed to export sessions: ' + error.message, 'error');
    }
  }

  async handleImportFile(event) {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const text = await file.text();
      const result = await this.storageManager.importSessions(text, true); // Merge with existing

      this.showToast(`Successfully imported ${result.imported} sessions`, 'success');
      
      // Refresh current view if it's sessions
      if (this.currentView === 'sessions') {
        await this.loadSessions();
      }
      
      await this.updateSidebarBadges();
      
      // Reset the file input
      event.target.value = '';
    } catch (error) {
      console.error('Error importing sessions:', error);
      this.showToast('Failed to import sessions: ' + error.message, 'error');
    }
  }

  async clearAllData() {
    if (!confirm('⚠️ This will permanently delete ALL saved sessions and settings. Are you sure?')) {
      return;
    }

    if (!confirm('🚨 FINAL WARNING: This action cannot be undone. All your sessions will be lost forever. Continue?')) {
      return;
    }

    try {
      // Clear all storage
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      
      this.showToast('All data cleared successfully', 'success');
      
      // Refresh all views
      await this.refreshCurrentView();
      await this.updateSidebarBadges();
    } catch (error) {
      console.error('Error clearing data:', error);
      this.showToast('Failed to clear data: ' + error.message, 'error');
    }
  }

  async syncData() {
    // Implement data sync
    this.showToast('Sync feature coming soon', 'info');
  }

  showHelp() {
    // Implement help modal or redirect
    this.showToast('Help documentation coming soon', 'info');
  }

  updateBulkActions() {
    const checked = document.querySelectorAll('.session-checkbox:checked').length;
    const bulkActions = document.getElementById('bulkActions');
    
    if (checked > 0) {
      bulkActions.style.display = 'flex';
      bulkActions.querySelector('.selected-count').textContent = `${checked} selected`;
    } else {
      bulkActions.style.display = 'none';
    }
  }

  filterTabs(filter) {
    // Implement tab filtering
    this.loadTabs();
  }

  handleUrlNavigation() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view) {
      this.switchView(view);
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
      <span class="toast-message">${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  async loadSearch() {
    // Load all items when search view is first opened
    // Check if there's a query in the global search box
    const globalQuery = document.getElementById('globalSearch').value;
    await this.performSearch(globalQuery);
  }

  async getSessions() {
    return await this.storageManager.getSessions();
  }

  async getSuspendedTabs() {
    const data = await chrome.storage.local.get(['suspendedTabs']);
    return data.suspendedTabs || [];
  }

  async getAllItemsForSearch(searchOptions) {
    try {
      const results = {
        query: '',
        timestamp: Date.now(),
        openTabs: [],
        sessions: [],
        suspendedTabs: [],
        total: 0
      };

      const promises = [];

      // Get open tabs if not excluded
      if (!searchOptions.excludeOpenTabs) {
        promises.push(this.tabManager.getAllTabs().then(tabs => {
          results.openTabs = tabs.filter(tab => !tab.suspended);
        }));
      }

      // Get suspended tabs if not excluded
      if (!searchOptions.excludeSuspended) {
        promises.push(this.getSuspendedTabs().then(suspendedTabs => {
          results.suspendedTabs = suspendedTabs;
        }));
      }

      // Get sessions if not excluded
      if (!searchOptions.excludeSessions) {
        promises.push(this.getSessions().then(sessions => {
          results.sessions = sessions.map(session => ({
            session,
            tabs: session.tabs || [],
            totalMatches: session.tabs ? session.tabs.length : 0
          }));
        }));
      }


      await Promise.all(promises);

      // Calculate total
      results.total = results.openTabs.length + 
                     results.suspendedTabs.length +
                     results.sessions.reduce((sum, s) => sum + s.tabs.length, 0);

      return results;
    } catch (error) {
      console.error('Error getting all items for search:', error);
      return {
        query: '',
        timestamp: Date.now(),
        openTabs: [],
        sessions: [],
        suspendedTabs: [],
        total: 0
      };
    }
  }

  renderTabItem(tab, isSuspended = false) {
    const tabIdentifier = isSuspended && tab.uniqueId ? tab.uniqueId : tab.id;
    return `
      <div class="tab-item ${isSuspended ? 'suspended' : ''}" data-tab-id="${tabIdentifier}" data-suspended="${isSuspended}">
        <img class="tab-favicon favicon-img" src="${this.getFaviconUrl(tab)}" alt="">
        <div class="tab-content">
          <div class="tab-title">${this.escapeHtml(tab.title)}</div>
          <div class="tab-url">${this.escapeHtml(this.extractDomain(tab.url))}</div>
        </div>
        <div class="tab-actions">
          <button class="btn-icon tab-action-switch" data-tab-id="${tabIdentifier}" title="Switch to tab">
            <span class="icon">↗️</span>
          </button>
          ${isSuspended ? `
            <button class="btn-icon tab-action-restore" data-tab-id="${tabIdentifier}" title="Restore">
              <span class="icon">▶️</span>
            </button>
          ` : `
            <button class="btn-icon tab-action-suspend" data-tab-id="${tabIdentifier}" title="Suspend">
              <span class="icon">⏸️</span>
            </button>
          `}
          <button class="btn-icon tab-action-close" data-tab-id="${tabIdentifier}" title="Close">
            <span class="icon">❌</span>
          </button>
        </div>
      </div>
    `;
  }

  renderTabsGroupedByWindow(tabs, isSuspended = false) {
    // Group tabs by window
    const tabsByWindow = {};
    tabs.forEach(tab => {
      const windowId = tab.windowId || 'Unknown';
      if (!tabsByWindow[windowId]) {
        tabsByWindow[windowId] = [];
      }
      tabsByWindow[windowId].push(tab);
    });

    // Render tabs grouped by window
    return Object.entries(tabsByWindow).map(([windowId, windowTabs]) => `
      <div class="search-window-group">
        <div class="search-window-header">
          <h4>Window ${windowId}</h4>
          <span class="search-tab-count">${windowTabs.length} tabs</span>
        </div>
        <div class="search-tab-list">
          ${windowTabs.map(tab => this.renderTabItem(tab, isSuspended)).join('')}
        </div>
      </div>
    `).join('');
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getFaviconUrl(tab) {
    // For internal Chrome pages, use the _favicon API
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://'))) {
      return `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(tab.url)}`;
    }

    // For web pages, prioritize the favIconUrl from the tab object
    if (tab.favIconUrl) {
      return tab.favIconUrl;
    }

    // As a fallback for web pages without favicons, use a default icon
    if (tab.url && (tab.url.startsWith('http:') || tab.url.startsWith('https:'))) {
      return 'icons/icon16.svg';
    }

    // For all other cases (e.g., file:// URLs, about:blank), use a default icon
    return 'icons/icon16.svg';
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }

  addFaviconErrorHandlers() {
    document.querySelectorAll('.favicon-img').forEach(img => {
      img.addEventListener('error', () => {
        img.src = 'icons/icon16.svg';
      });
    });
  }
}

// Initialize manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.manager = new OmniManager();
  });
} else {
  window.manager = new OmniManager();
}
