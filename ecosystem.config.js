module.exports = {
  apps: [
    {
      name: "tijaratk-backend",
      script: "dist/src/main.js", // PM2 cluster mode requires pointing directly to the compiled JS file
      cwd: "./backend",
      exec_mode: "cluster",
      instances: 2,
      env: {
        NODE_ENV: "production",
        PORT: 8000,
      },
      autorestart: true,
      watch: false,
      max_memory_restart: "700M",
    },
    {
      name: "tijaratk-frontend",
      script: ".next/standalone/frontend/server.js", // Next.js nested standalone server file
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
    {
      name: "tijaratk-staging-backend",
      script: "dist/src/main.js",
      cwd: "/home/tijaratk/tijaratk-market-staging/backend",
      env: { NODE_ENV: "production", HTTP_SERVER_PORT: 8100 },
    },
    {
      name: "tijaratk-staging-frontend",
      script: ".next/standalone/frontend/server.js",
      cwd: "/home/tijaratk/tijaratk-market-staging/frontend",
      env: { NODE_ENV: "production", PORT: 3100 },
    },
  ],
};
