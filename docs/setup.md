# JazaBox Setup

## Backend Environment

Set these variables in your host environment or a local `.env` file:

- `PORT=4000`
- `DB_HOST=localhost`
- `DB_PORT=3306`
- `DB_USERNAME=guzabox`
- `DB_PASSWORD=pass`
- `DB_NAME=jazabox`
- `DB_SYNC=true`
- `DB_LOGGING=false`
- `JWT_SECRET=change-me`
- `ADMIN_PHONE=254700000000`
- `ADMIN_EMAIL=admin@example.com`
- `USSD_CODE=*519*63#`
- `SMS_PROVIDER=stub`
- `ADVANTA_BASE_URL=https://developers.advantasms.com`
- `ADVANTA_SEND_PATH=/api/services/sendotp`
- `ADVANTA_PARTNER_ID=`
- `ADVANTA_API_KEY=`
- `ADVANTA_SHORTCODE=`
- `MPESA_BASE_URL=`
- `MPESA_CONSUMER_KEY=`
- `MPESA_CONSUMER_SECRET=`
- `MPESA_SHORTCODE=`
- `MPESA_PASSKEY=`
- `MPESA_CALLBACK_URL=`
- `PUBLIC_BASE_URL=`
- `MPESA_B2C_SHORTCODE=`
- `MPESA_B2C_INITIATOR_NAME=`
- `MPESA_B2C_SECURITY_CREDENTIAL=`
- `MPESA_B2C_COMMAND_ID=BusinessPayment`
- `MPESA_B2C_RESULT_URL=`
- `MPESA_B2C_TIMEOUT_URL=`
- `MPESA_B2C_REMARKS=Lucky Box instant payout`
- `MPESA_B2C_OCCASION=InstantWin`

## USSD Webhook

The backend exposes a USSD webhook at:

- `GET /ussd`
- `POST /ussd`

It responds with plain text in the standard format:

- `CON ...` to continue the session
- `END ...` to terminate the session

The controller accepts multiple common field-name variants (so it works with different aggregators),
including:

- Session id: `SESSIONID`, `SESSION_ID`, `sessionId`
- Phone/MSISDN: `MSISDN`, `phoneNumber`, `phone`
- User input/text: `INPUT`, `text`
- Service/USSD code: `USSDCODE`, `ussdCode`, `SERVICECODE`, `SERVICE_CODE`, `serviceCode`

## Dashboard Environment

Set:

- `NEXT_PUBLIC_API_URL=http://localhost:4000`
