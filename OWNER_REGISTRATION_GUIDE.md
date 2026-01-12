# Owner Registration and Login Guide

## Overview

Event owners can access the platform in two ways:
1. **Owner Dashboard** (New) - Authenticated dashboard at `/owner/login` for managing all their events
2. **Event-Specific Portal** (Legacy) - Token-based access at `/event-owner/{token}` for single event management

## Owner Registration

### For New Owners (Self-Registration)

Owners can create their own accounts by visiting:

**URL:** `/owner/login`

The page includes:
- **Login form** (default view)
- **Registration form** (toggle to "Create Account")
- **Password setup form** (shown when admin-created account needs password setup)

### Registration Process

1. Navigate to `/owner/login`
2. Click "Don't have an account? Sign up"
3. Fill in the registration form:
   - Full Name (required)
   - Email Address (required)
   - Password (required)
   - Phone (optional)
   - Company (optional)
4. Click "Create Account"
5. You'll be automatically logged in and redirected to `/owner` (dashboard)

## Admin-Created Owner Accounts

When an admin creates an owner account:

1. **Email Notification Sent**: The owner receives a welcome email with:
   - Instructions to set up their password
   - Link to `/owner/login`
   - Note that their account was created by an admin

2. **Password Setup**: When the owner tries to log in:
   - They'll see a password setup form
   - They enter their email and new password
   - After setup, they're automatically logged in

3. **First Login**: The owner can:
   - Visit `/owner/login`
   - Enter their email
   - The system will detect they need to set up a password
   - Complete password setup and access the dashboard

## Owner Dashboard Features

Once logged in, owners can access:

- **Dashboard** (`/owner`) - Overview of all events and statistics
- **Events** (`/owner/events`) - List of all their events
- **Event Details** (`/owner/events/{id}`) - Manage individual events
- **Account** (`/owner/account`) - Profile and wallet settings

## Links Summary

| Page | URL | Description |
|------|-----|-------------|
| Owner Login/Register | `/owner/login` | Main entry point for owners |
| Owner Dashboard | `/owner` | Overview dashboard (requires login) |
| Owner Events List | `/owner/events` | List of all owner's events |
| Owner Event Details | `/owner/events/{id}` | Manage specific event |
| Owner Account | `/owner/account` | Profile and wallet management |
| Legacy Event Portal | `/event-owner/{token}` | Token-based single event access |

## Admin Actions

### Creating Owner Accounts

When an admin creates an owner account via `/admin/owners/new`:

1. The owner account is created **without a password**
2. An email is automatically sent to the owner with:
   - Welcome message
   - Link to `/owner/login` to set up password
   - Instructions for first-time access

3. The owner must visit `/owner/login` and set up their password before they can access the dashboard

### Linking Events to Owners

In the admin event settings:
- Admins can assign an owner account to an event
- The "Owner Portal" link in event overview now points to `/owner/login`
- Owners with accounts can log in to see all their events in the dashboard

## Troubleshooting

### Owner Can't Log In

1. **Check if account exists**: Verify in `/admin/owners`
2. **Check if password is set**: Admin-created accounts need password setup
3. **Check email**: Owner should have received welcome email with setup link
4. **Manual setup**: Owner can visit `/owner/login` directly and use password setup flow

### Email Not Received

1. **Check email configuration**: Verify SMTP settings in `/admin/settings`
2. **Check spam folder**: Welcome emails may be filtered
3. **Resend manually**: Admin can provide the link `/owner/login` directly to owner

### Password Setup Issues

1. **Account already has password**: Use "Forgot Password" or contact admin
2. **Email not found**: Verify email matches the one used when creating account
3. **Account inactive**: Contact admin to activate the account

