# Arkesel SMS Provider Setup Guide

## Overview

Arkesel is an SMS provider that supports sending SMS messages via HTTP API. This guide explains how to configure Arkesel as an SMS provider in the Digital Event Platform.

## API Information

- **API Base URL**: `https://sms.arkesel.com/sms/api`
- **API Key**: `eHBGVUdkSUpac1FJVlpMRmdxYWY`
- **Supported Operations**:
  - Send SMS (Text/Plain)
  - Schedule SMS
  - Check Balance
  - Contact Management

## Setup Instructions

### Step 1: Create SMS Provider via Admin Dashboard

1. Go to Admin Dashboard → Settings → SMS Providers
2. Click "Add SMS Provider" or "New Provider"
3. Fill in the form:
   - **Name**: `Arkesel SMS` (or any display name)
   - **Provider**: Select `arkesel` from dropdown (or enter manually)
   - **API Key**: `eHBGVUdkSUpac1FJVlpMRmdxYWY`
   - **Sender ID**: Enter your registered sender ID (required for Arkesel)
     - This is the "from" field in SMS messages
     - Must be registered with Arkesel
     - Examples: `Event`, `Wedding2024`, etc.
   - **Is Active**: ✅ (checked)
   - **Is Default**: ✅ (if you want this as default provider)

### Step 2: Configuration via API (Alternative)

If you prefer to set up via API, use the following:

```bash
POST /api/settings/sms-providers
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "name": "Arkesel SMS",
  "provider": "arkesel",
  "apiKey": "eHBGVUdkSUpac1FJVlpMRmdxYWY",
  "senderId": "YourSenderID",
  "isActive": true,
  "isDefault": true
}
```

**Required Fields**:
- `name`: Display name for the provider
- `provider`: Must be `"arkesel"`
- `apiKey`: Your Arkesel API key (`eHBGVUdkSUpac1FJVlpMRmdxYWY`)
- `senderId`: Your registered sender ID (this is the "from" field in SMS)

**Optional Fields**:
- `isActive`: `true` to enable (default: `true`)
- `isDefault`: `true` to set as default provider (default: `false`)

## API Endpoints Used

### Send SMS (Text/Plain)
```
GET https://sms.arkesel.com/sms/api?action=send-sms&api_key={API_KEY}&to={PhoneNumber}&from={SenderID}&sms={Message}
```

**Parameters**:
- `action`: `send-sms`
- `api_key`: Your Arkesel API key
- `to`: Recipient phone number (without leading +)
- `from`: Sender ID (must be registered)
- `sms`: Message text

**Response**:
```json
{
  "status": "success",
  "data": {
    "status": "sent",
    "message": "SMS sent successfully",
    "message_id": "123456789",
    "balance": 95.50
  }
}
```

### Check Balance
```
GET https://sms.arkesel.com/sms/api?action=check-balance&api_key={API_KEY}&response=json
```

**Parameters**:
- `action`: `check-balance`
- `api_key`: Your Arkesel API key
- `response`: `json`

**Response**:
```json
{
  "status": "success",
  "balance": 95.50
}
```

### Schedule SMS (Future Feature)
```
GET https://sms.arkesel.com/sms/api?action=send-sms&api_key={API_KEY}&to={PhoneNumber}&from={SenderID}&sms={Message}&schedule={ScheduleTime}
```

**Parameters**: Same as Send SMS, plus:
- `schedule`: ISO 8601 format datetime (e.g., `2024-12-25T10:00:00Z`)

## Usage Examples

### Send SMS via System

The system will automatically use Arkesel when:
1. Arkesel is set as the default SMS provider, OR
2. Arkesel is explicitly selected for a broadcast/notification

**Example**: Sending RSVP confirmation SMS
- System uses default SMS provider
- If Arkesel is default, it will automatically be used
- Message is sent via Arkesel API

### Test SMS Provider

You can test the Arkesel configuration:

```bash
POST /api/settings/sms-providers/{provider-id}/test
Content-Type: application/json
Authorization: Bearer <admin-token>

{
  "phone": "+233123456789"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Test SMS sent successfully",
  "balance": 95.50
}
```

### Check Balance

Check your Arkesel account balance:

```bash
GET /api/settings/sms-providers/{provider-id}/balance
Authorization: Bearer <admin-token>
```

**Response**:
```json
{
  "success": true,
  "balance": 95.50
}
```

## Phone Number Format

Arkesel accepts phone numbers in international format:
- ✅ `233123456789` (Ghana without +)
- ✅ `+233123456789` (with +, will be stripped automatically)
- ❌ `0123456789` (local format - not recommended)

**Note**: The system automatically removes leading `+` from phone numbers before sending to Arkesel.

## Sender ID Requirements

- **Must be registered** with Arkesel before use
- **Maximum length**: Usually 11 characters
- **Characters allowed**: Alphanumeric, spaces (some restrictions may apply)
- **Examples**: `Event`, `Wedding2024`, `CompanyName`

If sender ID is not registered, SMS will fail. Contact Arkesel support to register your sender ID.

## Error Handling

The system handles common Arkesel errors:

1. **Invalid API Key**: Returns authentication error
2. **Invalid Sender ID**: Returns error from Arkesel API
3. **Insufficient Balance**: Returns error with current balance
4. **Invalid Phone Number**: Returns validation error
5. **Network Errors**: Retries or returns connection error

## Integration Status

✅ **Implemented**:
- Send SMS via Arkesel API
- Balance checking endpoint
- Error handling
- Phone number normalization (+ removal)
- Balance included in send response

⚠️ **Not Yet Implemented**:
- Scheduled SMS (can be added if needed)
- Contact management API
- Bulk SMS with contact list

## Cost Information

- Arkesel charges per SMS sent
- Rates vary by destination country
- Balance is deducted automatically
- Check balance regularly via `/api/settings/sms-providers/{id}/balance`

## Troubleshooting

### SMS Not Sending

1. **Check API Key**: Verify API key is correct (`eHBGVUdkSUpac1FJVlpMRmdxYWY`)
2. **Check Sender ID**: Ensure sender ID is registered with Arkesel
3. **Check Balance**: Verify account has sufficient balance
4. **Check Phone Number**: Ensure phone number is in correct format (international, no +)
5. **Check Logs**: Review backend logs for specific error messages

### Balance Check Fails

1. Verify API key is correct
2. Ensure API key has balance check permissions
3. Check network connectivity to `sms.arkesel.com`

### Test SMS Returns Error

- Verify provider is active (`isActive: true`)
- Check all required fields are filled (apiKey, senderId)
- Ensure test phone number is valid
- Review error message in response for specific issue

## Next Steps

After setting up Arkesel:

1. ✅ Test SMS sending with test endpoint
2. ✅ Check balance to verify account access
3. ✅ Set as default provider if desired
4. ✅ Configure SMS notifications in event settings
5. ✅ Test end-to-end flow (RSVP → SMS notification)

## API Reference

Full Arkesel API documentation: [https://docs.arkesel.com](https://docs.arkesel.com)

## Support

For Arkesel-specific issues:
- Arkesel Support: [https://arkesel.com/support](https://arkesel.com/support)
- Arkesel Dashboard: [https://sms.arkesel.com](https://sms.arkesel.com)

For platform integration issues, check backend logs and contact platform support.

