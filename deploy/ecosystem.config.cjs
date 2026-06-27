/** PM2 process file — backend API */
module.exports = {
  apps: [
    {
      name: 'crownev-api',
      cwd: '/var/www/crownev/backend',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      error_file: '/var/log/crownev/api-error.log',
      out_file: '/var/log/crownev/api-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
