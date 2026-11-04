"use client";

import { useEffect, useRef, useState } from "react";

// Do fundo para a frente. Modelos otimizados com scripts/optimize-glb.sh (meshopt + WebP 1024).
// `flip`: o modelo foi exportado com a frente voltada para −Z.
const MODELS = [
  { url: "/3D/caixacard.glb" },
  { url: "/3D/picpaycard.glb" },
  { url: "/3D/intercard.glb" },
  { url: "/3D/nubankcard.glb", flip: true },
];

const FAN_STEP = 0.2; // rad entre cartões no leque
const PIVOT = 1.9; // distância do pivô (abaixo) até o centro do cartão
const BASE_TILT = { x: -0.28, y: 0.32 };
const ENTRANCE_MS = 1200;
const STAGGER_MS = 120;
const TAP = { ms: 300, px: 6 }; // toque curto sem arrastar = virar o cartão

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

/**
 * Leque de cartões 3D do hero: entram em sequência, flutuam devagar, seguem o ponteiro,
 * podem ser arrastados (voltam com mola) e viram com um toque. Carrega three.js só perto da tela.
 */
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
      // pan-y: no celular, arrastar na vertical rola a página; na horizontal, move o cartão.
      className={`absolute inset-0 touch-pan-y transition-opacity duration-500 ease-out ${ready ? "opacity-100" : "opacity-0"}`}
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
  type Vec3 = InstanceType<typeof THREE.Vector3>;

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

  // slot: gira em torno do pivô (abre o leque). body: posição/rotação animadas do cartão.
  const n = gltfs.length;
  const cards = gltfs.map((gltf, i) => {
    const slot = new THREE.Group();
    slot.position.y = -PIVOT;
    const body = new THREE.Group();
    body.position.set(0, PIVOT, i * 0.03);
    if (MODELS[i]?.flip) gltf.scene.rotation.y = Math.PI;
    gltf.scene.traverse((o) => (o.userData.card = i));
    body.add(gltf.scene);
    slot.add(body);
    rig.add(slot);
    return {
      slot,
      body,
      rest: body.position.clone(),
      angle: ((n - 1) / 2 - i) * FAN_STEP,
      phase: i * 1.7,
      flipped: false,
      hover: false,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      target: new THREE.Vector3(),
      rot: new THREE.Vector3(),
      rotVel: new THREE.Vector3(),
      rotTarget: new THREE.Vector3(),
    };
  });
  type Card = (typeof cards)[number];

  // Enquadra pelo leque já aberto, para caber em qualquer proporção do palco.
  for (const c of cards) c.slot.rotation.z = c.angle;
  rig.rotation.set(BASE_TILT.x, BASE_TILT.y, 0);
  const box = new THREE.Box3().setFromObject(rig);
  const size = box.getSize(new THREE.Vector3());
  rig.position.sub(box.getCenter(new THREE.Vector3()));

  const fit = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const half = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const dist = Math.max(size.y / (2 * half), size.x / (2 * half * camera.aspect)) * 1.18 + size.z;
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tilt = { x: BASE_TILT.x, y: BASE_TILT.y };
  const tiltTarget = { ...tilt };
  const start = performance.now();
  let last = start;
  let visible = true;
  let raf = 0;

  // Mola por eixo (Euler semi-implícito). Devolve true enquanto não assentou.
  const spring = (x: Vec3, v: Vec3, to: Vec3, k: number, c: number, dt: number) => {
    let moving = false;
    for (const a of ["x", "y", "z"] as const) {
      v[a] += (k * (to[a] - x[a]) - c * v[a]) * dt;
      x[a] += v[a] * dt;
      if (Math.abs(to[a] - x[a]) + Math.abs(v[a]) > 1e-4) moving = true;
    }
    return moving;
  };

  type Drag = {
    card: Card;
    grab: Vec3;
    x0: number;
    y0: number;
    t0: number;
    lx: number;
    ly: number;
    lt: number;
    vx: number;
    vy: number;
    moved: boolean;
  };
  let drag: Drag | null = null;

  const frame = (now: number) => {
    raf = 0;
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    const time = (now - start) / 1000;
    let busy = false;

    if (drag) {
      // Inclina na direção do arrasto; a inclinação some quando o ponteiro para.
      const decay = Math.exp(-dt * 8);
      drag.vx *= decay;
      drag.vy *= decay;
      drag.card.rotTarget.set(
        clamp(drag.vy * 0.3, 0.35),
        (drag.card.flipped ? Math.PI : 0) + clamp(drag.vx * 0.3, 0.45),
        clamp(-drag.vx * 0.1, 0.2),
      );
    }

    cards.forEach((c, i) => {
      const p = reduced ? 1 : Math.min(Math.max((now - start - i * STAGGER_MS) / ENTRANCE_MS, 0), 1);
      const e = easeOutExpo(p);
      if (p < 1) busy = true;
      c.slot.rotation.z = c.angle * e;

      const grabbed = drag?.card === c;
      // Enquanto vira, salta para a frente para não atravessar os vizinhos.
      if (!grabbed) c.target.z = Math.abs(c.rotTarget.y - c.rot.y) > 0.35 ? 1 : c.hover ? 0.22 : 0;
      if (reduced) {
        c.pos.copy(c.target);
        c.rot.copy(c.rotTarget);
      } else {
        // Firme enquanto segura; ao soltar, volta com um leve balanço.
        const [k, damp] = grabbed ? ([520, 46] as const) : ([140, 13] as const);
        busy = spring(c.pos, c.vel, c.target, k, damp, dt) || busy;
        busy = spring(c.rot, c.rotVel, c.rotTarget, k * 0.7, damp * 0.85, dt) || busy;
      }

      const idle = reduced ? 0 : e; // flutuação entra junto com o cartão
      c.body.position.set(
        c.rest.x + c.pos.x,
        c.rest.y + c.pos.y + Math.sin(time * 1.1 + c.phase) * 0.04 * idle - (1 - e) * 2.6,
        c.rest.z + c.pos.z,
      );
      c.body.rotation.set(
        c.rot.x + Math.sin(time * 0.8 + c.phase) * 0.05 * idle + (1 - e) * 1.1,
        c.rot.y,
        c.rot.z + Math.sin(time * 0.6 + c.phase) * 0.025 * idle,
      );
    });

    const follow = Math.min(dt * 6, 1);
    tilt.x += (tiltTarget.x - tilt.x) * follow;
    tilt.y += (tiltTarget.y - tilt.y) * follow;
    if (Math.abs(tiltTarget.x - tilt.x) + Math.abs(tiltTarget.y - tilt.y) > 1e-4) busy = true;
    rig.rotation.set(tilt.x, tilt.y + (reduced ? 0 : Math.sin(time * 0.35) * 0.05), 0);

    renderer.render(scene, camera);
    // Loop contínuo só com o palco visível; fora da tela, só termina o que estava em movimento.
    if (busy || drag || (visible && !reduced)) raf = requestAnimationFrame(frame);
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const camDir = new THREE.Vector3();
  const point = new THREE.Vector3();

  const aim = (ev: PointerEvent) => {
    const r = host.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  const pick = (ev: PointerEvent) => {
    aim(ev);
    const hit = raycaster.intersectObjects(
      cards.map((c) => c.body),
      true,
    )[0];
    const card = hit ? cards[hit.object.userData.card as number] : undefined;
    return hit && card ? { card, point: hit.point } : null;
  };

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0) return;
    const hit = pick(ev);
    if (!hit) return;
    // Arrasta num plano voltado para a câmera, passando pelo ponto agarrado.
    camera.getWorldDirection(camDir);
    plane.setFromNormalAndCoplanarPoint(camDir, hit.point);
    const grab = hit.card.body.getWorldPosition(new THREE.Vector3()).sub(hit.point);
    const { clientX: x, clientY: y, timeStamp: t } = ev;
    drag = { card: hit.card, grab, x0: x, y0: y, t0: t, lx: x, ly: y, lt: t, vx: 0, vy: 0, moved: false };
    host.setPointerCapture(ev.pointerId);
    host.style.cursor = "grabbing";
    kick();
  };

  const onMove = (ev: PointerEvent) => {
    const r = host.getBoundingClientRect();
    if (drag) {
      aim(ev);
      if (!raycaster.ray.intersectPlane(plane, point)) return;
      // Puxa o cartão um pouco para a frente, por cima dos outros.
      point.add(drag.grab).addScaledVector(camDir, -0.6);
      drag.card.slot.worldToLocal(point);
      drag.card.target.copy(point).sub(drag.card.rest);
      const dtp = Math.max(ev.timeStamp - drag.lt, 1);
      drag.vx = (ev.clientX - drag.lx) / dtp;
      drag.vy = (ev.clientY - drag.ly) / dtp;
      drag.lx = ev.clientX;
      drag.ly = ev.clientY;
      drag.lt = ev.timeStamp;
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) > TAP.px) drag.moved = true;
    } else {
      // Inclinação do leque segue o ponteiro; destaque no cartão sob o mouse.
      const nx = ((ev.clientX - r.left) / r.width) * 2 - 1;
      const ny = ((ev.clientY - r.top) / r.height) * 2 - 1;
      if (!reduced) {
        tiltTarget.x = BASE_TILT.x + ny * 0.12;
        tiltTarget.y = BASE_TILT.y + nx * 0.22;
      }
      if (ev.pointerType === "mouse") {
        const hit = pick(ev);
        for (const c of cards) c.hover = c === hit?.card;
        host.style.cursor = hit ? "grab" : "";
      }
    }
    kick();
  };

  const onUp = (ev: PointerEvent) => {
    if (!drag) return;
    const c = drag.card;
    if (ev.type === "pointerup" && !drag.moved && ev.timeStamp - drag.t0 < TAP.ms) c.flipped = !c.flipped;
    c.target.set(0, 0, 0);
    c.rotTarget.set(0, c.flipped ? Math.PI : 0, 0);
    if (host.hasPointerCapture(ev.pointerId)) host.releasePointerCapture(ev.pointerId);
    drag = null;
    host.style.cursor = "";
    kick();
  };

  const onLeave = () => {
    if (drag) return;
    tiltTarget.x = BASE_TILT.x;
    tiltTarget.y = BASE_TILT.y;
    for (const c of cards) c.hover = false;
    host.style.cursor = "";
    kick();
  };

  const surface = host.parentElement ?? host;
  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);
  surface.addEventListener("pointermove", onMove);
  surface.addEventListener("pointerleave", onLeave);

  const ro = new ResizeObserver(() => {
    fit();
    kick();
  });
  ro.observe(host);
  const vis = new IntersectionObserver(([entry]) => {
    visible = !!entry?.isIntersecting;
    if (visible) kick();
  });
  vis.observe(host);
  fit();
  kick();

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    vis.disconnect();
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onUp);
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
