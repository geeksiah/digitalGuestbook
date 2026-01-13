# Template Developer Guide

## Overview
This guide explains how to create custom templates for **EventPeepo** (formerly Digital Event Platform). Templates are HTML/CSS/JS bundles that can be uploaded to customize the appearance and behavior of event pages.

EventPeepo is a comprehensive event management platform that supports:
- **RSVP Management** - Customizable RSVP forms with approval workflows
- **Guestbook** - Video, audio, and photo submissions from guests
- **Photo Booth** - Interactive photo booth with QR code downloads
- **Check-in System** - QR code-based check-in for invitation-only events
- **Payout Management** - Owner wallet system with payout requests
- **Ticketing** - Paid and free ticket sales with custom form fields
- **Notifications** - Multi-channel notifications (Email, SMS, WhatsApp)
- **Media Management** - Comprehensive media library with download capabilities

## Template Types

The platform supports the following template types:

1. **INVITATION** - Event landing page (shown when event is in PRE_EVENT phase)
2. **RSVP** - RSVP form page
3. **GUESTBOOK** - Guestbook page (general)
4. **GUESTBOOK_VIDEO** - Video guestbook page
5. **GUESTBOOK_AUDIO** - Audio guestbook page
6. **GUESTBOOK_PHOTO** - Photo guestbook page
7. **BOOTH** - Photo booth page (general)
8. **BOOTH_VIDEO** - Video booth page
9. **BOOTH_AUDIO** - Audio booth page
10. **BOOTH_PHOTO** - Photo booth page
11. **THANK_YOU** - Post-event thank you page

## Template Structure

Templates can be:
- **HTML-only** - Single HTML file with embedded CSS/JS
- **ZIP-based** - ZIP file containing HTML, CSS, JS, and asset files

### HTML-Only Template
A single HTML file with all styles and scripts embedded:

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{event.name}}</title>
  <style>
    /* CSS here */
  </style>
</head>
<body>
  <h1>{{event.name}}</h1>
  <p>{{event.formattedDate}}</p>
  <script>
    // JavaScript here
  </script>
</body>
</html>
```

### ZIP-Based Template
A ZIP file containing:
- `index.html` - Main HTML file (required)
- `style.css` - CSS file (optional, can be embedded in HTML)
- `script.js` - JavaScript file (optional, can be embedded in HTML)
- `assets/` - Images, fonts, etc. (optional)

## Template Variables

Templates support variable injection using double curly braces: `{{variable.name}}`

### Available Variables

#### Event Variables
- `{{event.name}}` - Event name
- `{{event.description}}` - Event description
- `{{event.date}}` - Event date (ISO format)
- `{{event.formattedDate}}` - Formatted event date
- `{{event.venue}}` - Event venue
- `{{event.primaryColor}}` - Primary color (hex)
- `{{event.secondaryColor}}` - Secondary color (hex)
- `{{event.accentColor}}` - Accent color (hex)

#### URL Variables
- `{{urls.rsvp}}` - RSVP page URL
- `{{urls.guestbook}}` - Guestbook page URL
- `{{urls.booth}}` - Booth page URL
- `{{urls.invitation}}` - Invitation page URL
- `{{urls.checkIn}}` - Check-in page URL

#### Owner Variables
- `{{owner.name}}` - Owner name
- `{{owner.email}}` - Owner email
- `{{owner.phone}}` - Owner phone

#### Additional Variables (Context-specific)
- `{{accessCode}}` - Access code (for invitation pages)
- `{{guestName}}` - Guest name (for invitation pages)
- `{{guestCount}}` - Guest count (for invitation pages)

## Creating a Template

### Step 1: Create Your HTML/CSS/JS

Create your template files following the structure above. Use template variables where dynamic content is needed.

Example:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{event.name}}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background: linear-gradient(135deg, {{event.primaryColor}} 0%, {{event.secondaryColor}} 100%);
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 40px;
      border-radius: 10px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 {
      color: {{event.primaryColor}};
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>{{event.name}}</h1>
    <p><strong>Date:</strong> {{event.formattedDate}}</p>
    <p><strong>Venue:</strong> {{event.venue}}</p>
    <p>{{event.description}}</p>
    <a href="{{urls.rsvp}}" class="btn">RSVP Now</a>
  </div>
</body>
</html>
```

### Step 2: Package as ZIP (Optional)

If using assets:
1. Create a directory structure:
   ```
   my-template/
   ├── index.html
   ├── style.css
   ├── script.js
   └── assets/
       ├── images/
       └── fonts/
   ```
