import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin
  const adminPassword = await bcrypt.hash(
    process.env.ADMIN_PASSWORD || 'admin123',
    12
  );

  const admin = await prisma.admin.upsert({
    where: { email: process.env.ADMIN_EMAIL || 'admin@example.com' },
    update: {},
    create: {
      email: process.env.ADMIN_EMAIL || 'admin@example.com',
      passwordHash: adminPassword,
      name: process.env.ADMIN_NAME || 'Platform Admin',
      role: 'superadmin',
    },
  });

  console.log(`✅ Admin created: ${admin.email}`);

  // Create default templates
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
  font-size: 0.9rem;
  letter-spacing: 2px;
  font-weight: bold;
  transition: all 0.3s ease;
}
.cta-button:hover {
  background: #1a1a2e;
  color: #d4af37;
}`,
    },
  });

  const rsvpTemplate = await prisma.template.upsert({
    where: { id: 'default-rsvp' },
    update: {},
    create: {
      id: 'default-rsvp',
      name: 'Classic RSVP Form',
      description: 'A clean, easy-to-use RSVP form',
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
    <form id="rsvp-form">
      <div class="form-group">
        <label for="primaryName">Your Name *</label>
        <input type="text" id="primaryName" name="primaryName" required>
      </div>
      <div class="form-group">
        <label for="secondaryName">Guest Name (if applicable)</label>
        <input type="text" id="secondaryName" name="secondaryName">
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email">
      </div>
      <div class="form-group">
        <label>Will you attend? *</label>
        <div class="radio-group">
          <label><input type="radio" name="attendance" value="YES" required> Yes, I'll be there!</label>
          <label><input type="radio" name="attendance" value="NO"> Sorry, can't make it</label>
          <label><input type="radio" name="attendance" value="MAYBE"> Maybe</label>
        </div>
      </div>
      <div class="form-group">
        <label for="guestCount">Number of Guests</label>
        <select id="guestCount" name="guestCount">
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
      </div>
      <div class="form-group">
        <label for="note">Message for the couple</label>
        <textarea id="note" name="note" rows="3"></textarea>
      </div>
      <button type="submit">Submit RSVP</button>
    </form>
  </div>
</body>
</html>`,
      cssContent: `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', sans-serif;
  background: #f8f9fa;
  min-height: 100vh;
  padding: 40px 20px;
}
.rsvp-container {
  max-width: 500px;
  margin: 0 auto;
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}
h1 {
  font-size: 0.8rem;
  letter-spacing: 3px;
  color: #d4af37;
  text-transform: uppercase;
  margin-bottom: 10px;
}
h2 {
  font-size: 1.8rem;
  color: #1a1a2e;
  margin-bottom: 30px;
}
.form-group {
  margin-bottom: 20px;
}
label {
  display: block;
  margin-bottom: 8px;
  color: #2d3436;
  font-weight: 500;
}
input[type="text"],
input[type="email"],
select,
textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}
.radio-group label {
  display: block;
  font-weight: normal;
  margin-bottom: 8px;
}
button {
  width: 100%;
  background: #d4af37;
  color: #1a1a2e;
  border: none;
  padding: 15px;
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.3s;
}
button:hover {
  background: #1a1a2e;
  color: #d4af37;
}`,
    },
  });

  const guestbookTemplate = await prisma.template.upsert({
    where: { id: 'default-guestbook' },
    update: {},
    create: {
      id: 'default-guestbook',
      name: 'Modern Guestbook',
      description: 'A modern guestbook with video/audio recording',
      type: 'GUESTBOOK',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Guestbook - {{event.name}}</title>
</head>
<body>
  <div class="guestbook-container">
    <h1>Leave a Message</h1>
    <h2>{{event.name}}</h2>
    <div class="message-options">
      <button class="option-btn" data-type="video">📹 Video Message</button>
      <button class="option-btn" data-type="audio">🎤 Audio Message</button>
      <button class="option-btn" data-type="photo">📷 Upload Photo</button>
    </div>
    <div id="recorder-container"></div>
  </div>
</body>
</html>`,
      cssContent: `
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}
.guestbook-container {
  background: white;
  max-width: 500px;
  width: 100%;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
}
h1 {
  font-size: 0.8rem;
  letter-spacing: 3px;
  color: #d4af37;
  text-transform: uppercase;
  margin-bottom: 10px;
}
h2 {
  font-size: 1.8rem;
  color: #1a1a2e;
  margin-bottom: 30px;
}
.message-options {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.option-btn {
  padding: 20px;
  font-size: 1.1rem;
  background: #f8f9fa;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
}
.option-btn:hover {
  background: #d4af37;
  border-color: #d4af37;
  color: white;
}`,
    },
  });

  const thankYouTemplate = await prisma.template.upsert({
    where: { id: 'default-thankyou' },
    update: {},
    create: {
      id: 'default-thankyou',
      name: 'Elegant Thank You',
      description: 'A heartfelt thank-you page',
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
    <h1>Thank You</h1>
    <h2>For Being Part of Our Special Day</h2>
    <p>We are deeply grateful for your presence, your love, and your support.</p>
    <p class="signature">With love,<br>The Happy Couple</p>
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
.thankyou-container {
  background: #fefefe;
  max-width: 600px;
  padding: 80px 60px;
  text-align: center;
}
h1 {
  font-size: 0.9rem;
  letter-spacing: 4px;
  color: #d4af37;
  text-transform: uppercase;
  margin-bottom: 20px;
}
h2 {
  font-size: 2.2rem;
  color: #1a1a2e;
  margin-bottom: 30px;
}
p {
  font-size: 1.1rem;
  color: #636e72;
  line-height: 1.8;
  margin-bottom: 20px;
}
.signature {
  font-style: italic;
  color: #2d3436;
  margin-top: 40px;
}`,
    },
  });

  console.log('✅ Default templates created');

  // Create sample event
  const sampleEvent = await prisma.event.upsert({
    where: { slug: 'sample-wedding' },
    update: {},
    create: {
      slug: 'sample-wedding',
      name: 'Sarah & Michael\'s Wedding',
      description: 'Join us as we celebrate our love and begin our journey together.',
      date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      timezone: 'America/New_York',
      venue: 'The Grand Ballroom, 123 Wedding Lane',
      invitationOnly: true,
      invitationEnabled: true,
      rsvpEnabled: true,
      guestbookEnabled: true,
      checkInEnabled: true,
      invitationTemplateId: invitationTemplate.id,
      rsvpTemplateId: rsvpTemplate.id,
      guestbookTemplateId: guestbookTemplate.id,
      thankYouTemplateId: thankYouTemplate.id,
    },
  });

  console.log(`✅ Sample event created: ${sampleEvent.name}`);
  console.log(`   Couple Portal URL: /couple/${sampleEvent.coupleAccessToken}`);

  console.log('\n🎉 Seeding complete!');
  console.log('\n📋 Login credentials:');
  console.log(`   Email: ${admin.email}`);
  console.log(`   Password: ${process.env.ADMIN_PASSWORD || 'admin123'}`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
