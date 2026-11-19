// Procedural studio lighting environment for metal reflections (no image files).

export function createStudioEnvironment(THREE, renderer) {
  const env = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(20, 12, 20),
    new THREE.MeshBasicMaterial({ color: 0x15181d, side: THREE.BackSide }),
  );
  env.add(room);

  const panel = (color, intensity, pos, scale) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.set(...pos);
    m.scale.set(...scale);
    env.add(m);
  };
  panel(0xffffff, 6, [0, 5.8, 0], [8, 0.1, 6]);      // soft top light
  panel(0xdfe9ff, 3, [-9.8, 1, 2], [0.1, 6, 8]);     // cool side fill
  panel(0xfff1e0, 4, [9.8, 2, -2], [0.1, 4, 6]);     // warm side key
  panel(0x8a96a8, 0.8, [0, -5.8, 0], [12, 0.1, 12]); // faint floor bounce
  panel(0xe8eef7, 1.6, [2, 2, 9.8], [8, 5, 0.1]);     // front softbox
  panel(0xcfd9ea, 1.0, [-2, 2, -9.8], [8, 5, 0.1]);   // back softbox

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.04);
  pmrem.dispose();
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return target.texture;
}
