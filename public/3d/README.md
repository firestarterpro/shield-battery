# 3D knee module (W4)
Files: `knee.js` (module), `demo.html` (standalone test page). Nothing else in the site was touched.

Integration (in app.js, e.g. when the 3D card first scrolls into view):
```js
import("/3d/knee.js").then(m => { window.knee = m.mountKnee(document.getElementById("leg-wrap")); });
```
- Needs the `three` import map entry already in index.html; imports `../vendor/OrbitControls.js`.
- Binds the existing ids in index.html: `[data-layer]` checkboxes, `#leg-bend`, `#leg-bend-val`, `#leg-xray`, `#leg-tag`. It adds "Highlight injury", "Show the tear (before repair)", "X-ray opacity" and "Reset view" controls to `#leg-ui`. Pass `{ui:false}` to skip binding.
- API: `setLayer(name,bool)` (skin, muscle, tendon, bone, implant, injury), `setBend(0-130)`, `setState("repaired"|"torn")`, `setXray(fileOrUrl,{opacity,size,x,y})`, `clearXray()`, `setXrayOpacity(v)`, `reset()`, `dispose()`.
- X-ray hook: a see-through plane through the knee (lateral view), no data upload.
