module.exports = {
  apps: [
    {
      name: "tijaratk-staging-backend",
      script: "dist/src/main.js",
      cwd: "/var/www/tijaratk-staging/backend",
      env: { NODE_ENV: "production", HTTP_SERVER_PORT: 8100 },
    },
    {
      name: "tijaratk-staging-frontend",
      script: ".next/standalone/frontend/server.js",
      cwd: "/var/www/tijaratk-staging/frontend",
      env: { NODE_ENV: "production", PORT: 3100 },
    },
  ],
};
