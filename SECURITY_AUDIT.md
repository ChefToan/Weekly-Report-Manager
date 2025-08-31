# Security Audit Report & Production Deployment Guide

## 🔒 **CRITICAL SECURITY ISSUES FOUND**

### **HIGH PRIORITY - IMMEDIATE ACTION REQUIRED**

#### 1. **Password Reset Vulnerability**
- **Location**: `frontend/src/app/api/auth/update-password/route.ts`
- **Issue**: Password reset tokens are NOT validated against database
- **Risk**: Anyone can reset any user's password with a fake token
- **Status**: 🚨 **CRITICAL - PRODUCTION BLOCKING**

#### 2. **Console Logging in Production**
- **Locations**: Multiple API routes and components
- **Issue**: Sensitive data logged to console (passwords, tokens, user data)
- **Risk**: Information disclosure in production logs
- **Status**: 🚨 **HIGH RISK**

#### 3. **Missing Security Headers**
- **Issue**: No CORS, CSP, rate limiting, or security middleware
- **Risk**: XSS, CSRF, clickjacking attacks
- **Status**: 🔸 **MEDIUM RISK**

#### 4. **Development Mode Features in Production**
- **Location**: Password reset emails only logged, not sent
- **Risk**: Password reset functionality broken in production
- **Status**: 🔸 **MEDIUM RISK**

---

## 🛠 **FIXES REQUIRED BEFORE DEPLOYMENT**

### **1. Fix Password Reset System**

Create proper token storage table:

```sql
-- Add to your database schema
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for performance
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires ON password_reset_tokens(expires_at);
```

### **2. Remove Console Logging**
- Replace all `console.log` with proper logging service
- Remove sensitive data from logs
- Use environment-based logging levels

### **3. Add Security Middleware**

Create `frontend/src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // CSP for production
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    )
  }
  
  return response
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

### **4. Environment Variables Security**

Create `.env.example`:

```env
# Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# App Configuration
NEXT_PUBLIC_APP_URL=https://tookerbackyard.cheftoan.com
NODE_ENV=production

# Email Service (choose one)
RESEND_API_KEY=your_resend_key
FROM_EMAIL=noreply@cheftoan.com

# Security
SESSION_SECRET=your_256_bit_secret_key
```

### **5. Update Next.js Config for Production**

```typescript
// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
  
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs'],
  },
};

export default nextConfig;
```

---

## 🚀 **ORACLE CLOUD INFRASTRUCTURE DEPLOYMENT**

### **Server Setup (Ubuntu 22.04)**

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install PM2 globally
sudo npm install -g pm2

# 4. Install Nginx
sudo apt install nginx -y

# 5. Install certbot for SSL
sudo apt install certbot python3-certbot-nginx -y

# 6. Create app user
sudo useradd -m -s /bin/bash webapp
sudo usermod -a -G sudo webapp
```

### **Nginx Configuration**

```nginx
# /etc/nginx/sites-available/tookerbackyard.cheftoan.com
server {
    listen 80;
    server_name tookerbackyard.cheftoan.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tookerbackyard.cheftoan.com;
    
    # SSL Configuration (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/tookerbackyard.cheftoan.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tookerbackyard.cheftoan.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    
    # Main app
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Stricter rate limiting for auth endpoints
    location /api/auth/ {
        limit_req zone=login burst=10 nodelay;
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Static files caching
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }
    
    # Favicon
    location /favicon.ico {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:3000;
    }
}
```

### **PM2 Configuration**

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'tookerbackyard',
    script: 'npm',
    args: 'start',
    cwd: '/home/webapp/WeeklyReportSite/frontend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/webapp/logs/err.log',
    out_file: '/home/webapp/logs/out.log',
    log_file: '/home/webapp/logs/combined.log',
    time: true
  }]
};
```

### **Deployment Steps**

```bash
# 1. Setup SSL certificate first
sudo certbot --nginx -d tookerbackyard.cheftoan.com

# 2. Clone your repository
cd /home/webapp
git clone https://github.com/ChefToan/Weekly-Report-Manager.git WeeklyReportSite
cd WeeklyReportSite/frontend

# 3. Create environment file
sudo -u webapp cp .env.example .env
sudo -u webapp nano .env
# Add your production environment variables

# 4. Install dependencies and build
sudo -u webapp npm ci
sudo -u webapp npm run build

# 5. Create logs directory
mkdir -p /home/webapp/logs

# 6. Setup PM2
sudo -u webapp pm2 start ecosystem.config.js
sudo -u webapp pm2 save
sudo -u webapp pm2 startup

# 7. Enable services
sudo systemctl enable nginx
sudo systemctl restart nginx

# 8. Setup automatic deployments (optional)
sudo -u webapp pm2 install pm2-logrotate
```

### **Firewall Setup (OCI Security List)**

Configure these ports in OCI Console > Networking > Security Lists:

```
Ingress Rules:
- 22/tcp (SSH) - Your IP only
- 80/tcp (HTTP) - 0.0.0.0/0
- 443/tcp (HTTPS) - 0.0.0.0/0

Egress Rules:
- All traffic (for package updates, API calls)
```

### **Monitoring & Maintenance**

```bash
# PM2 commands
pm2 status           # Check app status
pm2 logs             # View logs
pm2 restart all      # Restart app
pm2 monit           # Monitor resources

# Nginx commands
sudo nginx -t        # Test config
sudo systemctl reload nginx    # Reload config
sudo systemctl status nginx   # Check status

# SSL renewal (automatic, but test with)
sudo certbot renew --dry-run

# Update deployment
cd /home/webapp/WeeklyReportSite
git pull origin main
cd frontend
npm ci
npm run build
pm2 restart all
```

---

## ✅ **PRE-DEPLOYMENT CHECKLIST**

- [ ] Fix password reset token validation
- [ ] Remove all console.log statements
- [ ] Add security middleware
- [ ] Configure environment variables
- [ ] Test password reset functionality
- [ ] Set up proper email service
- [ ] Configure SSL certificate
- [ ] Test all API endpoints
- [ ] Set up monitoring
- [ ] Create backup strategy

**⚠️ DO NOT DEPLOY until password reset vulnerability is fixed!**
