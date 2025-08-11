# Claude Code Instructions for Omni Project

## Project Overview
Omni is a comprehensive browser extension that combines the best features from leading tab management extensions (Session Buddy, OneTab, Tabli, and Workona). The project aims to create the ultimate tab management and workspace organization solution.

## Work Logging Requirements

**MANDATORY LOGGING RULE**: After completing any significant work session or task, Claude must:
1. Create/update a worklog entry in the format `logs/worklog-yyyyMMdd.md` with the following structure:
2. Update `docs/todo.md` to reflect the current status of completed tasks by checking off completed items and adding any new tasks discovered

### Worklog Format:
```markdown
# Worklog - [Date]

## Session [N] - [Time Range]

### User Request:
Request Datetime: yyyy-MM-dd hh:mm:ss

[Record the user's request exactly as asked]

### Work Completed:
Completed time: yyyy-MM-dd hh:mm:ss

- [List all tasks completed]
- [Include file names and key changes]
- [Note any decisions made or approaches taken]

### Files Created/Modified:
- `filename.ext` - [Brief description of what was done]

### Key Decisions:
- [Any important architectural or implementation decisions]

### Issues/Challenges:
- [Any problems encountered and how they were resolved]

### Next Steps:
- [Any follow-up work identified]

---
```

### When to Log and Update Todo:
- After implementing features or functionality
- After making significant changes to existing code
- After research or analysis work
- After troubleshooting or debugging
- At the end of any substantial work session
- When switching between different types of tasks
- Whenever a user request is completed
- When new tasks or issues are discovered

### Todo Update Requirements:
- Check off completed items with `[x]` when tasks are finished
- Add new tasks discovered during implementation
- Update task status (✅ COMPLETED, 🔄 IN PROGRESS, 📋 PENDING)
- Add notes about blockers or dependencies
- Keep the todo.md file as the single source of truth for project status

### Log Location:
All logs must be stored in `logs/worklog-yyyyMMdd.md` files where:
- `yyyy` = 4-digit year
- `MM` = 2-digit month
- `dd` = 2-digit day

## Project Structure
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
├── logs/
│   └── worklog-yyyyMMdd.md
└── CLAUDE.md
```

## Development Guidelines

### Code Standards:
- Follow existing code style and patterns
- Use ES6+ features where appropriate
- Include error handling for all async operations
- Write clear, self-documenting code
- Follow Chrome extension best practices

### Content Security Policy (CSP) Requirements:
**CRITICAL**: Chrome extensions have strict CSP that prevents inline JavaScript execution.

**Never Use:**
- Inline event handlers: `onclick="function()"`, `onload="function()"`, etc.
- Inline JavaScript in HTML: `<script>code here</script>`
- `javascript:` URLs in href attributes
- `eval()` or similar dynamic code execution

**Always Use Instead:**
- Event delegation with `addEventListener()` in separate JS files
- Data attributes for passing data: `data-session-id="123"`
- CSS classes for identifying elements: `class="session-restore-btn"`
- External script files with proper event delegation patterns

**Event Delegation Pattern:**
```javascript
// ✅ CORRECT: Event delegation in separate JS file
document.addEventListener('click', (e) => {
  const restoreBtn = e.target.closest('.session-restore-btn');
  if (restoreBtn) {
    const sessionId = restoreBtn.dataset.sessionId;
    this.restoreSession(sessionId);
    return;
  }
});

// ❌ WRONG: Inline handler (will cause CSP violation)
<button onclick="manager.restoreSession('123')">Restore</button>

// ✅ CORRECT: Use data attributes instead
<button class="session-restore-btn" data-session-id="123">Restore</button>
```

**Testing CSP Compliance:**
- Load extension as unpacked extension in Chrome
- Open DevTools Console when testing
- Look for CSP violation errors
- All CSP errors must be fixed before release

### Testing:
- Test all functionality in Chrome browser
- Verify permissions and manifest configuration
- Test across different window states and tab configurations
- Validate data persistence and recovery

### Documentation:
- Keep PRD updated with any changes
- Document API changes or new interfaces
- Update README if project structure changes
- Maintain clear commit messages

## Implementation Phases

### Phase 1 (MVP) - COMPLETED
- Core tab management (conversion, restoration, suspension)
- Basic session saving and recovery
- Simple workspace organization  
- Universal search functionality

### Phase 2 (Enhanced Features) - PENDING
- Advanced organization and grouping
- Export/import capabilities
- Keyboard shortcuts and quick actions
- Cross-device synchronization

### Phase 3 (Advanced Features) - PENDING
- Collaboration features
- Cloud service integrations
- AI-powered suggestions
- Advanced productivity enhancements

## Important Notes
- Always prioritize data safety and recovery
- Maintain backward compatibility when possible
- Follow Chrome extension security guidelines
- Test memory usage and performance impact
- Ensure privacy and local data processing