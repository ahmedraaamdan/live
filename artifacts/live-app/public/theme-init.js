// Apply the saved theme before first paint (no flash). A file rather than an
// inline script, so the page's Content-Security-Policy can stay script-src 'self'.
try {
  var t = localStorage.getItem('gl.theme');
  if (t === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t === 'dark' ? 'dark' : 'light';
} catch (e) {}

// iOS ignores user-scalable=no in the viewport meta, so its pinch zoom is stopped here.
document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
