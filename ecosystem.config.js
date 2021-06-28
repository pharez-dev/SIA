module.exports = {
  apps: [
    {
      name: "SiaServer",
      script:'app.js',
      cwd: "/home/admindev/server/",
      instances: 'max',
      exec_mode : "cluster",
      autorestart: true,
      max_memory_restart: "2G",
      env: {
        NODE_ENV: "development"
      },
      env_production: {
        NODE_ENV: "production",
        API_URL: "YOUR ENV URL",
        PORT: 8080
      },
      error_file: 'err.log',
      out_file: 'out.log',
      log_file: 'combined.log',
      time: true,
       
    }
  ]
};
