# Owner Wallet Implementation

## Overview
This document describes the implementation of owner wallet functionality, allowing owners to set up payout wallets for receiving payments across all their events.

## Database Schema Changes

### New Model: `OwnerWallet`
Added a new `OwnerWallet` model to the Prisma schema that stores wallet configuration for owners:

```prisma
model OwnerWallet {
  id      String @id @default(uuid())
  ownerId String @unique

  // Bank Account Details
  bankName      String?
  accountName   String?
  accountNumber String?
  routingNumber String? // For US banks
  swiftCode     String? // For international

  // Mobile Money (Africa)
  mobileProvider String? // mpesa | mtn | airtel
  mobileNumber   String?

  // Digital Wallets
  paypalEmail        String?
  stripeAccountId    String? // Stripe Connect account
  paystackSubaccount String?

  // Payout Preferences
  preferredMethod     String  @default("bank") // bank | mobile | paypal | stripe | paystack
  currency            String  @default("USD")
  autoPayoutEnabled   Boolean @default(false)
  autoPayoutThreshold Float   @default(100) // Minimum balance to trigger auto-payout

  // Verification
  isVerified Boolean   @default(false)
  verifiedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  owner Owner @relation(fields: [ownerId], references: [id], onDelete: Cascade)
}
```

### Owner Model Update
Added wallet relation to Owner model:
```prisma
model Owner {
  // ... existing fields ...
  wallet OwnerWallet?
}
```

## API Endpoints

### Admin Endpoints
- `GET /api/owners/:id/wallet` - Get owner wallet configuration
- `POST /api/owners/:id/wallet` - Create or update owner wallet (admin can set up on behalf of owner)

### Owner Dashboard Endpoints
- `GET /api/owner-dashboard/wallet` - Get wallet configuration for logged-in owner
- `POST /api/owner-dashboard/wallet` - Create or update wallet configuration

## Features

1. **Owner Wallet Setup**: Owners can set up their wallet through the owner dashboard
2. **Admin Wallet Setup**: Admins can set up wallets on behalf of owners
3. **Multiple Payment Methods**: Supports bank accounts, mobile money, PayPal, Stripe, and Paystack
4. **Wallet Display**: Wallet information is shown in admin dashboard owner details

## Frontend Changes

### Admin Dashboard
- Updated owner list to show wallet status
- Owner details now include wallet information
- Admin can view and manage owner wallets

### Owner Dashboard
- Owners can view and update their wallet configuration
- Wallet setup interface for entering payout details

## Notifications

Enhanced notifications to include payout activities:
- **Payout Processed**: Owners receive email/SMS/WhatsApp notification when payout is processed
- **Payout Rejected**: Owners receive notification when payout request is rejected

Notification details include:
- Payout amount and currency
- Payment method
- Transaction reference (if available)
- Rejection reason (if rejected)

## Migration Steps

1. Run Prisma migration:
   ```bash
   npx prisma migrate dev --name add_owner_wallet
   ```

2. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

3. Deploy to production:
   ```bash
   npx prisma migrate deploy
   ```

## Security Considerations

- Wallet endpoints are protected by authentication
- Admin endpoints require admin authentication
- Owner dashboard endpoints require owner authentication
- Sensitive wallet information should be encrypted at rest (consider adding encryption for sensitive fields)
- Audit logs track all wallet updates

## Future Enhancements

- Wallet verification workflow
- Multi-currency support per wallet
- Auto-payout functionality
- Wallet history/transaction log
- Integration with payment processors for automatic verification

