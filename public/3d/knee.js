// Shield Battery · 3D left-leg teaching model. Self-contained: no build step.
// Usage:  import { mountKnee } from "/3d/knee.js";  const knee = mountKnee(document.getElementById("leg-wrap"));
// Needs an import map entry for "three" (the draft's index.html already has one).
// Axes (cm): x = forward (anterior), y = up, z = person's right, so -z is lateral for the LEFT leg. Knee centre = origin.
import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";

const INFO = "Red = complete patellar tendon rupture at the inferior pole of the left patella, repaired Nov 8 with 2 suture anchors and a collagen implant. Teaching model, not your scan.";
const LAYERS = ["skin", "muscle", "tendon", "bone", "implant", "injury"];
const T0 = new THREE.Vector2(2.6, -5.5);   // tibial tuberosity, tibia frame (extension)
const R_P = 4.18, L_C = 7.12;              // patella centre radius about knee; patella-centre to tuberosity distance
const rot = (x, y, a) => new THREE.Vector2(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));

function mat(color, o = {}) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.65, metalness: 0.05 }, o)); }
function tag(o, layer) { o.userData.layer = layer; return o; }
function lathe(profile, seg = 40) { return new THREE.LatheGeometry(profile.map(([y, r]) => new THREE.Vector2(r, y)), seg); }
function ell(g, m, layer, pos, scale) { const o = new THREE.Mesh(g, m); o.position.set(...pos); o.scale.set(...scale); return tag(o, layer); }
const sphere = new THREE.SphereGeometry(1, 28, 20);
const cyl = new THREE.CylinderGeometry(1, 1, 1, 20, 1);
// place a unit cylinder between two Vector3 points
function seg(mesh, a, b, rx, rz) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length() || 1e-3;
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  mesh.scale.set(rx, len, rz);
}

