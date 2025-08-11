class SearchManager {
  constructor(tabManager, workspaceManager) {
    this.tabManager = tabManager;
    this.storageManager = new StorageManager();
    this.searchHistory = [];
    this.maxHistoryItems = 50;
  }

  async universalSearch(query, options = {}) {
    if (!query || query.trim().length === 0) {
      return this.getEmptyResults();
    }

    const searchQuery = query.trim().toLowerCase();
    this.addToSearchHistory(searchQuery);

    const results = {
      query: searchQuery,
      timestamp: Date.now(),
      openTabs: [],
      sessions: [],
      suspendedTabs: [],
      total: 0
    };

    const searchPromises = [];

    if (!options.excludeOpenTabs) {
      searchPromises.push(this.searchOpenTabs(searchQuery));
    }

    if (!options.excludeSessions) {
      searchPromises.push(this.searchSessions(searchQuery));
    }


    if (!options.excludeSuspended) {
      searchPromises.push(this.searchSuspendedTabs(searchQuery));
    }

    try {
      const [openTabResults, sessionResults, suspendedResults] = 
        await Promise.all(searchPromises);

      results.openTabs = openTabResults || [];
      results.sessions = sessionResults || [];
      results.suspendedTabs = suspendedResults || [];

      results.total = results.openTabs.length + 
                     results.sessions.reduce((sum, s) => sum + s.tabs.length, 0) +
                     results.suspendedTabs.length;

      return results;
    } catch (error) {
      console.error('Error performing universal search:', error);
      return results;
    }
  }

  async searchOpenTabs(query) {
    try {
      const allTabs = await this.tabManager.getAllTabs();
      return this.filterTabs(allTabs, query);
    } catch (error) {
      console.error('Error searching open tabs:', error);
      return [];
    }
  }

  async searchSessions(query) {
    try {
      const sessions = await this.storageManager.getSessions();
      const results = [];

      for (const session of sessions) {
        const matchingTabs = this.filterTabs(session.tabs, query);
        const sessionNameMatch = session.name.toLowerCase().includes(query);

        if (matchingTabs.length > 0 || sessionNameMatch) {
          results.push({
            session: {
              ...session,
              nameMatch: sessionNameMatch
            },
            tabs: matchingTabs,
            totalMatches: matchingTabs.length
          });
        }
      }

      return results.sort((a, b) => b.totalMatches - a.totalMatches);
    } catch (error) {
      console.error('Error searching sessions:', error);
      return [];
    }
  }

  async searchSuspendedTabs(query) {
    try {
      const data = await chrome.storage.local.get(['suspendedTabs']);
      const suspendedTabs = data.suspendedTabs || [];
      return this.filterTabs(suspendedTabs, query);
    } catch (error) {
      console.error('Error searching suspended tabs:', error);
      return [];
    }
  }

  filterTabs(tabs, query) {
    return tabs.filter(tab => {
      const titleMatch = tab.title && tab.title.toLowerCase().includes(query);
      const urlMatch = tab.url && tab.url.toLowerCase().includes(query);
      const domainMatch = this.extractDomain(tab.url).toLowerCase().includes(query);
      
      return titleMatch || urlMatch || domainMatch;
    }).map(tab => ({
      ...tab,
      relevanceScore: this.calculateRelevanceScore(tab, query)
    })).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  calculateRelevanceScore(tab, query) {
    let score = 0;
    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();
    const domain = this.extractDomain(tab.url).toLowerCase();

    if (title.includes(query)) {
      score += 10;
      if (title.startsWith(query)) score += 5;
    }

    if (domain.includes(query)) {
      score += 8;
      if (domain === query) score += 5;
    }

    if (url.includes(query)) {
      score += 6;
    }

    if (tab.lastAccessed) {
      const daysSinceAccessed = (Date.now() - tab.lastAccessed) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 5 - daysSinceAccessed);
    }

    return score;
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return '';
    }
  }

  async quickSearch(query, limit = 10) {
    const results = await this.universalSearch(query);
    
    const quickResults = [];
    
    results.openTabs.slice(0, Math.min(3, limit)).forEach(tab => {
      quickResults.push({
        type: 'open-tab',
        data: tab,
        action: 'switch-to-tab'
      });
    });

    results.suspendedTabs.slice(0, Math.min(2, limit - quickResults.length)).forEach(tab => {
      quickResults.push({
        type: 'suspended-tab',
        data: tab,
        action: 'restore-tab'
      });
    });

    const remainingLimit = limit - quickResults.length;
    if (remainingLimit > 0) {
      for (const sessionResult of results.sessions.slice(0, 2)) {
        if (quickResults.length >= limit) break;
        
        sessionResult.tabs.slice(0, Math.min(2, remainingLimit)).forEach(tab => {
          if (quickResults.length < limit) {
            quickResults.push({
              type: 'session-tab',
              data: {
                ...tab,
                sessionId: sessionResult.session.id,
                sessionName: sessionResult.session.name
              },
              action: 'restore-from-session'
            });
          }
        });
      }
    }

    return quickResults.slice(0, limit);
  }

  async getSearchSuggestions(partialQuery) {
    if (partialQuery.length < 2) {
      return this.getRecentSearches();
    }

    const suggestions = [];
    const query = partialQuery.toLowerCase();

    const recentSearches = this.searchHistory
      .filter(search => search.includes(query) && search !== query)
      .slice(0, 3);

    suggestions.push(...recentSearches.map(search => ({
      type: 'recent-search',
      text: search,
      icon: 'history'
    })));

    try {
      const sessions = await this.storageManager.getSessions();
      
      const sessionSuggestions = sessions
        .filter(session => session.name.toLowerCase().includes(query))
        .slice(0, 3)
        .map(session => ({
          type: 'session',
          text: session.name,
          icon: 'folder',
          data: session
        }));

      suggestions.push(...sessionSuggestions);


    } catch (error) {
      console.error('Error getting search suggestions:', error);
    }

    return suggestions.slice(0, 10);
  }

  getRecentSearches() {
    return this.searchHistory
      .slice(0, 5)
      .map(search => ({
        type: 'recent-search',
        text: search,
        icon: 'history'
      }));
  }

  addToSearchHistory(query) {
    const index = this.searchHistory.indexOf(query);
    if (index > -1) {
      this.searchHistory.splice(index, 1);
    }
    
    this.searchHistory.unshift(query);
    
    if (this.searchHistory.length > this.maxHistoryItems) {
      this.searchHistory = this.searchHistory.slice(0, this.maxHistoryItems);
    }

    this.saveSearchHistory();
  }

  async saveSearchHistory() {
    try {
      await chrome.storage.local.set({ 
        searchHistory: this.searchHistory 
      });
    } catch (error) {
      console.error('Error saving search history:', error);
    }
  }

  async loadSearchHistory() {
    try {
      const data = await chrome.storage.local.get(['searchHistory']);
      this.searchHistory = data.searchHistory || [];
    } catch (error) {
      console.error('Error loading search history:', error);
      this.searchHistory = [];
    }
  }

  clearSearchHistory() {
    this.searchHistory = [];
    this.saveSearchHistory();
  }

  getEmptyResults() {
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

window.SearchManager = SearchManager;