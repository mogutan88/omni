# Cipher Memory Management Setup

## Overview
Cipher is integrated into the Omni Extension project to provide intelligent memory management for AI-driven development workflows. It captures and organizes development knowledge, technical decisions, and problem-solving patterns.

## Setup Status
✅ **Configured Files:**
- `.cipher.json` - Project metadata and configuration
- `memAgent/cipher.yml` - Agent configuration with memory categories
- `.env` - Environment configuration (API keys needed)

## Required Configuration

### 1. API Key Setup
To use Cipher with AI capabilities, you need to configure an API key in `.env`:

```bash
# For Claude/Anthropic (recommended for this project)
ANTHROPIC_API_KEY="your_anthropic_api_key_here"

# Or for OpenAI
OPENAI_API_KEY="your_openai_api_key_here"
```

### 2. Memory Categories
The project is configured with specific memory categories:

- **architecture** - System architecture decisions and patterns
- **features** - Implemented features and functionality  
- **bugs_fixed** - Bug fixes and solutions discovered
- **ai_workflow** - AI development workflow and tool usage
- **technical_decisions** - Technical decisions and rationale
- **chrome_extension_quirks** - Chrome extension specific challenges

## Usage Examples

### Basic Memory Operations
```bash
# Add a memory about a technical decision
cipher "Remember: We use Chrome Sync API for session persistence because it survives extension reinstalls and syncs across devices"

# Add a bug fix memory
cipher "Bug fix: Chrome internal page favicons were broken due to _favicon API requiring proper URL encoding and permissions in manifest.json"

# Query project memories
cipher "What do we know about session storage implementation?"

# Interactive mode
cipher
```

### Advanced Usage
```bash
# Start API server for web UI
cipher --mode api --port 3001

# Start full UI application  
cipher --mode ui --port 3000

# Use specific agent configuration
cipher --agent memAgent/cipher.yml "Tell me about our Chrome extension architecture"
```

## Memory Content Ideas

Based on the Omni Extension project, here are key memories to capture:

### Architecture Decisions
- Chrome Sync API vs Local Storage trade-offs
- Window grouping preservation strategy
- Dual storage approach (sync + local backup)

### Technical Solutions
- Chrome internal page favicon retrieval using _favicon API
- CSP violation fixes with event delegation
- Session optimization for sync storage limits

### AI Workflow Insights  
- Claude Code: Most reliable for consistent results
- Gemini CLI: Good performance, solid alternative
- Codex CLI: Slower but functional
- Devin: Excellent for independent tasks

### Chrome Extension Quirks
- Manifest V3 service worker limitations
- Chrome://favicon/ security restrictions
- Extension ID persistence challenges

## Next Steps

1. **Configure API Key**: Add your preferred AI provider's API key to `.env`
2. **Initialize Memories**: Run the initialization command to populate basic project knowledge
3. **Regular Usage**: Use Cipher throughout development to capture insights and decisions
4. **Team Sharing**: Export/import memory for team collaboration

## Integration with Development Workflow

Cipher can be integrated into your development process:

```bash
# Before starting work
cipher "What did we learn about Chrome extension development last time?"

# After fixing a bug
cipher "Bug fix: [describe the problem and solution]"

# After making architectural decisions
cipher "Architecture decision: [explain the decision and reasoning]"

# When encountering Chrome extension quirks
cipher "Chrome extension quirk: [describe the issue and workaround]"
```

This provides a persistent knowledge base that grows with your project and can be invaluable for onboarding new team members or revisiting old decisions.