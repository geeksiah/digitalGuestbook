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
      name: 'Ticket Checkout Flow',
      description: 'Mobile-first RSVP and ticket checkout layout',
      type: 'RSVP',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tickets - {{event.name}}</title>
</head>
<body>
  <div class="shell">
    <header class="hero">
      <p class="eyebrow">Event Tickets</p>
      <h1>{{event.name}}</h1>
      <p class="meta">{{event.formattedDate}}</p>
    </header>

    <section class="card">
      <h2>Choose Tickets</h2>
      <div class="ticket-row">
        <div>
          <p class="ticket-name">General Admission</p>
          <p class="ticket-price">$100 / ticket</p>
        </div>
        <select class="qty" data-price="100"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select>
      </div>
      <div class="ticket-row">
        <div>
          <p class="ticket-name">VIP</p>
          <p class="ticket-price">$150 / ticket</p>
        </div>
        <select class="qty" data-price="150"><option>0</option><option>1</option><option>2</option><option>3</option><option>4</option></select>
      </div>
    </section>

    <section class="card">
      <h2>Contact Information</h2>
      <div class="field"><label>First Name</label><input type="text" placeholder="Alex" /></div>
      <div class="field"><label>Last Name</label><input type="text" placeholder="Hugo" /></div>
      <div class="field"><label>Email Address</label><input type="email" placeholder="you@example.com" /></div>
    </section>

    <section class="card">
      <div class="summary">
        <div>
          <p class="total-label">Total</p>
          <p class="total-amount" id="totalAmount">$0.00</p>
        </div>
        <button class="cta" type="button">Continue</button>
      </div>
      <p class="hint">Assign another RSVP/Ticket template anytime from the event templates panel.</p>
    </section>
  </div>
</body>
</html>`,
      cssContent: `
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'Inter', -apple-system, sans-serif;
  background: linear-gradient(180deg, #ecf7f2 0%, #d9efe6 100%);
  min-height: 100vh;
  padding: 20px 14px 28px;
  color: #06362f;
}
.shell {
  max-width: 430px;
  margin: 0 auto;
}
.hero {
  padding: 4px 6px 12px;
}
.eyebrow {
  margin: 0 0 6px;
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #2f7d67;
  font-weight: 700;
}
.hero h1 {
  margin: 0;
  font-size: 24px;
  line-height: 1.2;
}
.meta {
  margin: 8px 0 0;
  color: #437a69;
  font-size: 13px;
}
.card {
  background: #ffffff;
  border: 1px solid #d6e8df;
  border-radius: 22px;
  padding: 16px;
  margin-top: 12px;
  box-shadow: 0 8px 20px rgba(6, 54, 47, 0.06);
}
.card h2 {
  margin: 0 0 14px;
  font-size: 18px;
}
.ticket-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #edf4f0;
}
.ticket-row:last-child {
  border-bottom: none;
}
.ticket-name {
  margin: 0;
  font-weight: 700;
}
.ticket-price {
  margin: 4px 0 0;
  font-size: 13px;
  color: #5d7b71;
}
.qty {
  min-width: 64px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid #cde2d8;
  background: #f9fdfb;
}
.field {
  margin-bottom: 10px;
}
.field:last-child {
  margin-bottom: 0;
}
label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #578272;
}
input {
  width: 100%;
  border: 1px solid #cfe3d9;
  border-radius: 12px;
  padding: 11px 12px;
}
.summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.total-label {
  margin: 0;
  font-size: 12px;
  color: #608478;
}
.total-amount {
  margin: 4px 0 0;
  font-size: 24px;
  font-weight: 800;
  color: #0a5d4c;
}
.cta {
  min-width: 132px;
  background: #0d7a6a;
  color: #fff;
  padding: 12px 18px;
  border: none;
  border-radius: 999px;
  font-weight: 700;
  cursor: pointer;
}
.hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: #5d7b71;
}
      `,
      jsContent: `
