# 3D knee module (hologram + surgery game)
Files: `knee.js` (module), `demo.html` (standalone test page). Nothing else in the site was touched.

Integration (in app.js, e.g. when the 3D card first scrolls into view):
```js
import("/3d/knee.js").then(m => { window.knee = m.mountKnee(document.getElementById("leg-wrap")); });
```
- Needs the `three` import map entry already in index.html; imports `../vendor/OrbitControls.js`.
- Binds the existing ids in index.html: `[data-layer]` checkboxes, `#leg-bend`, `#leg-bend-val`, `#leg-xray`, `#leg-tag`. It adds "Highlight injury", "Show the tear (before repair)", "X-ray opacity" and "Reset view" controls to `#leg-ui`. Pass `{ui:false}` to skip binding.
- API: `setLayer(name,bool)` (skin, muscle, tendon, bone, implant, injury), `setBend(0-130)`, `setState("repaired"|"torn")`, `setXray(fileOrUrl,{opacity,size,x,y})`, `clearXray()`, `setXrayOpacity(v)`, `reset()`, `dispose()`.
- X-ray hook: a see-through plane through the knee (lateral view), no data upload.

## v2 (futuristic redesign)
- Real bones/muscles come from `knee-parts.json` + `knee-parts.bin` (BodyParts3D © DBCLS, CC BY 4.0, simplified meshes cropped to the left knee). Tendons, ligaments, cartilage, implants, glow shell, labels and the game are drawn in code.
- Labels show an easy name plus the medical name (button cycles easy+medical / easy / medical). Injury parts (patellar tendon, inferior pole, retinaculum) glow orange and pulse.
- Tap the tendon (or press Replay the tear) for a slow-motion rupture; then `Do my surgery` runs a 4-step drag game: 2 Q-Fix anchors, pull the tendon up, collagen patch. Fires `sb:surgery-complete`.
- Extra API: `playTear()`, `startGame()`, `quitGame()`. `setLayer` also accepts `fx` (glow, particles, labels).
