# VPS Deployment Guide

## Quick Deployment Steps

### 1. SSH into your VPS
```bash
ssh wilson@your-vps-ip
```

### 2. Navigate to deployment directory and pull latest changes
```bash
cd /var/www/kwachuabox && git pull origin main
```

### 3. Install/Update backend dependencies and build
```bash
cd backend
npm ci
npm run build
```

### 4. Restart backend with PM2 (as wilson user)
```bash
sudo -iu wilson pm2 restart kwachuabox-backend
```

### 5. Verify deployment
```bash
# Check backend health
curl http://localhost:4000/admin/instant-win/status

# Check PM2 status
sudo -iu wilson pm2 status

# Check logs
sudo -iu wilson pm2 logs kwachuabox-backend --lines 50
```

## Full Deployment (First Time or Major Update)

### 1. Backup current deployment
```bash
sudo cp -r /var/www/kwachuabox /var/backups/kwachuabox_backup_$(date +%Y%m%d_%H%M%S)
```

### 2. Pull latest code
```bash
cd /var/www/kwachuabox
git fetch origin
git pull origin main
```

### 3. Backend deployment
```bash
cd backend

# Install dependencies
npm ci

# Build TypeScript
npm run build

# Run migrations (if any)
npm run migration:run

# Restart with PM2 (as wilson user)
sudo -iu wilson pm2 restart kwachuabox-backend --update-env

# Or if starting fresh
sudo -iu wilson pm2 delete kwachuabox-backend
sudo -iu wilson pm2 start npm --name "kwachuabox-backend" -- run start
sudo -iu wilson pm2 save
```

### 4. Frontend deployment (if applicable)
```bash
cd ../dashboard

# Install dependencies
npm ci

# Build Next.js
npm run build

# Restart with PM2 (as wilson user)
sudo -iu wilson pm2 restart kwachuabox-frontend

# Or if starting fresh
sudo -iu wilson pm2 delete kwachuabox-frontend
sudo -iu wilson pm2 start npm --name "kwachuabox-frontend" -- run start
sudo -iu wilson pm2 save
```

### 5. Reload Nginx (if needed)
```bash
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

## Using the Deployment Script

### 1. Update the script with your repository URL
Edit `deploy-production.sh` and update line 30:
```bash
git clone https://github.com/codeswindler/guzaBox.git $REPO_DIR
```

### 2. Make script executable
```bash
chmod +x deploy-production.sh
```

### 3. Run deployment
```bash
./deploy-production.sh
```

## Environment Variables

Make sure your `.env` file in `backend/` is up to date:
```bash
cd /var/www/kwachuabox/backend
nano .env
```

Key variables to verify:
- `MPESA_B2C_INITIATOR_NAME=MONTPAYAPI`
- `MPESA_B2C_SECURITY_CREDENTIAL=...` (your encrypted credential)
- Database credentials
- SMS provider settings

## Troubleshooting

### Backend won't start
```bash
# Check logs (as wilson user)
sudo -iu wilson pm2 logs kwachuabox-backend --lines 100

# Check if port is in use
sudo lsof -i :4000

# Check environment variables
cd /var/www/kwachuabox/backend
cat .env | grep -v "SECRET\|PASSWORD\|KEY"  # View non-sensitive vars
```

### Frontend won't start (if applicable)
```bash
# Check logs (as wilson user)
sudo -iu wilson pm2 logs luckybox-frontend --lines 100

# Check if port is in use
sudo lsof -i :3000

# Rebuild if needed
cd /var/www/kwachuabox/dashboard
rm -rf .next
npm run build
sudo -iu wilson pm2 restart kwachuabox-frontend
```

### Database connection issues
```bash
# Test database connection
mysql -u your_db_user -p your_db_name -e "SELECT 1;"

# Check backend .env has correct DB credentials
cd /var/www/kwachuabox/backend
grep DB_ .env
```

### PM2 not persisting
```bash
# Save PM2 configuration (as wilson user)
sudo -iu wilson pm2 save

# Setup PM2 startup script (as wilson user)
sudo -iu wilson pm2 startup
# Follow the instructions it outputs
```

## Quick Update (After Code Changes)

```bash
cd /var/www/kwachuabox && git pull origin main
cd backend && npm ci && npm run build
sudo -iu wilson pm2 restart kwachuabox-backend --update-env
```

## Monitoring

### Check service status
```bash
sudo -iu wilson pm2 status
sudo -iu wilson pm2 monit
```

### View logs
```bash
# Backend logs
sudo -iu wilson pm2 logs kwachuabox-backend

# Frontend logs (if applicable)
sudo -iu wilson pm2 logs luckybox-frontend

# All logs
sudo -iu wilson pm2 logs

# Follow logs in real-time
sudo -iu wilson pm2 logs --lines 0
```

### Check system resources
```bash
# CPU and memory
htop

# Disk space
df -h

# Network connections
netstat -tulpn | grep -E '4000|3000'
```

## Rollback

If something goes wrong:
```bash
# Stop services (as wilson user)
sudo -iu wilson pm2 stop all

# Restore from backup
sudo rm -rf /var/www/kwachuabox
sudo cp -r /var/backups/kwachuabox_backup_YYYYMMDD_HHMMSS /var/www/kwachuabox

# Restart services
cd /var/www/kwachuabox/backend
sudo -iu wilson pm2 restart kwachuabox-backend
```
