$path = 'C:\Users\abbas\Downloads\index (5).html'
$c = Get-Content -LiteralPath $path -Raw

# Metadata and top CTA
$c = $c.Replace(
  '<title>EventPeepo | Premium Event Management and Digital Event Solutions</title>',
  '<title>EventPeepo | Premium Event Management, Digital Event Solutions, Ushering, Media & Logistics</title>'
)
$c = $c.Replace(
  'EventPeepo delivers premium event management, digital event solutions, ushering, photography and videography, and logistics for memorable celebrations and corporate experiences.',
  'EventPeepo delivers premium event management, digital event solutions, ushering, photography and videography, and logistics. We help you create seamless events that guests remember and hosts feel proud of.'
)
$c = $c.Replace('Get Proposal', 'Book Free Call')

# Hero copy (maintain look, improve conversion language)
$c = $c.Replace(
  'Premium event execution, modern digital delivery',
  'Premium event execution, now built for higher conversion'
)
$c = $c.Replace(
  '<h1>Elevate Every Guest Moment.</h1>',
  '<h1>Elevate Every Guest Moment.</h1>'
)
$c = $c.Replace(
  'EventPeepo blends event management precision with digital innovation so your events feel seamless,' + [Environment]::NewLine + '            premium, and unforgettable from first invite to final goodbye.',
  'EventPeepo blends event management precision with digital innovation so your events feel seamless,' + [Environment]::NewLine + '            premium, and unforgettable from first invite to final goodbye. Get a tailored event plan in under 24 hours.'
)
$c = $c.Replace('Plan My Event', 'Get Free Strategy Call')
$c = $c.Replace('Launch Digital Experience', 'View Digital Experience')
$c = $c.Replace('client referrals', 'referral confidence')
$c = $c.Replace('<div class="metric"><strong>24/7</strong><span>ops coordination</span></div>', '<div class="metric"><strong>&lt; 24h</strong><span>proposal response</span></div>')

$heroActionsOld = @'
          <div class="hero-actions">
            <a href="#contact" class="btn btn-primary">Get Free Strategy Call</a>
            <a href="https://app.eventpeepo.com" target="_blank" rel="noopener" class="btn btn-soft">View Digital Experience</a>
          </div>
'@
$heroActionsNew = @'
          <div class="hero-actions">
            <a href="#contact" class="btn btn-primary">Get Free Strategy Call</a>
            <a href="https://app.eventpeepo.com" target="_blank" rel="noopener" class="btn btn-soft">View Digital Experience</a>
          </div>
          <div class="hero-trust">
            <span>Dedicated event lead</span>
            <span>Fast proposal turnaround</span>
            <span>Mobile-first guest journey</span>
          </div>
'@
if ($c -notmatch '<div class="hero-trust">') {
  $c = $c.Replace($heroActionsOld, $heroActionsNew)
}

# Conversion CTA band after services
$ctaBand = @'

    <section class="cta-band">
      <div class="shell cta-band-wrap reveal">
        <div>
          <span class="eyebrow" style="margin-bottom:8px;"><span class="dot"></span>Need this event done right?</span>
          <h2 style="font-size:clamp(1.3rem,4.4vw,1.9rem); margin:0 0 6px;">Secure your date with a free strategy call.</h2>
          <p class="sub" style="margin:0;">We will share a tailored plan covering management, digital flow, ushering, media, and logistics.</p>
        </div>
        <div class="hero-actions" style="margin:0;">
          <a href="#contact" class="btn btn-primary">Book Free Call</a>
          <a href="https://wa.me/2340000000000" target="_blank" rel="noopener" class="btn btn-soft">Chat on WhatsApp</a>
        </div>
      </div>
    </section>

'@
if ($c -notmatch '<section class="cta-band">') {
  $c = [regex]::Replace(
    $c,
    '(?s)\s*<section id="digital">',
    $ctaBand + [Environment]::NewLine + '    <section id="digital">',
    1
  )
}

# FAQ before contact
$faqSection = @'

    <section id="faq">
      <div class="shell">
        <header class="section-head reveal">
          <span class="eyebrow">Frequently Asked</span>
          <h2>Answers that help you decide faster.</h2>
          <p class="sub">Clear expectations, transparent process, and premium delivery standards.</p>
        </header>
        <div class="faq-grid">
          <article class="quote reveal"><p>Can EventPeepo handle everything end-to-end? Yes. Planning, digital systems, ushering, media, and logistics are coordinated under one team.</p><strong>Full-Service Delivery</strong></article>
          <article class="quote reveal"><p>Can we book specific services only? Yes. Choose a single service or combine multiple services based on your goals and budget.</p><strong>Flexible Service Mix</strong></article>
          <article class="quote reveal"><p>How fast can we get started? After your inquiry, we provide a tailored next-step plan quickly so you can lock decisions early.</p><strong>Fast Response</strong></article>
        </div>
      </div>
    </section>

