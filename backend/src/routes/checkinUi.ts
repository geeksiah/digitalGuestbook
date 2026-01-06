import { Router } from "express";

const router = Router();

router.get("/checkin/:eventSlug", (_req, res) => {
  const slug = _req.params.eventSlug;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Check-In — ${slug}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 2rem; }
    .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    h1 { margin-bottom: 1.5rem; color: #333; text-align: center; }
    .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    .tab { flex: 1; padding: 1rem; border: 2px solid #ddd; border-radius: 8px; background: white; cursor: pointer; text-align: center; }
    .tab.active { border-color: #007bff; background: #e7f3ff; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: #555; }
    input { width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1.25rem; text-align: center; letter-spacing: 0.5rem; }
    button { width: 100%; padding: 1rem; border: none; border-radius: 4px; font-size: 1.25rem; cursor: pointer; margin-top: 1rem; }
    .btn-primary { background: #007bff; color: white; }
    .btn-success { background: #28a745; color: white; }
    button:hover { opacity: 0.9; }
    button:disabled { background: #ccc; cursor: not-allowed; }
    .result { margin-top: 1rem; padding: 1rem; border-radius: 4px; text-align: center; font-weight: 600; font-size: 1.1rem; }
    .result.success { background: #d4edda; color: #155724; }
    .result.error { background: #f8d7da; color: #721c24; }
    .result.warning { background: #fff3cd; color: #856404; }
    #video { width: 100%; border-radius: 8px; margin: 1rem 0; }
    #deviceKey { font-size: 1rem; letter-spacing: normal; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Event Check-In</h1>
    <label>Device Key</label>
    <input type="text" id="deviceKey" placeholder="Enter device API key" />
    
    <div class="tabs">
      <div class="tab active" onclick="showTab('code')">Code Entry</div>
      <div class="tab" onclick="showTab('qr')">QR Scan</div>
    </div>
    
    <div id="code" class="tab-content active">
      <label>6-Digit Code</label>
      <input type="text" id="codeInput" inputmode="numeric" placeholder="000000" maxlength="6" pattern="[0-9]{6}" />
      <button class="btn-primary" onclick="checkInCode()">Check In</button>
    </div>
    
    <div id="qr" class="tab-content">
      <video id="video" autoplay playsinline></video>
      <button class="btn-success" onclick="startQRScan()">Start Camera</button>
      <button class="btn-primary" onclick="stopQRScan()" style="display: none;" id="stopBtn">Stop Camera</button>
    </div>
    
    <div id="status" class="result" style="display: none;"></div>
  </div>
  
  <script>
    const slug = ${JSON.stringify(slug)};
    let stream = null;
    let qrWorker = null;
    
    function showTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      event.target.classList.add('active');
      document.getElementById(tab).classList.add('active');
      if (tab === 'qr') {
        startQRScan();
      } else {
        stopQRScan();
      }
    }
    
    async function checkInCode() {
      const code = document.getElementById('codeInput').value.trim();
      const key = document.getElementById('deviceKey').value.trim();
      const statusEl = document.getElementById('status');
      
      if (!key) {
        statusEl.textContent = 'Please enter device key';
        statusEl.className = 'result error';
        statusEl.style.display = 'block';
        return;
      }
      
      if (code.length !== 6) {
        statusEl.textContent = 'Please enter 6-digit code';
        statusEl.className = 'result error';
        statusEl.style.display = 'block';
        return;
      }
      
      statusEl.textContent = 'Checking...';
      statusEl.className = 'result';
      statusEl.style.display = 'block';
      
      try {
        const res = await fetch('/v1/checkin/code', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-key': key
          },
          body: JSON.stringify({ code, eventSlug: slug })
        });
        const data = await res.json();
        
        if (!res.ok) {
          statusEl.textContent = data.error || 'Error';
          statusEl.className = 'result error';
        } else {
          if (data.result === 'SUCCESS') {
            statusEl.textContent = '✓ Checked in successfully!' + (data.partyName ? ' — ' + data.partyName : '');
            statusEl.className = 'result success';
            document.getElementById('codeInput').value = '';
          } else if (data.result === 'DUPLICATE') {
            statusEl.textContent = 'Already checked in' + (data.partyName ? ' — ' + data.partyName : '');
            statusEl.className = 'result warning';
          } else {
            statusEl.textContent = data.result;
            statusEl.className = 'result error';
          }
        }
      } catch (e) {
        statusEl.textContent = 'Network error';
        statusEl.className = 'result error';
      }
    }
    
    document.getElementById('codeInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') checkInCode();
    });
    
    async function startQRScan() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = document.getElementById('video');
        video.srcObject = stream;
        document.getElementById('stopBtn').style.display = 'block';
        
        // Simple QR detection (would need a library like jsQR in production)
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const checkQR = () => {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            // QR detection would go here
          }
          requestAnimationFrame(checkQR);
        };
        checkQR();
      } catch (err) {
        alert('Error accessing camera: ' + err.message);
      }
    }
    
    function stopQRScan() {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
      }
      document.getElementById('video').srcObject = null;
      document.getElementById('stopBtn').style.display = 'none';
    }
  </script>
</body>
</html>`);
});

export default router;


