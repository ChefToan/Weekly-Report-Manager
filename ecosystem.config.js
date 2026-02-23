module.exports = {
  apps: [{
    name: 'weeklyreport',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/weekly-report-site/frontend',
    instances: 1,
    exec_mode: 'fork',
    
    // OPTIMIZED: Custom log locations in project directory for better organization
    out_file: '/home/ubuntu/weekly-report-site/logs/pm2/out.log',
    error_file: '/home/ubuntu/weekly-report-site/logs/pm2/error.log',
    log_file: '/home/ubuntu/weekly-report-site/logs/pm2/combined.log',
    
    // Enhanced log management
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Auto restart settings
    autorestart: true,
    watch: false,
    ignore_watch: ["node_modules", "logs", ".git"],
    
    // Memory management (reduced for better performance)
    max_memory_restart: '500M',
    
    // OPTIMIZED: Time-based log rotation to prevent large log files
    log_rotate: true,
    log_max_size: '10M',
    log_retain: 30,
    
    // Graceful shutdown
    kill_timeout: 5000
  }]
};
