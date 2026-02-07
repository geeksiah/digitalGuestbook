// DROP-IN REPLACEMENT for backend/prisma/seed.ts
// ⭐ SECURED: No automatic admin creation, create manually in Supabase

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');
  console.log('');
  console.log('⚠️  NOTE: This seed file does NOT create admin accounts.');
  console.log('📝 Create your admin account manually in Supabase:');
  console.log('');
  console.log('   SQL Command:');
  console.log('   ------------');
  console.log('   INSERT INTO "Admin" (id, email, "passwordHash", name, role, "createdAt", "updatedAt")');
  console.log('   VALUES (');
  console.log('     gen_random_uuid(),');
  console.log('     \'your-email@example.com\',');
  console.log('     \'$2a$12$YOUR_BCRYPT_HASH_HERE\',  -- Use bcrypt to hash your password');
  console.log('     \'Your Name\',');
  console.log('     \'superadmin\',');
  console.log('     NOW(),');
  console.log('     NOW()');
  console.log('   );');
  console.log('');
  console.log('   Generate bcrypt hash:');
  console.log('   ---------------------');
  console.log('   const bcrypt = require(\'bcryptjs\');');
  console.log('   const hash = await bcrypt.hash(\'your-secure-password\', 12);');
  console.log('   console.log(hash);');
  console.log('');

  // Create default templates
  console.log('📄 Creating default templates...');

  // ============================================
  // INVITATION TEMPLATE
  // ============================================
  const invitationTemplate = await prisma.template.upsert({
    where: { id: 'default-invitation' },
    update: {},
    create: {
      id: 'default-invitation',
      name: 'Elegant Invitation',
      description: 'A beautiful, elegant invitation template',
      type: 'INVITATION',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{event.name}} - You're Invited</title>
</head>
<body>
  <div class="invitation-container">
    <header>
      <h1>You're Invited</h1>
      <h2>{{event.name}}</h2>
    </header>
    <main>
      <p class="date">{{event.formattedDate}}</p>
      <p class="venue">{{event.venue}}</p>
      <p class="description">{{event.description}}</p>
    </main>
    <footer>
      <a href="{{urls.rsvp}}" class="cta-button">RSVP Now</a>
    </footer>
  </div>
</body>
</html>`,
      cssContent: `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Georgia', serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}
.invitation-container {
  background: #fefefe;
  max-width: 600px;
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 25px 50px rgba(0,0,0,0.3);
}
h1 {
  font-size: 1rem;
  letter-spacing: 4px;
  color: #d4af37;
  text-transform: uppercase;
  margin-bottom: 20px;
}
h2 {
  font-size: 2.5rem;
  color: #1a1a2e;
  margin-bottom: 30px;
}
.date {
  font-size: 1.2rem;
  color: #636e72;
  margin-bottom: 10px;
}
.venue {
  font-size: 1rem;
  color: #b2bec3;
  margin-bottom: 30px;
}
.description {
  font-size: 1rem;
  color: #2d3436;
  line-height: 1.8;
  margin-bottom: 40px;
}
.cta-button {
  display: inline-block;
  background: #d4af37;
  color: #1a1a2e;
  text-decoration: none;
  padding: 15px 40px;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  transition: all 0.3s;
}
.cta-button:hover {
  background: #1a1a2e;
  color: #d4af37;
}
      `,
    },
  });
  console.log(`✅ Created: ${invitationTemplate.name}`);

  // ============================================
  // ⭐ LIVE_LANDING TEMPLATE (NEW)
  // ============================================
  const liveLandingTemplate = await prisma.template.upsert({
    where: { id: 'default-live-landing' },
    update: {},
    create: {
      id: 'default-live-landing',
      name: 'Default Live Landing',
      description: 'Default landing page for live events',
      type: 'LIVE_LANDING',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{event.name}} - Live Event</title>
</head>
<body>
  <div class="container">
    <div class="live-badge">
      <span class="live-dot"></span>
      Event is Live
    </div>
    <h1>{{event.name}}</h1>
    <p class="description">{{event.description}}</p>
    <div class="event-details">
      <span>{{event.formattedDate}}</span>
      <span class="dot"></span>
      <span>{{event.venue}}</span>
    </div>
    <div class="actions">
      <a href="{{urls.guestbook}}" class="action-card">
        <span class="icon">💬</span>
        <h3>Leave a Message</h3>
        <p>Record a video or audio message, or upload photos</p>
        <span class="cta">Get Started <span class="arrow">→</span></span>
      </a>
      <a href="{{urls.booth}}" class="action-card">
        <span class="icon">📸</span>
        <h3>Photo Booth</h3>
        <p>Capture fun moments at our interactive photo booth</p>
        <span class="cta">Take Photos <span class="arrow">→</span></span>
      </a>
    </div>
  </div>
</body>
</html>`,
      cssContent: `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #ffffff;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.container {
  max-width: 1200px;
  width: 100%;
  text-align: center;
}
.live-badge {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  padding: 10px 24px;
  border-radius: 100px;
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 40px;
}
.live-dot {
  width: 10px;
  height: 10px;
  background: #22c55e;
  border-radius: 50%;
  animation: pulse 2s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
h1 {
  font-size: clamp(40px, 8vw, 72px);
  font-weight: 900;
  margin-bottom: 24px;
}
.description {
  font-size: clamp(18px, 3vw, 22px);
  margin-bottom: 20px;
}
.event-details {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 60px;
}
.dot {
  width: 5px;
  height: 5px;
  background: rgba(255, 255, 255, 0.4);
  border-radius: 50%;
}
.actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 28px;
  max-width: 1000px;
  margin: 0 auto;
}
.action-card {
  background: rgba(255, 255, 255, 0.06);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 28px;
  padding: 48px 36px;
  text-decoration: none;
  color: inherit;
  transition: all 0.4s;
}
.action-card:hover {
  transform: translateY(-12px);
  border-color: rgba(255, 215, 0, 0.6);
}
.icon {
  font-size: 56px;
  margin-bottom: 24px;
}
.action-card h3 {
  font-size: 26px;
  margin-bottom: 14px;
}
.action-card p {
  margin-bottom: 24px;
  opacity: 0.7;
}
.cta {
  color: #ffd700;
  font-weight: 700;
}
      `,
    },
  });
  console.log(`✅ Created: ${liveLandingTemplate.name} ⭐ NEW`);

  // ============================================
  // ⭐ EVENT_ENDED TEMPLATE (NEW)
  // ============================================
  const eventEndedTemplate = await prisma.template.upsert({
    where: { id: 'default-event-ended' },
    update: {},
    create: {
      id: 'default-event-ended',
      name: 'Default Event Ended',
      description: 'Default page shown after event ends',
      type: 'EVENT_ENDED',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{event.name}} - Thank You</title>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="emoji">🎉</div>
      <h1>Thank You!</h1>
      <p class="subtitle">For being part of our special day</p>
      <div class="divider"></div>
      <div class="event-details">
        <p class="event-name">{{event.name}}</p>
        <p>{{event.formattedDate}}</p>
      </div>
      <div class="message-box">
        <p>Your presence made this celebration truly <span class="highlight">unforgettable</span>.</p>
      </div>
    </div>
  </div>
</body>
</html>`,
      cssContent: `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: #ffffff;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.container {
  max-width: 900px;
  width: 100%;
  text-align: center;
}
.card {
  background: rgba(255, 255, 255, 0.06);
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 40px;
  padding: clamp(60px, 10vw, 100px);
}
.emoji {
  font-size: clamp(70px, 12vw, 100px);
  margin-bottom: 36px;
  animation: float 4s infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}
h1 {
  font-size: clamp(42px, 8vw, 64px);
  font-weight: 900;
  margin-bottom: 24px;
}
.subtitle {
  font-size: clamp(22px, 4vw, 32px);
  margin-bottom: 40px;
}
.divider {
  width: 100px;
  height: 5px;
  background: linear-gradient(90deg, transparent, #ffd700, transparent);
  margin: 40px auto;
  border-radius: 10px;
}
.event-name {
  font-weight: 700;
  margin-bottom: 12px;
}
.message-box {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 32px;
  margin-top: 40px;
}
.highlight {
  color: #ffd700;
}
      `,
    },
  });
  console.log(`✅ Created: ${eventEndedTemplate.name} ⭐ NEW`);

  // ============================================
  // RSVP TEMPLATE
  // ============================================
  const rsvpTemplate = await prisma.template.upsert({
    where: { id: 'default-rsvp' },
    update: {},
    create: {
      id: 'default-rsvp',
      name: 'Modern RSVP Form',
      description: 'Clean, modern RSVP form',
      type: 'RSVP',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RSVP - {{event.name}}</title>
</head>
<body>
  <div class="rsvp-container">
    <h1>RSVP</h1>
    <h2>{{event.name}}</h2>
    <form id="rsvpForm">
      <input type="text" name="primaryName" placeholder="Your Name *" required>
      <input type="email" name="email" placeholder="Email Address">
      <select name="attendance" required>
        <option value="">Will you attend? *</option>
        <option value="YES">Yes, I'll be there!</option>
        <option value="NO">Sorry, can't make it</option>
        <option value="MAYBE">Maybe</option>
      </select>
      <input type="number" name="guestCount" placeholder="Number of guests" min="1" value="1">
      <textarea name="note" placeholder="Message to the couple (optional)" rows="4"></textarea>
      <button type="submit">Submit RSVP</button>
    </form>
  </div>
</body>
</html>`,
      cssContent: `
body {
  font-family: -apple-system, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-center;
  padding: 20px;
}
.rsvp-container {
  background: white;
  max-width: 500px;
  width: 100%;
  padding: 40px;
  border-radius: 20px;
  box-shadow: 0 25px 50px rgba(0,0,0,0.3);
}
h1 {
  color: #d4af37;
  font-size: 1.5rem;
  text-align: center;
  margin-bottom: 10px;
}
h2 {
  color: #1a1a2e;
  font-size: 2rem;
  text-align: center;
  margin-bottom: 30px;
}
form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
input, select, textarea {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  font-size: 1rem;
}
input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: #d4af37;
}
button {
  background: #d4af37;
  color: #1a1a2e;
  padding: 15px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
}
button:hover {
  background: #1a1a2e;
  color: #d4af37;
}
      `,
    },
  });
  console.log(`✅ Created: ${rsvpTemplate.name}`);

  // ============================================
  // THANK_YOU TEMPLATE
  // ============================================
  const thankYouTemplate = await prisma.template.upsert({
    where: { id: 'default-thankyou' },
    update: {},
    create: {
      id: 'default-thankyou',
      name: 'Simple Thank You',
      description: 'Simple thank you page after RSVP submission',
      type: 'THANK_YOU',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You - {{event.name}}</title>
</head>
<body>
  <div class="thankyou-container">
    <div class="icon">✓</div>
    <h1>Thank You!</h1>
    <p>Your RSVP has been received for</p>
    <h2>{{event.name}}</h2>
    <p class="date">{{event.formattedDate}}</p>
  </div>
</body>
</html>`,
      cssContent: `
body {
  font-family: -apple-system, sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: white;
}
.thankyou-container {
  text-align: center;
  max-width: 600px;
}
.icon {
  width: 100px;
  height: 100px;
  margin: 0 auto 30px;
  background: #22c55e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 50px;
  color: white;
}
h1 {
  font-size: 3rem;
  margin-bottom: 20px;
}
p {
  font-size: 1.2rem;
  opacity: 0.9;
  margin-bottom: 10px;
}
h2 {
  font-size: 2rem;
  color: #d4af37;
  margin: 20px 0;
}
.date {
  font-size: 1.1rem;
  opacity: 0.8;
}
      `,
    },
  });
  console.log(`✅ Created: ${thankYouTemplate.name}`);

  console.log('');
  console.log('✨ Database seeded successfully!');
  console.log('');
  console.log('⚠️  IMPORTANT: Remember to create your admin account manually in Supabase!');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
