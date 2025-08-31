# Weekly Report Site - Ubuntu Server Deployment Guide

## Prerequisites
- Ubuntu 22.04 server on Oracle Cloud Infrastructure
- Domain: weeklyreport.info pointing to your server IP
- Root or sudo access

## Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y

# Install certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# Install git (if not already installed)
sudo apt install git -y
```

## Setup Application User

```bash
# Create dedicated user for the application
sudo useradd -m -s /bin/bash webapp
sudo usermod -a -G sudo webapp

# Switch to webapp user
sudo su - webapp

# Create necessary directories
mkdir -p ~/logs
```

## Deploy Application

```bash
# Clone repository
cd /home/webapp
git clone https://github.com/ChefToan/Weekly-Report-Manager.git WeeklyReportSite
cd WeeklyReportSite/frontend

# Copy environment configuration
cp .env.example .env

# Edit environment variables
nano .env
```

### Environment Variables Setup
Update `.env` with your production values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NEXT_PUBLIC_APP_URL=https://weeklyreport.info
NODE_ENV=production
RESEND_API_KEY=your_resend_key
FROM_EMAIL=noreply@weeklyreport.info
```

## Install Dependencies and Build

```bash
# Install dependencies
npm ci

# Build the application
npm run build

# Test the build
npm start
# Press Ctrl+C to stop after verifying it works
```

## Setup SSL Certificate

```bash
# Exit webapp user
exit

# Setup SSL with Let's Encrypt
sudo certbot --nginx -d weeklyreport.info

# Follow the prompts to complete SSL setup
```

## Configure Nginx

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/weeklyreport.info
```

Paste the Nginx configuration from the security audit file, then:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/weeklyreport.info /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Setup PM2

```bash
# Switch back to webapp user
sudo su - webapp
cd /home/webapp/WeeklyReportSite

# Start application with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Follow the instructions shown (copy and run the sudo command as root user)

# Exit webapp user and run the sudo command
exit
# Run the sudo command that PM2 showed you
```

## Firewall Configuration (Oracle Cloud)

In your Oracle Cloud Console:

1. Navigate to Networking → Virtual Cloud Networks
2. Click your VCN → Security Lists → Default Security List
3. Add Ingress Rules:
   - Source: 0.0.0.0/0, Protocol: TCP, Port Range: 80
   - Source: 0.0.0.0/0, Protocol: TCP, Port Range: 443
   - Source: YOUR_IP/32, Protocol: TCP, Port Range: 22 (SSH)

## Database Setup

1. Run the password reset tokens SQL in your Supabase SQL editor:
   ```sql
   -- Copy content from database/password-reset-tokens.sql
   ```

## Verification

```bash
# Check PM2 status
sudo su - webapp
pm2 status
pm2 logs

# Check Nginx status
exit
sudo systemctl status nginx

# Test SSL
curl -I https://weeklyreport.info

# Check if app is responding
curl https://weeklyreport.info
```

## Maintenance Commands

```bash
# Update application
sudo su - webapp
cd /home/webapp/WeeklyReportSite
git pull origin main
cd frontend
npm ci
npm run build
pm2 restart all

# View logs
pm2 logs
pm2 logs --lines 100

# Monitor resources
pm2 monit

# Nginx commands
sudo nginx -t                    # Test config
sudo systemctl reload nginx     # Reload config
sudo systemctl status nginx     # Check status

# SSL renewal (automatic, but test with)
sudo certbot renew --dry-run
```

## Monitoring Setup

```bash
# Install PM2 log rotation
sudo su - webapp
pm2 install pm2-logrotate

# Setup basic monitoring
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

## Backup Strategy

```bash
# Create backup script
sudo nano /home/webapp/backup.sh
```

```bash
#!/bin/bash
# Backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/webapp/backups"
mkdir -p $BACKUP_DIR

# Backup application
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /home/webapp WeeklyReportSite

# Keep only last 7 backups
find $BACKUP_DIR -name "app_*.tar.gz" -mtime +7 -delete

echo "Backup completed: app_$DATE.tar.gz"
```

```bash
# Make executable
chmod +x /home/webapp/backup.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /home/webapp/backup.sh
```

## Security Checklist

- [ ] SSL certificate installed and working
- [ ] Firewall configured (only necessary ports open)
- [ ] Application user created (not running as root)
- [ ] Environment variables properly configured
- [ ] Database password reset tokens table created
- [ ] Nginx security headers configured
- [ ] PM2 monitoring enabled
- [ ] Log rotation configured
- [ ] Backup strategy implemented

## Troubleshooting

### App won't start
```bash
# Check PM2 logs
pm2 logs

# Check if port 3000 is in use
sudo netstat -tlnp | grep :3000

# Restart PM2
pm2 restart all
```

### SSL issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx configuration
sudo nginx -t
```

### High memory usage
```bash
# Check PM2 status
pm2 status

# Check system resources
htop
free -h
df -h
```

Your application should now be accessible at https://weeklyreport.info!
