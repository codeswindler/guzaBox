# Security Page Setup

## Environment Variable Configuration

The security page requires an access key to be set in the environment variables.

### Frontend (Dashboard)

**Option 1: Create `.env.local` file (Recommended)**

```bash
cd /var/www/kwachuabox/dashboard
nano .env.local
```

Add:
```
NEXT_PUBLIC_SECURITY_PAGE_KEY=your-secret-key-here
```

**Option 2: Set as environment variable before build**

```bash
export NEXT_PUBLIC_SECURITY_PAGE_KEY=your-secret-key-here
cd /var/www/kwachuabox/dashboard
npm run build
```

**Important:** For Next.js, `NEXT_PUBLIC_*` variables are embedded at build time. After setting the variable, you must rebuild:

```bash
cd /var/www/kwachuabox/dashboard
npm run build
sudo -iu wilson pm2 restart kwachuabox-dashboard
```

### Backend (Optional - for consistency)

The backend also has `SECURITY_PAGE_KEY` in the template, but it's not currently used. You can set it for future use:

```bash
cd /var/www/kwachuabox/backend
nano .env
```

Add:
```
SECURITY_PAGE_KEY=your-secret-key-here
```

Then restart:
```bash
sudo -iu wilson pm2 restart kwachuabox-backend --update-env
```

## Usage

Once configured, access the security page by:

1. **Via URL parameter:**
   ```
   https://your-domain.com/security?key=your-secret-key-here
   ```

2. **Via prompt:**
   - Navigate to `/security`
   - Enter the access key when prompted
   - Key is stored in sessionStorage for the current session

## Security Recommendations

- Use a strong, random key (at least 16 characters)
- Don't commit the key to git
- Use different keys for different environments if needed
- Rotate the key periodically
