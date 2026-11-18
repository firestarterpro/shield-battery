// Shield Battery · 3D left-knee teaching model (futuristic hologram + "fix my knee" game). No build step.
// Usage:  import { mountKnee } from "/3d/knee.js";  const knee = mountKnee(document.getElementById("leg-wrap"));
// Bones and muscles: BodyParts3D (c) DBCLS, CC BY 4.0, via the simplified meshes in knee-parts.bin. Tendons, ligaments,
// cartilage, implants, skin glow and the surgery game are drawn in code.
// Axes (cm): x = forward (anterior), y = up, z = person's right, so -z is lateral for the LEFT leg. Knee centre = origin.
import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";

const INFO = "The red-orange glow marks the patellar tendon injury (complete rupture at the bottom tip of the left kneecap), repaired Nov 8 with 2 suture anchors and a collagen patch. Teaching model, not your scan.";
const CREDIT = "Anatomy: BodyParts3D © DBCLS, CC BY 4.0 (simplified)";
const LAYERS = ["skin", "muscle", "tendon", "bone", "implant", "injury", "fx"];
const SNAP = 0.45;                       // tear progress at which the tendon lets go
const CUT_TOP = 19, CUT_BOT = -17;       // hologram "dissolve" heights (cm)
const rot = (x, y, a) => new THREE.Vector2(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const cyl = new THREE.CylinderGeometry(1, 1, 1, 16, 1);
const sphere = new THREE.SphereGeometry(1, 24, 16);
function seg(mesh, a, b, rx, rz) {                 // place a unit cylinder between two points
  const d = new THREE.Vector3().subVectors(b, a), len = d.length() || 1e-3;
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  mesh.scale.set(rx, len, rz);
}
function glowTex() {
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.3, "rgba(255,255,255,.45)"); r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// friendly name + medical name for every label. kind: "inj" = injury (red)
const LABELS = [
  { id: "femur", easy: "Thigh bone", med: "femur" },
  { id: "quad", easy: "Big thigh muscle", med: "quadriceps" },
  { id: "ham", easy: "Back-of-thigh muscle", med: "hamstring" },
  { id: "patella", easy: "Kneecap", med: "patella" },
  { id: "pole", easy: "Bottom tip of kneecap", med: "inferior pole", inj: 1 },
  { id: "ptendon", easy: "Kneecap-to-shin tendon", med: "patellar tendon", inj: 1 },
  { id: "retin", easy: "Side support bands", med: "retinaculum", inj: 1 },
  { id: "acl", easy: "Inner knee strap", med: "ACL ligament" },
  { id: "mens", easy: "Cushion", med: "meniscus" },
  { id: "tibia", easy: "Shin bone", med: "tibia" },
  { id: "fibula", easy: "Thin calf bone", med: "fibula" },
  { id: "calf", easy: "Calf muscle", med: "gastrocnemius" },
];

export function mountKnee(container, opts = {}) {
  const tagEl = container.querySelector("#leg-tag") || null;
  const say = (t) => { if (tagEl) tagEl.textContent = t; };
  if (!container.clientHeight) container.style.minHeight = "420px";

  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
  catch (e) { say("3D isn't available on this device or browser."); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute("aria-label", "3D hologram of the left knee");
  container.insertBefore(renderer.domElement, container.firstChild);
  container.classList.add("k-holo");
  injectStyle();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 600);
  const HOME = { pos: V3(46, 7, -26), tgt: V3(0, 1, 0) };
  camera.position.copy(HOME.pos);
  scene.add(new THREE.HemisphereLight(0x9ec8ff, 0x1a1030, 0.9));
  const key = new THREE.DirectionalLight(0xcfe6ff, 1.6); key.position.set(30, 50, -40); scene.add(key);
  const back = new THREE.DirectionalLight(0x3a7bff, 1.4); back.position.set(-40, 10, 50); scene.add(back);
  const warm = new THREE.PointLight(0xff7a2a, 60, 40, 1.6); warm.position.set(6, -1, -6); scene.add(warm);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.tgt); controls.enableDamping = true; controls.dampingFactor = 0.09;
  controls.minDistance = 22; controls.maxDistance = 140; controls.enablePan = false; controls.update();

  // ---------- overlay (labels, leader lines, game card) ----------
  const ov = document.createElement("div"); ov.className = "k-ov";
  ov.innerHTML = `<svg class="k-lines"></svg><div class="k-hud tl"></div><div class="k-hud br"></div>`;
  container.appendChild(ov);
  const svg = ov.querySelector("svg");
  const card = document.createElement("div"); card.className = "k-card"; card.hidden = true; container.appendChild(card);
  const credit = document.createElement("div"); credit.className = "k-credit"; credit.textContent = CREDIT; container.appendChild(credit);

  const S = { bend: 0, tear: 0, injuryOn: true, nameMode: 0 };
  const layerOn = Object.fromEntries(LAYERS.map((l) => [l, true]));
  const G = { active: false, step: 0, t0: 0, anch: [false, false], snapped: false, patch: false, done: false };
  let anim = null, camTw = null, need = true, visible = true, raf = 0, disposed = false, ready = false;
  const uni = { uTime: { value: 0 } };
  const api = { THREE, scene, camera, state: S, game: G, setLayer() {}, setBend() {}, setState() {}, reset() {}, dispose() {} };

  init().catch((e) => { console.error(e); say("The 3D model couldn't load on this device."); });
  return api;

  // =====================================================================================================
  async function init() {
    say("Loading the 3D knee…");
    const base = new URL(".", import.meta.url);
    const [meta, buf] = await Promise.all([fetch(new URL("knee-parts.json", base)).then((r) => r.json()), fetch(new URL("knee-parts.bin", base)).then((r) => r.arrayBuffer())]);

    // ---- materials ----
    const rimU = (c) => ({ value: new THREE.Color(c) });
    function holo(m, rim, fib) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uRim = rimU(rim); sh.uniforms.uEdge = rimU(0xff9a3a); sh.uniforms.uFib = { value: fib ? 1 : 0 }; sh.uniforms.uTime = uni.uTime;
        sh.uniforms.uTop = { value: CUT_TOP }; sh.uniforms.uBot = { value: CUT_BOT };
        sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec3 aRest; varying vec3 vRest;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRest = aRest;");
        sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vRest; uniform vec3 uRim,uEdge; uniform float uFib,uTop,uBot,uTime;")
          .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nfloat cutD = min(uTop - vRest.y, vRest.y - uBot); if (cutD < 0.0) discard;")
          .replace("#include <color_fragment>", "#include <color_fragment>\nif (uFib > 0.5) diffuseColor.rgb *= 0.84 + 0.16 * sin(vRest.x * 15.0 + vRest.z * 12.0 + sin(vRest.y * 0.8) * 2.5);")
          .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\nfloat rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2); totalEmissiveRadiance += uRim * rimF * 0.85 + uEdge * smoothstep(0.9, 0.0, cutD) * 1.3;");
      };
      m.side = THREE.DoubleSide; return m;
    }
    const M = {
      bone: holo(new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.55, metalness: 0.05, emissive: 0x0a1020 }), 0x5ab4ff),
      muscle: holo(new THREE.MeshStandardMaterial({ color: 0xc2493c, roughness: 0.5, metalness: 0.02, emissive: 0x2a0606 }), 0xff7a55, true),
      band: holo(new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.45, emissive: 0x1a1408 }), 0xffc16a),
      patella: new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.5, emissive: 0x2a0c00, emissiveIntensity: 1 }),
      tendon: new THREE.MeshStandardMaterial({ color: 0xf2e8cf, roughness: 0.45, emissive: 0x3a2a10, emissiveIntensity: 0.6 }),
      lig: new THREE.MeshStandardMaterial({ color: 0xffe9a8, roughness: 0.4, emissive: 0x4a3510, emissiveIntensity: 0.8 }),
      cart: new THREE.MeshStandardMaterial({ color: 0x7fd3ff, roughness: 0.2, transparent: true, opacity: 0.75, emissive: 0x1a6fa8, emissiveIntensity: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xe8eef6, metalness: 0.35, roughness: 0.3, emissive: 0x6a86b0, emissiveIntensity: 0.7 }),
      suture: new THREE.MeshBasicMaterial({ color: 0x3d8bff }),
      collagen: new THREE.MeshStandardMaterial({ color: 0xffc247, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, emissive: 0x8a5a00, emissiveIntensity: 0.9 }),
      red: new THREE.MeshStandardMaterial({ color: 0xff3b2e, emissive: 0xff2a10, emissiveIntensity: 1.1, roughness: 0.5 }),
      inj: new THREE.MeshStandardMaterial({ color: 0xff8a3a, emissive: 0xff5a10, emissiveIntensity: 1.0, roughness: 0.4, transparent: true, opacity: 0.8 }),
      halo: new THREE.MeshBasicMaterial({ color: 0xff5a1a, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
      retin: new THREE.MeshStandardMaterial({ color: 0xffa050, emissive: 0xff6a1a, emissiveIntensity: 0.9, transparent: true, opacity: 0.45, depthWrite: false }),
      stitch: new THREE.MeshStandardMaterial({ color: 0xf2e8cf, roughness: 0.45, emissive: 0x6a3a10, emissiveIntensity: 0.9 }),
    };
    const gtex = glowTex();
    const sprite = (color, s, o = 0.9) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: gtex, color, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.set(s, s, 1); return sp; };

    // ---- load parts ----
    const root = new THREE.Group(); scene.add(root);
    const thigh = new THREE.Group(), shin = new THREE.Group(), pg = new THREE.Group(); root.add(thigh, shin, pg);
    const P = {}, skinned = [];
    const tag = (o, layer) => { o.userData.layer = layer; return o; };
    for (const p of meta.parts) {
      const posA = new Float32Array(buf, p.pos, p.v * 3).slice(), nA = new Int16Array(buf, p.nor, p.v * 3), nF = new Float32Array(p.v * 3);
      for (let i = 0; i < nF.length; i++) nF[i] = nA[i] / 32767;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(posA.slice(), 3)); geo.setAttribute("normal", new THREE.BufferAttribute(nF.slice(), 3));
      geo.setAttribute("aRest", new THREE.BufferAttribute(posA.slice(), 3)); geo.setIndex(new THREE.BufferAttribute(new Uint16Array(buf, p.idx, p.tris * 3).slice(), 1));
      P[p.name] = { geo, rest: posA, restN: nF, p };
    }
    const nm = (n) => P[n];
    // anchor points taken from the real meshes
    function extreme(name, axis, sign, yLo = -99, yHi = 99) {
      const r = nm(name).rest; let best = null, bv = -Infinity;
      for (let i = 0; i < r.length; i += 3) { const y = r[i + 1]; if (y < yLo || y > yHi) continue; const v = sign * r[i + axis]; if (v > bv) { bv = v; best = V3(r[i], r[i + 1], r[i + 2]); } }
      return best || V3(0, 0, 0);
    }
    // patella: centre it, tint its lower tip (the injured spot)
    const pat = nm("Left patella"); pat.geo.computeBoundingBox();
    const pc = pat.geo.boundingBox.getCenter(new THREE.Vector3()); const P0 = new THREE.Vector2(pc.x, pc.y);
    { const a = pat.geo.attributes.position, col = new Float32Array(a.count * 3), c0 = new THREE.Color(0xf2ead6), c1 = new THREE.Color(0xff6a2a);
      for (let i = 0; i < a.count; i++) { a.setXYZ(i, a.getX(i) - pc.x, a.getY(i) - pc.y, a.getZ(i) - pc.z); const t = 1 - sstep(-1.9, -0.5, a.getY(i)); const c = c0.clone().lerp(c1, t); col.set([c.r, c.g, c.b], i * 3); }
      pat.geo.setAttribute("color", new THREE.BufferAttribute(col, 3)); a.needsUpdate = true; }
    const patella = tag(new THREE.Mesh(pat.geo, M.patella), "bone"); pg.add(patella);
    // bones
    thigh.add(tag(new THREE.Mesh(nm("Left femur").geo, M.bone), "bone"));
    shin.add(tag(new THREE.Mesh(nm("Left tibia").geo, M.bone), "bone"), tag(new THREE.Mesh(nm("Left fibula").geo, M.bone), "bone"));
    // muscles + iliotibial band: in root, bent smoothly with the knee
    for (const p of meta.parts) if (p.layer !== "bone") { const o = tag(new THREE.Mesh(P[p.name].geo, p.layer === "tendon" ? M.band : M.muscle), p.layer); root.add(o); skinned.push(P[p.name]); }
    // tibial tuberosity (tendon landing spot) and kinematics from the data
    const T0 = (() => { const v = extreme("Left tibia", 0, 1, -9, -2); return new THREE.Vector2(v.x - 0.35, v.y); })();
    const R_P = P0.length(), L_C = P0.clone().sub(T0).length();
    // skin shell from slices of the real anatomy
    const skinGeo = (() => {
      const all = []; for (const p of meta.parts) all.push(P[p.name].rest); all.push(new Float32Array([pc.x + 1.6, pc.y, 0, pc.x - 1.6, pc.y, 0]));
      const ys = [], rows = []; for (let y = -23; y <= 25; y += 1.5) ys.push(y);
      for (const y of ys) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
        for (const r of all) for (let i = 0; i < r.length; i += 3) if (Math.abs(r[i + 1] - y) <= 1.6) { x0 = Math.min(x0, r[i]); x1 = Math.max(x1, r[i]); z0 = Math.min(z0, r[i + 2]); z1 = Math.max(z1, r[i + 2]); }
        rows.push(x1 < x0 ? null : [(x0 + x1) / 2, (z0 + z1) / 2, (x1 - x0) / 2 + 1.1, (z1 - z0) / 2 + 1.1]); }
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = rows[i - 1] || rows.find(Boolean);
      for (let k = 0; k < 3; k++) for (let i = 1; i < rows.length - 1; i++) rows[i] = rows[i].map((v, j) => (rows[i - 1][j] + v + rows[i + 1][j]) / 3);
      const N = 30, pos = [], idx = [];
      rows.forEach((r, i) => { for (let j = 0; j < N; j++) { const a = (j / N) * Math.PI * 2; pos.push(r[0] + Math.cos(a) * r[2], ys[i], r[1] + Math.sin(a) * r[3]); } });
      for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < N; j++) { const a = i * N + j, b = i * N + (j + 1) % N, c = a + N, d = b + N; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry(); const pa = new Float32Array(pos);
      g.setAttribute("position", new THREE.BufferAttribute(pa.slice(), 3)); g.setAttribute("aRest", new THREE.BufferAttribute(pa.slice(), 3)); g.setIndex(idx); g.computeVertexNormals();
      return { geo: g, rest: pa, restN: g.attributes.normal.array.slice() };
    })();
    const skinMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide, uniforms: { uTime: uni.uTime },
      vertexShader: "attribute vec3 aRest; varying vec3 vN; varying vec3 vV; varying vec3 vR; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.0); vV = -mv.xyz; vR = aRest; gl_Position = projectionMatrix*mv; }",
      fragmentShader: `varying vec3 vN; varying vec3 vV; varying vec3 vR; uniform float uTime;
        void main(){ float cutD = min(${CUT_TOP.toFixed(1)} - vR.y, vR.y - (${CUT_BOT.toFixed(1)})); if (cutD < 0.0) discard;
          float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
          float bands = 0.5 + 0.5 * sin(vR.y * 3.0 - uTime * 1.2);
          float a = 0.05 + f * 0.8 + f * bands * 0.15; vec3 c = mix(vec3(0.15,0.55,1.0), vec3(0.55,0.95,1.0), f);
          a += smoothstep(0.7, 0.0, cutD) * 0.6; c = mix(c, vec3(1.0,0.6,0.25), smoothstep(0.7, 0.0, cutD));
          gl_FragColor = vec4(c * a * 1.6, a); }`,
    });
    const skin = tag(new THREE.Mesh(skinGeo.geo, skinMat), "skin"); skin.renderOrder = 10; root.add(skin); skinned.push(skinGeo);

    // ---- procedural soft tissue ----
    const quadTendon = tag(new THREE.Mesh(cyl, M.tendon), "tendon"); root.add(quadTendon);
    const tMain = tag(new THREE.Mesh(cyl, M.tendon), "tendon"); pg.add(tMain);                    // intact patellar tendon
    const tStub = tag(new THREE.Mesh(cyl, M.red), "tendon"); pg.add(tStub);                       // torn: stump on shin
    const tStubP = tag(new THREE.Mesh(cyl, M.red), "tendon"); pg.add(tStubP);                     // torn: stump on patella
    const fray = tag(new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), M.red), "tendon"); pg.add(fray);
    const fray2 = tag(new THREE.Mesh(new THREE.ConeGeometry(1, 1, 10), M.red), "tendon"); pg.add(fray2);
    const gTendon = tag(new THREE.Mesh(cyl, M.stitch), "tendon"); root.add(gTendon);              // game: the tendon you pull up
    const band = tag(new THREE.Mesh(cyl, M.inj), "injury"); pg.add(band);                         // glow sleeve on the repaired tendon
    // ligaments (ACL, PCL, MCL, LCL) and cartilage cushions
    const ligs = [];
    const lig = (fn) => { const m = tag(new THREE.Mesh(cyl, M.lig), "tendon"); root.add(m); ligs.push({ m, a: fn[0], b: fn[1], shinA: fn[2], shinB: fn[3], r: fn[4] }); };
    const fHead = extreme("Left fibula", 1, 1), fLat = extreme("Left femur", 2, -1, -3, 4), fMed = extreme("Left femur", 2, 1, -3, 4), tMed = extreme("Left tibia", 2, 1, -10, -5);
    lig([V3(0.8, 2.4, -0.5), V3(2.2, 1.0, 0.2), false, true, 0.32]);                // ACL
    lig([V3(2.6, 2.3, 1.4), V3(-0.4, 0.6, 0.7), false, true, 0.36]);                // PCL
    lig([fMed.clone().add(V3(0, 0, -0.4)), tMed.clone().add(V3(0, 0, -0.3)), false, true, 0.3]);   // MCL
    lig([fLat.clone().add(V3(0, 0, 0.4)), fHead.clone().add(V3(0, 0, 0.2)), false, true, 0.3]);    // LCL
    const mens = [];
    for (const [z, a0] of [[-1.0, -0.4], [2.8, 0.4]]) {
      const t = tag(new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.55, 10, 28, Math.PI * 1.55), M.cart), "bone");
      t.rotation.x = Math.PI / 2; t.rotation.z = z < 0 ? 1.9 : -1.2; t.position.set(1.3, 0.9, z); t.scale.set(1, 1, 0.6); shin.add(t); mens.push(t);
    }
    // retinaculum: side support strands between the kneecap and the shin
    const retin = [];
    for (const z of [-1, 1]) for (const k of [0, 1, 2]) {
      const m = tag(new THREE.Mesh(cyl, M.retin), "tendon"); root.add(m); retin.push({ m, z, k });
    }
    // implants: two Q-Fix anchors, static sutures, collagen patch
    const anchors = [];
    for (const z of [-1.0, 1.0]) {
      const g = new THREE.Group(); const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 14), M.metal); const head = new THREE.Mesh(sphere, M.metal); head.position.y = -1.05; head.scale.setScalar(0.42);
      g.add(body, head); g.position.set(0.1, -1.4, z); g.userData.layer = "implant"; pg.add(g); anchors.push(g);
    }
    const statSut = [-1.0, 1.0].map((z) => { const s = tag(new THREE.Mesh(cyl, M.suture), "implant"); s.position.set(0.55, -3.4, z); s.scale.set(0.07, 2.2, 0.07); pg.add(s); return s; });
    const patch = tag(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.0, 28, 1, true, Math.PI * 0.5 - Math.PI * 0.65, Math.PI * 1.3), M.collagen), "implant");
    patch.position.y = -3.4; patch.scale.set(0.9, 1, 1.9); pg.add(patch);
    // injury glow
    const glow = sprite(0xff5a1a, 7, 0.9); glow.position.set(0, -2.3, 0); glow.userData.layer = "injury"; pg.add(glow);
    const pole = tag(new THREE.Mesh(sphere, M.red), "injury"); pole.position.y = -2.1; pole.scale.setScalar(0.35); pg.add(pole);
    const pick = new THREE.Mesh(cyl, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); pg.add(pick);   // fat invisible tap target on the tendon

    // ---- game objects ----
    const gm = new THREE.Group(); root.add(gm);
    const hAnchor = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.8, 14), M.metal), h = new THREE.Mesh(sphere, M.metal); h.position.y = -1.05; h.scale.setScalar(0.42); hAnchor.add(b, h); hAnchor.scale.setScalar(2.2); }
    const hStump = new THREE.Mesh(sphere, M.inj); hStump.scale.setScalar(0.9);
    const hPatch = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 3.4), M.collagen);
    const hSprite = sprite(0xffffff, 6, 0.9); hSprite.material.depthTest = false; hSprite.renderOrder = 60;
    const hPick = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: false })); hPick.scale.setScalar(2.6);
    const handle = new THREE.Group(); handle.add(hAnchor, hStump, hPatch, hSprite, hPick); gm.add(handle); handle.visible = false;
    for (const o of [hAnchor, hStump, hPatch]) o.traverse((q) => { if (q.material) { q.material = q.material.clone(); q.material.depthTest = false; q.renderOrder = 55; } });
    const tgt = sprite(0x55ffb0, 5, 0.95); tgt.material.depthTest = false; tgt.renderOrder = 59; gm.add(tgt); tgt.visible = false;
    const hint = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, 0, 0), V3(0, 1, 0)]), new THREE.LineDashedMaterial({ color: 0x55ffb0, dashSize: 0.5, gapSize: 0.4, transparent: true, opacity: 0.8, depthTest: false })); hint.renderOrder = 58; gm.add(hint); hint.visible = false;
    const sutLine = [0, 1].map(() => { const m = new THREE.Mesh(cyl, M.suture); m.visible = false; gm.add(m); return m; });

    // ---- particles: floating motes, tear burst / confetti, scanner ring, flow arrows ----
    const mote = (() => {
      const n = window.innerWidth < 600 ? 90 : 160, pos = new Float32Array(n * 3), ph = new Float32Array(n);
      for (let i = 0; i < n; i++) { pos.set([Math.random() * 22 - 8, Math.random() * 40 - 18, Math.random() * 22 - 11], i * 3); ph[i] = Math.random() * 6.28; }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const m = new THREE.Points(g, new THREE.PointsMaterial({ map: gtex, size: 0.9, color: 0x9fdcff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.userData.layer = "fx"; root.add(m); return { m, pos, ph, n };
    })();
    const burst = (() => {
      const n = 120, g = new THREE.BufferGeometry(); const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = new Float32Array(n * 3);
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const m = new THREE.Points(g, new THREE.PointsMaterial({ map: gtex, size: 1.0, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.frustumCulled = false; scene.add(m); return { m, pos, col, vel, n, life: 0 };
    })();
    function fire(at, kind) {
      const b = burst, c = new THREE.Color(); b.life = 1; b.kind = kind;
      for (let i = 0; i < b.n; i++) {
        b.pos.set([at.x, at.y, at.z], i * 3);
        const d = V3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar((kind === "confetti" ? 9 : 5) * (0.4 + Math.random()));
        b.vel.set([d.x, d.y, d.z], i * 3);
        c.setHSL(kind === "confetti" ? Math.random() : 0.04 + Math.random() * 0.06, 1, 0.6); b.col.set([c.r, c.g, c.b], i * 3);
      }
      b.m.geometry.attributes.color.needsUpdate = true;
    }
    const scan = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.07, 6, 72), new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    scan.rotation.x = Math.PI / 2; scan.userData.layer = "fx"; root.add(scan);
    const arrows = [];
    function arrowPath(parent, pts, color, n) {
      const curve = new THREE.CatmullRomCurve3(pts), line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), new THREE.LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.6, transparent: true, opacity: 0.7, depthTest: false }));
      line.computeLineDistances(); line.userData.layer = "fx"; line.renderOrder = 40; parent.add(line);
      const cones = []; for (let i = 0; i < n; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.4, 1.2, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthTest: false })); c.userData.layer = "fx"; c.renderOrder = 41; parent.add(c); cones.push(c); }
      arrows.push({ curve, cones, n });
    }
    arrowPath(thigh, [V3(6.5, 17, -7.5), V3(8, 10, -7.8), V3(7.5, 4, -7.6), V3(4.5, -0.5, -7)], 0x3fa0ff, 5);
    arrowPath(shin, [V3(-4, -15, -7.2), V3(-2, -9, -7.4), V3(-0.5, -3.5, -7.3), V3(3, 0, -7)], 0xff8a3a, 5);

    // ---- X-ray overlay hook ----
    const xr = { mesh: null, opts: { opacity: 0.6, size: 42, x: 0, y: 0 } };

    // ---- labels ----
    const lab = LABELS.map((L) => {
      const el = document.createElement("div"); el.className = "k-lab" + (L.inj ? " inj" : ""); ov.appendChild(el);
      const ln = document.createElementNS("http://www.w3.org/2000/svg", "line"), dot = document.createElementNS("http://www.w3.org/2000/svg", "circle"); dot.setAttribute("r", 3);
      if (L.inj) { ln.setAttribute("class", "inj"); dot.setAttribute("class", "inj"); }
      svg.append(ln, dot); return { L, el, ln, dot, a: null, w: 0, h: 0 };
    });
    const A = { // anchors: [group, local point]
      femur: [thigh, extreme("Left femur", 2, -1, 8, 13)], quad: [root, extreme("Left rectus femoris", 0, 1, 7, 13)], ham: [root, extreme("Long head of left biceps femoris", 0, -1, 7, 13)],
      patella: [pg, V3(0.6, 1.0, -2.2)], pole: [pg, V3(0, -2.1, -0.5)], ptendon: [pg, V3(0, -5.2, -1.3)], retin: [pg, V3(0.2, -0.6, -2.3)],
      acl: [root, V3(1.5, 1.7, -0.2)], mens: [shin, V3(1.3, 0.9, -2.7)], tibia: [shin, extreme("Left tibia", 2, -1, -14, -9)], fibula: [shin, extreme("Left fibula", 2, -1, -14, -9)], calf: [root, extreme("Lateral head of left gastrocnemius", 0, -1, -10, -5)],
    };
    function setNames(mode) {
      S.nameMode = mode; for (const l of lab) { const { easy, med } = l.L; l.el.innerHTML = mode === 0 ? `${easy}<small>${med}</small>` : mode === 1 ? easy : med; }
      requestAnimationFrame(measure);
    }
    function measure() { for (const l of lab) { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; } }
    setNames(0);
    const tmpV = new THREE.Vector3();
    function layoutLabels() {
      const W = container.clientWidth, H = container.clientHeight, on = layerOn.fx;
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`); ov.classList.toggle("off", !on);
      if (!on) return;
      const pts = lab.map((l) => { const [g, p] = A[l.L.id]; g.updateWorldMatrix(true, false); tmpV.copy(p).applyMatrix4(g.matrixWorld);
        if (g === root) { /* skinned parts: follow the knee bend for shin-side points */ } tmpV.project(camera); l.a = { x: (tmpV.x * 0.5 + 0.5) * W, y: (-tmpV.y * 0.5 + 0.5) * H, z: tmpV.z }; return l; });
      const cx = W / 2, cols = { L: [], R: [] }; for (const l of pts) (l.a.x < cx ? cols.L : cols.R).push(l);
      const gap = 4, small = W < 520;
      for (const side of ["L", "R"]) {
        const arr = cols[side].sort((a, b) => a.a.y - b.a.y); let prev = 8;
        for (const l of arr) { const y = Math.max(prev, Math.min(H - l.h - 8, l.a.y - l.h / 2)); l.y = y; prev = y + l.h + gap; }
        let next = H - 8; for (let i = arr.length - 1; i >= 0; i--) { const l = arr[i]; if (l.y + l.h > next) l.y = next - l.h; next = l.y - gap; }
        for (const l of arr) {
          const x = side === "L" ? 6 : W - 6 - l.w, ex = side === "L" ? 6 + l.w : W - 6 - l.w, ey = l.y + l.h / 2;
          l.el.style.cssText = `left:${x}px;top:${l.y}px;text-align:${side === "L" ? "left" : "right"}`; l.el.style.maxWidth = small ? "34%" : "26%";
          l.ln.setAttribute("x1", ex); l.ln.setAttribute("y1", ey); l.ln.setAttribute("x2", l.a.x); l.ln.setAttribute("y2", l.a.y); l.dot.setAttribute("cx", l.a.x); l.dot.setAttribute("cy", l.a.y);
        }
      }
    }
    const injLab = lab.find((l) => l.L.id === "ptendon");
    injLab.el.style.pointerEvents = "auto"; injLab.el.style.cursor = "pointer"; injLab.el.addEventListener("click", () => playTear());

    // ---- pose: knee bend, patella tracking, tendon states ----
    const lift = (u) => u < SNAP ? u / SNAP : 1 + 1.4 * (1 - Math.pow(1 - (u - SNAP) / (1 - SNAP), 2));
    function deform() {
      const a = -THREE.MathUtils.degToRad(S.bend), c = Math.cos(a), s = Math.sin(a);
      for (const k of skinned) {
        const pa = k.geo.attributes.position, na = k.geo.attributes.normal, r = k.rest, rn = k.restN;
        for (let i = 0; i < pa.count; i++) {
          const x = r[i * 3], y = r[i * 3 + 1], z = r[i * 3 + 2], w = sstep(4, -3, y);
          if (w === 0) { pa.setXYZ(i, x, y, z); na.setXYZ(i, rn[i * 3], rn[i * 3 + 1], rn[i * 3 + 2]); continue; }
          pa.setXYZ(i, x + w * (x * c - y * s - x), y + w * (x * s + y * c - y), z);
          const nx = rn[i * 3], ny = rn[i * 3 + 1]; na.setXYZ(i, nx + w * (nx * c - ny * s - nx), ny + w * (nx * s + ny * c - ny), rn[i * 3 + 2]);
        }
        pa.needsUpdate = na.needsUpdate = true;
      }
    }
    const pole3 = new THREE.Vector3(), T3 = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
    function showGT() { return G.active && G.step >= 3; }
    function pose(redeform = true) {
      const th = THREE.MathUtils.degToRad(S.bend);
      shin.rotation.z = -th; shin.updateMatrix(); if (redeform) deform();
      const T = rot(T0.x, T0.y, -th), d = T.length();
      const a = (R_P * R_P - L_C * L_C + d * d) / (2 * d), h = Math.sqrt(Math.max(0, R_P * R_P - a * a));
      const u = T.clone().divideScalar(d), perp = new THREE.Vector2(-u.y, u.x), Pp = u.clone().multiplyScalar(a).addScaledVector(perp, h);
      Pp.y += lift(S.tear) * (1 - S.bend / 160);
      const dir = T.clone().sub(Pp), len = dir.length(); dir.normalize();
      pg.position.set(Pp.x, Pp.y, 0); pg.rotation.z = Math.atan2(dir.x, -dir.y); pg.updateMatrixWorld(true);
      const lenT = len - 2.0, k = Math.min(1, S.tear / SNAP), setL = (m, y0, y1, rx, rz) => { m.position.set(0, (y0 + y1) / 2, 0); m.scale.set(rx, Math.abs(y1 - y0) + 1e-3, rz); m.quaternion.identity(); };
      M.tendon.color.setRGB(0.95 - 0.1 * k, 0.91 - 0.5 * k, 0.81 - 0.6 * k);
      const shake = S.tear > 0 && S.tear < SNAP ? Math.sin(S.tear * 160) * 0.06 * k : 0;
      setL(tMain, -2.0, -2.0 - lenT, 0.45 * (1 - 0.4 * k), 1.3 * (1 - 0.25 * k)); tMain.position.x = shake;
      pick.position.set(0, -2.0 - lenT / 2, 0); pick.scale.set(1.6, lenT + 1, 2.6);
      setL(band, -3.0, -3.0 - Math.max(1, lenT - 2.0), 0.62, 1.55);
      setL(tStub, -2.0 - lenT, -2.0 - lenT + 3.0 - 0.6 * (S.tear - SNAP) / (1 - SNAP), 0.45, 1.3);
      setL(tStubP, -2.0, -3.1, 0.38, 1.1); fray.position.set(0, -2.0 - lenT + 3.4, 0); fray.scale.set(0.5, 0.9, 1.2); fray.rotation.z = Math.PI;
      fray2.position.set(0, -3.5, 0); fray2.scale.set(0.45, 0.8, 1.1);
      // quadriceps tendon: thigh muscle end -> top of the kneecap
      const sp = V3(Pp.x - dir.x * 2.0, Pp.y - dir.y * 2.0, 0); seg(quadTendon, V3(3.9, 9, 0), sp, 0.4, 1.1);
      // ligaments (femur end fixed, shin end rides with the shin)
      for (const L of ligs) { const aa = L.a.clone(), bb = L.b.clone(); if (L.shinB) bb.applyMatrix4(shin.matrix); seg(L.m, aa, bb, L.r, L.r); }
      // retinaculum fans: patella side -> shin side
      for (const R of retin) {
        const pa = pg.localToWorld(V3(0.3, -0.2 - R.k * 0.9, R.z * 2.2)); const pb = V3(3.2 - R.k * 0.4, -3.8 - R.k * 1.6, R.z * 3.4).applyMatrix4(shin.matrix);
        seg(R.m, pa, pb, 0.09, 0.03);
      }
      pole3.copy(pg.localToWorld(V3(0, -2.0, 0))); T3.set(T0.x, T0.y, 0).applyMatrix4(shin.matrix);
      warm.position.copy(pg.localToWorld(V3(-2, -2.5, -5)));
      applyVis(); need = true;
      if (!G.active) say(`Left knee · bent ${S.bend}° · ${S.tear >= SNAP ? "before repair (torn)" : "after repair"}. ${INFO}`);
    }
    function applyVis() {
      const torn = S.tear >= SNAP, gt = showGT();
      root.traverse((o) => {
        const l = o.userData.layer; if (!l) return; o.visible = layerOn[l];
      });
      const v = (o, c) => { o.visible = o.visible && c; };
      v(tMain, !gt && !torn); v(tStub, !gt && torn); v(tStubP, !gt && torn); v(fray, !gt && torn); v(fray2, !gt && torn); v(gTendon, gt);
      v(band, !gt && !torn && S.injuryOn); v(pick, !torn); pick.visible = !G.active;
      anchors.forEach((o, i) => v(o, G.active ? G.anch[i] : !torn)); statSut.forEach((o) => v(o, !G.active && !torn)); v(patch, G.active ? G.patch : !torn);
      glow.visible = layerOn.injury; pole.visible = layerOn.injury; retin.forEach((r) => { r.m.visible = layerOn.tendon; });
      ligs.forEach((l) => { l.m.visible = layerOn.tendon; });
    }
    function setLayer(name, on) { if (!(name in layerOn)) return; layerOn[name] = !!on; if (name === "injury") S.injuryOn = !!on; pose(false); }
    function setBend(deg) { S.bend = Math.round(THREE.MathUtils.clamp(+deg || 0, 0, 130)); pose(); return S.bend; }
    function setState(s) { anim = null; S.tear = (s === "torn" || s === "ruptured") ? 1 : 0; syncTornBox(); pose(false); }

    // ---- tear animation (slow motion) ----
    function playTear() {
      if (G.active) return; S.tear = 0; anim = { kind: "tear", t0: performance.now(), dur: 6500, snapped: false }; pose(false);
      say("🎬 Watch closely… the tendon is stretching more and more…");
    }
    function stepAnim(now) {
      if (!anim) return;
      if (anim.kind === "tear") {
        S.tear = Math.min(1, (now - anim.t0) / anim.dur);
        if (!anim.snapped && S.tear >= SNAP) { anim.snapped = true; fire(pole3, "tear"); say("💥 SNAP! A complete tear at the bottom tip of the kneecap. The kneecap shoots upward."); }
        pose(false);
        if (S.tear >= 1) { anim = null; syncTornBox(); offerSurgery(); }
      } else if (anim.kind === "repair") {
        const k = Math.min(1, (now - anim.t0) / 900); S.tear = anim.from * (1 - k * k * (3 - 2 * k)); pose(false);
        if (k >= 1) { anim = null; S.tear = 0; pose(false); gameStep(4); }
      }
    }
    function syncTornBox() { const t = container.ownerDocument.querySelector("#leg-torn"); if (t) t.checked = S.tear >= SNAP; }

    // ---- surgery game ----
    function html(b) { card.innerHTML = b; card.hidden = false; }
    function offerSurgery() { html(`<b>😬 Ouch, that tendon let go.</b><br>Want to fix it yourself?<div class="k-row"><button data-k="start" class="k-go">🛠️ Do my surgery</button><button data-k="replay">↻ Replay the tear</button></div>`); }
    function startGame() {
      G.active = true; G.step = 0; G.anch = [false, false]; G.snapped = false; G.patch = false; G.done = false; anim = null; S.tear = 1; S.bend = 0; syncBend();
      setLayer("muscle", false); setCheck("muscle", false);
      camTo(V3(52, 3, -9), V3(0, 0, 0)); pose(false); say("🩺 Surgery time!");
      html(`<b>🩺 Welcome, Doctor!</b> Today's patient is one very brave knee. The tendon holding the kneecap to the shin has snapped. We'll fix it in 4 easy steps.<div class="k-row"><button data-k="go" class="k-go">I'm scrubbed in! ▶</button><button data-k="quit">Not now</button></div><small>Just a teaching game, not medical advice.</small>`);
    }
    const STEPS = {
      1: "🔩 <b>Step 1 of 4:</b> Drag the shiny <b>silver anchor</b> to the glowing green spot on the bottom edge of the kneecap. It's a tiny screw that holds the stitches.",
      2: "🔩 <b>Step 2 of 4:</b> One more anchor! Drag it to the second green spot. Two anchors = double the grip.",
      3: "🧵 <b>Step 3 of 4:</b> The torn tendon end is dangling. Drag the <b>glowing orange end</b> up to the kneecap. Watch the blue stitches pull it tight!",
      4: "🩹 <b>Step 4 of 4:</b> Last touch! Drag the <b>golden patch</b> over the repair, like a bandage for the tendon (it helps it heal).",
    };
    function gameStep(n) {
      G.step = n; need = true;
      if (n === 5) return finishGame();
      html(`${STEPS[n]}<div class="k-dots">${[1, 2, 3, 4].map((i) => `<i class="${i < n ? "d" : i === n ? "a" : ""}"></i>`).join("")}</div><div class="k-row"><button data-k="hint">💡 Where?</button><button data-k="quit">✕ Stop</button></div>`);
      const cam = new THREE.Vector3().copy(camera.position).sub(controls.target).normalize(), right = new THREE.Vector3().crossVectors(V3(0, 1, 0), cam).normalize().negate();
      const t = targetOf(n), up = V3(0, 1, 0);
      if (n === 3) { handle.position.copy(T3).lerp(pole3, 0.55); } else handle.position.copy(t).addScaledVector(right, 9).addScaledVector(up, n === 4 ? -3 : -2.5);
      hAnchor.visible = n <= 2; hStump.visible = n === 3; hPatch.visible = n === 4; handle.visible = true; tgt.visible = true; hint.visible = false;
      hPatch.quaternion.copy(camera.quaternion);
      pose(false);
    }
    function targetOf(n) {
      if (n === 1) return pg.localToWorld(V3(0.1, -1.95, -1.0)); if (n === 2) return pg.localToWorld(V3(0.1, -1.95, 1.0));
      if (n === 3) return pole3.clone(); return pg.localToWorld(V3(0.6, -3.4, 0));
    }
    function finishGame() {
      pose(false); handle.visible = false; tgt.visible = false; hint.visible = false; sutLine.forEach((s) => (s.visible = false));
      fire(pole3.clone().add(V3(0, 2, 0)), "confetti"); const secs = Math.round((performance.now() - G.t0) / 1000), rank = secs < 45 ? "Speedy Surgeon ⚡" : secs < 100 ? "Steady Hands 🙌" : "Careful Doctor 🐢";
      html(`<b>🎉 Surgery complete!</b> The knee is fixed.<br>Time: ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")} · Rank: <b>${rank}</b><div class="k-row"><button data-k="again" class="k-go">↻ Do it again</button><button data-k="quit">Done</button></div>`);
      G.done = true; window.dispatchEvent(new CustomEvent("sb:surgery-complete", { detail: { seconds: secs } }));
    }
    function quitGame() { G.active = false; handle.visible = false; tgt.visible = false; hint.visible = false; sutLine.forEach((s) => (s.visible = false)); card.hidden = true; anim = null; S.tear = 0; setLayer("muscle", true); setCheck("muscle", true); camTo(HOME.pos, HOME.tgt); syncTornBox(); pose(false); }
    card.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return; const k = b.dataset.k;
      if (k === "start" || k === "again") { startGame(); } else if (k === "go") { G.t0 = performance.now(); gameStep(1); }
      else if (k === "quit") quitGame(); else if (k === "replay") { playTear(); card.hidden = true; }
      else if (k === "hint") { hint.visible = !hint.visible; }
    });
    function snap() {
      const n = G.step; fire(targetOf(n), "tear"); if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) { /* ignore */ }
      if (n === 1 || n === 2) { G.anch[n - 1] = true; gameStep(n + 1); }
      else if (n === 3) { G.snapped = true; handle.visible = false; tgt.visible = false; hint.visible = false; anim = { kind: "repair", t0: performance.now(), from: S.tear }; html("<b>💪 Nice! Pulling the kneecap back down…</b>"); }
      else if (n === 4) { G.patch = true; gameStep(5); }
    }

    // ---- pointer: tap the tendon / drag the game piece ----
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3();
    const toNdc = (e) => { const r = renderer.domElement.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
    let drag = null, down = null;
    container.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".k-card,.k-lab")) return; toNdc(e);
      if (G.active && handle.visible && ray.intersectObject(hPick, false).length) {
        e.stopPropagation(); e.preventDefault(); controls.enabled = false;
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), handle.position); ray.ray.intersectPlane(plane, hit);
        drag = { off: handle.position.clone().sub(hit) }; try { container.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
      } else down = { x: e.clientX, y: e.clientY, t: performance.now() };
    }, true);
    container.addEventListener("pointermove", (e) => {
      if (drag) {
        toNdc(e); plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), handle.position);
        if (ray.ray.intersectPlane(plane, hit)) { handle.position.copy(hit).add(drag.off); if (handle.position.distanceTo(targetOf(G.step)) < 1.1) { endDrag(); snap(); } }
      }
    });
    const endDrag = () => { drag = null; controls.enabled = true; };
    container.addEventListener("pointerup", (e) => {
      if (drag) { const near = handle.position.distanceTo(targetOf(G.step)) < 2.6; endDrag(); if (near) snap(); return; }
      if (down && !G.active && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 7 && performance.now() - down.t < 600) {
        toNdc(e); if (ray.intersectObjects([pick, band, tStub], false).length || ray.intersectObject(glow, false).length) playTear();
      }
      down = null;
    });
    container.addEventListener("pointercancel", () => { if (drag) endDrag(); down = null; });

    // ---- camera tween, resize, loop ----
    function camTo(p, t) { camTw = { t0: performance.now(), p0: camera.position.clone(), t0v: controls.target.clone(), p1: p.clone(), t1: t.clone() }; }
    function reset() { camTo(HOME.pos, HOME.tgt); }
    function resize() { const w = container.clientWidth || 300, h = container.clientHeight || 420; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 0.8 ? 46 : 35; camera.updateProjectionMatrix(); need = true; measure(); }
    const ro = new ResizeObserver(resize); ro.observe(container); resize();
    controls.addEventListener("change", () => { need = true; });
    const io = new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible) loop(); }, { threshold: 0 }); io.observe(container);
    renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); say("3D view paused (graphics reset). Reload to restore."); });
    const t00 = performance.now(), qv = new THREE.Vector3(), cv = new THREE.Vector3();
    function loop() {
      cancelAnimationFrame(raf); if (disposed || !visible) return;
      const now = performance.now(), t = (now - t00) / 1000; uni.uTime.value = t;
      if (camTw) { const k = Math.min(1, (now - camTw.t0) / 900), e = k * k * (3 - 2 * k); camera.position.lerpVectors(camTw.p0, camTw.p1, e); controls.target.lerpVectors(camTw.t0v, camTw.t1, e); if (k >= 1) camTw = null; }
      stepAnim(now);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2), torn = S.tear >= SNAP;
      glow.scale.setScalar(5.5 + 2 * pulse + (torn ? 1.5 : 0)); glow.material.opacity = 0.55 + 0.4 * pulse; glow.material.color.set(torn ? 0xff2a1a : 0xff7a22);
      M.inj.emissiveIntensity = 0.6 + 0.8 * pulse; M.patella.emissiveIntensity = 0.7 + 0.6 * pulse; warm.intensity = 40 + 40 * pulse;
      scan.position.y = CUT_BOT + 3 + (CUT_TOP - CUT_BOT - 6) * (0.5 + 0.5 * Math.sin(t * 0.7)); scan.visible = layerOn.fx;
      const mp = mote.pos; for (let i = 0; i < mote.n; i++) { mp[i * 3 + 1] += 0.012 + 0.006 * Math.sin(t + mote.ph[i]); mp[i * 3] += 0.004 * Math.sin(t * 0.6 + mote.ph[i]); if (mp[i * 3 + 1] > 22) mp[i * 3 + 1] = -18; }
      mote.m.geometry.attributes.position.needsUpdate = true;
      for (const a of arrows) a.cones.forEach((c, i) => { const u = (t * 0.18 + i / a.n) % 1; a.curve.getPoint(u, c.position); a.curve.getTangent(u, qv); c.quaternion.setFromUnitVectors(V3(0, 1, 0), qv); });
      if (burst.life > 0) { burst.life -= 0.012; const p = burst.pos; for (let i = 0; i < burst.n; i++) { for (let j = 0; j < 3; j++) p[i * 3 + j] += burst.vel[i * 3 + j] * 0.016; burst.vel[i * 3 + 1] -= (burst.kind === "confetti" ? 0.12 : 0.02); } burst.m.geometry.attributes.position.needsUpdate = true; burst.m.material.opacity = Math.max(0, burst.life); }
      if (G.active && G.step >= 1 && G.step <= 4) {
        const tt = targetOf(G.step); tgt.position.copy(tt); tgt.scale.setScalar(4 + 1.2 * pulse); hSprite.scale.setScalar(5 + pulse * 1.5); hSprite.material.color.set(G.step === 3 ? 0xff9a3a : G.step === 4 ? 0xffd24a : 0xaad4ff);
        if (!drag) handle.position.y += Math.sin(t * 3) * 0.004;
        hPatch.quaternion.copy(camera.quaternion); hAnchor.rotation.z = 0.0;
        if (hint.visible) { const g = hint.geometry.attributes.position; g.setXYZ(0, handle.position.x, handle.position.y, handle.position.z); g.setXYZ(1, tt.x, tt.y, tt.z); g.needsUpdate = true; hint.computeLineDistances(); }
      }
      // sutures: from placed anchors to the tendon end
      const tip = G.snapped ? pole3 : handle.position;
      sutLine.forEach((s, i) => { const on = G.active && G.anch[i] && G.step >= 3 && G.step <= 5 || (G.active && G.anch[i] && G.step === 3); s.visible = on; if (on) seg(s, pg.localToWorld(V3(0.1, -2.5, i ? 1 : -1)), tip.clone().add(V3(0, 0, i ? 0.6 : -0.6)), 0.06, 0.06); });
      if (showGT()) seg(gTendon, T3, G.snapped ? pole3 : handle.position, 0.8, 0.8);
      layoutLabels(); controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    }
    function syncBend() { const b = container.ownerDocument.querySelector("#leg-bend"), bv = container.ownerDocument.querySelector("#leg-bend-val"); if (b) b.value = S.bend; if (bv) bv.textContent = S.bend + "°"; }
    function setCheck(name, v) { const c = container.ownerDocument.querySelector(`[data-layer="${name}"]`); if (c) c.checked = v; }

    // ---- X-ray API ----
    function setXray(src, o = {}) {
      Object.assign(xr.opts, o); const url = typeof src === "string" ? src : URL.createObjectURL(src);
      new THREE.TextureLoader().load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace; clearXray(); const ar = tex.image.width / tex.image.height;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(xr.opts.size * ar, xr.opts.size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: xr.opts.opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
        m.position.set(xr.opts.x, xr.opts.y, 0); m.renderOrder = 50; xr.mesh = m; root.add(m); need = true; if (typeof src !== "string") URL.revokeObjectURL(url);
      });
    }
    function clearXray() { if (xr.mesh) { root.remove(xr.mesh); xr.mesh.material.map.dispose(); xr.mesh.material.dispose(); xr.mesh.geometry.dispose(); xr.mesh = null; need = true; } }
    function setXrayOpacity(v) { xr.opts.opacity = +v; if (xr.mesh) { xr.mesh.material.opacity = +v; need = true; } }

    // ---- bind the page's controls (ids from index.html) ----
    const ui = opts.ui === false ? null : (opts.uiRoot || container.ownerDocument);
    if (ui) {
      const bar = ui.querySelector("#leg-ui");
      if (bar && !bar.querySelector("#leg-torn")) bar.insertAdjacentHTML("beforeend",
        `<label><input type="checkbox" data-layer="injury" checked> Highlight injury</label>` +
        `<label><input type="checkbox" data-layer="fx" checked> Glow &amp; labels</label>` +
        `<label><input type="checkbox" id="leg-torn"> Show the tear (before repair)</label>` +
        `<label id="leg-xop-wrap" hidden>X-ray opacity <input type="range" id="leg-xop" min="0.1" max="1" step="0.05" value="0.6"></label>` +
        `<button type="button" id="leg-names">Names: easy + medical</button><button type="button" id="leg-replay">▶ Replay the tear</button><button type="button" id="leg-surgery" class="primary">🛠️ Do my surgery</button><button type="button" id="leg-reset">Reset view</button>`);
      ui.querySelectorAll("[data-layer]").forEach((c) => c.addEventListener("change", () => setLayer(c.dataset.layer, c.checked)));
      const bend = ui.querySelector("#leg-bend"), bv = ui.querySelector("#leg-bend-val");
      if (bend) bend.addEventListener("input", () => { const v = setBend(bend.value); if (bv) bv.textContent = v + "°"; });
      const torn = ui.querySelector("#leg-torn"); if (torn) torn.addEventListener("change", () => { if (G.active) { torn.checked = true; return; } setState(torn.checked ? "torn" : "repaired"); });
      const rs = ui.querySelector("#leg-reset"); if (rs) rs.addEventListener("click", reset);
      const nb = ui.querySelector("#leg-names"); if (nb) nb.addEventListener("click", () => { const m = (S.nameMode + 1) % 3; setNames(m); nb.textContent = ["Names: easy + medical", "Names: easy", "Names: medical"][m]; });
      const rp = ui.querySelector("#leg-replay"); if (rp) rp.addEventListener("click", () => { if (!G.active) playTear(); });
      const su = ui.querySelector("#leg-surgery"); if (su) su.addEventListener("click", () => { if (!G.active) startGame(); });
      const xf = ui.querySelector("#leg-xray"), xw = ui.querySelector("#leg-xop-wrap"), xo = ui.querySelector("#leg-xop");
      if (xf) xf.addEventListener("change", () => { if (xf.files[0]) { setXray(xf.files[0]); if (xw) xw.hidden = false; } });
      if (xo) xo.addEventListener("input", () => setXrayOpacity(xo.value));
    }

    Object.assign(api, { setLayer, setBend, setState, setXray, clearXray, setXrayOpacity, reset, playTear, startGame, quitGame, dispose,
      parts: P, _dbg: { handle, targetOf } });
    function dispose() { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); controls.dispose(); clearXray(); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); renderer.dispose(); renderer.domElement.remove(); ov.remove(); card.remove(); credit.remove(); }
    ready = true; pose(); loop();
  }
}

