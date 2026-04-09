# SonicStudio Deployment Guide

## Development Environment

### Prerequisites
- Node.js 18+ and npm 9+
- Git

### Quick Start

```bash
git clone https://github.com/yourusername/sonic-studio.git
cd sonic-studio
npm install
npm run dev
```

## Production Deployment

### Environment Variables

Create a `.env.production` file:

```env
VITE_API_URL=https://api.sonicstudio.io
VITE_ENABLE_ANALYTICS=true
VITE_MAX_TRACKS=32
VITE_MAX_PROJECT_SIZE=104857600
VITE_PUBLIC_URL=https://sonicstudio.io
```

### Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deployment Options

### Option 1: Vercel (Recommended for Frontend)

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option 2: Netlify

```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod --dir=dist
```

### Option 3: Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
RUN npm install -g serve
COPY --from=0 /app/dist ./dist

EXPOSE 3000
CMD ["serve", "-s", "dist", "-l", "3000"]
```

Build and run:
```bash
docker build -t sonic-studio .
docker run -p 3000:3000 sonic-studio
```

### Option 4: Traditional VPS (AWS EC2, DigitalOcean, etc.)

1. SSH into your server
2. Install Node.js 18+
3. Clone the repository
4. Install dependencies: `npm install`
5. Build the project: `npm run build`
6. Use PM2 to run the backend:

```bash
npm install -g pm2
pm2 start npm --name "sonic-studio" -- start
pm2 save
pm2 startup
```

7. Configure Nginx as reverse proxy

## Backend Server Deployment

### Node.js + Express Backend

#### Development
```bash
npm run build:server
npm run start
```

#### Production with PM2

```bash
npm install -g pm2

# Build and start
npm run build:server
pm2 start dist/server/index.js --name "sonic-studio-api"
pm2 save
pm2 startup
```

#### With Nginx Configuration

Create `/etc/nginx/sites-available/sonicstudio`:

```nginx
upstream sonic_studio_api {
  server localhost:3001;
}

server {
  listen 80;
  server_name api.sonicstudio.io;

  location / {
    proxy_pass http://sonic_studio_api;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/sonicstudio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Database Setup

### Using PostgreSQL (Optional)

```bash
npm install pg
```

Configure connection in `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/sonic_studio
```

### Using MongoDB (Alternative)

```bash
npm install mongodb
```

## SSL/HTTPS Setup

### Using Let's Encrypt with Certbot

```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d sonicstudio.io -d api.sonicstudio.io
```

Auto-renewal:
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run lint
      - run: npm run build
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

## Monitoring & Logging

### Application Monitoring

```bash
npm install pm2-logrotate
pm2 install pm2-logrotate
```

### Error Tracking

Consider integrating Sentry:

```bash
npm install @sentry/react
```

### Performance Monitoring

- Use New Relic, Datadog, or similar services
- Monitor Web Audio API performance in browsers
- Track export/render times

## Backup & Disaster Recovery

### Database Backups

```bash
# PostgreSQL
pg_dump sonic_studio > backup.sql
```

### Project File Backups

```bash
# Backup uploaded projects
tar -czf projects_backup.tar.gz data/projects/
```

## Scaling Considerations

1. **Frontend**: Use CDN (CloudFlare, AWS CloudFront)
2. **Backend**: Load balancing with Nginx or load balancer
3. **Database**: Replication and read replicas
4. **File Storage**: S3-compatible storage for rendered audio files
5. **Message Queue**: Use Redis for background jobs (rendering, exports)

## Troubleshooting

### Application won't start
- Check Node.js version: `node --version`
- Check port availability: `lsof -i :3000`
- Review logs: `pm2 logs`

### High memory usage
- Check for memory leaks in audio context
- Limit concurrent exports
- Use Web Worker threads for processing

### Slow exports
- Implement server-side rendering with `ffmpeg` or `libsndfile`
- Use background job queue
- Cache frequently exported formats

## Support

For deployment issues, refer to:
- [Vercel Docs](https://vercel.com/docs)
- [Netlify Docs](https://docs.netlify.com)
- [PM2 Docs](https://pm2.keymetrics.io)
