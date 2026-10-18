// Component labels: HTML text pinned to 3D anchor objects, re-projected every
// frame so they stay attached as the camera moves. Label text comes from the
// topic's stages.json ("labels": { anchorKey: text }).

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

  const items = Object.entries(texts)
    .filter(([key]) => anchors[key])
    .map(([key, text]) => {
      const node = document.createElement('div');
      node.className = 'aim-label';
      node.dataset.key = key;
      const pill = document.createElement('span');
      pill.textContent = text;
      node.append(pill);
      layer.append(node);
      return { key, anchor: anchors[key], node };
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
    if (!visible) return;
    const w = viewport.clientWidth;
    const h = viewport.clientHeight;
    for (const it of items) {
      it.anchor.getWorldPosition(v);
      const facing = facesCamera(it.anchor);
      v.project(camera);
      const onScreen = v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      const show = onScreen && facing && shownInScene(it.anchor);
      it.node.hidden = !show;
      if (show) it.node.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
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
      return items.map((it) => ({ key: it.key, hidden: it.node.hidden, transform: it.node.style.transform }));
    },
  };
}