'@
if ($c -notmatch '<section id="faq">') {
  $c = [regex]::Replace(
    $c,
    '(?s)\s*<section id="contact">',
    $faqSection + [Environment]::NewLine + '    <section id="contact">',
    1
  )
}

# Contact section enhancements
$c = $c.Replace('Ready to plan with EventPeepo?', 'Ready to create a premium event outcome?')
$c = $c.Replace('Tell us what you are planning. We will respond with a tailored strategy and service recommendation.', 'Share a few details and we will respond with a tailored strategy, service scope, and next steps.')
$c = $c.Replace('Request Proposal', 'Get My Proposal')

$emailToServiceOld = @'
            <div class="field">
              <label for="email">Email Address</label>
              <input id="email" name="email" type="email" required placeholder="you@company.com" />
            </div>
            <div class="field">
              <label for="service">Primary Service Needed</label>
'@
$emailToServiceNew = @'
            <div class="field">
              <label for="email">Email Address</label>
              <input id="email" name="email" type="email" required placeholder="you@company.com" />
            </div>
            <div class="field">
              <label for="phone">WhatsApp / Phone (Optional)</label>
              <input id="phone" name="phone" placeholder="+234..." />
            </div>
            <div class="field">
              <label for="eventType">Event Type</label>
              <select id="eventType" name="eventType" required>
                <option value="">Select event type</option>
                <option>Wedding</option>
                <option>Corporate Event</option>
                <option>Birthday / Celebration</option>
                <option>Conference / Summit</option>
                <option>Private Dinner</option>
                <option>Other</option>
              </select>
            </div>
            <div class="field">
              <label for="service">Primary Service Needed</label>
'@
if ($c -notmatch 'id="phone"') {
  $c = $c.Replace($emailToServiceOld, $emailToServiceNew)
}

$dateBlockOld = @'
            <div class="field">
              <label for="date">Event Date</label>
              <input id="date" name="date" type="date" />
            </div>
'@
$dateBlockNew = @'
            <div class="field">
              <label for="budget">Estimated Budget Range</label>
              <select id="budget" name="budget">
                <option value="">Select range</option>
                <option>Below NGN 2M</option>
                <option>NGN 2M - NGN 5M</option>
                <option>NGN 5M - NGN 10M</option>
                <option>NGN 10M - NGN 25M</option>
                <option>NGN 25M+</option>
              </select>
            </div>
            <div class="field">
              <label for="date">Event Date</label>
              <input id="date" name="date" type="date" />
            </div>
'@
if ($c -notmatch 'id="budget"') {
  $c = $c.Replace($dateBlockOld, $dateBlockNew)
}
$c = [regex]::Replace(
  $c,
  '(?s)<button class="btn btn-primary" type="submit">Get My Proposal</button>\s*</div>',
  '<button class="btn btn-primary" type="submit">Get My Proposal</button>' + [Environment]::NewLine + '            <p class="assist">No spam. We only contact you about your event request.</p>' + [Environment]::NewLine + '          </div>',
  1
)

