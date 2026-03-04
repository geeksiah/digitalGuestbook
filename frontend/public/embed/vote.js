(function () {
  var script = document.currentScript;
  if (!script) return;

  var slug = script.getAttribute('data-slug');
  if (!slug) {
    console.error('[EventPeepo Vote Embed] Missing data-slug');
    return;
  }

  var apiBase = (script.getAttribute('data-api-url') || '').replace(/\/+$/, '');
  var hostBase = (script.getAttribute('data-host-url') || '').replace(/\/+$/, '');
  if (!apiBase) apiBase = window.location.origin;
  if (!hostBase) hostBase = window.location.origin;

  var mountId = script.getAttribute('data-mount-id');
  var mountNode = mountId ? document.getElementById(mountId) : null;
  if (!mountNode) {
    mountNode = document.createElement('div');
    script.parentNode.insertBefore(mountNode, script.nextSibling);
  }

  var iframe = document.createElement('iframe');
  iframe.title = 'Event voting embed';
  iframe.style.width = '100%';
  iframe.style.minHeight = script.getAttribute('data-height') || '860px';
  iframe.style.border = '0';
  iframe.style.borderRadius = '12px';
  iframe.loading = 'lazy';

  var renderIframe = function (token) {
    var query = token ? '?embed=1&token=' + encodeURIComponent(token) : '?embed=1';
    iframe.src = hostBase + '/e/' + encodeURIComponent(slug) + '/vote' + query;
    if (!mountNode.contains(iframe)) {
      mountNode.appendChild(iframe);
    }
  };

  var requestToken = function () {
    return fetch(apiBase + '/api/voting/embed/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug: slug }),
      credentials: 'omit',
    }).then(function (response) {
      if (!response.ok) {
        throw new Error('Failed to create embed token');
      }
      return response.json();
    });
  };

  requestToken()
    .then(function (payload) {
      renderIframe(payload && payload.token ? payload.token : '');
    })
    .catch(function (error) {
      console.error('[EventPeepo Vote Embed] Token request failed:', error);
      renderIframe('');
    });
})();

