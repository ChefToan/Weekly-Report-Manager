module.exports = {
  apps: [{
    name: 'weeklyreport',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/weekly-report-site/frontend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/home/ubuntu/logs/err.log',
    out_file: '/home/ubuntu/logs/out.log',
    log_file: '/home/ubuntu/logs/combined.log',
    time: true,
    // Graceful shutdown
    kill_timeout: 5000,
    // Auto restart on crash
    min_uptime: '10s',
    max_restarts: 10
  }]
};
