# Template Developer Guide

## Overview
This guide explains how to create custom templates for the Digital Event Platform. Templates are HTML/CSS/JS bundles that can be uploaded to customize the appearance and behavior of event pages.

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

## Limitations

- Templates run in isolated iframes for security
- External API calls may be blocked by CORS
- File size limit: 50MB per template
- Supported file types: HTML, CSS, JS, images, fonts

## Support

For template development support, contact the platform administrator or refer to the main documentation.

