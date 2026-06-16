#!/bin/bash
# Record demo GIF for README
# Usage: ./scripts/record-demo.sh
# Requires: asciinema, agg

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CAST_FILE="$PROJECT_DIR/demo.cast"
GIF_FILE="$PROJECT_DIR/demo.gif"

echo "Recording demo..."

# Record with asciinema
asciinema rec "$CAST_FILE" \
  --cols 100 \
  --rows 28 \
  --overwrite \
  --command "$SCRIPT_DIR/demo-full.sh"

echo ""
echo "Converting to GIF..."

# Convert to GIF with agg
agg "$CAST_FILE" "$GIF_FILE" \
  --theme monokai \
  --font-size 16 \
  --speed 1.0 \
  --cols 100 \
  --rows 28

echo "Done! Files:"
echo "  $CAST_FILE"
echo "  $GIF_FILE"
