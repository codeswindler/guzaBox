# 🚀 Production Deployment Checklist

## ✅ Pre-Deployment Checklist

### 1. Code Changes
- [x] Added `wonAmount` column to PaymentTransaction entity
- [x] Created database migration script
- [x] Fixed instant gratification logic
- [x] Updated SMS service with personalized loss messages
- [x] Created instant win admin controls
- [x] Removed manual release system from UI
- [x] Updated environment configuration

### 2. Testing
- [ ] Test instant gratification flow locally
- [ ] Verify SMS messages work correctly
- [ ] Test admin control panel
- [ ] Check budget protection logic
- [ ] Verify M-Pesa integration

### 3. Environment Setup
- [ ] Update production .env file
- [ ] Verify database credentials
- [ ] Check M-Pesa production settings
- [ ] Verify SMS provider settings

## 🔄 Git Commands

```bash
# Stage all changes
git add .

# Commit changes
git commit -m "feat: implement instant gratification system

- Add wonAmount column for tracking instant wins
- Create database migration for new column
- Implement instant win admin controls
- Add personalized loss messages
- Remove manual release system
- Update environment configuration
- Fix database queries for wonAmount

This enables real-time instant gratification with budget protection"

# Push to main branch
git push origin main
```

## 📦 Production Deployment

```bash
# Make deployment script executable
chmod +x deploy-production.sh

# Run deployment
./deploy-production.sh
```

## 🗄️ Database Migration

The deployment script will automatically run:
```sql
ALTER TABLE payment_transactions 
ADD COLUMN wonAmount DECIMAL(10,2) NULL;

CREATE INDEX idx_payment_transactions_won_amount ON payment_transactions(wonAmount);
CREATE INDEX idx_payment_transactions_today_wins ON payment_transactions(createdAt, wonAmount) WHERE wonAmount IS NOT NULL;
```

## 🌐 Post-Deployment Verification

### 1. Backend Health Check
```bash
curl https://micdelight.goldentranscripts.net/admin/instant-win/status
```

### 2. Frontend Check
- Visit: https://micdelight.goldentranscripts.net
- Check instant wins page loads
- Verify admin controls work

### 3. Test Instant Gratification
1. Make a test payment via USSD simulator
2. Check if instant win logic works
3. Verify SMS messages are sent correctly
4. Check budget protection

### 4. Monitor Logs
```bash
pm2 logs guzabox-backend
pm2 logs guzabox-frontend
```

## 🚨 Rollback Plan

If deployment fails:
```bash
# Stop services
sudo systemctl stop nginx
pm2 delete guzabox-backend guzabox-frontend

# Restore from backup
sudo rm -rf /var/www/guzabox
sudo cp -r /var/backups/guzabox/guzabox_backup_YYYYMMDD_HHMMSS /var/www/guzabox

# Start services
cd /var/www/guzabox/backend
pm2 start npm --name "guzabox-backend" -- run start

cd /var/www/guzabox/dashboard
pm2 start npm --name "guzabox-frontend" -- run start

sudo systemctl start nginx
```

## 📞 Emergency Contacts

- Database Admin: [Contact]
- M-Pesa Support: [Contact]
- SMS Provider: [Contact]
- DevOps: [Contact]

## 🎯 Success Criteria

- [ ] Backend starts without errors
- [ ] Frontend loads correctly
- [ ] Instant gratification controls work
- [ ] SMS messages send correctly
- [ ] Database migration succeeds
- [ ] No data loss occurs