export function mountKnee(container, opts = {}) {
  const tagEl = container.querySelector("#leg-tag") || null;
  const say = (t) => { if (tagEl) tagEl.textContent = t; };
  if (!container.clientHeight) container.style.minHeight = "360px";

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch (e) { say("3D isn't available on this device or browser."); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.setAttribute("aria-label", "3D model of the left knee");
  container.insertBefore(renderer.domElement, container.firstChild);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 600);
  camera.position.set(38, 10, -88);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a7380, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(40, 60, -50); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcd4ff, 0.6); fill.position.set(-40, 10, 50); scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, -2, 0); controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.minDistance = 25; controls.maxDistance = 260; controls.update();
  const home = { pos: camera.position.clone(), tgt: controls.target.clone() };

  const M = {
    skin: mat(0xe3b99b, { transparent: true, opacity: 0.26, depthWrite: false, roughness: 0.9 }),
    muscle: mat(0xa8433d, { roughness: 0.55 }),
    tendon: mat(0xf1e7cf, { roughness: 0.5 }),
    bone: mat(0xeee6d3, { roughness: 0.6 }),
    metal: mat(0xd5dbe2, { metalness: 0.9, roughness: 0.25 }),
    suture: mat(0x2f64c8, { roughness: 0.4 }),
    collagen: mat(0xe9b24c, { transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    red: new THREE.MeshStandardMaterial({ color: 0xe53935, emissive: 0xb71c1c, emissiveIntensity: 0.7, roughness: 0.5 }),
    halo: new THREE.MeshBasicMaterial({ color: 0xff2a2a, transparent: true, opacity: 0.4, depthWrite: false }),
  };

  const root = new THREE.Group(); scene.add(root);

  // ---- thigh (fixed) ----
  const thigh = new THREE.Group(); root.add(thigh);
  const skinThigh = new THREE.Mesh(lathe([[0, 4.4], [10, 5.2], [22, 6.3], [38, 6.8]]), M.skin);
  thigh.add(tag(skinThigh, "skin")); skinThigh.renderOrder = 10;
  const kneeSkin = ell(sphere, M.skin, "skin", [0, 0, 0], [4.5, 4.5, 4.5]); kneeSkin.renderOrder = 10; thigh.add(kneeSkin);
  const femur = tag(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.3, 36, 20), M.bone), "bone"); femur.position.y = 19.5; thigh.add(femur);
  for (const z of [-2.1, 2.1]) thigh.add(ell(sphere, M.bone, "bone", [-0.3, 0, z], [2.9, 2.7, 1.9]));
  thigh.add(ell(sphere, M.bone, "bone", [0.2, 2.8, 0], [2.4, 2.2, 3.4])); // trochlea / groove area
  thigh.add(ell(sphere, M.muscle, "muscle", [2.4, 25, 0], [3.0, 14.5, 3.6]));    // quadriceps
  thigh.add(ell(sphere, M.muscle, "muscle", [-2.6, 22, 0], [2.4, 15.5, 3.2]));   // hamstrings
  thigh.add(ell(sphere, M.muscle, "muscle", [-0.5, 22, 3.6], [2.0, 14, 1.8]));   // adductors
  thigh.add(ell(sphere, M.muscle, "muscle", [-0.5, 22, -3.6], [2.0, 14, 1.8]));  // vastus lateralis
  const quadTendon = tag(new THREE.Mesh(cyl, M.tendon), "tendon"); root.add(quadTendon);

  // ---- shin (rotates about the knee) ----
  const shin = new THREE.Group(); root.add(shin);
  const skinShin = new THREE.Mesh(lathe([[-40, 2.9], [-34, 2.9], [-20, 4.0], [-9, 4.9], [0, 4.4]]), M.skin);
  shin.add(tag(skinShin, "skin")); skinShin.renderOrder = 10;
  const foot = ell(new THREE.BoxGeometry(1, 1, 1), M.skin, "skin", [4.5, -43.5, 0], [13, 4.6, 6.2]); foot.renderOrder = 10; shin.add(foot);
  shin.add(ell(new THREE.BoxGeometry(1, 1, 1), M.bone, "bone", [4, -43.2, 0], [11, 2.6, 4.4]));
  const tibia = tag(new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.3, 38, 20), M.bone), "bone"); tibia.position.set(0, -20.5, 0); shin.add(tibia);
  shin.add(ell(new THREE.CylinderGeometry(1, 1, 1, 28), M.bone, "bone", [0, -1.3, 0], [3.3, 1.2, 3.3]));  // plateau
  shin.add(ell(sphere, M.bone, "bone", [T0.x - 0.2, T0.y, 0], [1.0, 1.3, 1.5]));                         // tuberosity
  const fib = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.5, 34, 12), M.bone), "bone"); fib.position.set(-1.2, -21, -2.9); shin.add(fib);
  shin.add(ell(sphere, M.muscle, "muscle", [-3.2, -9, -1.7], [2.3, 8, 1.9]));   // gastrocnemius
  shin.add(ell(sphere, M.muscle, "muscle", [-3.2, -9, 1.7], [2.3, 8, 1.9]));
  shin.add(ell(sphere, M.muscle, "muscle", [-2.4, -19, 0], [1.8, 11, 2.3]));    // soleus
  shin.add(ell(sphere, M.muscle, "muscle", [1.9, -15, -1.2], [1.1, 10, 1.3]));  // tibialis anterior
  const achilles = tag(new THREE.Mesh(cyl, M.tendon), "tendon"); seg(achilles, new THREE.Vector3(-2.4, -28, 0), new THREE.Vector3(-2.0, -41, 0), 0.5, 0.8); shin.add(achilles);

  // ---- patella group: patella, patellar tendon, anchors, collagen implant, injury halo ----
  const pg = new THREE.Group(); root.add(pg);
  const patella = ell(sphere, M.bone, "bone", [0, 0, 0], [0.95, 2.3, 2.3]); pg.add(patella);
  const tMain = tag(new THREE.Mesh(cyl, M.tendon), "tendon"); pg.add(tMain);
  const tStub = tag(new THREE.Mesh(cyl, M.red), "tendon"); pg.add(tStub);
  const fray = tag(new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), M.red), "tendon"); pg.add(fray);
  const fray2 = tag(new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), M.red), "tendon"); pg.add(fray2);
  const band = tag(new THREE.Mesh(cyl, M.halo), "injury"); pg.add(band);
  const implant = new THREE.Group(); pg.add(implant);
  for (const z of [-1.0, 1.0]) {
    const a = tag(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.9, 14), M.metal), "implant"); a.position.set(0.1, -1.55, z); implant.add(a);
    const h = tag(new THREE.Mesh(sphere, M.metal), "implant"); h.position.set(0.1, -2.55, z); h.scale.setScalar(0.4); implant.add(h);
    const s = tag(new THREE.Mesh(cyl, M.suture), "implant"); s.position.set(0.55, -3.3, z); s.scale.set(0.07, 1.8, 0.07); implant.add(s);
  }
  const patch = tag(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.0, 28, 1, true, Math.PI * 0.5 - Math.PI * 0.65, Math.PI * 1.3), M.collagen), "implant");
  patch.position.y = -3.1; patch.scale.set(0.9, 1, 1.9); implant.add(patch);
  const halo = tag(new THREE.Mesh(sphere, M.halo), "injury"); halo.position.y = -2.3; halo.scale.setScalar(1.7); pg.add(halo);
  const pin = tag(new THREE.Mesh(sphere, M.red), "injury"); pin.position.y = -2.3; pin.scale.setScalar(0.35); pg.add(pin);

  // ---- X-ray overlay hook ----
  const xr = { mesh: null, opts: { opacity: 0.6, size: 42, x: 0, y: 0 } };

  // ---- state ----
  const S = { bend: 0, torn: false, injuryOn: true };

  function pose() {
    const th = THREE.MathUtils.degToRad(S.bend);
    shin.rotation.z = -th;
    const T = rot(T0.x, T0.y, -th), d = T.length();
    const a = (R_P * R_P - L_C * L_C + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R_P * R_P - a * a));
    const u = T.clone().divideScalar(d), perp = new THREE.Vector2(-u.y, u.x);
    const P = u.clone().multiplyScalar(a).addScaledVector(perp, h);
    if (S.torn) P.y += 2.4 * (1 - S.bend / 160);               // patella rides high once the tendon lets go
    const dir = T.clone().sub(P), len = dir.length(); dir.normalize();
    pg.position.set(P.x, P.y, 0); pg.rotation.z = Math.atan2(dir.x, -dir.y);
    const lenT = len - 2.0;                                      // tendon run, patella pole to tuberosity
    const setLocal = (m, y0, y1, rx, rz) => { m.position.set(0, (y0 + y1) / 2, 0); m.scale.set(rx, Math.abs(y1 - y0), rz); m.quaternion.identity(); };
    tMain.visible = !S.torn; tStub.visible = fray.visible = fray2.visible = S.torn;
    implant.visible = !S.torn;
    if (!S.torn) {
      setLocal(tMain, -2.0, -2.0 - lenT, 0.45, 1.3);
      band.position.y = -3.0; band.scale.set(0.62, 2.0, 1.55); band.visible = S.injuryOn;
    } else {
      setLocal(tMain, 0, 0, 0.01, 0.01);
      setLocal(tStub, -2.0 - lenT, -2.0 - lenT + 3.0, 0.45, 1.3);
      fray.position.set(0, -2.0 - lenT + 3.4, 0); fray.scale.set(0.5, 0.9, 1.2); fray.rotation.z = Math.PI;
      fray2.position.set(0, -2.55, 0); fray2.scale.set(0.45, 0.7, 1.1);
      band.visible = false;
    }
    // quadriceps tendon: muscle belly end -> patella superior pole (femur frame)
    const sp = new THREE.Vector3(P.x - dir.x * 2.2, P.y - dir.y * 2.2, 0);
    seg(quadTendon, new THREE.Vector3(2.7, 11, 0), sp, 0.5, 1.5);
    say(`Left knee · bent ${S.bend}° · ${S.torn ? "before repair (torn)" : "after repair"}. ${INFO}`);
    need = true;
  }

  // ---- layers ----
  const layerOn = Object.fromEntries(LAYERS.map((l) => [l, true]));
  function setLayer(name, on) {
    if (!(name in layerOn)) return;
    layerOn[name] = !!on;
    if (name === "injury") S.injuryOn = !!on;
    root.traverse((o) => { if (o.userData.layer === name) o.visible = !!on; });
    pose();
  }
  function setBend(deg) { S.bend = Math.round(THREE.MathUtils.clamp(+deg || 0, 0, 130)); pose(); return S.bend; }
  function setState(s) { S.torn = (s === "torn" || s === "ruptured"); pose(); }

  // ---- X-ray API: setXray(File | URL | dataURL, {opacity,size,x,y}) ; clearXray() ----
  function setXray(src, o = {}) {
    Object.assign(xr.opts, o);
    const url = (typeof src === "string") ? src : URL.createObjectURL(src);
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      clearXray();
      const ar = tex.image.width / tex.image.height;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(xr.opts.size * ar, xr.opts.size),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: xr.opts.opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(xr.opts.x, xr.opts.y, 0); m.renderOrder = 50; xr.mesh = m; root.add(m); need = true;
      if (typeof src !== "string") URL.revokeObjectURL(url);
    });
  }
  function clearXray() { if (xr.mesh) { root.remove(xr.mesh); xr.mesh.material.map.dispose(); xr.mesh.material.dispose(); xr.mesh.geometry.dispose(); xr.mesh = null; need = true; } }
  function setXrayOpacity(v) { xr.opts.opacity = +v; if (xr.mesh) { xr.mesh.material.opacity = +v; need = true; } }
  function reset() { camera.position.copy(home.pos); controls.target.copy(home.tgt); controls.update(); need = true; }

  // ---- size, render loop ----
  let need = true, visible = true, raf = 0, disposed = false;
  function resize() {
    const w = container.clientWidth || 300, h = container.clientHeight || 360;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 46 : 35; camera.updateProjectionMatrix(); need = true;
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();
  controls.addEventListener("change", () => { need = true; });
  const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) loop(); }, { threshold: 0 }); io.observe(container);
  const t0 = performance.now();
  function loop() {
    cancelAnimationFrame(raf);
    if (disposed || !visible) return;
    const t = (performance.now() - t0) / 1000, p = 1 + 0.18 * Math.sin(t * 3);
    halo.scale.setScalar(1.7 * p); M.halo.opacity = 0.3 + 0.15 * Math.sin(t * 3);
    controls.update(); renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }
  renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); say("3D view paused (graphics reset). Reload to restore."); });

  // ---- bind the page's existing controls (ids from index.html) ----
  const ui = opts.ui === false ? null : (opts.uiRoot || document);
  if (ui) {
    const bar = ui.querySelector("#leg-ui");
    if (bar && !bar.querySelector("#leg-torn")) {
      bar.insertAdjacentHTML("beforeend",
        `<label><input type="checkbox" data-layer="injury" checked> Highlight injury</label>` +
        `<label><input type="checkbox" id="leg-torn"> Show the tear (before repair)</label>` +
        `<label id="leg-xop-wrap" hidden>X-ray opacity <input type="range" id="leg-xop" min="0.1" max="1" step="0.05" value="0.6"></label>` +
        `<button type="button" id="leg-reset">Reset view</button>`);
    }
    ui.querySelectorAll("[data-layer]").forEach((c) => c.addEventListener("change", () => setLayer(c.dataset.layer, c.checked)));
    const bend = ui.querySelector("#leg-bend"), bv = ui.querySelector("#leg-bend-val");
    if (bend) bend.addEventListener("input", () => { const v = setBend(bend.value); if (bv) bv.textContent = v + "°"; });
    const torn = ui.querySelector("#leg-torn"); if (torn) torn.addEventListener("change", () => setState(torn.checked ? "torn" : "repaired"));
    const rs = ui.querySelector("#leg-reset"); if (rs) rs.addEventListener("click", reset);
    const xf = ui.querySelector("#leg-xray"), xw = ui.querySelector("#leg-xop-wrap"), xo = ui.querySelector("#leg-xop");
    if (xf) xf.addEventListener("change", () => { if (xf.files[0]) { setXray(xf.files[0]); if (xw) xw.hidden = false; } });
    if (xo) xo.addEventListener("input", () => setXrayOpacity(xo.value));
  }

  pose(); loop();
  function dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose(); clearXray(); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); renderer.dispose(); renderer.domElement.remove(); }
  return { setLayer, setBend, setState, setXray, clearXray, setXrayOpacity, reset, dispose, THREE, scene, camera, state: S };
}
export default mountKnee;
