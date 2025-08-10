class WorkspaceManager {
  constructor() {
    this.currentWorkspace = null;
    this.workspaces = new Map();
    this.initialize();
  }

  async initialize() {
    const data = await chrome.storage.local.get(['workspaces']);
    const workspaces = data.workspaces || [];
    
    workspaces.forEach(workspace => {
      this.workspaces.set(workspace.id, workspace);
    });

    if (this.workspaces.size === 0) {
      await this.createDefaultWorkspace();
    }

    this.currentWorkspace = workspaces.find(w => w.id === 'default')?.id || workspaces[0]?.id;
  }

  async createDefaultWorkspace() {
    const defaultWorkspace = {
      id: 'default',
      name: 'Default Workspace',
      tabs: [],
      created: Date.now(),
      lastAccessed: Date.now(),
      color: '#4285f4'
    };

    this.workspaces.set('default', defaultWorkspace);
    await this.saveWorkspaces();
    return defaultWorkspace;
  }

  async createWorkspace(name, color = '#4285f4') {
    const id = Date.now().toString();
    const workspace = {
      id,
      name: name || `Workspace ${this.workspaces.size + 1}`,
      tabs: [],
      created: Date.now(),
      lastAccessed: Date.now(),
      color
    };

    this.workspaces.set(id, workspace);
    await this.saveWorkspaces();
    return workspace;
  }

  async deleteWorkspace(workspaceId) {
    if (workspaceId === 'default') {
      throw new Error('Cannot delete default workspace');
    }

    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    this.workspaces.delete(workspaceId);

    if (this.currentWorkspace === workspaceId) {
      this.currentWorkspace = 'default';
    }

    await this.saveWorkspaces();
    return true;
  }

  async renameWorkspace(workspaceId, newName) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    workspace.name = newName;
    workspace.lastAccessed = Date.now();
    
    await this.saveWorkspaces();
    return workspace;
  }

  async switchToWorkspace(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    await this.saveCurrentWorkspaceTabs();

    this.currentWorkspace = workspaceId;
    workspace.lastAccessed = Date.now();

    await this.restoreWorkspaceTabs(workspaceId);
    await this.saveWorkspaces();

    return workspace;
  }

  async saveCurrentWorkspaceTabs() {
    if (!this.currentWorkspace) return;

    try {
      const tabs = await chrome.tabs.query({});
      const workspaceTabs = [];

      for (const tab of tabs) {
        if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          workspaceTabs.push({
            url: tab.url,
            title: tab.title,
            favIconUrl: tab.favIconUrl,
            pinned: tab.pinned,
            index: tab.index
          });
        }
      }

      const workspace = this.workspaces.get(this.currentWorkspace);
      if (workspace) {
        workspace.tabs = workspaceTabs;
        workspace.lastAccessed = Date.now();
      }

      await this.saveWorkspaces();
    } catch (error) {
      console.error('Error saving current workspace tabs:', error);
    }
  }

  async restoreWorkspaceTabs(workspaceId) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace || !workspace.tabs.length) {
      return [];
    }

    try {
      const currentTabs = await chrome.tabs.query({});
      
      for (const tab of currentTabs) {
        if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
          await chrome.tabs.remove(tab.id);
        }
      }

      const restoredTabs = [];
      for (let i = 0; i < workspace.tabs.length; i++) {
        const tabData = workspace.tabs[i];
        try {
          const newTab = await chrome.tabs.create({
            url: tabData.url,
            pinned: tabData.pinned,
            index: i,
            active: i === 0
          });
          
          restoredTabs.push(newTab);
        } catch (error) {
          console.error('Error restoring workspace tab:', error);
        }
      }

      return restoredTabs;
    } catch (error) {
      console.error('Error restoring workspace tabs:', error);
      return [];
    }
  }

  async addTabsToWorkspace(workspaceId, tabs) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    workspace.tabs.push(...tabs);
    workspace.lastAccessed = Date.now();
    
    await this.saveWorkspaces();
    return workspace;
  }

  async removeTabFromWorkspace(workspaceId, tabIndex) {
    const workspace = this.workspaces.get(workspaceId);
    if (!workspace) {
      throw new Error('Workspace not found');
    }

    if (tabIndex >= 0 && tabIndex < workspace.tabs.length) {
      workspace.tabs.splice(tabIndex, 1);
      workspace.lastAccessed = Date.now();
      await this.saveWorkspaces();
    }

    return workspace;
  }

  getWorkspace(workspaceId) {
    return this.workspaces.get(workspaceId);
  }

  getAllWorkspaces() {
    return Array.from(this.workspaces.values()).sort((a, b) => {
      if (a.id === 'default') return -1;
      if (b.id === 'default') return 1;
      return b.lastAccessed - a.lastAccessed;
    });
  }

  getCurrentWorkspace() {
    return this.getWorkspace(this.currentWorkspace);
  }

  async saveWorkspaces() {
    const workspaces = Array.from(this.workspaces.values());
    await chrome.storage.local.set({ workspaces });
  }

  async searchWorkspaces(query) {
    const searchQuery = query.toLowerCase();
    const allWorkspaces = this.getAllWorkspaces();
    
    const results = [];
    
    for (const workspace of allWorkspaces) {
      if (workspace.name.toLowerCase().includes(searchQuery)) {
        results.push({
          workspace,
          matchType: 'name',
          tabs: []
        });
      }
      
      const matchingTabs = workspace.tabs.filter(tab =>
        tab.title.toLowerCase().includes(searchQuery) ||
        tab.url.toLowerCase().includes(searchQuery)
      );
      
      if (matchingTabs.length > 0) {
        const existingResult = results.find(r => r.workspace.id === workspace.id);
        if (existingResult) {
          existingResult.tabs = matchingTabs;
          existingResult.matchType = 'both';
        } else {
          results.push({
            workspace,
            matchType: 'tabs',
            tabs: matchingTabs
          });
        }
      }
    }
    
    return results;
  }

  async getWorkspaceStats() {
    const workspaces = this.getAllWorkspaces();
    const totalTabs = workspaces.reduce((sum, workspace) => sum + workspace.tabs.length, 0);
    
    return {
      totalWorkspaces: workspaces.length,
      totalTabs,
      currentWorkspace: this.getCurrentWorkspace()?.name || 'None',
      recentWorkspaces: workspaces.slice(0, 5)
    };
  }
}

window.WorkspaceManager = WorkspaceManager;