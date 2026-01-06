import { Router } from "express";
import { requireGuestbookAccess, requireApprovedIfInvitationOnly } from "../middleware/guestGating.js";
import { prisma } from "../db.js";
import { Prisma } from "@prisma/client";
import { renderTemplateFromDir, resolveTemplateDir } from "../utils/templateRenderer.js";

const router = Router();

router.get("/e/:slug/guestbook", requireGuestbookAccess, requireApprovedIfInvitationOnly, async (req, res) => {
  const slug = req.params.slug;
  const event = await prisma.event.findUnique({ where: { slug } });
  if (!event) return res.status(404).send("Not found");
  const assignment = await prisma.templateAssignment.findUnique({
    where: { eventId_templateType: { eventId: event.id, templateType: "GUESTBOOK" } },
    include: { template: true }
  });
  if (assignment) {
    const templateDir = resolveTemplateDir(assignment.template.storagePath);
    const html = renderTemplateFromDir(templateDir, {
      event: {
        id: event.id,
        slug: event.slug,
        name: event.name,
        dateTimeISO: event.dateTime.toISOString(),
        timezone: event.timezone,
        phase: "LIVE",
        features: {
          invitationWebsite: event.featureInvitationWebsite,
          rsvp: event.featureRsvp,
          guestbook: event.featureGuestbook
        }
      },
      ctas: {}
    });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(html);
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Guestbook — ${event.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 2rem; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { margin-bottom: 1.5rem; color: #333; }
    .mode-selector { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    .mode-btn { flex: 1; padding: 1rem; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: center; }
    .mode-btn.active { border-color: #007bff; background: #e7f3ff; }
    .mode-btn:hover { border-color: #007bff; }
    .preview { margin: 1rem 0; text-align: center; }
    .preview video, .preview img { max-width: 100%; border-radius: 8px; }
    .controls { display: flex; gap: 1rem; margin: 1rem 0; }
    button { padding: 0.75rem 1.5rem; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    .btn-primary { background: #007bff; color: white; }
    .btn-danger { background: #dc3545; color: white; }
    .btn-success { background: #28a745; color: white; }
    button:hover { opacity: 0.9; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .message { padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    .message.success { background: #d4edda; color: #155724; }
    .message.error { background: #f8d7da; color: #721c24; }
    .timer { font-size: 1.5rem; text-align: center; margin: 1rem 0; font-weight: bold; }
    input[type="file"] { display: none; }
    .file-label { display: block; padding: 1rem; border: 2px dashed #ddd; border-radius: 8px; text-align: center; cursor: pointer; }
    .file-label:hover { border-color: #007bff; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Leave a Message for ${event.name}</h1>
    <div id="message"></div>
    
    <div class="mode-selector">
      <div class="mode-btn active" data-mode="VIDEO">📹 Video</div>
      <div class="mode-btn" data-mode="AUDIO">🎤 Audio</div>
      <div class="mode-btn" data-mode="PHOTO">📷 Photo</div>
    </div>
    
    <div id="preview" class="preview"></div>
    <div id="timer" class="timer" style="display: none;"></div>
    
    <div class="controls">
      <button id="recordBtn" class="btn-primary" style="display: none;">Start Recording</button>
      <button id="stopBtn" class="btn-danger" style="display: none;">Stop</button>
      <label for="fileInput" class="file-label" id="fileLabel">Choose File</label>
      <input type="file" id="fileInput" accept="video/*,audio/*,image/*" capture>
      <button id="uploadBtn" class="btn-success" style="display: none;">Upload</button>
    </div>
  </div>
  
  <script>
    const slug = ${JSON.stringify(slug)};
    let currentMode = 'VIDEO';
    let mediaRecorder = null;
    let recordedChunks = [];
    let stream = null;
    let timerInterval = null;
    let startTime = null;
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
        resetUI();
      });
    });
    
    function resetUI() {
      document.getElementById('preview').innerHTML = '';
      document.getElementById('timer').style.display = 'none';
      document.getElementById('recordBtn').style.display = currentMode !== 'PHOTO' ? 'block' : 'none';
      document.getElementById('stopBtn').style.display = 'none';
      document.getElementById('uploadBtn').style.display = 'none';
      document.getElementById('fileLabel').style.display = 'block';
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      recordedChunks = [];
    }
    
    document.getElementById('recordBtn').addEventListener('click', async () => {
      try {
        const constraints = currentMode === 'VIDEO' 
          ? { video: true, audio: true }
          : { audio: true };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (currentMode === 'VIDEO') {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.muted = true;
          video.style.width = '100%';
          document.getElementById('preview').innerHTML = '';
          document.getElementById('preview').appendChild(video);
        }
        
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunks, { type: currentMode === 'VIDEO' ? 'video/webm' : 'audio/webm' });
          const url = URL.createObjectURL(blob);
          if (currentMode === 'VIDEO') {
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.style.width = '100%';
            document.getElementById('preview').innerHTML = '';
            document.getElementById('preview').appendChild(video);
          } else {
            const audio = document.createElement('audio');
            audio.src = url;
            audio.controls = true;
            audio.style.width = '100%';
            document.getElementById('preview').innerHTML = '';
            document.getElementById('preview').appendChild(audio);
          }
          document.getElementById('uploadBtn').style.display = 'block';
          document.getElementById('fileInput').files = new FileList();
        };
        
        mediaRecorder.start();
        document.getElementById('recordBtn').style.display = 'none';
        document.getElementById('stopBtn').style.display = 'block';
        startTimer();
      } catch (err) {
        alert('Error accessing camera/microphone: ' + err.message);
      }
    });
    
    document.getElementById('stopBtn').addEventListener('click', () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      document.getElementById('recordBtn').style.display = 'block';
      document.getElementById('stopBtn').style.display = 'none';
      stopTimer();
    });
    
    document.getElementById('fileInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = url;
        document.getElementById('preview').innerHTML = '';
        document.getElementById('preview').appendChild(img);
      } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.style.width = '100%';
        document.getElementById('preview').innerHTML = '';
        document.getElementById('preview').appendChild(video);
      }
      document.getElementById('uploadBtn').style.display = 'block';
    });
    
    document.getElementById('uploadBtn').addEventListener('click', async () => {
      const msg = document.getElementById('message');
      const btn = document.getElementById('uploadBtn');
      btn.disabled = true;
      btn.textContent = 'Uploading...';
      msg.innerHTML = '';
      
      let file;
      if (recordedChunks.length > 0) {
        const blob = new Blob(recordedChunks, { type: currentMode === 'VIDEO' ? 'video/webm' : 'audio/webm' });
        file = new File([blob], 'recording.webm', { type: blob.type });
      } else {
        file = document.getElementById('fileInput').files[0];
      }
      
      if (!file) {
        msg.innerHTML = '<div class="message error">Please record or select a file</div>';
        btn.disabled = false;
        btn.textContent = 'Upload';
        return;
      }
      
      try {
        const initRes = await fetch('/v1/media/upload-init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventSlug: slug, type: currentMode, source: 'PERSONAL' })
        });
        const init = await initRes.json();
        if (!initRes.ok) {
          msg.innerHTML = '<div class="message error">' + (init.error || 'Error') + '</div>';
          btn.disabled = false;
          btn.textContent = 'Upload';
          return;
        }
        
        const form = new FormData();
        form.append('file', file);
        const upRes = await fetch(init.uploadUrl, { method: 'POST', body: form });
        const up = await upRes.json();
        if (!upRes.ok) {
          msg.innerHTML = '<div class="message error">' + (up.error || 'Upload failed') + '</div>';
        } else {
          msg.innerHTML = '<div class="message success">Uploaded successfully! Thank you for your message.</div>';
          resetUI();
        }
      } catch (err) {
        msg.innerHTML = '<div class="message error">Network error. Please try again.</div>';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Upload';
      }
    });
    
    function startTimer() {
      startTime = Date.now();
      timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        document.getElementById('timer').textContent = \`\${mins}:\${String(secs).padStart(2, '0')}\`;
        document.getElementById('timer').style.display = 'block';
        if (elapsed >= 120) {
          document.getElementById('stopBtn').click();
        }
      }, 1000);
    }
    
    function stopTimer() {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      document.getElementById('timer').style.display = 'none';
    }
  </script>
</body>
</html>`);
});

export default router;


