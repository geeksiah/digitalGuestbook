import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../../db.js";
import { Prisma } from "@prisma/client";
import { config } from "../../config.js";

const router = Router();

function writeTemplateHtml(dir: string, html: string) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), html, "utf8");
}

router.post("/v1/admin/dev/seed-sample", async (_req, res) => {
  // Create sample templates
  const invitationT = await prisma.template.create({ data: { name: "Sample Invitation", type: "INVITATION", storagePath: "" } });
  const rsvpT = await prisma.template.create({ data: { name: "Sample RSVP", type: "RSVP", storagePath: "" } });
  const guestbookT = await prisma.template.create({ data: { name: "Sample Guestbook", type: "GUESTBOOK", storagePath: "" } });
  const thanksT = await prisma.template.create({ data: { name: "Sample Thank You", type: "THANK_YOU", storagePath: "" } });

  const invDir = path.join(config.templateStorageDir, invitationT.id);
  const rsvpDir = path.join(config.templateStorageDir, rsvpT.id);
  const gbDir = path.join(config.templateStorageDir, guestbookT.id);
  const tyDir = path.join(config.templateStorageDir, thanksT.id);

  writeTemplateHtml(invDir, `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>{{event.name}}</title>
<style>body{font-family:system-ui;padding:16px}a.button{display:inline-block;padding:12px 16px;border:1px solid #333;border-radius:8px;text-decoration:none;margin-right:8px}</style>
</head><body>
<h1>{{event.name}}</h1>
<p>Date: {{event.dateTimeISO}}</p>
{{#ctas.rsvpUrl}}<a class="button" href="{{ctas.rsvpUrl}}">RSVP</a>{{/ctas.rsvpUrl}}
{{#ctas.guestbookUrl}}<a class="button" href="{{ctas.guestbookUrl}}">Guestbook</a>{{/ctas.guestbookUrl}}
{{#ctas.thankYouUrl}}<a class="button" href="{{ctas.thankYouUrl}}">Thank You</a>{{/ctas.thankYouUrl}}
</body></html>`);

  writeTemplateHtml(rsvpDir, `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>RSVP — {{event.name}}</title>
<style>body{font-family:system-ui;padding:16px}input,select,textarea,button{font-size:18px;padding:10px;width:100%;box-sizing:border-box;margin:6px 0}</style>
</head><body>
<h1>RSVP — {{event.name}}</h1>
<form method="post" action="/v1/events/{{event.slug}}/rsvp">
  <label>Name(s)<input name="partyName" required/></label>
  <label>Attendance
    <select name="response">
      <option value="YES">Yes</option>
      <option value="NO">No</option>
      <option value="MAYBE">Maybe</option>
    </select>
  </label>
  <label>Guest count<input type="number" name="guestCount" min="1"/></label>
  <label>Meal preference<input name="mealPreference"/></label>
  <label>Note<textarea name="note"></textarea></label>
  <button type="submit">Submit</button>
</form>
</body></html>`);

  writeTemplateHtml(gbDir, `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Guestbook — {{event.name}}</title>
<style>body{font-family:system-ui;padding:16px}input,button,select{font-size:18px;padding:10px;width:100%;box-sizing:border-box;margin:6px 0}.card{border:1px solid #ddd;border-radius:10px;padding:12px}</style>
</head><body>
<h1>Guestbook — {{event.name}}</h1>
<div class="card">
  <label>Mode</label>
  <select id="mode">
    <option value="VIDEO">Video</option>
    <option value="AUDIO">Audio</option>
    <option value="PHOTO">Photo</option>
  </select>
  <label>Capture</label>
  <input id="file" type="file" accept="video/*,audio/*,image/*" capture />
  <button id="upload">Upload</button>
  <div id="status"></div>
</div>
<script>
  const slug = {{&quot;{{event.slug}}&quot;}};
  async function uploadFile(){
    const status=document.getElementById("status");
    const file=document.getElementById("file").files[0];
    const mode=document.getElementById("mode").value;
    if(!file){status.textContent="Please capture or choose a file.";status.style.color="crimson";return;}
    status.textContent="Preparing...";
    const initRes=await fetch("/v1/media/upload-init",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({eventSlug: slug, type: mode, source:"PERSONAL"})});
    const init=await initRes.json();
    if(!initRes.ok){status.textContent=init.error||"Error";status.style.color="crimson";return;}
    const form=new FormData();form.append("file",file);
    status.textContent="Uploading...";
    const upRes=await fetch(init.uploadUrl,{method:"POST",body:form});
    const up=await upRes.json();
    if(!upRes.ok){status.textContent=up.error||"Upload failed";status.style.color="crimson";return;}
    status.textContent="Uploaded. Thank you!";status.style.color="green";document.getElementById("file").value="";
  }
  document.getElementById("upload").onclick=uploadFile;
</script>
</body></html>`);

  writeTemplateHtml(tyDir, `<!doctype html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Thank You — {{event.name}}</title>
<style>body{font-family:system-ui;padding:16px;text-align:center}</style>
</head><body>
<h1>Thank You!</h1>
<p>Your presence made {{event.name}} special.</p>
</body></html>`);

  await prisma.template.update({ where: { id: invitationT.id }, data: { storagePath: invitationT.id } });
  await prisma.template.update({ where: { id: rsvpT.id }, data: { storagePath: rsvpT.id } });
  await prisma.template.update({ where: { id: guestbookT.id }, data: { storagePath: guestbookT.id } });
  await prisma.template.update({ where: { id: thanksT.id }, data: { storagePath: thanksT.id } });

  // Create sample event
  const now = new Date();
  const event = await prisma.event.create({
    data: {
      slug: "demo",
      name: "Demo Wedding",
      dateTime: now,
      timezone: "UTC",
      invitationOnly: true,
      featureInvitationWebsite: true,
      featureRsvp: true,
      featureGuestbook: true,
      manualPhaseOverride: "PRE_EVENT"
    }
  });

  // Assign templates
  await prisma.templateAssignment.create({ data: { eventId: event.id, templateId: invitationT.id, templateType: "INVITATION" } });
  await prisma.templateAssignment.create({ data: { eventId: event.id, templateId: rsvpT.id, templateType: "RSVP" } });
  await prisma.templateAssignment.create({ data: { eventId: event.id, templateId: guestbookT.id, templateType: "GUESTBOOK" } });
  await prisma.templateAssignment.create({ data: { eventId: event.id, templateId: thanksT.id, templateType: "THANK_YOU" } });

  res.json({
    ok: true,
    event: { id: event.id, slug: event.slug, coupleAccessKey: event.coupleAccessKey },
    pages: {
      invitation: `/e/${event.slug}`,
      rsvp: `/e/${event.slug}/rsvp`,
      guestbook: `/e/${event.slug}/guestbook`,
      thanks: `/e/${event.slug}/thanks`
    }
  });
});

export default router;