function injectStyle() {
  if (document.getElementById("k-holo-css")) return;
  const s = document.createElement("style"); s.id = "k-holo-css";
  s.textContent = `
  .k-holo{background:radial-gradient(ellipse at 50% 45%,#10244a 0%,#070f24 55%,#02050d 100%) !important;border-color:#1f4a8a !important}
  .k-holo::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(80,160,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(80,160,255,.07) 1px,transparent 1px);background-size:38px 38px;mask-image:radial-gradient(ellipse at center,#000 30%,transparent 80%)}
  .k-ov{position:absolute;inset:0;pointer-events:none;z-index:2}.k-ov.off .k-lab,.k-ov.off svg{display:none}
  .k-lines{position:absolute;inset:0;width:100%;height:100%}.k-lines line{stroke:rgba(190,225,255,.75);stroke-width:1}.k-lines circle{fill:#bfe3ff}
  .k-lines line.inj{stroke:#ff7a3a;stroke-width:1.6}.k-lines circle.inj{fill:#ff5a1a}
  .k-lab{position:absolute;color:#e6f2ff;font:600 11.5px/1.2 system-ui,sans-serif;text-shadow:0 0 6px #000,0 0 3px #000;padding:2px 3px;background:rgba(5,12,30,.45);border-radius:4px}
  .k-lab small{display:block;font-weight:400;font-size:9.5px;opacity:.75;font-style:italic}.k-lab.inj{color:#ffd0a8;border:1px solid #ff7a3a;background:rgba(60,15,5,.6)}
  .k-hud{position:absolute;width:26px;height:26px;border:2px solid rgba(90,200,255,.7)}.k-hud.tl{left:6px;top:6px;border-right:0;border-bottom:0}.k-hud.br{right:6px;bottom:6px;border-left:0;border-top:0}
  .k-card{position:absolute;left:50%;transform:translateX(-50%);top:10px;width:min(440px,calc(100% - 24px));z-index:5;background:rgba(6,16,40,.92);border:1px solid #3aa0ff;border-radius:12px;padding:10px 12px;color:#e8f3ff;font-size:.9rem;line-height:1.35;box-shadow:0 0 18px rgba(60,160,255,.4)}
  .k-card .k-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}.k-card button{background:#10305a;color:#e8f3ff;border:1px solid #3aa0ff;border-radius:8px;padding:6px 10px;font-size:.85rem;cursor:pointer}.k-card button.k-go{background:#ff6a1a;border-color:#ff9a5a;color:#fff;font-weight:700}
  .k-card small{display:block;opacity:.65;margin-top:6px;font-size:.7rem}.k-dots{display:flex;gap:6px;margin-top:6px}.k-dots i{width:34px;height:6px;border-radius:3px;background:#27406a}.k-dots i.a{background:#ffb04a}.k-dots i.d{background:#4ade80}
  .k-credit{position:absolute;right:10px;bottom:6px;z-index:3;font-size:9px;color:rgba(190,215,255,.55);pointer-events:none}
  .k-holo .leg-tag{display:none}`;
  document.head.appendChild(s);
}
export default mountKnee;
