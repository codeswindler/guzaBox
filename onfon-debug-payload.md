# Onfon Media API Request Payload for Troubleshooting

## Issue
Getting `MessageErrorCode: 401` with error: "Value filter failed for user [MONTPAY] (source_address filter mismatch)."

## HTTP Request Details

### Endpoint
```
POST https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS
```

### Headers
```json
{
  "AccessKey": "YOUR_ACCESS_KEY_HERE",
  "Content-Type": "application/json",
  "User-Agent": "KwachuaBox/1.0"
}
```

### Request Body
```json
{
  "ApiKey": "YOUR_API_KEY_HERE",
  "ClientId": "MONTPAY",
  "SenderId": "MPAY TECH",
  "MessageParameters": [
    {
      "Number": "254727839315",
      "Text": "Almost won. Try again.\n\nYou chose 1\n\nBox 1: 0\nBox 2: 555\nBox 3: 5424\nBox 4: 6834\nBox 5: 9636\nBox 6: 0\n\nBet: Z1oHDV9LKEZ\n\nDial *885 to win more."
    }
  ]
}
```

## Response Received

```json
{
  "ErrorCode": 0,
  "ErrorDescription": "null",
  "Data": [
    {
      "MessageErrorCode": 401,
      "MessageErrorDescription": "Value filter failed for user [MONTPAY] (source_address filter mismatch).",
      "MobileNumber": "254727839315",
      "MessageId": "",
      "Custom": ""
    }
  ]
}
```

## Questions for Onfon Media Support

1. Is the SenderId "MPAY TECH" approved/configured for account "MONTPAY"?
2. What SenderId(s) are currently approved for account "MONTPAY"?
3. Do we need to request approval for "MPAY TECH" as a SenderId?
4. Are the credentials (AccessKey, ApiKey, ClientId) correct for account "MONTPAY"?
5. Is there any additional configuration needed on the account side?

## cURL Command (for testing)

Replace `YOUR_ACCESS_KEY` and `YOUR_API_KEY` with actual values:

```bash
curl -X POST https://api.onfonmedia.co.ke/v1/sms/SendBulkSMS \
  -H "AccessKey: YOUR_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -H "User-Agent: KwachuaBox/1.0" \
  -d '{
    "ApiKey": "YOUR_API_KEY",
    "ClientId": "MONTPAY",
    "SenderId": "MPAY TECH",
    "MessageParameters": [
      {
        "Number": "254727839315",
        "Text": "Test message"
      }
    ]
  }'
```
