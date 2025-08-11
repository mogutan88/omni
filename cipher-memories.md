# Omni Extension - Cipher Memory Bank

## Project Overview Memories

### Core Architecture
- **Storage Strategy**: Dual approach using Chrome Sync API (primary) + Local Storage (backup) for maximum persistence
- **Window Grouping**: Sessions preserve window structure using windowId as container, without geometric properties
- **Session Persistence**: Chrome Sync API survives extension reinstalls and syncs across devices
- **Data Optimization**: Sessions optimized for sync storage limits (5 windows max, 10 tabs per window)

### Key Technical Decisions
- **Manifest V3**: Used service worker architecture instead of background pages
- **favicon API**: Implemented Chrome's `_favicon` API for internal pages (chrome://settings, etc.)
- **Event Delegation**: Replaced inline event handlers to fix CSP violations
- **Storage Limits**: Implemented fallback to local storage when sync storage quota exceeded

## Bug Fixes and Solutions

### Chrome Internal Page Favicons
- **Problem**: Chrome internal pages (chrome://extensions) showed broken HTML with escaped quotes
- **Root Cause**: SVG data URLs with unescaped quotes breaking HTML template literals
- **Solution**: Used Chrome's `_favicon` API with proper URL encoding and web_accessible_resources permissions

### Session Persistence Issues
- **Problem**: Sessions lost after extension reinstall/reload during development
- **Root Cause**: Local storage gets cleared, unpacked extensions don't maintain stable IDs
- **Solution**: Chrome Sync API + manifest key for stable ID + bookmark backup system

### Search Functionality Broken in Popup
- **Problem**: Search worked in manager page but not in popup
- **Root Cause**: Legacy workspace references causing JavaScript errors
- **Solution**: Removed workspace-related code and added proper null checks

### Tab Counting Inconsistencies
- **Problem**: Badge counts didn't update when tabs closed externally
- **Root Cause**: No listeners for external tab closure events
- **Solution**: Added Chrome tabs/windows event listeners with throttled messaging

## Chrome Extension Quirks

### Security Restrictions
- `chrome://favicon/` URLs blocked by security policy for external URLs
- CSP violations from inline event handlers
- Web accessible resources required for _favicon API

### Storage Limitations
- Chrome Sync API: 100KB total limit, 8KB per item
- Local storage cleared on extension removal
- Sync storage has quota limits that require optimization

### API Peculiarities
- `_favicon` API only works for internal Chrome pages
- Service worker limitations compared to background pages
- Extension ID changes on each unpacked extension reload

## AI Workflow Insights

### Tool Performance
- **Claude Code**: Most reliable and consistent, best for complex refactoring
- **Gemini CLI**: Fast responses, good for quick implementations  
- **Codex CLI**: Functional but slower, mixed quality results
- **Devin**: Excellent for independent tasks and code review

### Workflow Automation
- Automatic worklog generation and todo updates
- AI-driven PRD creation and documentation
- Integrated debugging and issue tracking
- Automated presentation material creation

## Feature Implementation Patterns

### Universal Search
- Real-time search across tabs, sessions, and suspended tabs
- Fuzzy matching with relevance scoring
- Grouped results by window for better organization
- Auto-focus and keyboard navigation

### Session Management
- Named sessions with automatic timestamping
- Window grouping preservation during save/restore
- Export/import functionality for backup
- Bookmark-based persistence for uninstall protection

### Tab Suspension
- Memory optimization through tab suspension
- Selective suspension (excludes Chrome internal pages)
- Visual indicators for suspended state
- Bulk operations for efficiency

## Development Environment

### Project Structure
```
omni/
├── manifest.json          # Extension manifest with V3 config
├── src/
│   ├── tab-manager.js     # Core tab operations
│   ├── session-manager.js # Session save/restore logic
│   ├── search-manager.js  # Universal search functionality
│   └── storage-manager.js # Dual storage strategy
├── docs/                  # Documentation and guides  
└── logs/                  # AI-generated work logs
```

### Key Files
- `manifest.json`: Contains stable ID key and permissions
- `background.js`: Service worker for event handling
- `popup.html/js`: Extension popup interface
- `omni.html`: Full-featured manager page

This memory bank serves as a comprehensive reference for future development and team onboarding.