2. Zip the directory:
   ```bash
   zip -r my-template.zip my-template/
   ```

### Step 3: Upload Template

1. Go to Admin Dashboard > Templates
2. Click "Upload Template"
3. Fill in:
   - **Name**: Display name for the template
   - **Description**: Optional description
   - **Type**: Select template type
   - **File**: Upload HTML file or ZIP file
4. Click "Upload"

### Step 4: Assign to Event

1. Go to Event details
2. Click "Templates" tab
3. Select template for desired page type
4. Save

## Template Best Practices

1. **Mobile-First Design**: Ensure templates are responsive and work on mobile devices
2. **Fast Loading**: Keep assets optimized and file sizes small
3. **Accessibility**: Use semantic HTML and ensure proper contrast
4. **Browser Compatibility**: Test in modern browsers (Chrome, Firefox, Safari, Edge)
5. **Error Handling**: Handle cases where variables might be missing
6. **Security**: Avoid inline scripts that could be XSS vectors (prefer external JS files)

## Template Isolation

Templates are isolated per event:
- Each event gets its own copy of template assets
- Changes to a template don't affect existing events
- This ensures template updates don't break existing events

## Template Variables Reference

### Event Object
```javascript
{
  name: string,
  description: string | null,
  date: string (ISO format),
  formattedDate: string,
  venue: string | null,
  primaryColor: string (hex),
  secondaryColor: string (hex),
  accentColor: string (hex),
  phase: 'PRE_EVENT' | 'LIVE' | 'POST_EVENT',
  slug: string
}
```

### URLs Object
```javascript
{
  rsvp: string (full URL),
  guestbook: string (full URL),
  booth: string (full URL),
  invitation: string (full URL),
  checkIn: string (full URL)
}
```

## Testing Templates

1. Upload template to development environment
2. Assign to test event
3. View event pages to verify rendering
4. Test on different devices and browsers
5. Verify all variables are replaced correctly

## Template Updates

When updating a template:
1. Upload new version with same name (or create new version)
2. Assign updated template to events
3. Old events continue using previous version (due to isolation)

## New Features & Capabilities

### RSVP System
- **Customizable Forms**: Admins can create custom form fields with configurable types, labels, placeholders, and required status
- **Approval Workflow**: Invitation-only events require owner/admin approval for RSVPs
- **QR Code Generation**: Approved RSVPs automatically generate QR codes for check-in
- **Multi-channel Notifications**: RSVP approvals trigger email, SMS, and WhatsApp notifications with QR codes

### Guestbook & Booth
- **Media Types**: Support for video, audio, and photo submissions
- **Booth Downloads**: Guests can download their booth photos via QR code (exclusive, time-limited access)
- **Camera Features**: 
  - Horizontal flip (mirror mode) for natural camera view
  - Fullscreen camera with overlay controls
  - Audio/video playback controls
- **Session Management**: Booth photos are grouped by session for batch downloads

### Payout System
- **Owner Wallets**: Owners can configure payout methods (bank, mobile money, PayPal, Stripe, Paystack)
- **Payout Requests**: Owners can request payouts with event selection and amount validation
- **Status Tracking**: Payouts support multiple statuses (PENDING, PROCESSING, FULFILLED, DELAYED, REJECTED)
- **Totals Display**: Real-time calculation of available, fulfilled, and pending amounts per event

### Media Management
- **Progress Feedback**: ZIP downloads show real-time progress with file count and MB downloaded
- **Folder Organization**: Media organized by type (VIDEO, PHOTO, AUDIO)
- **Download Options**: Individual file downloads and bulk ZIP downloads with progress tracking
- **Authentication**: Secure downloads with admin JWT or owner token authentication

### Notification System
- **Multi-Provider Support**: Email (SMTP with auto-configuration), SMS (Twilio, Arkesel), WhatsApp (Twilio)
- **Dynamic Templates**: Status-aware notifications with context-specific messages
- **QR Code Attachments**: QR codes embedded in emails and WhatsApp messages
- **Retry Logic**: Automatic retry with timeout handling for failed notifications

## Limitations

- Templates run in isolated iframes for security
- External API calls may be blocked by CORS
- File size limit: 50MB per template
- Supported file types: HTML, CSS, JS, images, fonts
- QR codes are generated server-side and injected as base64 data URLs

## Security Considerations

