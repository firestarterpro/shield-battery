// Loads the 3D knee (public/3d/knee.js) the first time the Rehab page opens.
let started = false;
function start() {
  if (started) return; const el = document.getElementById("leg-wrap"); if (!el) return;
  started = true;
  import("/3d/knee.js").then(m => m.mountKnee(el)).catch(() => {
    const t = document.getElementById("leg-tag"); if (t) t.textContent = "The 3D model couldn't load on this device.";
  });
}
window.addEventListener("sb:knee-open", start);
window.addEventListener("sb:rehab-open", start);
if (location.hash === "#knee") start();
