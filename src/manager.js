class OmniManager {
  constructor() {
    this.currentView = 'overview';
    this.tabManager = null;
    this.workspaceManager = null;
    this.searchManager = null;
    this.sidebarCollapsed = false;
    
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize managers
      this.tabManager = new TabManager();
      this.workspaceManager = new WorkspaceManager();
      this.searchManager = new SearchManager(this.tabManager, this.workspaceManager);
      
      await this.initializeManagers();
      this.setupEventListeners();
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
      this.workspaceManager.initialize(),
      this.searchManager.loadSearchHistory()
    ]);
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

    // View-specific actions
    this.setupOverviewActions();
    this.setupWorkspaceActions();
    this.setupSessionActions();
    this.setupTabActions();
    this.setupSearchActions();
    this.setupPreferencesActions();
    
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
          case 'New Workspace':
            this.showWorkspaceModal();
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

  setupWorkspaceActions() {
    document.getElementById('newWorkspaceBtn')?.addEventListener('click', () => {
      this.showWorkspaceModal();
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
    document.getElementById('searchQuery')?.addEventListener('input', (e) => {
      this.performSearch(e.target.value);
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
      workspaces: 'Workspaces',
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
      case 'workspaces':
        await this.loadWorkspaces();
        break;
      case 'sessions':
        await this.loadSessions();
        break;
      case 'tabs':
        await this.loadTabs();
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
      const [tabs, sessions, workspaces, suspendedTabs] = await Promise.all([
        this.tabManager.getAllTabs(),
        this.getSessions(),
        this.workspaceManager.getAllWorkspaces(),
        this.getSuspendedTabs()
      ]);

      // Update stat cards
      document.getElementById('activeTabs').textContent = tabs.filter(t => !t.suspended).length;
      document.getElementById('suspendedTabs').textContent = suspendedTabs.length;
      document.getElementById('totalSessions').textContent = sessions.length;
      document.getElementById('totalWorkspaces').textContent = workspaces.length;

      // Calculate memory saved (approximate)
      const memorySaved = suspendedTabs.length * 50; // Assume 50MB per tab
      document.getElementById('memorySaved').textContent = `${memorySaved} MB`;

      // Load recent activity
      this.loadRecentActivity();
    } catch (error) {
      console.error('Error loading overview:', error);
    }
  }

  async loadWorkspaces() {
    try {
      const workspaces = this.workspaceManager.getAllWorkspaces();
      const container = document.getElementById('workspaceGrid');
      
      if (workspaces.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">🗂️</div>
            <h3>No workspaces yet</h3>
            <p>Create your first workspace to organize your tabs</p>
            <button class="btn btn-primary" onclick="manager.showWorkspaceModal()">Create Workspace</button>
          </div>
        `;
        return;
      }

      container.innerHTML = workspaces.map(workspace => `
        <div class="workspace-card" data-workspace-id="${workspace.id}">
          <div class="workspace-header" style="background: ${workspace.color}">
            <div class="workspace-icon">🗂️</div>
            <div class="workspace-actions">
              <button class="btn-icon" onclick="manager.switchToWorkspace('${workspace.id}')">
                <span class="icon">↗️</span>
              </button>
            </div>
          </div>
          <div class="workspace-body">
            <div class="workspace-name">${this.escapeHtml(workspace.name)}</div>
            <div class="workspace-stats">
              <span>${workspace.tabs.length} tabs</span>
              <span>•</span>
              <span>Last used ${this.formatDate(workspace.lastAccessed)}</span>
            </div>
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading workspaces:', error);
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
          <td>${this.escapeHtml(session.name)}</td>
          <td>${session.tabCount}</td>
          <td>${this.formatDate(session.created)}</td>
          <td>${this.formatDate(session.created)}</td>
          <td>
            <button class="btn btn-sm" onclick="manager.restoreSession('${session.id}')">Restore</button>
            <button class="btn btn-sm" onclick="manager.deleteSession('${session.id}')">Delete</button>
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
              <div class="tab-item ${tab.suspended ? 'suspended' : ''}" data-tab-id="${tab.id}">
                <img class="tab-favicon" src="${tab.favIconUrl || 'data:image/svg+xml,<svg/>'}" onerror="this.style.display='none'">
                <div class="tab-content">
                  <div class="tab-title">${this.escapeHtml(tab.title)}</div>
                  <div class="tab-url">${this.escapeHtml(this.extractDomain(tab.url))}</div>
                </div>
                <div class="tab-actions">
                  <button class="btn-icon" onclick="manager.switchToTab(${tab.id})" title="Switch to tab">
                    <span class="icon">↗️</span>
                  </button>
                  ${tab.suspended ? `
                    <button class="btn-icon" onclick="manager.restoreTab(${tab.id})" title="Restore">
                      <span class="icon">▶️</span>
                    </button>
                  ` : `
                    <button class="btn-icon" onclick="manager.suspendTab(${tab.id})" title="Suspend">
                      <span class="icon">⏸️</span>
                    </button>
                  `}
                  <button class="btn-icon" onclick="manager.closeTab(${tab.id})" title="Close">
                    <span class="icon">❌</span>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading tabs:', error);
    }
  }

  async loadRecentActivity() {
    const activities = [
      { icon: '💾', text: 'Session saved', time: '2 minutes ago' },
      { icon: '🗂️', text: 'Workspace created', time: '1 hour ago' },
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
      const [tabs, sessions, workspaces] = await Promise.all([
        this.tabManager.getAllTabs(),
        this.getSessions(),
        this.workspaceManager.getAllWorkspaces()
      ]);

      document.getElementById('tabCount').textContent = tabs.length;
      document.getElementById('sessionCount').textContent = sessions.length;
      document.getElementById('workspaceCount').textContent = workspaces.length;
    } catch (error) {
      console.error('Error updating badges:', error);
    }
  }

  showWorkspaceModal() {
    document.getElementById('workspaceModal').classList.remove('hidden');
    document.getElementById('modalOverlay').classList.remove('hidden');
  }

  showSessionModal() {
    // Implement session save modal
    this.showToast('Save session feature coming soon', 'info');
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.add('hidden');
    });
    document.getElementById('modalOverlay').classList.add('hidden');
  }

  async quickSaveSession() {
    try {
      const tabs = await this.tabManager.getAllTabs();
      const sessionName = `Quick Save ${new Date().toLocaleString()}`;
      await this.tabManager.saveTabsAsSession(sessionName, tabs);
      this.showToast('Session saved successfully', 'success');
      await this.updateSidebarBadges();
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
    if (query.length < 2) return;
    
    // Switch to search view
    this.switchView('search');
    document.getElementById('searchQuery').value = query;
    await this.performSearch(query);
  }

  async performSearch(query) {
    if (!query) return;

    try {
      const results = await this.searchManager.universalSearch(query);
      const container = document.getElementById('searchResults');
      
      if (results.total === 0) {
        container.innerHTML = '<p>No results found</p>';
        return;
      }

      // Render search results
      container.innerHTML = `
        <div class="search-result-count">${results.total} results found</div>
        ${results.openTabs.length > 0 ? `
          <div class="result-section">
            <h3>Open Tabs (${results.openTabs.length})</h3>
            ${results.openTabs.map(tab => `
              <div class="result-item">
                <span class="result-title">${this.escapeHtml(tab.title)}</span>
                <span class="result-url">${this.escapeHtml(tab.url)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${results.sessions.length > 0 ? `
          <div class="result-section">
            <h3>Sessions</h3>
            ${results.sessions.map(item => `
              <div class="result-item">
                <span class="result-title">${this.escapeHtml(item.session.name)}</span>
                <span class="result-count">${item.totalMatches} matching tabs</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
    } catch (error) {
      console.error('Error performing search:', error);
    }
  }

  async switchToWorkspace(workspaceId) {
    try {
      await this.workspaceManager.switchToWorkspace(workspaceId);
      this.showToast('Switched to workspace', 'success');
      window.close();
    } catch (error) {
      console.error('Error switching workspace:', error);
      this.showToast('Failed to switch workspace', 'error');
    }
  }

  async restoreSession(sessionId) {
    try {
      await this.tabManager.restoreTabsFromSession(sessionId);
      this.showToast('Session restored', 'success');
    } catch (error) {
      console.error('Error restoring session:', error);
      this.showToast('Failed to restore session', 'error');
    }
  }

  async deleteSession(sessionId) {
    if (!confirm('Delete this session?')) return;

    try {
      const data = await chrome.storage.local.get(['sessions']);
      const sessions = data.sessions || [];
      const updated = sessions.filter(s => s.id !== sessionId);
      await chrome.storage.local.set({ sessions: updated });
      
      this.showToast('Session deleted', 'success');
      await this.loadSessions();
      await this.updateSidebarBadges();
    } catch (error) {
      console.error('Error deleting session:', error);
      this.showToast('Failed to delete session', 'error');
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

  async suspendTab(tabId) {
    try {
      await this.tabManager.suspendTab(tabId);
      await this.loadTabs();
      this.showToast('Tab suspended', 'success');
    } catch (error) {
      console.error('Error suspending tab:', error);
    }
  }

  async restoreTab(tabId) {
    try {
      await this.tabManager.restoreTab(tabId);
      await this.loadTabs();
      this.showToast('Tab restored', 'success');
    } catch (error) {
      console.error('Error restoring tab:', error);
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

  async saveSettings() {
    // Implement settings save
    this.showToast('Settings saved', 'success');
  }

  async resetSettings() {
    if (!confirm('Reset all settings to defaults?')) return;
    // Implement settings reset
    this.showToast('Settings reset', 'success');
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

  async getSessions() {
    const data = await chrome.storage.local.get(['sessions']);
    return data.sessions || [];
  }

  async getSuspendedTabs() {
    const data = await chrome.storage.local.get(['suspendedTabs']);
    return data.suspendedTabs || [];
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
}

// Initialize manager when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.manager = new OmniManager();
  });
} else {
  window.manager = new OmniManager();
}