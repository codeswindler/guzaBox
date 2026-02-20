# Production Deployment Checklist

## ⚠️ Critical Changes Review

### 1. Budget Protection Logic Change
**File**: `backend/src/modules/payments/payments.service.ts`

**Change**: Removed `previousBudget` from `effectiveBudget` calculation
- **Before**: `effectiveBudget = Math.max(newBudget, totalReleased, previousBudget)`
- **After**: `effectiveBudget = Math.max(newBudget, totalReleased)`

**Impact**: 
- ✅ **SAFE**: This protects retained amount by never allowing budget to exceed current collections
- ⚠️ **Behavior Change**: If collections decrease mid-day, budget will now decrease (but never below what's already been paid)
- ✅ **Protection**: Added safety check `if (totalReleased + prizeAmount > newBudget)` to prevent exceeding current budget

**Risk Level**: **LOW** - This is the intended behavior to protect retained amount

### 2. Session Tracking (New Feature)
**Files**: Multiple new files and changes

**Changes**:
- New `admin_sessions` table (migration)
- New session tracking on login
- Global interceptor for session activity updates
- New security endpoints

**Impact**:
- ✅ **SAFE**: All changes are additive (new table, new endpoints)
- ✅ **Backward Compatible**: `req` parameter is optional in login methods
- ✅ **Non-Blocking**: Interceptor catches errors silently and doesn't block requests
- ✅ **Migration**: Safe - only creates new table, doesn't modify existing tables

**Risk Level**: **LOW** - All changes are backward compatible

## ✅ Pre-Deployment Checks

### Database Migration
```bash
# On production server, verify migration will run successfully:
cd /var/www/kwachuabox/backend
npm run build
# Check that migration file exists and is correct
```

### Code Compilation
```bash
# Backend
cd backend
npm run build
# Should complete without errors

# Frontend  
cd dashboard
npm run build
# Should complete without errors
```

### Environment Variables
- ✅ No new required environment variables
- ✅ All existing variables remain the same

### API Compatibility
- ✅ All existing endpoints unchanged
- ✅ New endpoints added (GET /auth/sessions, DELETE /auth/sessions/:id, POST /auth/logout)
- ✅ Login endpoints backward compatible (optional `req` parameter)

## 🚀 Deployment Steps (Safe Order)

### 1. Backend Deployment
```bash
# On production server
cd /var/www/kwachuabox/backend

# Pull changes
git pull origin main

# Build
npm run build

# Run migration (if not auto-run)
# TypeORM will run migrations on next start, or run manually:
# npm run migration:run

# Restart with zero downtime
sudo -iu wilson pm2 restart kwachuabox-backend --update-env
```

### 2. Frontend Deployment
```bash
# On production server
cd /var/www/kwachuabox/dashboard

# Pull changes
git pull origin main

# Build
npm run build

# Restart
sudo -iu wilson pm2 restart kwachuabox-dashboard
```

### 3. Post-Deployment Verification

#### Check Backend Logs
```bash
sudo -iu wilson pm2 logs kwachuabox-backend --lines 50
# Look for:
# - No migration errors
# - No session interceptor errors
# - API requests working normally
```

#### Test Budget Protection
1. Make a test payment
2. Verify prize payout works
3. Check logs for any budget warnings
4. Verify budget percentage doesn't exceed 100%

#### Test Session Tracking
1. Log in to dashboard
2. Navigate to Security page
3. Verify current session appears
4. Test revoking a session (if multiple devices)

## ⚠️ Rollback Plan (If Needed)

### If Issues Occur:

1. **Rollback Code**:
```bash
cd /var/www/kwachuabox/backend
git checkout <previous-commit-hash>
npm run build
sudo -iu wilson pm2 restart kwachuabox-backend --update-env

cd /var/www/kwachuabox/dashboard
git checkout <previous-commit-hash>
npm run build
sudo -iu wilson pm2 restart kwachuabox-dashboard
```

2. **Database Rollback** (if migration was run):
```sql
-- Only if needed - migration is safe and can stay
DROP TABLE IF EXISTS admin_sessions;
```

## 📊 Monitoring After Deployment

### Watch For:
1. **Budget Protection**: Monitor logs for "prize_would_exceed_budget" warnings
2. **Session Tracking**: Check that sessions are being created on login
3. **API Errors**: Monitor for any 500 errors related to sessions
4. **Performance**: Session interceptor should not impact performance (runs async)

### Expected Behavior:
- ✅ Budget never exceeds current collections × maxPercentage
- ✅ Sessions created on login
- ✅ Session activity updates on API calls
- ✅ Security page shows active sessions

## ✅ Summary

**Overall Risk Level**: **LOW**

**Reasoning**:
1. Budget change is intentional and safer (protects retained amount)
2. Session tracking is fully backward compatible
3. All changes are additive (new features, no breaking changes)
4. Migration only creates new table
5. Interceptor is non-blocking and error-tolerant

**Recommendation**: **SAFE TO DEPLOY** ✅
