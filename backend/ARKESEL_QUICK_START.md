# Arkesel SMS Provider - Quick Start

## ✅ Implementation Complete

Arkesel SMS provider has been fully integrated into the system. You can now use Arkesel to send SMS notifications.

## Quick Setup

### Via Admin Dashboard (Recommended)

1. **Navigate**: Admin Dashboard → Settings → SMS Providers → Add Provider
2. **Fill Form**:
   ```
   Name: Arkesel SMS
   Provider: arkesel
   API Key: eHBGVUdkSUpac1FJVlpMRmdxYWY
   Sender ID: [Your registered sender ID - REQUIRED]
   Is Active: ✅
   Is Default: ✅ (optional)
   ```
3. **Save** and test using the "Test" button

### Via API

```bash
POST /api/settings/sms-providers
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Arkesel SMS",
  "provider": "arkesel",
  "apiKey": "eHBGVUdkSUpac1FJVlpMRmdxYWY",
  "senderId": "YourSenderID",
  "isActive": true,
  "isDefault": true
}
```

## Required Fields

- ✅ **apiKey**: `eHBGVUdkSUpac1FJVlpMRmdxYWY` (provided)
- ✅ **senderId**: Your registered Arkesel sender ID (must be registered with Arkesel first)

## Testing

### Test SMS Sending

```bash
POST /api/settings/sms-providers/{provider-id}/test
{
  "phone": "+233123456789"
}
```

### Check Balance

```bash
GET /api/settings/sms-providers/{provider-id}/balance
```

## Phone Number Format

- ✅ `233123456789` (without +)
- ✅ `+233123456789` (with +, automatically removed)
- ❌ `0123456789` (local format - not recommended)

## Usage

Once configured as default provider, Arkesel will automatically be used for:
- RSVP confirmation SMS
- Check-in notifications
- Guestbook notifications
- Broadcast messages
- All SMS notifications

## API Details

**Base URL**: `https://sms.arkesel.com/sms/api`

**Send SMS**:
```
GET /sms/api?action=send-sms&api_key={KEY}&to={PHONE}&from={SENDER_ID}&sms={MESSAGE}
```

**Check Balance**:
```
GET /sms/api?action=check-balance&api_key={KEY}&response=json
```

## Features Implemented

✅ Send SMS via Arkesel API  
✅ Balance checking endpoint  
✅ Phone number normalization (+ removal)  
✅ Error handling and validation  
✅ Balance included in send response  
✅ Sender ID validation  

## Notes

- **Sender ID is REQUIRED** - Must be registered with Arkesel before use
- Balance is checked and returned with each send (if available)
- All phone numbers are automatically normalized (leading + removed)
- Errors are logged and returned with descriptive messages

For detailed documentation, see `ARKESEL_SMS_SETUP.md`.