# CSS additions
$extraCss = @'

    .hero-trust { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 16px; }
    .hero-trust span { font-size: 0.78rem; font-weight: 600; color: var(--brand-deep); background: #eef6f3; border: 1px solid #cde0d8; border-radius: 999px; padding: 7px 10px; }
    .cta-band { padding-top: 6px; }
    .cta-band-wrap { border: 1px solid var(--line); background: #fff; border-radius: 22px; padding: 20px; display: grid; gap: 12px; box-shadow: 0 10px 26px rgba(18, 50, 42, 0.08); }
    .faq-grid { display: grid; gap: 12px; }
    .assist { margin: 2px 0 0; font-size: 0.8rem; color: var(--ink-soft); }
'@
if ($c -notmatch '\.hero-trust \{') {
  $c = $c.Replace('    @media (min-width: 760px) {', $extraCss + [Environment]::NewLine + '    @media (min-width: 760px) {')
}
if ($c -notmatch '\.cta-band-wrap \{ grid-template-columns: 1fr auto; align-items: center; \}') {
  $c = $c.Replace('.proof { grid-template-columns: repeat(3, minmax(0, 1fr)); }', '.proof { grid-template-columns: repeat(3, minmax(0, 1fr)); }' + [Environment]::NewLine + '      .faq-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }' + [Environment]::NewLine + '      .cta-band-wrap { grid-template-columns: 1fr auto; align-items: center; }')
}

# Script mailto payload improvements
if ($c -notmatch "var phone = document\.getElementById\('phone'\)") {
  $c = $c.Replace(
    "var email = document.getElementById('email') && document.getElementById('email').value || '';",
    "var email = document.getElementById('email') && document.getElementById('email').value || '';" + [Environment]::NewLine + "          var phone = document.getElementById('phone') && document.getElementById('phone').value || '';" + [Environment]::NewLine + "          var eventType = document.getElementById('eventType') && document.getElementById('eventType').value || '';" + [Environment]::NewLine + "          var budget = document.getElementById('budget') && document.getElementById('budget').value || '';"
  )
}
$mailtoBodyOld = @'
          var body = encodeURIComponent(
            'Name: ' + name + '\n' +
            'Email: ' + email + '\n' +
            'Service: ' + service + '\n' +
            'Event Date: ' + date + '\n\n' +
            'Brief:\n' + message
          );
'@
$mailtoBodyNew = @'
          var body = encodeURIComponent(
            'Name: ' + name + '\n' +
            'Email: ' + email + '\n' +
            'Phone: ' + phone + '\n' +
            'Event Type: ' + eventType + '\n' +
            'Service: ' + service + '\n' +
            'Budget: ' + budget + '\n' +
            'Event Date: ' + date + '\n\n' +
            'Brief:\n' + message
          );
'@
$c = $c.Replace($mailtoBodyOld, $mailtoBodyNew)

# Cleanup duplicate injections from prior runs
$c = [regex]::Replace($c, '(?s)(\s*<div class="hero-trust">\s*<span>Dedicated event lead</span>\s*<span>Fast proposal turnaround</span>\s*<span>Mobile-first guest journey</span>\s*</div>)\s*\1', '$1')
$c = [regex]::Replace($c, '(?s)(\s*\.hero-trust \{[^\n]+\}\r?\n\s*\.hero-trust span \{[^\n]+\}\r?\n\s*\.cta-band \{[^\n]+\}\r?\n\s*\.cta-band-wrap \{[^\n]+\}\r?\n\s*\.faq-grid \{[^\n]+\}\r?\n\s*\.assist \{[^\n]+\})\s*\1', '$1')
$c = [regex]::Replace($c, '(?s)\s*<div class="field">\s*<label for="budget">Estimated Budget Range</label>\s*<select id="budget" name="budget">\s*<option value="">Select range</option>\s*<option>Below â‚¦2M</option>\s*<option>â‚¦2M - â‚¦5M</option>\s*<option>â‚¦5M - â‚¦10M</option>\s*<option>â‚¦10M - â‚¦25M</option>\s*<option>â‚¦25M\+</option>\s*</select>\s*</div>', '')
$badBudgetBlock = @'
            <div class="field">
              <label for="budget">Estimated Budget Range</label>
              <select id="budget" name="budget">
                <option value="">Select range</option>
                <option>Below â‚¦2M</option>
                <option>â‚¦2M - â‚¦5M</option>
                <option>â‚¦5M - â‚¦10M</option>
                <option>â‚¦10M - â‚¦25M</option>
                <option>â‚¦25M+</option>
              </select>
            </div>
'@
$c = $c.Replace($badBudgetBlock, '')
$c = [regex]::Replace(
  $c,
  '(?s)<div class="field">\s*<label for="budget">Estimated Budget Range</label>\s*<select id="budget" name="budget">.*?</select>\s*</div>\s*(?=<div class="field">\s*<label for="budget">Estimated Budget Range</label>)',
  ''
)
$c = [regex]::Replace($c, "(?s)(var budget = document\.getElementById\('budget'\) && document\.getElementById\('budget'\)\.value \|\| '';\s*)var phone = document\.getElementById\('phone'\) && document\.getElementById\('phone'\)\.value \|\| '';\s*var eventType = document\.getElementById\('eventType'\) && document\.getElementById\('eventType'\)\.value \|\| '';\s*var budget = document\.getElementById\('budget'\) && document\.getElementById\('budget'\)\.value \|\| '';\s*", '$1')
$c = [regex]::Replace($c, "(\.faq-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}\r?\n\s*\.cta-band-wrap \{ grid-template-columns: 1fr auto; align-items: center; \}\r?\n)\s*\.faq-grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\); \}\s*", '$1')

Set-Content -LiteralPath $path -Value $c -Encoding UTF8
Write-Host 'Conversion pass applied.'
