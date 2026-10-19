// Component labels: HTML text pinned to 3D anchor objects, re-projected every
// frame so they stay attached as the camera moves. Label text comes from the
// topic's stages.json ("labels": { anchorKey: text }). A scene may also set
// text from code on the anchor itself (anchor.userData.label; changes are picked
// up every frame), a style class (userData.labelClass), userData.labelAutoFlip
// (the label switches sides near the view's edges), and userData.labelAlways
// for labels that stay visible when the Labels toggle is off (e.g. axis names).

function shownInScene(obj) {
  for (let o = obj; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export function createLabels(viewport, api, texts) {
  const { THREE, camera, sceneInfo } = api;
  const anchors = sceneInfo.labelAnchors || {};
  const layer = document.createElement('div');
  layer.className = 'aim-labels';
  // Visual only: the same component names are in the stage text.
  layer.setAttribute('aria-hidden', 'true');
  viewport.insertBefore(layer, viewport.querySelector('.aim-overlay'));

  let fixedLayer = null;
  const entries = Object.entries(texts).filter(([key]) => anchors[key]);
  for (const [key, anchor] of Object.entries(anchors)) {
    if (!(key in texts) && typeof anchor.userData?.label === 'string') entries.push([key, anchor.userData.label]);
  }
  const items = entries.map(([key, text]) => {
    const anchor = anchors[key];
    const node = document.createElement('div');
    node.className = anchor.userData.labelClass ? `aim-label ${anchor.userData.labelClass}` : 'aim-label';
    node.dataset.key = key;
    const pill = document.createElement('span');
    pill.textContent = text;
    node.append(pill);
    if (anchor.userData.labelAlways) {
      if (!fixedLayer) {
        fixedLayer = document.createElement('div');
        fixedLayer.className = 'aim-labels aim-labels-fixed';
        fixedLayer.setAttribute('aria-hidden', 'true');
        viewport.insertBefore(fixedLayer, layer);
      }
      fixedLayer.append(node);
    } else {
      layer.append(node);
    }
    return { key, anchor, node, pill, text, always: !!anchor.userData.labelAlways };
  });

  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  // Hide a label whose surface faces away from the camera (cheap stand-in for occlusion).
  const facesCamera = (anchor) => {
    const local = anchor.userData.normal;
    if (!local) return true;
    n.set(...local).transformDirection(anchor.matrixWorld);
    toCam.copy(camera.position).sub(v);
    return n.dot(toCam) > 0;
  };
  let visible = true;

  function update() {
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    for (const it of items) {
      if (!visible && !it.always) continue;
      const text = it.anchor.userData.label;
      if (typeof text === 'string' && text !== it.text) { it.text = text; it.pill.textContent = text; it.size = null; }
      it.anchor.getWorldPosition(v);
      const facing = facesCamera(it.anchor);
      v.project(camera);
      const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      const show = onScreen && facing && shownInScene(it.anchor);
      it.node.hidden = !show;
      if (!show) continue;
      const x = ((v.x + 1) / 2) * w;
      const y = ((1 - v.y) / 2) * h;
      it.node.style.transform = `translate(${x}px, ${y}px)`;
      // userData.labelAutoFlip: keep the default side (right of and above the
      // point) when it fits; otherwise use the side with more room.
      if (it.anchor.userData.labelAutoFlip) {
        if (!it.size) it.size = [it.pill.offsetWidth, it.pill.offsetHeight];
        const [lw, lh] = it.size;
        const rightFits = x + 12 + lw <= w - 4;
        const upFits = y - 8 - lh >= 4;
        it.node.classList.toggle('aim-label-flip-x', !rightFits && x - 12 - lw >= w - 4 - (x + 12 + lw));
        it.node.classList.toggle('aim-label-flip-y', !upFits && h - (y + 8 + lh) >= y - 8 - lh);
      }
    }
  }
  api.addHook('post', update);

  return {
    get visible() { return visible; },
    setVisible(on) {
      visible = !!on;
      layer.hidden = !visible;
      if (visible) update();
    },
    positions() {
      update();
      return items.map((it) => ({ key: it.key, text: it.text, always: it.always, hidden: it.node.hidden, transform: it.node.style.transform }));
    },
  };
}
