# Pre-Launch Checklist

## ✅ Code Quality

- [x] **TypeScript compilation** - No errors
- [x] **Linter checks** - No errors
- [x] **Removed unused code** - Auto Win code cleaned up
- [x] **Protected budget logic** - Implemented Option A
- [x] **Race condition protection** - Lock-first approach
- [x] **Safety margins** - 2 KES buffer added
- [x] **Budget monitoring** - Overrun detection and logging

## ✅ Fund Protection

- [x] **SERIALIZABLE transactions** - Database-level isolation
- [x] **Pessimistic locking** - Prevents concurrent access
- [x] **Protected budget growth** - Never decreases below paid amount
- [x] **Final validation** - Prize amount checked before saving
- [x] **Budget monitoring** - Warnings logged on overrun

## ⚠️ Pre-Launch Verification (Do These!)

### 1. Database Schema
- [ ] Verify `payout_releases` table has `releaseBudget` and `totalReleased` columns
- [ ] Verify `payment_transactions` table has `wonAmount` column
- [ ] Check all indexes exist

### 2. Environment Variables
- [ ] `MPESA_B2C_INITIATOR_NAME=MONTPAYAPI` (or your current value)
- [ ] `MPESA_B2C_SECURITY_CREDENTIAL` is set and valid
- [ ] Database credentials are correct
- [ ] SMS provider settings are configured

### 3. Instant Win Settings
- [ ] Check default settings in database:
  ```sql
  SELECT * FROM instant_win_settings;
  ```
- [ ] Verify `enabled = 0` initially (disable until ready)
- [ ] Set appropriate `maxPercentage` (e.g., 50%)
- [ ] Set `minAmount` and `maxAmount` ranges
- [ ] Set `baseProbability` (e.g., 0.1 = 10%)

### 4. Testing (Recommended Before Full Launch)

#### Test 1: Budget Protection
```bash
# Make a test payment
# Verify budget is calculated correctly
# Check logs for any warnings
```

#### Test 2: Concurrent Requests
```bash
# Simulate multiple payments simultaneously
# Verify no budget overruns occur
# Check PM2 logs for errors
```

#### Test 3: Percentage Change
```bash
# Start with 50% percentage
# Make some payments
# Change to 30% mid-day
# Verify budget doesn't decrease below paid amount
```

### 5. Monitoring Setup
- [ ] PM2 logs are accessible: `sudo -iu wilson pm2 logs kwachukuabox-backend`
- [ ] Set up alerts for budget overrun warnings (if possible)
- [ ] Monitor first few transactions closely

### 6. Rollback Plan
- [ ] Backup database before deployment
- [ ] Know how to disable instant wins quickly:
  ```sql
  UPDATE instant_win_settings SET enabled = 0;
  ```
- [ ] Know how to rollback code if needed

## 🚀 Deployment Steps

1. **Deploy code:**
   ```bash
   cd /var/www/kwachukuabox && git pull origin main
   cd backend && npm ci && npm run build
   sudo -iu wilson pm2 restart kwachukuabox-backend --update-env
   ```

2. **Verify deployment:**
   ```bash
   # Check backend is running
   curl http://localhost:4000/admin/instant-win/status
   
   # Check PM2 status
   sudo -iu wilson pm2 status
   
   # Check logs for errors
   sudo -iu wilson pm2 logs kwachukuabox-backend --lines 50
   ```

3. **Enable instant wins (when ready):**
   - Via dashboard: `/admin/instant-win` → Enable toggle
   - Or via SQL: `UPDATE instant_win_settings SET enabled = 1;`

4. **Monitor first transactions:**
   ```bash
   # Watch logs in real-time
   sudo -iu wilson pm2 logs kwachukuabox-backend --lines 0
   
   # Look for:
   # - "budget_overrun_detected" warnings
   # - "prize_exceeds_budget" warnings
   # - Any errors
   ```

## ⚠️ Known Considerations

1. **No database migrations needed** - All schema changes already exist
2. **No breaking changes** - All existing integrations preserved
3. **Backward compatible** - Old transactions still work
4. **Safe to deploy** - Can disable instantly if issues arise

## 🎯 Go-Live Decision

**You can confidently go live IF:**

- ✅ All code checks pass (done)
- ✅ Database schema is correct
- ✅ Environment variables are set
- ✅ Instant win settings are configured
- ✅ You've tested at least one transaction
- ✅ Monitoring is in place
- ✅ You know how to disable quickly if needed

**Recommendation:** 
1. Deploy code first
2. Keep instant wins **disabled** initially
3. Test with a few transactions
4. Monitor closely
5. Enable when confident

## 🆘 Emergency Disable

If something goes wrong, disable instantly:

```sql
UPDATE instant_win_settings SET enabled = 0;
```

Or via dashboard: Toggle off the "Enabled" switch.

This will stop all instant win processing immediately without affecting payments.
