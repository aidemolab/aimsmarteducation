// Placeholder scene for the module template: a slowly turning wireframe and the words
// "Living model goes here". Replace it with the module's own scene (same interface:
// init, update, setStage, setOption, debugState), keeping it in this unit's scenes/ folder.
let shape = null;
let label = null;

export default {
  id: 'placeholder',

  init(context) {
    const { THREE, root, overlay } = context;
    shape = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.7, 0.2, 96, 10),
      new THREE.MeshBasicMaterial({ color: 0x8c90f0, wireframe: true, transparent: true, opacity: 0.55 }),
    );
    root.add(shape);
    if (overlay) {
      label = document.createElement('p');
      label.className = 'placeholder-scene-label';
      label.textContent = 'Living model goes here';
      overlay.append(label);
    }
    return { defaultView: { position: [0, 0.5, 6.5], target: [0, 0, 0] } };
  },

  update(t) {
    if (shape) { shape.rotation.y = t * 0.3; shape.rotation.x = 0.4; }
  },

  setStage() {},

  setOption() {},

  debugState(t) {
    return { stage: 0, t, placeholder: true };
  },
};
