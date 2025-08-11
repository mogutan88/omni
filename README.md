# Omni Browser Extension

The ultimate tab management and session organization solution for modern browsers.

## Overview

Omni is a comprehensive browser extension that combines the best features from leading tab management extensions including Session Buddy, OneTab, Tabli, and Workona. It provides users with powerful tools for managing browser sessions, optimizing memory usage, and organizing their browsing workflow.

## Key Features

### 🗂️ Core Session Management
- **One-click session saving**: Save all open tabs and windows with automatic datetime naming
- **Flexible session scope**: Save all windows or single window sessions
- **Individual/bulk restoration**: Restore tabs individually, per window, or all at once
- **Crash recovery**: Automatic recovery of tabs after browser crashes
- **Auto-save functionality**: Automatically save sessions at regular intervals

### 📑 Advanced Tab Management
- **Memory optimization**: Save up to 95% memory usage by suspending inactive tabs
- **Cross-window management**: Manage tabs across all browser windows simultaneously
- **Visual tab organization**: Expandable/collapsible window groups
- **Powerful filtering**: Search and filter tabs by title, URL, or domain
- **Batch operations**: Select and perform actions on multiple tabs at once

### 🔍 Universal Search & Discovery
- **Comprehensive search**: Search across all open tabs, saved sessions, and history
- **Advanced filtering**: Filter by title, URL, domain, date, or custom tags
- **Fuzzy search**: Find tabs with partial matches and typos
- **Quick access**: Recently accessed tabs and sessions

### 📊 Data Management
- **Export/Import**: Multiple formats including JSON, CSV, HTML, and URLs
- **Cross-device sync**: Synchronize sessions across multiple devices
- **Cloud backup**: Automatic backup of all saved data
- **Version history**: Track changes and revert to previous states

### 🎯 Productivity Features
- **Keyboard shortcuts**: Complete keyboard navigation and control
- **Smart suggestions**: AI-powered recommendations for tab organization
- **Tab scheduling**: Schedule tabs to open at specific times
- **Auto-cleanup**: Automatically close or archive old unused tabs
- **Duplicate detection**: Identify and manage duplicate tabs

### 🔒 Privacy & Security
- **Local processing**: All data processing happens locally in browser
- **No external transmission**: Tab URLs never sent to external servers
- **Enterprise-grade encryption**: 256-bit AES encryption for stored data
- **Privacy controls**: Granular control over data sharing and storage

## Terminology

- **Session**: The status of browser tabs and windows at a given time, which can be stored and restored
- **Single Window Session**: A session limited to tabs within a single window
- **Named Session**: A session with a user-assigned or automatically generated name
- **Omni Popup**: Popup window shown when user clicks the extension icon in the window toolbar
- **Omni Page**: Extension index page which has UIs of full features and functionalities of the Omni extension

## Browser Compatibility

- ✅ Google Chrome
- ✅ Microsoft Edge
- ✅ Mozilla Firefox

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project directory

## Development

### Project Structure
```
omni/
├── manifest.json
├── background.js
├── popup.html
├── omni.html
├── suspended.html
├── src/
│   ├── tab-manager.js
│   ├── search-manager.js
│   └── popup.js
├── css/
│   └── popup.css
├── docs/
│   └── prd.md
└── logs/
    └── worklog-yyyyMMdd.md
```

### Implementation Phases

#### Phase 1 (MVP) ✅
- Core session management (saving, restoration, suspension)
- Basic session saving and recovery
- Universal search functionality

#### Phase 2 (Enhanced Features) 🔄
- Advanced organization and grouping
- Export/import capabilities
- Keyboard shortcuts and quick actions
- Cross-device synchronization

#### Phase 3 (Advanced Features) 📋
- Collaboration features
- Cloud service integrations
- AI-powered suggestions
- Advanced productivity enhancements

## Performance Metrics

- **Memory Reduction**: Target 90%+ reduction through tab suspension
- **Session Recovery**: 99.9% success rate
- **Fast Switching**: Near-instant switching between sessions
- **Resource Optimization**: Intelligent caching and lazy loading

## Competitive Advantages

Omni differentiates itself by:
- Combining all best features from leading competitors in one solution
- Enhanced performance with intelligent resource management
- Superior cross-device synchronization
- Advanced collaboration capabilities
- Enterprise-grade security and privacy
- Extensible architecture for future integrations

## Reference Extensions

### OneTab
- https://www.one-tab.com/
- https://chromewebstore.google.com/detail/onetab/chphlpgkkbolifaimnlloiipkdnihall

### Session Buddy
- https://sessionbuddy.com/
- https://chromewebstore.google.com/detail/session-buddy/edacconmaakjimmfgnblocblbcdcpbko

### Tabli
- https://www.gettabli.com/
- https://chromewebstore.google.com/detail/tabli/igeehkedfibbnhbfponhjjplpkeomghi

### Workona
- https://workona.com/
- https://chromewebstore.google.com/detail/tab-manager-by-workona/ailcmbgekjpnablpdkmaaccecekgdhlh

## Contributing

Please read the [Product Requirements Document](docs/prd.md) for detailed feature specifications and implementation guidelines.

## License

This project is licensed under the MIT License.