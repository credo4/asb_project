// Config PM2 pour le déploiement VPS. Usage (depuis backend/, après
// `npm ci && npx prisma generate && npm run build`) :
//   pm2 start ecosystem.config.js
//   pm2 save        # pour survivre à un reboot du VPS (avec `pm2 startup`)
module.exports = {
  apps: [
    {
      name: 'asb-backend',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: true,
      max_restarts: 10,
      // Redémarre si la mémoire dérive anormalement (protection basique,
      // pas un remplacement d'un vrai monitoring).
      max_memory_restart: '500M',
    },
  ],
};
