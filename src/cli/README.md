# OMB Analytics CLI

Command-line interface for Oh-My-ClaudeCode analytics, token tracking, cost reports, and session management.

## Installation

After installing oh-my-black:

```bash
npm install -g oh-my-black
```

The `omb-analytics` command will be available globally.

## Commands

### Stats

Show current session statistics including token usage, costs, and top agents.

```bash
omb-analytics stats
omb-analytics stats --json
```

### Cost Reports

Generate cost reports for different time periods.

```bash
omb-analytics cost daily
omb-analytics cost weekly
omb-analytics cost monthly
omb-analytics cost monthly --json
```

### Session History

View historical session data.

```bash
omb-analytics sessions
omb-analytics sessions --limit 20
omb-analytics sessions --json
```

### Agent Usage

Show agent usage breakdown by tokens and cost.

```bash
omb-analytics agents
omb-analytics agents --limit 20
omb-analytics agents --json
```

### Export Data

Export analytics data to JSON or CSV format.

```bash
# Export cost report
omb-analytics export cost json ./cost-report.json
omb-analytics export cost csv ./cost-report.csv --period weekly

# Export session history
omb-analytics export sessions json ./sessions.json
omb-analytics export sessions csv ./sessions.csv

# Export usage patterns
omb-analytics export patterns json ./patterns.json
```

### Cleanup

Remove old logs and orphaned background tasks.

```bash
omb-analytics cleanup
omb-analytics cleanup --retention 60  # Keep 60 days instead of default 30
```

## Data Storage

Analytics data is stored in:
- `~/.omb/analytics/tokens/` - Token usage logs
- `~/.omb/analytics/sessions/` - Session history
- `~/.omb/analytics/metrics/` - Performance metrics

## JSON Output

All commands support `--json` flag for machine-readable output, useful for integration with other tools or scripts.

```bash
# Example: Parse JSON output with jq
omb-analytics stats --json | jq '.stats.totalCost'
omb-analytics agents --json | jq '.topAgents[0].agent'
```

## Examples

### Daily Cost Tracking

```bash
# Check today's cost
omb-analytics cost daily

# Export weekly report
omb-analytics export cost csv weekly-report.csv --period weekly
```

### Session Analysis

```bash
# View recent sessions
omb-analytics sessions --limit 5

# Export all sessions for analysis
omb-analytics export sessions json all-sessions.json
```

### Agent Performance

```bash
# See which agents are most expensive
omb-analytics agents --limit 10

# Export for spreadsheet analysis
omb-analytics export patterns csv agent-patterns.csv
```

### Maintenance

```bash
# Monthly cleanup (keep 90 days of data)
omb-analytics cleanup --retention 90
```
