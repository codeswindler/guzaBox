# Security Page Setup

## Overview

The security page allows administrators to view and manage active sessions, including device information, IP addresses, geolocation, uptime, and the ability to revoke sessions.

## Environment Variable Configuration

The security page requires an access key to be set in the **backend** environment variables only:

### Backend (.env)

```bash
cd /var/www/kwachuabox/backend
nano .env
```

Add:
```
SECURITY_PAGE_KEY=your-secret-key-here
```

Then restart the backend:
```bash
sudo -iu wilson pm2 restart kwachuabox-backend --update-env
```

**Important:** The key is validated on the backend, so you don't need to set it in the frontend. This is more secure and centralized.

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

## Features

- View all active sessions for your account
- See device information (browser, OS, user agent)
- View IP addresses and geolocation (city, region, country)
- Monitor session uptime (time since login)
- View last activity timestamp
- Revoke individual sessions
- Revoke all other sessions (keep current session)
- Logout from current session

## Security Recommendations

- Use a strong, random key (at least 16 characters)
- Don't commit the key to git
- Use different keys for different environments if needed
- Rotate the key periodically
- The key is validated server-side for security