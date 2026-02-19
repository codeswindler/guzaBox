# Safe Directory & Service Rename: kwachukuabox → kwachuabox

## ⚠️ Important: This is a SAFE operation
- Brief downtime: ~30-60 seconds
- All data preserved
- Services will restart automatically
- No database changes needed

## Step-by-Step Migration

### 1. Stop PM2 processes (prevents issues during rename)
```bash
sudo -iu wilson pm2 stop kwachukuabox-backend
sudo -iu wilson pm2 stop kwachukuabox-frontend
```

### 2. Verify services are stopped
```bash
sudo -iu wilson pm2 status
# Both should show "stopped" status
```

### 3. Backup current setup (safety first!)
```bash
sudo cp -r /var/www/kwachukuabox /var/backups/kwachukuabox_backup_$(date +%Y%m%d_%H%M%S)
```

### 4. Rename the directory
```bash
sudo mv /var/www/kwachukuabox /var/www/kwachuabox
```

### 5. Delete old PM2 processes and create new ones

#### Backend:
```bash
# Delete old process
sudo -iu wilson pm2 delete kwachukuabox-backend

# Create new process with correct path
cd /var/www/kwachuabox/backend
sudo -iu wilson pm2 start dist/main.js --name "kwachuabox-backend" --cwd /var/www/kwachuabox/backend
```

#### Frontend:
```bash
# Delete old process
sudo -iu wilson pm2 delete kwachukuabox-frontend

# Create new process with correct path
cd /var/www/kwachuabox/dashboard
sudo -iu wilson pm2 start npm --name "kwachuabox-frontend" --cwd /var/www/kwachuabox/dashboard -- start -- --port 3100
```

### 6. Save PM2 configuration
```bash
sudo -iu wilson pm2 save
```

### 7. Verify services are running
```bash
sudo -iu wilson pm2 status
# Both should show "online" status

# Check logs
sudo -iu wilson pm2 logs kwachuabox-backend --lines 10
sudo -iu wilson pm2 logs kwachuabox-frontend --lines 10
```

### 8. Update Nginx configuration (if it references the old path)

Check if Nginx config references the old directory:
```bash
sudo grep -r "kwachukuabox" /etc/nginx/
```

If found, update the config file:
```bash
sudo nano /etc/nginx/sites-enabled/luckybox
# or
sudo nano /etc/nginx/sites-enabled/kwachuabox
```

Change any `/var/www/kwachukuabox` references to `/var/www/kwachuabox`

Test and reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 9. Test the services

```bash
# Test backend
curl http://localhost:4000/admin/instant-win/status

# Test frontend (if accessible)
curl http://localhost:3100
```

## Quick One-Liner Script (Copy & Paste)

```bash
# Stop services
sudo -iu wilson pm2 stop kwachukuabox-backend kwachukuabox-frontend

# Backup
sudo cp -r /var/www/kwachukuabox /var/backups/kwachukuabox_backup_$(date +%Y%m%d_%H%M%S)

# Rename directory
sudo mv /var/www/kwachukuabox /var/www/kwachuabox

# Delete old PM2 processes
sudo -iu wilson pm2 delete kwachukuabox-backend kwachukuabox-frontend

# Start backend with new name
cd /var/www/kwachuabox/backend
sudo -iu wilson pm2 start dist/main.js --name "kwachuabox-backend" --cwd /var/www/kwachuabox/backend

# Start frontend with new name
cd /var/www/kwachuabox/dashboard
sudo -iu wilson pm2 start npm --name "kwachuabox-frontend" --cwd /var/www/kwachuabox/dashboard -- start -- --port 3100

# Save PM2 config
sudo -iu wilson pm2 save

# Verify
sudo -iu wilson pm2 status
```

## Rollback (If Something Goes Wrong)

```bash
# Stop new services
sudo -iu wilson pm2 stop kwachuabox-backend kwachuabox-frontend
sudo -iu wilson pm2 delete kwachuabox-backend kwachuabox-frontend

# Restore directory
sudo rm -rf /var/www/kwachuabox
sudo mv /var/backups/kwachukuabox_backup_YYYYMMDD_HHMMSS /var/www/kwachukuabox

# Restart old services
cd /var/www/kwachukuabox/backend
sudo -iu wilson pm2 start dist/main.js --name "kwachukuabox-backend" --cwd /var/www/kwachukuabox/backend

cd /var/www/kwachukuabox/dashboard
sudo -iu wilson pm2 start npm --name "kwachukuabox-frontend" --cwd /var/www/kwachukuabox/dashboard -- start -- --port 3100

sudo -iu wilson pm2 save
```

## Notes

- **Environment variables** don't need to change (they're in `.env` files inside the directories)
- **Database** doesn't need any changes
- **Git repository** path doesn't matter - it's just a directory name
- **PM2 process names** are updated for consistency
- **Nginx** may need updating if it has hardcoded paths (check with `grep`)

## Expected Downtime

- **~30-60 seconds** total downtime
- Services restart automatically after rename
- No data loss or corruption
