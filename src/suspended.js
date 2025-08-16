class SuspendedPage {
    constructor() {
        this.uniqueId = this.getUniqueIdFromUrl();
        this.suspendedTab = null;
        this.initialize();
    }

    getUniqueIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('uniqueId') || urlParams.get('id');
    }

    async initialize() {
        await this.loadSuspendedTabData();
        this.setupEventListeners();
        this.updateSuspendTime();
        setInterval(() => this.updateSuspendTime(), 60000); // Update every minute
    }

    async loadSuspendedTabData() {
        try {
            const data = await chrome.storage.local.get(['suspendedTabs']);
            const suspendedTabs = data.suspendedTabs || [];
            
            this.suspendedTab = suspendedTabs.find(tab => 
                tab.uniqueId === this.uniqueId
            );

            if (this.suspendedTab) {
                document.getElementById('tabTitle').textContent = this.suspendedTab.title;
                document.getElementById('tabUrl').textContent = this.suspendedTab.url;
            } else {
                document.getElementById('tabTitle').textContent = 'Unknown Tab';
                document.getElementById('tabUrl').textContent = 'Tab data not found';
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
            // chrome.tabs.getCurrent() can return undefined in certain contexts (e.g., when called from a popup or background script).
            // In such cases, we create a new tab as a fallback.
            const currentTab = await chrome.tabs.getCurrent();
            if (!currentTab) {
                await chrome.tabs.create({ url: this.suspendedTab.url });
                return;
            }
            await chrome.tabs.update(currentTab.id, { 
                url: this.suspendedTab.url 
            });

            const data = await chrome.storage.local.get(['suspendedTabs']);
            const suspendedTabs = data.suspendedTabs || [];
            const updatedTabs = suspendedTabs.filter(tab => 
                tab.uniqueId !== this.suspendedTab.uniqueId
            );
            await chrome.storage.local.set({ suspendedTabs: updatedTabs });

        } catch (error) {
            console.error('Error restoring tab:', error);
            await chrome.tabs.create({ url: this.suspendedTab.url });
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
