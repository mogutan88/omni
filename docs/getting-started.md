# Getting Started with Omni Tab Manager

Welcome to Omni Tab Manager - the ultimate tab management and workspace organization solution for Chrome. This guide will help you get started with all the key features.

## 🚀 Quick Start

### Installing the Extension

1. **From Chrome Web Store** (Recommended):
   - Visit the Chrome Web Store
   - Search for "Omni Tab Manager" 
   - Click "Add to Chrome"
   - Your sessions will automatically sync across devices

2. **Development/Unpacked Installation**:
   - Download or clone the extension files
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top-right
   - Click "Load unpacked" and select the extension folder
   - ⚠️ **Important**: Use Export/Import to backup sessions (see Development Notes below)

### First Launch

After installation, you'll see the Omni icon in your Chrome toolbar. Click it to open the popup interface.

## 🎯 Core Features

### 1. Session Management

**What are Sessions?**
Sessions are saved collections of your tabs that you can restore later. Think of them as bookmarks for entire browsing sessions.

**Creating Sessions:**
- **From Popup**: Click the "Save Session" button
- **From Manager**: Navigate to Sessions view and click "Save Session"
- **Quick Save**: Use the sidebar quick actions in the manager

**Session Options:**
- **All Windows**: Save tabs from all open Chrome windows
- **Current Window**: Save only tabs from the active window
- **Custom Names**: Give your sessions meaningful names

**Restoring Sessions:**
- Click the "Restore" button next to any saved session
- All tabs will be reopened in new tabs
- Original tabs remain untouched

### 2. Tab Suspension

**What is Tab Suspension?**
Suspended tabs are temporarily unloaded to save memory while keeping their place in your browser.

**Manual Suspension:**
- Use the "Convert All Tabs" feature to suspend all current tabs
- Individual tabs can be suspended from the All Tabs view

**Automatic Suspension:**
- Enable in Preferences → General Settings
- Set timeout period (5-120 minutes)
- Inactive tabs will automatically suspend

**Restoring Suspended Tabs:**
- Click on any suspended tab to restore it
- Or use the restore button in the All Tabs view

### 3. Universal Search

**Searching Everything:**
- Use the search bar in the popup or manager page header
- Search across open tabs, suspended tabs, and saved sessions
- Results update in real-time as you type

**Search Filters:**
- Toggle different content types (tabs, sessions, history)
- Available in the Search view of the manager page

## 🖥️ Interface Overview

### Popup Interface (Click Extension Icon)

**Dashboard Tab:**
- Quick overview of your tabs and sessions
- Statistics: active tabs, suspended tabs, saved sessions
- Recent activity feed

**Sessions Tab:**
- List of all saved sessions
- Quick restore and delete actions
- Save new session button

**Search Tab:**
- Universal search across all content
- Real-time results as you type
- Click any result to open/restore

**Dev Tab** (Development Tools):
- Export/Import sessions for backup
- Storage statistics and debug information
- Development utilities

### Manager Page (Full Interface)

Access the full manager by clicking "Open Manager" in the popup or visiting the extension's manager page.

**Navigation Sidebar:**
- **Overview**: Dashboard with statistics and recent activity
- **Sessions**: Full session management interface
- **All Tabs**: View and manage all open and suspended tabs
- **Search**: Advanced search with filtering options
- **Preferences**: Settings and data management

## ⚙️ Settings & Preferences

### General Settings
- **Auto-save sessions**: Automatically save tabs when closing windows
- **Suspend inactive tabs**: Enable automatic tab suspension
- **Suspension timeout**: Set inactivity period (5-120 minutes)

### Appearance
- **Theme**: Light, Dark, or System
- **Compact mode**: Reduce spacing for more content

### Data & Privacy
- **Export Sessions**: Download your sessions as a JSON backup file
- **Import Sessions**: Upload and restore sessions from a backup file
- **Clear All Data**: Remove all saved sessions and settings (⚠️ irreversible)

## 💾 Data Backup & Sync

### Chrome Sync (Published Extension)
- Sessions automatically sync across your Chrome devices
- Data persists across extension updates
- Uses Chrome's built-in sync storage

### Manual Backup (Development Mode)
When using an unpacked/development version:

1. **Before Reloading Extension**:
   - Go to Dev tab or Preferences → Data & Privacy
   - Click "Export Sessions"
   - Save the JSON file safely

2. **After Reloading Extension**:
   - Click "Import Sessions" 
   - Select your saved JSON file
   - Your sessions will be restored

## 🔧 Development Notes

### For Developers & Power Users

**Unpacked Extension Limitations:**
- Sessions may not persist across extension reloads
- Each reload assigns a new extension ID
- Use Export/Import for reliable backup/restore

**Storage Information:**
- Chrome sync storage: 100KB total, 8KB per item
- Local storage: Higher limits but not persistent
- Sessions are optimized for sync storage limits

**Console Debugging:**
- Open Chrome DevTools → Console
- Look for Omni-related log messages
- Storage warnings will guide you on persistence issues

## 🆘 Troubleshooting

### Common Issues

**Sessions Not Saving:**
- Check if you have too many tabs (storage quota exceeded)
- Try saving current window only instead of all windows
- Use Export feature as backup

**Sessions Lost After Extension Update:**
- Normal for unpacked extensions
- Use Export/Import for backup/restore
- Consider using published version for automatic sync

**Tabs Not Restoring:**
- Some tabs (chrome://, extension pages) cannot be restored
- Check Chrome's security restrictions
- Private/Incognito tabs are not saved

**Search Not Working:**
- Clear search filters in Search view
- Try different search terms
- Refresh the manager page

### Getting Help

**Debug Information:**
- Visit Dev tab in popup for storage statistics
- Check console for error messages
- Export your data before reporting issues

**Performance Issues:**
- Reduce number of saved sessions
- Enable compact mode in preferences
- Clear old session data periodically

## 🎉 Tips & Best Practices

### Efficient Workflow

1. **Organize by Project**: Create sessions for different work projects
2. **Use Descriptive Names**: Name sessions clearly (e.g., "React Project - March 2024")
3. **Regular Cleanup**: Delete old sessions you no longer need
4. **Export Regularly**: Backup your sessions, especially in development mode

### Advanced Usage

- **Keyboard Shortcuts**: Use Chrome's extension shortcuts (configurable in chrome://extensions/shortcuts)
- **Window Management**: Save different sessions for different types of work
- **Memory Optimization**: Use tab suspension for better performance
- **Cross-Device Sync**: Install from Chrome Web Store for device synchronization

## 🔄 Updates & Changelog

Keep your extension updated for the latest features and bug fixes. Check the Chrome Web Store or GitHub repository for release notes and updates.

---

**Need more help?** Check out our [FAQ](./faq.md) or visit the [GitHub repository](https://github.com/your-repo/omni) for detailed documentation and support.