# RSVP and Checkout Form Customization Guide

## Overview

Both RSVP and checkout forms in EventPeepo are **fully customizable** per event. This allows event owners to collect exactly the information they need for their specific event type.

## How It Works

### 1. **Default Fields (Always Present)**
Every RSVP form includes these core fields by default:
- **Primary Name** (required) - Main guest name
- **Secondary Name** (optional) - Partner/companion name
- **Email** (required) - Email address for confirmations
- **Phone** (required) - Phone number for contact
- **Attendance** (required) - YES/NO/MAYBE
- **Guest Count** (required) - Number of guests
- **Meal Preference** (optional) - Meal selection
- **Dietary Notes** (optional) - Dietary restrictions
- **Note** (optional) - Additional message

### 2. **Custom Fields System**
Event owners can add unlimited custom fields through the admin dashboard:

**Field Types Supported:**
- `text` - Single line text input
- `email` - Email input with validation
- `phone` - Phone number input
- `number` - Numeric input
- `select` - Dropdown selection
- `checkbox` - Checkbox input
- `radio` - Radio button group
- `textarea` - Multi-line text input
- `date` - Date picker

**Field Configuration Options:**
- **Label** - Display name for the field
- **Placeholder** - Hint text
- **Help Text** - Additional instructions
- **Required** - Make field mandatory
- **Options** - For select/radio/checkbox (JSON array)
- **Validation** - Min/max length, regex patterns
- **Sort Order** - Control field display order
- **Visibility** - Show/hide on confirmation

### 3. **Form Customization API**

**Admin Endpoints:**
- `GET /api/ticketing/event/:eventId/fields` - List all form fields
- `POST /api/ticketing/event/:eventId/fields` - Create new field
- `PATCH /api/ticketing/event/:eventId/fields/:id` - Update field
- `DELETE /api/ticketing/event/:eventId/fields/:id` - Delete field

**Public Endpoint:**
- `GET /api/ticketing/public/:eventSlug/form` - Get form configuration for RSVP page

### 4. **Data Storage**

Custom field responses are stored in the `RSVP.customFields` JSON column:
```json
{
  "field_123": "Response value",
  "field_456": "Another response"
}
```

This allows:
- Flexible schema per event
- No database migrations needed for new fields
- Easy export and analysis

### 5. **Checkout Form (Paid RSVP)**

When `rsvpMode` is set to `paid`, the form includes:
- All default RSVP fields
- All custom fields
- **Ticket Selection** - Choose ticket types and quantities
- **Payment Gateway Selection** - Choose payment method
- **Promo Code** - Optional discount code

### 6. **Form Rendering**

The frontend dynamically renders fields based on:
1. Default fields (hardcoded)
2. Custom fields from `EventFormField` table
3. Field configuration (type, required, options, etc.)

Fields are sorted by `sortOrder` and filtered by `isActive`.

## Example: Adding a Custom Field

**Via Admin Dashboard:**
1. Navigate to Event → Settings → Form Fields
2. Click "Add Field"
3. Configure:
   - Label: "Company Name"
   - Type: "text"
   - Required: true
   - Sort Order: 5
4. Save

**Via API:**
```bash
POST /api/ticketing/event/{eventId}/fields
{
  "fieldName": "company_name",
  "label": "Company Name",
  "type": "text",
  "required": true,
  "sortOrder": 5
}
```

## Default Behavior

**By Default:**
- Email is **required** ✅
- Phone is **required** ✅
- All other fields are optional (except primary name and attendance)

**Customization:**
- Owners can add/remove/modify custom fields
- Field order can be rearranged
- Fields can be made required/optional
- Fields can be hidden from confirmation page

## Best Practices

1. **Keep forms concise** - Only ask for necessary information
2. **Use appropriate field types** - Email for emails, phone for phones
3. **Provide help text** - Guide users on what to enter
4. **Test validation** - Ensure required fields work correctly
5. **Consider mobile** - Keep forms mobile-friendly

## Technical Details

**Database Schema:**
```prisma
model EventFormField {
  id          String
  eventId     String
  fieldName   String  // Internal identifier
  label       String  // Display label
  type        String  // Field type
  placeholder String?
  helpText    String?
  options     String? // JSON array for select/radio
  required    Boolean
  minLength   Int?
  maxLength   Int?
  pattern     String? // Regex validation
  sortOrder   Int
  isActive    Boolean
  // ...
}
```

**Validation:**
- Backend validates all fields using Zod schemas
- Custom fields validated based on their configuration
- Required fields enforced on submission
- Type validation (email, phone, number) applied automatically

