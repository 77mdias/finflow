"use client";

import { useEffect, useRef, useState } from "react";

// Do fundo para a frente. Modelos otimizados com glTF-Transform (meshopt + WebP 1024).
// `flip`: o modelo foi exportado com a frente voltada para −Z.
const MODELS = [
  { url: "/3D/caixacard.glb" },
  { url: "/3D/picpaycard.glb" },
  { url: "/3D/intercard.glb" },
  { url: "/3D/nubankcard.glb", flip: true },
];

const FAN_STEP = 0.2; // rad entre cartões no leque
const PIVOT = 1.9; // distância do pivô (abaixo) até o centro do cartão
const BASE_TILT = { x: -0.32, y: 0.38 };
const ENTRANCE_MS = 900;

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));

/** Leque de cartões 3D do hero. Carrega three.js só quando o palco chega perto da tela. */
export function CardStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        mountScene(host)
          .then((d) => {
            if (cancelled) return d();
            dispose = d;
            setReady(true);
          })
          // Sem WebGL ou falha de rede: o palco fica só com o fundo, a página segue utilizável.
          .catch(() => undefined);
      },
      { rootMargin: "200px" },
    );
    io.observe(host);

    return () => {
      cancelled = true;
      io.disconnect();
      dispose?.();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      aria-hidden
      className={`absolute inset-0 transition-opacity duration-500 ease-out ${ready ? "opacity-100" : "opacity-0"}`}
    />
  );
}

async function mountScene(host: HTMLDivElement): Promise<() => void> {
  const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
  ]);

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltfs = await Promise.all(MODELS.map(({ url }) => loader.loadAsync(url)));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const rig = new THREE.Group();
  scene.add(rig);

  const n = gltfs.length;
  const arms = gltfs.map((gltf, i) => {
    const arm = new THREE.Group();
    arm.position.y = -PIVOT;
    gltf.scene.position.set(0, PIVOT, i * 0.03);
    if (MODELS[i]?.flip) gltf.scene.rotation.y = Math.PI;
    arm.add(gltf.scene);
    rig.add(arm);
    return { arm, angle: ((n - 1) / 2 - i) * FAN_STEP };
  });

  const pose = (p: number) => {
    const e = easeOutExpo(p);
    for (const { arm, angle } of arms) arm.rotation.z = angle * e;
  };

  // Enquadra pelo leque já aberto, para caber em qualquer proporção do palco.
  pose(1);
  rig.rotation.set(BASE_TILT.x, BASE_TILT.y, 0);
  const box = new THREE.Box3().setFromObject(rig);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  rig.position.sub(center);

  const fit = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(size.y / (2 * half), size.x / (2 * half * camera.aspect)) * 1.12 + size.z;
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tilt = { x: BASE_TILT.x, y: BASE_TILT.y };
  const target = { ...tilt };
  const start = performance.now();
  let raf = 0;

  const frame = (now: number) => {
    raf = 0;
    const p = reduced ? 1 : Math.min((now - start) / ENTRANCE_MS, 1);
    pose(p);
    tilt.x += (target.x - tilt.x) * 0.08;
    tilt.y += (target.y - tilt.y) * 0.08;
    rig.rotation.set(tilt.x, tilt.y, 0);
    renderer.render(scene, camera);
    const settling = Math.abs(target.x - tilt.x) + Math.abs(target.y - tilt.y) > 1e-4;
    if (p < 1 || settling) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  // Inclinação segue o ponteiro (interação, não loop); desligada com movimento reduzido.
  const onMove = (ev: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((ev.clientY - r.top) / r.height) * 2 - 1;
    target.x = BASE_TILT.x + ny * 0.12;
    target.y = BASE_TILT.y + nx * 0.22;
    kick();
  };
  const onLeave = () => {
    target.x = BASE_TILT.x;
    target.y = BASE_TILT.y;
    kick();
  };
  const surface = host.parentElement ?? host;
  if (!reduced) {
    surface.addEventListener("pointermove", onMove);
    surface.addEventListener("pointerleave", onLeave);
  }

  const ro = new ResizeObserver(() => {
    fit();
    kick();
  });
  ro.observe(host);
  fit();
  kick();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    surface.removeEventListener("pointermove", onMove);
    surface.removeEventListener("pointerleave", onLeave);
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      for (const m of [obj.material].flat() as InstanceType<typeof THREE.MeshStandardMaterial>[]) {
        for (const t of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap, m.emissiveMap]) t?.dispose();
        m.dispose();
      }
    });
    envMap.dispose();
    room.dispose();
    pmrem.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