const selects = Array.from(document.querySelectorAll('.qty'));
const totalEl = document.getElementById('totalAmount');
const format = (value) => '$' + value.toFixed(2);
const recalc = () => {
  const total = selects.reduce((sum, select) => {
    const price = Number(select.dataset.price || 0);
    const qty = Number(select.value || 0);
    return sum + (price * qty);
  }, 0);
  if (totalEl) totalEl.textContent = format(total);
};
selects.forEach((select) => select.addEventListener('change', recalc));
recalc();
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

  // ============================================
  // GIFTING TEMPLATE
  // ============================================
  const giftingTemplate = await prisma.template.upsert({
    where: { id: 'default-gifting' },
    update: {},
    create: {
      id: 'default-gifting',
      name: 'Modern Gifting Catalog',
      description: 'Card-based gifting storefront with EventPeepo palette',
      type: 'GIFTING',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gift {{event.name}}</title>
</head>
<body>
  <main class="phone">
    <header>
      <p class="label">Category</p>
      <div class="chips">
        <button class="chip active">For You</button>
        <button class="chip">Indoor</button>
        <button class="chip">Outdoor</button>
        <button class="chip">Garden</button>
      </div>
    </header>
    <section class="grid">
      <article class="card"><div class="thumb"></div><h3>Signature Bouquet</h3><p>Elegant celebration package</p><div class="row"><button>Add To Cart</button><strong>$29</strong></div></article>
      <article class="card"><div class="thumb"></div><h3>Luxury Basket</h3><p>Curated premium surprise</p><div class="row"><button>Add To Cart</button><strong>$39</strong></div></article>
    </section>
    <footer class="bottom"><span>Total</span><strong>$68</strong><a href="{{urls.gifting}}">Checkout</a></footer>
  </main>
</body>
</html>`,
      cssContent: `
* { box-sizing: border-box; }
body { margin: 0; font-family: 'Inter', -apple-system, sans-serif; min-height: 100vh; background: linear-gradient(180deg, #e8f6ef 0%, #d3ebdf 100%); color: #083a33; padding: 16px; }
.phone { max-width: 410px; margin: 0 auto; background: #fff; border-radius: 30px; border: 1px solid #d8e9e1; box-shadow: 0 20px 44px rgba(8, 58, 51, 0.12); overflow: hidden; }
header { padding: 16px; }
.label { margin: 0; font-size: 20px; font-weight: 800; }
.chips { margin-top: 12px; display: flex; gap: 8px; overflow-x: auto; }
.chip { border: 1px solid #cfe4d9; background: #fff; border-radius: 12px; padding: 10px 14px; font-weight: 600; color: #567b6f; }
.chip.active { background: #0d7a6a; color: #fff; border-color: #0d7a6a; }
.grid { padding: 0 12px 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.card { border: 1px solid #d7e9e1; border-radius: 16px; background: #f6fcf9; padding: 10px; }
.thumb { height: 100px; border-radius: 10px; background: linear-gradient(135deg, #d8eee4, #edf8f3); margin-bottom: 8px; }
.card h3 { margin: 0; font-size: 15px; }
.card p { margin: 4px 0 10px; color: #5f8378; font-size: 12px; }
.row { display: flex; justify-content: space-between; align-items: center; }
.row button { border: none; border-radius: 999px; padding: 8px 12px; background: #0d7a6a; color: #fff; font-size: 12px; font-weight: 700; }
.row strong { font-size: 17px; color: #0a5d4c; }
.bottom { border-top: 1px solid #e5f2eb; padding: 12px 14px; display: flex; align-items: center; gap: 10px; }
.bottom span { color: #5f8378; font-size: 13px; }
.bottom strong { margin-right: auto; color: #0a5d4c; }
.bottom a { text-decoration: none; border-radius: 999px; background: #06362f; color: #fff; padding: 10px 18px; font-weight: 700; }
      `,
    },
  });
  console.log(`✅ Created: ${giftingTemplate.name}`);
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
