module.exports = {
  apps: [
    {
      name: "tijaratk-backend",
      script: "dist/src/main.js", // PM2 cluster mode requires pointing directly to the compiled JS file
      cwd: "./backend",
      exec_mode: "cluster",
      instances: 3,
      env: {
        NODE_ENV: "production",
        PORT: 8000,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
    },
    {
      name: "tijaratk-frontend",
      script: ".next/standalone/server.js", // Next.js cluster mode requires the standalone server file!
      cwd: "./frontend",
      exec_mode: "cluster",
      instances: 2,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
    },
  ],
};
