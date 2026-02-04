#!/bin/bash
set -e

echo "=== SWE-bench Evaluation Environment ==="
echo "Run Mode: ${RUN_MODE:-vanilla}"
echo "Claude Code version: $(claude --version 2>/dev/null || echo 'not installed')"

# Configure Claude Code if auth token is provided
if [ -n "$ANTHROPIC_AUTH_TOKEN" ]; then
    echo "Anthropic auth token configured"
    export ANTHROPIC_AUTH_TOKEN="$ANTHROPIC_AUTH_TOKEN"
else
    echo "WARNING: ANTHROPIC_AUTH_TOKEN not set"
fi

# Configure custom base URL if provided
if [ -n "$ANTHROPIC_BASE_URL" ]; then
    echo "Using custom Anthropic base URL: $ANTHROPIC_BASE_URL"
    export ANTHROPIC_BASE_URL="$ANTHROPIC_BASE_URL"
fi

# Install OMB if in omc mode
if [ "$RUN_MODE" = "omc" ]; then
    echo "Installing oh-my-black for enhanced mode..."

    # Check if OMB source is mounted
    if [ -d "/workspace/omc-source" ]; then
        echo "Installing OMB from mounted source..."
        cd /workspace/omc-source && npm install && npm link
    else
        echo "Installing OMB from npm..."
        npm install -g oh-my-black
    fi

    # Initialize OMB configuration
    mkdir -p ~/.claude

    echo "OMB installation complete"
fi

# Execute the command passed to the container
exec "$@"
