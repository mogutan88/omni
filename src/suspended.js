class SuspendedPage {
    constructor() {
        this.uniqueId = this.getUniqueIdFromUrl();
        this.suspendedTab = null;
        this.initialize();
    }

    getUniqueIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const uniqueId = urlParams.get('uniqueId');
        
        if (uniqueId) {
            return uniqueId;
        }
        
        // Migration fallback: convert legacy 'id' parameter to uniqueId format
        const legacyId = urlParams.get('id');
        if (legacyId) {
            console.warn('Using legacy id parameter. This will be migrated to uniqueId format.');
            return `migration-${crypto.randomUUID()}`;
        }
        
        console.error('No uniqueId or id parameter found in URL');
        return null;
    }

    async initialize() {
        await this.loadSuspendedTabData();
        this.setupEventListeners();
        this.updateSuspendTime();
        setInterval(() => this.updateSuspendTime(), 60000); // Update every minute
    }

    async loadSuspendedTabData() {
        if (!this.uniqueId) {
            document.getElementById('tabTitle').textContent = 'Invalid Tab';
            document.getElementById('tabUrl').textContent = 'No valid tab identifier found';
            return;
        }

        try {
            const data = await chrome.storage.local.get(['suspendedTabs']);
            const suspendedTabs = data.suspendedTabs || [];
            
            // First try exact uniqueId match
            this.suspendedTab = suspendedTabs.find(tab => 
                tab.uniqueId === this.uniqueId
            );

            // If not found and this looks like a migration ID, try to find by legacy fallback
            if (!this.suspendedTab && this.uniqueId.startsWith('migration-')) {
                // For migration IDs, try to find the first tab without a uniqueId
                this.suspendedTab = suspendedTabs.find(tab => 
                    !tab.uniqueId || tab.uniqueId === this.uniqueId
                );
                
                if (this.suspendedTab) {
                    console.log('Found suspended tab by migration ID during fallback');
                }
            }

            if (this.suspendedTab) {
                document.getElementById('tabTitle').textContent = this.suspendedTab.title;
                document.getElementById('tabUrl').textContent = this.suspendedTab.url;
            } else {
                document.getElementById('tabTitle').textContent = 'Tab Not Found';
                document.getElementById('tabUrl').textContent = 'This suspended tab may have been cleaned up or restored';
            }
        } catch (error) {
            console.error('Error loading suspended tab data:', error);
            document.getElementById('tabTitle').textContent = 'Error Loading Tab';
            document.getElementById('tabUrl').textContent = 'Please try refreshing';
        }
    }

    setupEventListeners() {
        document.getElementById('restoreBtn').addEventListener('click', () => {
            this.restoreTab();
        });

        document.getElementById('omniBtn').addEventListener('click', () => {
            this.openOmni();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.restoreTab();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.openOmni();
            }
        });
    }

    async restoreTab() {
        if (!this.suspendedTab) {
            alert('Cannot restore tab: tab data not found');
            return;
        }

        try {
            // Send message to background script to handle restoration through TabManager
            const response = await chrome.runtime.sendMessage({
                type: 'RESTORE_TAB',
                uniqueId: this.uniqueId
            });

            if (!response || !response.success) {
                console.error('Failed to restore tab:', response?.error);
                // Fallback: create new tab with the original URL
                await chrome.tabs.create({ url: this.suspendedTab.url });
            }
        } catch (error) {
            console.error('Error sending restore message:', error);
            // Fallback: create new tab with the original URL
            try {
                await chrome.tabs.create({ url: this.suspendedTab.url });
            } catch (createError) {
                console.error('Error creating fallback tab:', createError);
                alert('Unable to restore tab. Please try again.');
            }
        }
    }

    async openOmni() {
        try {
            await chrome.action.openPopup();
        } catch (error) {
            try {
                await chrome.tabs.create({
                    url: chrome.runtime.getURL('popup.html')
                });
            } catch (err) {
                console.error('Error opening Omni:', err);
            }
        }
    }

    updateSuspendTime() {
        if (!this.suspendedTab) return;

        const now = Date.now();
        const suspendedAt = this.suspendedTab.suspended || now;
        const diffMs = now - suspendedAt;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeText;
        if (diffMins < 1) {
            timeText = 'Just now';
        } else if (diffMins < 60) {
            timeText = `${diffMins}m`;
        } else if (diffHours < 24) {
            timeText = `${diffHours}h`;
        } else {
            timeText = `${diffDays}d`;
        }

        document.getElementById('suspendTime').textContent = timeText;
    }
}

if (typeof chrome !== 'undefined' && chrome.storage) {
    new SuspendedPage();
} else {
    document.getElementById('tabTitle').textContent = 'Extension Not Available';
    document.getElementById('tabUrl').textContent = 'Please reload this tab';
    document.getElementById('restoreBtn').addEventListener('click', () => {
        window.location.reload();
    });
}
