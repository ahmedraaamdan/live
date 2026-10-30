// Discourage casual copying while retaining editable fields and explicit copy actions.
const editable = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input, textarea, [contenteditable="true"], [data-allow-copy]'));
for (const event of ['copy', 'cut', 'contextmenu', 'dragstart', 'selectstart']) {
  document.addEventListener(event, (e) => { if (!editable(e.target)) e.preventDefault(); });
}
