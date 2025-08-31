#!/bin/bash

# Weekly Reports - Deployment Script
# This script handles deployment on the Ubuntu server
# Usage: ./scripts/deploy.sh [--skip-backup] [--skip-build]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/ubuntu/weekly-report-site"
BACKUP_DIR="/home/ubuntu/backups"
LOG_FILE="/home/ubuntu/logs/deploy.log"
APP_NAME="weeklyreport"

# Function to log messages
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}" | tee -a "$LOG_FILE"
}

# Parse command line arguments
SKIP_BACKUP=false
SKIP_BUILD=false

for arg in "$@"; do
    case $arg in
        --skip-backup)
        SKIP_BACKUP=true
        shift
        ;;
        --skip-build)
        SKIP_BUILD=true
        shift
        ;;
        --help|-h)
        echo "Usage: $0 [--skip-backup] [--skip-build]"
        echo "  --skip-backup    Skip creating backup"
        echo "  --skip-build     Skip npm build step"
        exit 0
        ;;
    esac
done

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    log_error "This script must be run as the ubuntu user"
    log "Please run: sudo -u ubuntu $0"
    exit 1
fi

log "🚀 Starting deployment process..."

# Navigate to application directory
if [ ! -d "$APP_DIR" ]; then
    log_error "Application directory not found: $APP_DIR"
    exit 1
fi

cd "$APP_DIR"

# Create backup (unless skipped)
if [ "$SKIP_BACKUP" = false ]; then
    log "📦 Creating backup..."
    mkdir -p "$BACKUP_DIR"
    
    BACKUP_NAME="backup-$(date +%Y%m%d_%H%M%S).tar.gz"
    tar -czf "$BACKUP_DIR/$BACKUP_NAME" -C /home/ubuntu weekly-report-site
    
    log_success "Backup created: $BACKUP_NAME"
    
    # Clean up old backups (keep last 5)
    find "$BACKUP_DIR" -name "backup-*.tar.gz" -type f | sort -r | tail -n +6 | xargs -r rm
    log "🧹 Cleaned up old backups (keeping last 5)"
else
    log_warning "Skipping backup creation"
fi

# Check git status
log "📥 Checking git repository status..."
if [ ! -d ".git" ]; then
    log_error "Not a git repository"
    exit 1
fi

# Show current status
log "Current branch: $(git branch --show-current)"
log "Current commit: $(git rev-parse --short HEAD)"

# Fetch and pull latest changes
log "📡 Fetching latest changes..."
git fetch origin

CURRENT_COMMIT=$(git rev-parse HEAD)
LATEST_COMMIT=$(git rev-parse origin/main)

if [ "$CURRENT_COMMIT" = "$LATEST_COMMIT" ]; then
    log_warning "Already up to date!"
else
    log "📩 Pulling latest changes..."
    git reset --hard origin/main
    NEW_COMMIT=$(git rev-parse --short HEAD)
    log_success "Updated to commit: $NEW_COMMIT"
fi

# Install dependencies and build (unless skipped)
if [ "$SKIP_BUILD" = false ]; then
    log "📦 Installing dependencies..."
    cd frontend
    
    # Check if package-lock.json changed
    if git diff --name-only HEAD~1 HEAD | grep -q "package-lock.json"; then
        log "📦 Package dependencies changed, running clean install..."
        rm -rf node_modules
        npm ci
    else
        npm ci
    fi
    
    log "🔨 Building application..."
    npm run build
    
    log_success "Build completed successfully"
    
    cd ..
else
    log_warning "Skipping build step"
fi

# Restart application with PM2
log "🔄 Restarting application..."

# Check if PM2 process exists
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
    log "♻️  Restarting existing PM2 process..."
    pm2 restart "$APP_NAME"
else
    log "🆕 Starting new PM2 process..."
    pm2 start ecosystem.config.js
fi

# Save PM2 configuration
pm2 save

# Wait for application to start
log "⏳ Waiting for application to start..."
sleep 5

# Health check
log "🏥 Performing health check..."
pm2 status

# Check if application responds
for i in {1..10}; do
    if curl -f -s http://localhost:3000 > /dev/null; then
        log_success "Application is responding on port 3000"
        break
    else
        if [ $i -eq 10 ]; then
            log_error "Application is not responding after 10 attempts"
            log "📋 Recent logs:"
            pm2 logs "$APP_NAME" --lines 20 --nostream
            exit 1
        fi
        log "⏳ Attempt $i/10: Waiting for application to respond..."
        sleep 2
    fi
done

# Final status
log "📊 Final status:"
pm2 status
pm2 info "$APP_NAME"

# Show recent logs
log "📋 Recent logs (last 10 lines):"
pm2 logs "$APP_NAME" --lines 10 --nostream

log_success "🎉 Deployment completed successfully!"
log "🌐 Application should be available at: https://weeklyreport.info"

# Deployment summary
echo ""
echo "=========================================="
echo "           DEPLOYMENT SUMMARY"
echo "=========================================="
echo "✅ Backup: $([ "$SKIP_BACKUP" = false ] && echo "Created" || echo "Skipped")"
echo "✅ Code: Updated to latest commit"
echo "✅ Build: $([ "$SKIP_BUILD" = false ] && echo "Completed" || echo "Skipped")"
echo "✅ PM2: Application restarted"
echo "✅ Health Check: Passed"
echo "🕒 Deployment completed at: $(date)"
echo "=========================================="