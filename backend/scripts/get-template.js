#!/usr/bin/env node
const https = require('https');
const { URL } = require('url');

function usage() {
  console.error('Usage: node get-template.js <templateId>');
  console.error('Environment variables: EVENT_TOKEN (required), BACKEND_URL (optional, default https://digitalguestbook.onrender.com)');
  process.exit(2);
}

const templateId = process.argv[2];
if (!templateId) usage();

const token = process.env.EVENT_TOKEN;
if (!token) {
  console.error('ERROR: Environment variable EVENT_TOKEN is not set.');
  usage();
}

const backend = process.env.BACKEND_URL || 'https://digitalguestbook.onrender.com';
const endpoint = new URL(`/api/templates/${templateId}`, backend).toString();

const options = {
  headers: {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'get-template-script'
  }
};

https.get(endpoint, options, (res) => {
  const { statusCode } = res;
  let raw = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { raw += chunk; });
  res.on('end', () => {
    if (statusCode >= 200 && statusCode < 300) {
      try {
        const json = JSON.parse(raw);
        console.log(JSON.stringify(json, null, 2));
      } catch (err) {
        console.error('Failed to parse JSON response:');
        console.error(raw);
        process.exit(3);
      }
    } else {
      console.error(`Request failed with status ${statusCode}`);
      try { console.error(JSON.stringify(JSON.parse(raw), null, 2)); } catch(e) { console.error(raw); }
      process.exit(4);
    }
  });
}).on('error', (e) => {
  console.error(`Request error: ${e.message}`);
  process.exit(1);
});