1. **Template Isolation**: Each event gets its own isolated copy of template assets
2. **XSS Prevention**: Templates are sanitized and run in isolated iframes
3. **Authentication**: All API endpoints require proper authentication (admin JWT or owner token)
4. **Download Security**: Media downloads use secure, time-limited tokens
5. **QR Code Security**: QR codes contain encrypted data and expire after use

## Best Practices Updates

1. **Mobile-First Design**: Ensure templates are responsive and work on mobile devices
2. **Fast Loading**: Keep assets optimized and file sizes small
3. **Accessibility**: Use semantic HTML and ensure proper contrast
4. **Browser Compatibility**: Test in modern browsers (Chrome, Firefox, Safari, Edge)
5. **Error Handling**: Handle cases where variables might be missing
6. **Security**: Avoid inline scripts that could be XSS vectors (prefer external JS files)
7. **QR Code Display**: When displaying QR codes, use the `{{qrCodeData}}` variable as an image source
8. **Conditional Rendering**: Use event capabilities to conditionally show/hide features
9. **Form Validation**: Leverage form field metadata for client-side validation
10. **Progressive Enhancement**: Ensure templates work without JavaScript where possible

## Template Examples

### RSVP Template with Custom Fields
```html
<!DOCTYPE html>
<html>
<head>
  <title>RSVP - {{event.name}}</title>
  <style>
    .form-field { margin-bottom: 20px; }
    .required::after { content: " *"; color: red; }
  </style>
</head>
<body>
  <h1>RSVP for {{event.name}}</h1>
  <form id="rsvpForm">
    {{#each formFields}}
    <div class="form-field">
      <label class="{{#if required}}required{{/if}}">{{label}}</label>
      {{#if (eq type "select")}}
        <select name="{{name}}" {{#if required}}required{{/if}}>
          {{#each options}}
          <option value="{{this}}">{{this}}</option>
          {{/each}}
        </select>
      {{else if (eq type "textarea")}}
        <textarea name="{{name}}" placeholder="{{placeholder}}" {{#if required}}required{{/if}}></textarea>
      {{else}}
        <input type="{{type}}" name="{{name}}" placeholder="{{placeholder}}" {{#if required}}required{{/if}} />
      {{/if}}
      {{#if helpText}}<small>{{helpText}}</small>{{/if}}
    </div>
    {{/each}}
    <button type="submit">Submit RSVP</button>
  </form>
</body>
</html>
```

### Invitation Template with QR Code
```html
<!DOCTYPE html>
<html>
<head>
  <title>Invitation - {{event.name}}</title>
</head>
<body>
  <h1>You're Invited!</h1>
  <h2>{{event.name}}</h2>
  <p>Date: {{event.formattedDate}}</p>
  <p>Venue: {{event.venue}}</p>
  
  {{#if accessCode}}
  <div class="access-info">
    <p>Your access code: <strong>{{accessCode}}</strong></p>
    {{#if qrCodeData}}
    <div class="qr-code">
      <p>Scan this QR code for check-in:</p>
      <img src="{{qrCodeData}}" alt="Check-in QR Code" />
    </div>
    {{/if}}
  </div>
  {{/if}}
  
  <a href="{{urls.rsvp}}">RSVP Now</a>
  <a href="{{urls.guestbook}}">View Guestbook</a>
</body>
</html>
```

## API Integration

Templates can make API calls to the EventPeepo backend using the following endpoints:

### Public Endpoints
- `GET /api/public/events/:slug` - Get event details
- `POST /api/rsvp/:slug` - Submit RSVP
- `POST /api/guestbook/:eventId/submit` - Submit guestbook entry
- `GET /api/public/booth/download/:token` - Download booth photos

### Authentication
- Admin endpoints require `Authorization: Bearer <admin_jwt_token>`
- Owner endpoints require `X-Owner-Token: <owner_access_token>` or `Authorization: Bearer <owner_jwt_token>`

## Support

For template development support:
- Refer to the main [Developer Documentation](./DEVELOPER_DOCUMENTATION.md)
- Check the [RSVP Form Customization Guide](./RSVP_FORM_CUSTOMIZATION.md)
- Contact the platform administrator

## Changelog

### Recent Updates (2025-01-13)
- ✅ Added QR code generation for RSVP approvals
- ✅ Enhanced payout system with status management
- ✅ Improved media download with progress feedback
- ✅ Added customizable RSVP form fields
- ✅ Enhanced notification system with multi-provider support
- ✅ Updated branding to EventPeepo
- ✅ Added booth photo download system with QR codes
- ✅ Improved camera UX with mirror mode and fullscreen controls

