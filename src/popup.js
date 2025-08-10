class OmniPopup {
  constructor() {
    this.tabManager = null;
    this.workspaceManager = null;
    this.searchManager = null;
    this.currentTab = 'dashboard';
    this.searchTimeout = null;
    
    this.initialize();
  }

  async initialize() {
    try {
      this.tabManager = new TabManager();
      this.workspaceManager = new WorkspaceManager();
      this.searchManager = new SearchManager(this.tabManager, this.workspaceManager);
      
      await this.initializeManagers();
      this.setupEventListeners();
      this.loadDashboard();
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showError('Failed to initialize extension');
    }
  }

  async initializeManagers() {
    await Promise.all([
      this.tabManager.initializeTabSuspension(),
      this.workspaceManager.initialize(),
      this.searchManager.loadSearchHistory()
    ]);
  }

  setupEventListeners() {
    document.getElementById('convertAllTabs').addEventListener('click', () => {
      this.convertAllTabs();
    });

    document.getElementById('openManager').addEventListener('click', () => {
      this.openManager();
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.handleSearchInput(e.target.value);
    });

    document.getElementById('searchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.performSearch(e.target.value);
      }
    });

    document.getElementById('searchBtn').addEventListener('click', () => {
      const query = document.getElementById('searchInput').value;
      this.performSearch(query);
    });

    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.switchTab(e.target.dataset.tab);
      });
    });

    document.getElementById('saveCurrentSession').addEventListener('click', () => {
      this.showSessionModal();
    });

    document.getElementById('createWorkspace').addEventListener('click', () => {
      this.showWorkspaceModal();
    });

    document.getElementById('newWorkspaceBtn').addEventListener('click', () => {
      this.showWorkspaceModal();
    });

    document.getElementById('saveSessionBtn').addEventListener('click', () => {
      this.showSessionModal();
    });

    this.setupModalEventListeners();
    this.setupFilterEventListeners();
  }

  setupModalEventListeners() {
    const workspaceModal = document.getElementById('workspaceModal');
    const sessionModal = document.getElementById('sessionModal');

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        this.hideModals();
      });
    });

    document.getElementById('cancelWorkspace').addEventListener('click', () => {
      this.hideModals();
    });

    document.getElementById('saveWorkspace').addEventListener('click', () => {
      this.saveWorkspace();
    });

    document.getElementById('cancelSession').addEventListener('click', () => {
      this.hideModals();
    });

    document.getElementById('saveSessionConfirm').addEventListener('click', () => {
      this.saveSession();
    });

    document.querySelectorAll('.color-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        document.getElementById('workspaceColor').value = color;
      });
    });

    workspaceModal.addEventListener('click', (e) => {
      if (e.target === workspaceModal) {
        this.hideModals();
      }
    });

    sessionModal.addEventListener('click', (e) => {
      if (e.target === sessionModal) {
        this.hideModals();
      }
    });
  }

  setupFilterEventListeners() {
    document.getElementById('sessionSort').addEventListener('change', (e) => {
      this.loadSessions(e.target.value);
    });

    document.getElementById('tabFilter').addEventListener('change', () => {
      this.loadAllTabs();
    });

    document.getElementById('tabSort').addEventListener('change', () => {
      this.loadAllTabs();
    });
  }

  async loadDashboard() {
    try {
      this.showLoading();
      
      const [openTabs, sessions, workspaces, suspendedTabs] = await Promise.all([
        this.tabManager.getAllTabs(),
        this.getSessions(),
        this.workspaceManager.getAllWorkspaces(),
        this.getSuspendedTabs()
      ]);

      document.getElementById('openTabsCount').textContent = openTabs.length;
      document.getElementById('sessionsCount').textContent = sessions.length;
      document.getElementById('workspacesCount').textContent = workspaces.length;
      document.getElementById('suspendedTabsCount').textContent = suspendedTabs.length;

      this.renderRecentSessions(sessions.slice(0, 5));
      
      this.hideLoading();
    } catch (error) {
      console.error('Error loading dashboard:', error);
      this.hideLoading();
    }
  }

  async getSessions() {
    const data = await chrome.storage.local.get(['sessions']);
    return data.sessions || [];
  }

  async getSuspendedTabs() {
    const data = await chrome.storage.local.get(['suspendedTabs']);
    return data.suspendedTabs || [];
  }

  renderRecentSessions(sessions) {
    const container = document.getElementById('recentSessions');
    
    if (sessions.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>No saved sessions yet</p></div>';
      return;
    }

    container.innerHTML = sessions.map(session => `
      <div class="recent-item" data-session-id="${session.id}">
        <div class="item-icon">💾</div>
        <div class="item-content">
          <div class="item-title">${this.escapeHtml(session.name)}</div>
          <div class="item-subtitle">${session.tabCount} tabs • ${this.formatDate(session.created)}</div>
        </div>
        <div class="item-actions">
          <button class="item-action" onclick="popup.restoreSession('${session.id}')" title="Restore">
            ↗️
          </button>
        </div>
      </div>
    `).join('');
  }

  async loadWorkspaces() {
    try {
      const workspaces = this.workspaceManager.getAllWorkspaces();
      const container = document.getElementById('workspacesList');
      
      if (workspaces.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No workspaces created yet</p></div>';
        return;
      }

      container.innerHTML = workspaces.map(workspace => `
        <div class="workspace-item" data-workspace-id="${workspace.id}">
          <div class="workspace-color" style="background-color: ${workspace.color}"></div>
          <div class="item-content">
            <div class="item-title">${this.escapeHtml(workspace.name)}</div>
            <div class="item-subtitle">${workspace.tabs.length} tabs • ${this.formatDate(workspace.lastAccessed)}</div>
          </div>
          <div class="item-actions">
            <button class="item-action" onclick="popup.switchWorkspace('${workspace.id}')" title="Switch">
              ↗️
            </button>
            ${workspace.id !== 'default' ? `
              <button class="item-action" onclick="popup.deleteWorkspace('${workspace.id}')" title="Delete">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading workspaces:', error);
    }
  }

  async loadSessions(sortBy = 'recent') {
    try {
      let sessions = await this.getSessions();
      
      switch (sortBy) {
        case 'name':
          sessions.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case 'tabs':
          sessions.sort((a, b) => b.tabCount - a.tabCount);
          break;
        default:
          sessions.sort((a, b) => b.created - a.created);
      }

      const container = document.getElementById('sessionsList');
      
      if (sessions.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No saved sessions yet</p></div>';
        return;
      }

      container.innerHTML = sessions.map(session => `
        <div class="session-item" data-session-id="${session.id}">
          <div class="item-icon">💾</div>
          <div class="item-content">
            <div class="item-title">${this.escapeHtml(session.name)}</div>
            <div class="item-subtitle">${session.tabCount} tabs • ${this.formatDate(session.created)}</div>
          </div>
          <div class="item-actions">
            <button class="item-action" onclick="popup.restoreSession('${session.id}')" title="Restore">
              ↗️
            </button>
            <button class="item-action" onclick="popup.deleteSession('${session.id}')" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  async loadAllTabs() {
    try {
      const filter = document.getElementById('tabFilter').value;
      const sort = document.getElementById('tabSort').value;
      
      let tabs = await this.tabManager.getAllTabs();
      
      switch (filter) {
        case 'active':
          tabs = tabs.filter(tab => !tab.suspended);
          break;
        case 'suspended':
          tabs = tabs.filter(tab => tab.suspended);
          break;
        case 'grouped':
          tabs = tabs.filter(tab => tab.groupId && tab.groupId !== -1);
          break;
      }

      tabs = this.sortTabs(tabs, sort);

      const container = document.getElementById('tabsList');
      
      if (tabs.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No tabs match the current filter</p></div>';
        return;
      }

      container.innerHTML = tabs.map(tab => `
        <div class="tab-item" data-tab-id="${tab.id}">
          <img class="item-icon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg xmlns=\\"http://www.w3.org/2000/svg\\" viewBox=\\"0 0 16 16\\"><rect width=\\"16\\" height=\\"16\\" fill=\\"#f1f3f4\\"/></svg>'}" onerror="this.style.display='none'">
          <div class="item-content">
            <div class="item-title">${this.escapeHtml(tab.title)}</div>
            <div class="item-subtitle">${this.escapeHtml(this.extractDomain(tab.url))}</div>
          </div>
          <div class="item-actions">
            <button class="item-action" onclick="popup.switchToTab(${tab.id})" title="Switch to tab">
              ↗️
            </button>
            ${tab.suspended ? `
              <button class="item-action" onclick="popup.restoreTab(${tab.id})" title="Restore">
                ▶️
              </button>
            ` : `
              <button class="item-action" onclick="popup.suspendTab(${tab.id})" title="Suspend">
                ⏸️
              </button>
            `}
            <button class="item-action" onclick="popup.closeTab(${tab.id})" title="Close">
              ❌
            </button>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading all tabs:', error);
    }
  }

  sortTabs(tabs, sortBy) {
    switch (sortBy) {
      case 'domain':
        return tabs.sort((a, b) => this.extractDomain(a.url).localeCompare(this.extractDomain(b.url)));
      case 'recent':
        return tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
      default:
        return tabs.sort((a, b) => {
          if (a.windowId !== b.windowId) {
            return a.windowId - b.windowId;
          }
          return a.index - b.index;
        });
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    this.currentTab = tabName;

    switch (tabName) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'workspaces':
        this.loadWorkspaces();
        break;
      case 'sessions':
        this.loadSessions();
        break;
      case 'tabs':
        this.loadAllTabs();
        break;
      case 'development':
        this.loadDevelopmentTab();
        break;
    }
  }

  async handleSearchInput(query) {
    clearTimeout(this.searchTimeout);
    
    if (query.length === 0) {
      this.hideSearchSuggestions();
      this.clearSearch(); // Clear search results when input is empty
      return;
    }

    // Show search results for queries with 2+ characters
    if (query.length >= 2) {
      // Add a subtle loading indicator to the search button
      const searchBtn = document.getElementById('searchBtn');
      searchBtn.innerHTML = '<span class="icon">⏳</span>';
      
      this.searchTimeout = setTimeout(async () => {
        try {
          // Get both suggestions and perform actual search
          const [suggestions, searchResults] = await Promise.all([
            this.searchManager.getSearchSuggestions(query),
            this.searchManager.universalSearch(query)
          ]);
          
          // Show full search results (this will hide suggestions automatically)
          this.showSearchResults(searchResults, false); // Show actual search results without loading indicator
          
          // Restore search button icon
          searchBtn.innerHTML = '<span class="icon">🔍</span>';
        } catch (error) {
          console.error('Error performing real-time search:', error);
          // Restore search button icon even on error
          searchBtn.innerHTML = '<span class="icon">🔍</span>';
        }
      }, 300);
    } else if (query.length === 1) {
      // For single character, just show suggestions
      this.searchTimeout = setTimeout(async () => {
        try {
          const suggestions = await this.searchManager.getSearchSuggestions(query);
          this.showSearchSuggestions(suggestions);
        } catch (error) {
          console.error('Error getting search suggestions:', error);
        }
      }, 300);
    }
  }

  showSearchSuggestions(suggestions) {
    const container = document.getElementById('searchSuggestions');
    
    if (suggestions.length === 0) {
      this.hideSearchSuggestions();
      return;
    }

    container.innerHTML = suggestions.map(suggestion => `
      <div class="suggestion-item" onclick="popup.selectSuggestion('${suggestion.text}')">
        <span class="icon">${this.getSuggestionIcon(suggestion.icon)}</span>
        <span>${this.escapeHtml(suggestion.text)}</span>
      </div>
    `).join('');
    
    container.classList.remove('hidden');
  }

  hideSearchSuggestions() {
    document.getElementById('searchSuggestions').classList.add('hidden');
  }

  getSuggestionIcon(iconType) {
    const icons = {
      'history': '🕒',
      'folder': '📁',
      'workspace': '🗂️'
    };
    return icons[iconType] || '🔍';
  }

  selectSuggestion(text) {
    document.getElementById('searchInput').value = text;
    this.hideSearchSuggestions();
    this.performSearch(text);
  }

  async performSearch(query) {
    if (!query || query.trim().length === 0) return;

    try {
      this.showLoading();
      this.hideSearchSuggestions();
      
      const results = await this.searchManager.universalSearch(query);
      this.showSearchResults(results, false); // false = don't show loading since we're already showing it
      
      this.hideLoading();
    } catch (error) {
      console.error('Error performing search:', error);
      this.hideLoading();
    }
  }

  showSearchResults(results, showLoading = true) {
    document.getElementById('searchResults').classList.remove('hidden');
    document.getElementById('searchResults').classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
      if (content.id !== 'searchResults') {
        content.classList.remove('active');
      }
    });

    const container = document.getElementById('searchResultsContent');
    let html = '';

    if (results.total === 0) {
      html = '<div class="empty-state"><p>No results found</p></div>';
    } else {
      if (results.openTabs.length > 0) {
        html += this.renderSearchSection('Open Tabs', results.openTabs, 'tab');
      }

      if (results.suspendedTabs.length > 0) {
        html += this.renderSearchSection('Suspended Tabs', results.suspendedTabs, 'suspended');
      }

      if (results.sessions.length > 0) {
        html += this.renderSearchSection('Saved Sessions', results.sessions, 'session');
      }

      if (results.workspaces.length > 0) {
        html += this.renderSearchSection('Workspaces', results.workspaces, 'workspace');
      }
    }

    container.innerHTML = html;

    document.getElementById('clearSearch').addEventListener('click', () => {
      this.clearSearch();
    });
  }

  renderSearchSection(title, items, type) {
    let html = `
      <div class="search-result-section">
        <h3>${title} (${items.length})</h3>
    `;

    if (type === 'tab' || type === 'suspended') {
      html += items.map(item => `
        <div class="search-result-item" onclick="popup.${type === 'suspended' ? 'restoreTab' : 'switchToTab'}(${item.id})">
          <div class="item-title">${this.escapeHtml(item.title)}</div>
          <div class="item-subtitle">${this.escapeHtml(this.extractDomain(item.url))}</div>
        </div>
      `).join('');
    } else if (type === 'session') {
      html += items.map(item => `
        <div class="search-result-item" onclick="popup.restoreSession('${item.session.id}')">
          <div class="item-title">${this.escapeHtml(item.session.name)}</div>
          <div class="item-subtitle">${item.totalMatches} matching tabs</div>
        </div>
      `).join('');
    } else if (type === 'workspace') {
      html += items.map(item => `
        <div class="search-result-item" onclick="popup.switchWorkspace('${item.workspace.id}')">
          <div class="item-title">${this.escapeHtml(item.workspace.name)}</div>
          <div class="item-subtitle">${item.totalMatches} matching tabs</div>
        </div>
      `).join('');
    }

    html += '</div>';
    return html;
  }

  clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('searchResults').classList.add('hidden');
    document.getElementById('searchResults').classList.remove('active');
    this.switchTab(this.currentTab);
  }

  showWorkspaceModal(workspaceId = null) {
    const modal = document.getElementById('workspaceModal');
    const title = document.getElementById('workspaceModalTitle');
    const nameInput = document.getElementById('workspaceName');
    const colorInput = document.getElementById('workspaceColor');

    if (workspaceId) {
      const workspace = this.workspaceManager.getWorkspace(workspaceId);
      title.textContent = 'Edit Workspace';
      nameInput.value = workspace.name;
      colorInput.value = workspace.color;
    } else {
      title.textContent = 'Create Workspace';
      nameInput.value = '';
      colorInput.value = '#4285f4';
    }

    modal.classList.remove('hidden');
    nameInput.focus();
  }

  showSessionModal() {
    const modal = document.getElementById('sessionModal');
    document.getElementById('sessionName').value = '';
    document.getElementById('includeAllWindows').checked = true;
    modal.classList.remove('hidden');
    document.getElementById('sessionName').focus();
  }

  hideModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
    });
  }

  async saveWorkspace() {
    const name = document.getElementById('workspaceName').value.trim();
    const color = document.getElementById('workspaceColor').value;

    if (!name) {
      alert('Please enter a workspace name');
      return;
    }

    try {
      await this.workspaceManager.createWorkspace(name, color);
      this.hideModals();
      if (this.currentTab === 'workspaces') {
        this.loadWorkspaces();
      }
      this.loadDashboard();
    } catch (error) {
      console.error('Error saving workspace:', error);
      alert('Failed to save workspace');
    }
  }

  async saveSession() {
    const name = document.getElementById('sessionName').value.trim() || `Session ${Date.now()}`;
    const includeAllWindows = document.getElementById('includeAllWindows').checked;

    try {
      const tabs = await this.tabManager.getAllTabs();
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
      this.hideModals();
      
      if (this.currentTab === 'sessions') {
        this.loadSessions();
      }
      this.loadDashboard();
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Failed to save session');
    }
  }

  async convertAllTabs() {
    try {
      this.showLoading();
      await this.tabManager.convertAllTabs();
      this.loadDashboard();
      this.hideLoading();
    } catch (error) {
      console.error('Error converting tabs:', error);
      this.hideLoading();
      alert('Failed to convert tabs');
    }
  }

  async restoreSession(sessionId) {
    try {
      this.showLoading();
      await this.tabManager.restoreTabsFromSession(sessionId);
      this.hideLoading();
      window.close();
    } catch (error) {
      console.error('Error restoring session:', error);
      this.hideLoading();
      alert('Failed to restore session');
    }
  }

  async deleteSession(sessionId) {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      const data = await chrome.storage.local.get(['sessions']);
      const sessions = data.sessions || [];
      const updatedSessions = sessions.filter(s => s.id !== sessionId);
      
      await chrome.storage.local.set({ sessions: updatedSessions });
      
      if (this.currentTab === 'sessions') {
        this.loadSessions();
      }
      this.loadDashboard();
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete session');
    }
  }

  async switchWorkspace(workspaceId) {
    try {
      this.showLoading();
      await this.workspaceManager.switchToWorkspace(workspaceId);
      this.hideLoading();
      window.close();
    } catch (error) {
      console.error('Error switching workspace:', error);
      this.hideLoading();
      alert('Failed to switch workspace');
    }
  }

  async deleteWorkspace(workspaceId) {
    if (!confirm('Are you sure you want to delete this workspace?')) {
      return;
    }

    try {
      await this.workspaceManager.deleteWorkspace(workspaceId);
      
      if (this.currentTab === 'workspaces') {
        this.loadWorkspaces();
      }
      this.loadDashboard();
    } catch (error) {
      console.error('Error deleting workspace:', error);
      alert('Failed to delete workspace');
    }
  }

  async switchToTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      await chrome.windows.update(tab.windowId, { focused: true });
      window.close();
    } catch (error) {
      console.error('Error switching to tab:', error);
      alert('Failed to switch to tab');
    }
  }

  async suspendTab(tabId) {
    try {
      await this.tabManager.suspendTab(tabId);
      if (this.currentTab === 'tabs') {
        this.loadAllTabs();
      }
      this.loadDashboard();
    } catch (error) {
      console.error('Error suspending tab:', error);
      alert('Failed to suspend tab');
    }
  }

  async restoreTab(tabId) {
    try {
      await this.tabManager.restoreTab(tabId);
      if (this.currentTab === 'tabs') {
        this.loadAllTabs();
      }
      this.loadDashboard();
    } catch (error) {
      console.error('Error restoring tab:', error);
      alert('Failed to restore tab');
    }
  }

  async closeTab(tabId) {
    try {
      await chrome.tabs.remove(tabId);
      if (this.currentTab === 'tabs') {
        this.loadAllTabs();
      }
      this.loadDashboard();
    } catch (error) {
      console.error('Error closing tab:', error);
      alert('Failed to close tab');
    }
  }

  showLoading() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loadingSpinner').classList.add('hidden');
  }

  showError(message) {
    alert(message);
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

  // Development Tab Methods
  async loadDevelopmentTab() {
    await this.updateStorageStats();
    await this.updatePerformanceMetrics();
    this.setupDevelopmentEventListeners();
    this.initializeConsoleCapture();
  }

  async updateStorageStats() {
    try {
      // Get storage usage
      const storageData = await chrome.storage.local.get();
      const dataSize = new Blob([JSON.stringify(storageData)]).size;
      
      document.getElementById('storageUsed').textContent = this.formatBytes(dataSize);
      document.getElementById('storageItems').textContent = Object.keys(storageData).length;
      
      // Chrome storage quota (5MB for local storage)
      const quota = 5 * 1024 * 1024; // 5MB in bytes
      document.getElementById('storageQuota').textContent = '5 MB';
      
      // Calculate cache size (approximate)
      const cacheSize = this.calculateCacheSize(storageData);
      document.getElementById('cacheSize').textContent = this.formatBytes(cacheSize);
    } catch (error) {
      console.error('Error updating storage stats:', error);
    }
  }

  async updatePerformanceMetrics() {
    try {
      const tabs = await this.tabManager.getAllTabs();
      const suspendedTabs = await this.getSuspendedTabs();
      
      document.getElementById('activeTabsCount').textContent = tabs.filter(t => !t.suspended).length;
      document.getElementById('suspendedCount').textContent = suspendedTabs.length;
      
      // Get memory usage if available
      if (chrome.runtime.getPlatformInfo) {
        try {
          const platformInfo = await chrome.runtime.getPlatformInfo();
          document.getElementById('memoryUsage').textContent = 'N/A (API Limited)';
        } catch (e) {
          document.getElementById('memoryUsage').textContent = 'N/A';
        }
      }
      
      // Get extension version
      const manifest = chrome.runtime.getManifest();
      document.getElementById('extensionVersion').textContent = manifest.version;
    } catch (error) {
      console.error('Error updating performance metrics:', error);
    }
  }

  setupDevelopmentEventListeners() {
    // Only set up once
    if (this.devListenersSetup) return;
    this.devListenersSetup = true;

    // Refresh button
    document.getElementById('refreshDevStats')?.addEventListener('click', async () => {
      await this.updateStorageStats();
      await this.updatePerformanceMetrics();
    });

    // Export data
    document.getElementById('exportData')?.addEventListener('click', () => {
      this.exportAllData();
    });

    // Import data
    document.getElementById('importData')?.addEventListener('click', () => {
      this.importData();
    });

    // Clear storage
    document.getElementById('clearStorage')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all storage? This cannot be undone!')) {
        this.clearAllStorage();
      }
    });

    // Reset extension
    document.getElementById('resetExtension')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset the extension to default settings?')) {
        this.resetExtension();
      }
    });

    // View data
    document.getElementById('viewData')?.addEventListener('click', () => {
      this.viewStorageData();
    });

    // Clear console
    document.getElementById('clearConsole')?.addEventListener('click', () => {
      document.getElementById('consoleOutput').innerHTML = '';
    });

    // Test features
    document.getElementById('testCrash')?.addEventListener('click', () => {
      this.simulateCrash();
    });

    document.getElementById('testNotification')?.addEventListener('click', () => {
      this.testNotification();
    });

    document.getElementById('generateTestData')?.addEventListener('click', () => {
      this.generateTestData();
    });

    document.getElementById('runDiagnostics')?.addEventListener('click', () => {
      this.runDiagnostics();
    });
  }

  async exportAllData() {
    try {
      const data = await chrome.storage.local.get();
      const exportData = {
        version: chrome.runtime.getManifest().version,
        timestamp: Date.now(),
        data: data
      };
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `omni-backup-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.logToConsole('info', 'Data exported successfully');
    } catch (error) {
      this.logToConsole('error', `Export failed: ${error.message}`);
    }
  }

  async importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.data) {
          throw new Error('Invalid backup file format');
        }
        
        await chrome.storage.local.set(importData.data);
        this.logToConsole('info', 'Data imported successfully');
        await this.updateStorageStats();
      } catch (error) {
        this.logToConsole('error', `Import failed: ${error.message}`);
      }
    };
    
    input.click();
  }

  async clearAllStorage() {
    try {
      await chrome.storage.local.clear();
      this.logToConsole('warn', 'All storage cleared');
      await this.updateStorageStats();
    } catch (error) {
      this.logToConsole('error', `Clear storage failed: ${error.message}`);
    }
  }

  async resetExtension() {
    try {
      await chrome.storage.local.clear();
      // Reinitialize with defaults
      await this.workspaceManager.initialize();
      await this.tabManager.initializeTabSuspension();
      this.logToConsole('warn', 'Extension reset to defaults');
      await this.loadDevelopmentTab();
    } catch (error) {
      this.logToConsole('error', `Reset failed: ${error.message}`);
    }
  }

  async viewStorageData() {
    const dataType = document.getElementById('dataType').value;
    try {
      const data = await chrome.storage.local.get([dataType]);
      const viewer = document.getElementById('dataViewer');
      viewer.textContent = JSON.stringify(data[dataType] || {}, null, 2);
    } catch (error) {
      this.logToConsole('error', `View data failed: ${error.message}`);
    }
  }

  simulateCrash() {
    this.logToConsole('error', 'Simulating crash...');
    setTimeout(() => {
      throw new Error('Simulated crash for testing');
    }, 100);
  }

  testNotification() {
    this.logToConsole('info', 'Testing notification system...');
    alert('Notification test: This is a test notification from Omni extension!');
  }

  async generateTestData() {
    try {
      // Generate test sessions
      const testSessions = [];
      for (let i = 0; i < 5; i++) {
        testSessions.push({
          id: `test-${Date.now()}-${i}`,
          name: `Test Session ${i + 1}`,
          tabs: Array(Math.floor(Math.random() * 10) + 1).fill(null).map((_, j) => ({
            url: `https://example.com/page${j}`,
            title: `Test Page ${j + 1}`,
            favIconUrl: '',
            saved: Date.now()
          })),
          created: Date.now() - (i * 3600000),
          tabCount: Math.floor(Math.random() * 10) + 1
        });
      }
      
      const data = await chrome.storage.local.get(['sessions']);
      const existingSessions = data.sessions || [];
      await chrome.storage.local.set({ 
        sessions: [...existingSessions, ...testSessions] 
      });
      
      this.logToConsole('info', `Generated ${testSessions.length} test sessions`);
      await this.updateStorageStats();
    } catch (error) {
      this.logToConsole('error', `Generate test data failed: ${error.message}`);
    }
  }

  async runDiagnostics() {
    this.logToConsole('info', 'Running diagnostics...');
    
    try {
      // Check permissions
      const permissions = chrome.runtime.getManifest().permissions;
      this.logToConsole('info', `Permissions: ${permissions.join(', ')}`);
      
      // Check storage
      const storageData = await chrome.storage.local.get();
      this.logToConsole('info', `Storage keys: ${Object.keys(storageData).join(', ')}`);
      
      // Check tabs
      const tabs = await chrome.tabs.query({});
      this.logToConsole('info', `Total tabs: ${tabs.length}`);
      
      // Check memory
      const dataSize = new Blob([JSON.stringify(storageData)]).size;
      this.logToConsole('info', `Storage size: ${this.formatBytes(dataSize)}`);
      
      this.logToConsole('info', 'Diagnostics complete ✓');
    } catch (error) {
      this.logToConsole('error', `Diagnostics failed: ${error.message}`);
    }
  }

  initializeConsoleCapture() {
    // Override console methods to capture logs
    const consoleOutput = document.getElementById('consoleOutput');
    const logLevel = document.getElementById('logLevel');
    
    if (!this.originalConsole) {
      this.originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };
    }
    
    // Restore original console for development tab
    console.log = (...args) => {
      this.originalConsole.log(...args);
      if (logLevel.value === 'all' || logLevel.value === 'info') {
        this.logToConsole('info', args.join(' '));
      }
    };
    
    console.error = (...args) => {
      this.originalConsole.error(...args);
      if (logLevel.value === 'all' || logLevel.value === 'error') {
        this.logToConsole('error', args.join(' '));
      }
    };
    
    console.warn = (...args) => {
      this.originalConsole.warn(...args);
      if (logLevel.value === 'all' || logLevel.value === 'error' || logLevel.value === 'warn') {
        this.logToConsole('warn', args.join(' '));
      }
    };
  }

  logToConsole(level, message) {
    const consoleOutput = document.getElementById('consoleOutput');
    if (!consoleOutput) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    entry.textContent = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    consoleOutput.appendChild(entry);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
    
    // Limit to 100 entries
    while (consoleOutput.children.length > 100) {
      consoleOutput.removeChild(consoleOutput.firstChild);
    }
  }

  calculateCacheSize(data) {
    // Calculate approximate cache size from search history and other cached data
    let cacheSize = 0;
    if (data.searchHistory) {
      cacheSize += new Blob([JSON.stringify(data.searchHistory)]).size;
    }
    return cacheSize;
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  async openManager() {
    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL('index.html')
      });
      window.close();
    } catch (error) {
      console.error('Error opening manager:', error);
      alert('Failed to open manager');
    }
  }
}

const popup = new OmniPopup();
window.popup = popup;