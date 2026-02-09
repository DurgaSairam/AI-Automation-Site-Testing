#!/bin/bash

# Cron Job Setup for Scheduled Testing
# This script helps set up automated testing on a schedule

echo "🕐 Setting up scheduled automated testing"
echo ""

# Get the current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Script directory: $SCRIPT_DIR"
echo ""

# Prompt for schedule
echo "Select testing schedule:"
echo "1) Every hour"
echo "2) Every 6 hours"
echo "3) Every 12 hours"
echo "4) Daily at 2 AM"
echo "5) Daily at specific time"
echo "6) Custom cron expression"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
  1)
    CRON_SCHEDULE="0 * * * *"
    SCHEDULE_DESC="every hour"
    ;;
  2)
    CRON_SCHEDULE="0 */6 * * *"
    SCHEDULE_DESC="every 6 hours"
    ;;
  3)
    CRON_SCHEDULE="0 */12 * * *"
    SCHEDULE_DESC="every 12 hours"
    ;;
  4)
    CRON_SCHEDULE="0 2 * * *"
    SCHEDULE_DESC="daily at 2 AM"
    ;;
  5)
    read -p "Enter hour (0-23): " hour
    CRON_SCHEDULE="0 $hour * * *"
    SCHEDULE_DESC="daily at $hour:00"
    ;;
  6)
    read -p "Enter cron expression: " CRON_SCHEDULE
    SCHEDULE_DESC="custom schedule"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo "Setting up tests to run $SCHEDULE_DESC"
echo "Cron expression: $CRON_SCHEDULE"
echo ""

# Create the cron job
CRON_JOB="$CRON_SCHEDULE cd $SCRIPT_DIR && /usr/bin/node $SCRIPT_DIR/auto-test-suite.js >> $SCRIPT_DIR/cron.log 2>&1"

# Check if cron job already exists
(crontab -l 2>/dev/null | grep -v "$SCRIPT_DIR/auto-test-suite.js") | crontab -

# Add new cron job
(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "✅ Cron job installed successfully!"
echo ""
echo "The following job has been added to your crontab:"
echo "$CRON_JOB"
echo ""
echo "Logs will be written to: $SCRIPT_DIR/cron.log"
echo ""
echo "To view current cron jobs, run: crontab -l"
echo "To remove this cron job, run: crontab -e"
echo ""
echo "Note: Make sure Node.js and Playwright are properly installed"
echo "Test the script manually first: npm test"
