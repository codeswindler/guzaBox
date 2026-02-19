# VPS Directory & PM2 Process Rename Migration Guide

## ⚠️ Important: This migration is SAFE
- All code changes are cosmetic (display text, messages)
- No database changes required
- No breaking API changes
- Can be done with zero downtime if planned correctly

## Step-by-Step Migration

### 1. SSH into your VPS
```bash
ssh wilson@your-vps-ip
```

### 2. Stop PM2 processes (to prevent issues during rename)
```bash
sudo -iu wilson pm2 stop luckybox-backend
sudo -iu wilson pm2 stop luckybox-frontend
```

### 3. Backup current setup (safety first!)
```bash
sudo cp -r /var/www/luckybox /var/backups/luckybox_backup_$(date +%Y%m%d_%H%M%S)
```

### 4. Rename the directory
```bash
sudo mv /var/www/luckybox /var/www/kwachuabox
```

### 5. Update PM2 process names

#### Option A: Delete and recreate (Recommended - Clean)
```bash
# Delete old processes
sudo -iu wilson pm2 delete luckybox-backend
sudo -iu wilson pm2 delete luckybox-frontend

# Start with new names
cd /var/www/kwachuabox/backend
sudo -iu wilson pm2 start npm --name "kwachuabox-backend" -- run start

cd /var/www/kwachuabox/dashboard
sudo -iu wilson pm2 start npm --name "kwachuabox-frontend" -- run start

# Save PM2 configuration
sudo -iu wilson pm2 save
```

#### Option B: Rename existing processes (Alternative)
```bash
# Rename processes
sudo -iu wilson pm2 restart luckybox-backend --update-env --name kwachuabox-backend
sudo -iu wilson pm2 restart luckybox-frontend --update-env --name kwachuabox-frontend

# Note: If restart doesn't rename, use delete + recreate (Option A)
```

### 6. Pull latest code (with new branding)
```bash
cd /var/www/kwachuabox
git pull origin main

# Rebuild if needed
cd backend
npm ci
npm run build

cd ../dashboard
npm ci
npm run build
```

### 7. Restart services
```bash
sudo -iu wilson pm2 restart kwachuabox-backend --update-env
sudo -iu wilson pm2 restart kwachuabox-frontend --update-env
```

### 8. Update Nginx configuration (if it references the old path)

Check if your nginx config has hardcoded paths:
```bash
sudo grep -r "luckybox" /etc/nginx/
```

If found, update them:
```bash
sudo nano /etc/nginx/sites-available/your-site-config
# Change any /var/www/luckybox references to /var/www/kwachuabox
sudo nginx -t  # Test configuration
sudo systemctl reload nginx
```

### 9. Verify everything works
```bash
# Check PM2 status
sudo -iu wilson pm2 status

# Check backend health
curl http://localhost:4000/admin/instant-win/status

# Check logs
sudo -iu wilson pm2 logs kwachuabox-backend --lines 20
sudo -iu wilson pm2 logs kwachuabox-frontend --lines 20
```

### 10. Clean up old PM2 processes (if any remain)
```bash
# List all processes
sudo -iu wilson pm2 list

# If old processes still exist, delete them
sudo -iu wilson pm2 delete luckybox-backend 2>/dev/null || true
sudo -iu wilson pm2 delete luckybox-frontend 2>/dev/null || true
sudo -iu wilson pm2 save
```

## Rollback Plan (if something goes wrong)

If you need to rollback:

```bash
# Stop new processes
sudo -iu wilson pm2 stop kwachuabox-backend
sudo -iu wilson pm2 stop kwachuabox-frontend

# Rename directory back
sudo mv /var/www/kwachuabox /var/www/luckybox

# Restart old processes (if they still exist)
sudo -iu wilson pm2 restart luckybox-backend --update-env
sudo -iu wilson pm2 restart luckybox-frontend --update-env

# Or restore from backup
sudo rm -rf /var/www/kwachuabox
sudo cp -r /var/backups/luckybox_backup_YYYYMMDD_HHMMSS /var/www/luckybox
cd /var/www/luckybox/backend
sudo -iu wilson pm2 restart luckybox-backend --update-env
```

## Quick Migration Script (One-liner approach)

If you prefer a more automated approach:

```bash
# Stop services
sudo -iu wilson pm2 stop all

# Backup and rename
sudo cp -r /var/www/luckybox /var/backups/luckybox_backup_$(date +%Y%m%d_%H%M%S)
sudo mv /var/www/luckybox /var/www/kwachuabox

# Pull latest code
cd /var/www/kwachuabox
git pull origin main

# Rebuild
cd backend && npm ci && npm run build
cd ../dashboard && npm ci && npm run build

# Delete old PM2 processes and create new ones
sudo -iu wilson pm2 delete luckybox-backend 2>/dev/null || true
sudo -iu wilson pm2 delete luckybox-frontend 2>/dev/null || true

cd /var/www/kwachuabox/backend
sudo -iu wilson pm2 start npm --name "kwachuabox-backend" -- run start

cd /var/www/kwachuabox/dashboard
sudo -iu wilson pm2 start npm --name "kwachuabox-frontend" -- run start

sudo -iu wilson pm2 save

# Verify
sudo -iu wilson pm2 status
curl http://localhost:4000/admin/instant-win/status
```

## Notes

- **Package names changed** but this doesn't affect running processes
- **PM2 process names** need to be updated for consistency
- **Directory name** change is optional but recommended for consistency
- **No database changes** needed
- **Environment variables** don't need to change
- **All functionality** remains the same - only branding changed

## Zero-Downtime Alternative

If you want zero downtime, you can:
1. Keep old directory and processes running
2. Set up new directory with new names in parallel
3. Test new setup
4. Switch nginx/proxy to point to new processes
5. Stop old processes after verification

But for a simple rename, the brief downtime (30-60 seconds) is usually acceptable.
