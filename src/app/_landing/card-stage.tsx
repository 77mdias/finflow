"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { button } from "@/shared/ui/button";

// Cartões próprios do FinFlow (sem marcas de terceiros), com malha em meshopt e texturas WebP.
// `flip`: use quando o modelo for exportado com a frente voltada para −Z.
const MODELS: { url: string; flip?: boolean }[] = [
  { url: "/3D/card-1.glb" },
  { url: "/3D/card-2.glb" },
  { url: "/3D/card-3.glb" },
  { url: "/3D/card-4.glb" },
];

type Pose = { x: number; y: number; z: number; rx: number; ry: number; rz: number };

// Posições de repouso em unidades da cena (cartão ≈ 1,9 × 1,1), uma por modelo.
// Palco largo: fila escalonada, cada cartão voltado para o centro. Estreito: grade 2 × 2.
const LAYOUTS: Record<"row" | "grid", Pose[]> = {
  row: [
    { x: -3.25, y: 0.42, z: 0, rx: -0.2, ry: 0.42, rz: 0.1 },
    { x: -1.08, y: -0.22, z: 0.18, rx: -0.12, ry: 0.18, rz: -0.06 },
    { x: 1.08, y: 0.28, z: 0.1, rx: -0.12, ry: -0.18, rz: 0.06 },
    { x: 3.25, y: -0.38, z: 0, rx: -0.2, ry: -0.42, rz: -0.1 },
  ],
  grid: [
    { x: -1.08, y: 0.72, z: 0, rx: -0.15, ry: 0.25, rz: 0.06 },
    { x: 1.08, y: 0.62, z: 0.1, rx: -0.15, ry: -0.25, rz: -0.05 },
    { x: -1.08, y: -0.62, z: 0.1, rx: -0.1, ry: 0.25, rz: -0.05 },
    { x: 1.08, y: -0.72, z: 0, rx: -0.1, ry: -0.25, rz: 0.06 },
  ],
};
const ROW_MIN_ASPECT = 2;
const PIXEL_BUDGET = 2_600_000; // teto de pixels do canvas: largura total com DPR 2 pesaria no preenchimento

const ENTRANCE_MS = 1300;
const STAGGER_MS = 130;
const LAYER = 0.25; // profundidade entre cartões empilhados (o último tocado fica na frente)
const LIFT = 0.45; // cartão sendo arrastado sobe em direção à câmera
const HOVER = 0.12;
const ROTATE_SPEED = 0.012; // rad por pixel no arrasto com o botão direito
const TAP = { ms: 300, px: 6 };

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

type Scene = { reset: () => void; dispose: () => void };

/**
 * Cartões 3D do hero. Entram espalhados a partir de um monte; arrastar move e o cartão fica onde
 * foi solto; botão direito (ou Shift) gira o modelo; clique vira. Carrega three.js só perto da tela.
 */
export function CardStage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        mountScene(host)
          .then((s) => {
            if (cancelled) return s.dispose();
            sceneRef.current = s;
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
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        ref={hostRef}
        role="img"
        aria-label="Cartões do FinFlow em 3D que você pode arrastar, girar e virar"
        // pan-y: no celular, arrastar na vertical rola a página; na horizontal, move o cartão.
        className={`absolute inset-0 touch-pan-y transition-opacity duration-500 ease-out ${ready ? "opacity-100" : "opacity-0"}`}
      />
      {ready && (
        <div className="absolute right-4 bottom-4 flex animate-fade-up items-center gap-3">
          <p className="text-caption text-fg-muted max-lg:hidden">
            Arraste para mover · botão direito para girar · clique para virar
          </p>
          <button
            type="button"
            onClick={() => sceneRef.current?.reset()}
            className={`${button("ghost", "md")} bg-surface/80 shadow-sm backdrop-blur-sm`}
          >
            <RotateCcw aria-hidden size={18} strokeWidth={1.5} />
            Reorganizar
          </button>
        </div>
      )}
    </>
  );
}

async function mountScene(host: HTMLDivElement): Promise<Scene> {
  // Os modelos são o maior peso da página: baixa em paralelo com o three.js, não depois dele.
  const downloads = MODELS.map(({ url }) =>
    fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.arrayBuffer();
    }),
  );
  for (const d of downloads) d.catch(() => undefined); // o erro é tratado por cartão, mais abaixo

  const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
    import("three"),
    import("three/examples/jsm/loaders/GLTFLoader.js"),
    import("three/examples/jsm/libs/meshopt_decoder.module.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
  ]);
  type Vec3 = InstanceType<typeof THREE.Vector3>;

  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.style.cssText = "display:block;width:100%;height:100%";
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const rig = new THREE.Group(); // inclinação sutil que segue o ponteiro
  scene.add(rig);

  // Cada cartão começa vazio e invisível; o modelo entra quando o arquivo dele chega.
  const cards = MODELS.map((_, i) => {
    const body = new THREE.Group();
    body.visible = false;
    rig.add(body);
    return {
      body,
      index: i,
      born: Infinity, // quando a entrada começa (o modelo terminou de carregar)
      phase: i * 1.7,
      hover: false,
      rest: new THREE.Vector3(), // onde o cartão fica (muda quando o usuário solta)
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      target: new THREE.Vector3(),
      rot: new THREE.Vector3(),
      rotVel: new THREE.Vector3(),
      rotTarget: new THREE.Vector3(), // orientação persistente (giro e virada do usuário)
      spin: new THREE.Vector2(), // inércia depois de girar
      tilt: new THREE.Vector2(), // inclinação passageira enquanto arrasta
    };
  });
  type Card = (typeof cards)[number];
  let stack: Card[] = [...cards]; // ordem de profundidade; o fim da lista fica na frente

  let layout: keyof typeof LAYOUTS | null = null;
  const applyLayout = (kind: keyof typeof LAYOUTS, snap: boolean) => {
    layout = kind;
    stack = [...cards];
    for (const c of cards) {
      const p = LAYOUTS[kind][c.index] as Pose;
      c.rest.set(p.x, p.y, p.z);
      c.rotTarget.set(p.rx, p.ry, p.rz);
      c.spin.set(0, 0);
      // Traz o ângulo atual para a volta mais próxima do alvo, para não "desenrolar" vários giros.
      for (const a of ["x", "y", "z"] as const) {
        const d = c.rot[a] - c.rotTarget[a];
        c.rot[a] = c.rotTarget[a] + d - Math.round(d / (2 * Math.PI)) * 2 * Math.PI;
      }
      if (snap) {
        c.pos.copy(c.rest);
        c.rot.copy(c.rotTarget);
      }
    }
  };

  const fit = () => {
    const { clientWidth: w, clientHeight: h } = host;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2, Math.sqrt(PIXEL_BUDGET / (w * h))));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const kind = camera.aspect >= ROW_MIN_ASPECT ? "row" : "grid";
    if (kind !== layout) applyLayout(kind, layout === null);
    const poses = LAYOUTS[kind];
    const hx = Math.max(...poses.map((p) => Math.abs(p.x))) + 1.05;
    const hy = Math.max(...poses.map((p) => Math.abs(p.y))) + 0.7;
    const dist = Math.max(hy / halfFov, hx / (halfFov * camera.aspect)) * 1.1 + 0.6;
    camera.position.set(0, 0, dist);
    camera.updateProjectionMatrix();
  };

  // Limites visíveis numa profundidade z, para o cartão solto nunca sumir do palco.
  const bounds = (z: number) => {
    const hh = halfFov * (camera.position.z - z);
    return { x: Math.max(hh * camera.aspect - 0.75, 0), y: Math.max(hh - 0.45, 0) };
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const tilt = { x: 0, y: 0 };
  const tiltTarget = { x: 0, y: 0 };
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
    mode: "move" | "rotate";
    grab: Vec3;
    x0: number;
    y0: number;
    t0: number;
    lx: number;
    ly: number;
    lt: number;
    vx: number; // px/ms
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

    for (const c of cards) {
      const p = reduced ? 1 : Math.min(Math.max((now - c.born) / ENTRANCE_MS, 0), 1);
      const e = easeOutExpo(p);
      if (c.body.visible && p < 1) busy = true;

      const grabbed = drag?.card === c;
      const moving = grabbed && drag?.mode === "move";
      c.target.set(
        c.rest.x,
        c.rest.y,
        c.rest.z + stack.indexOf(c) * LAYER + (moving ? LIFT : c.hover ? HOVER : 0),
      );

      // Inércia do giro: continua girando e desacelera.
      if (!grabbed && c.spin.lengthSq() > 1e-4) {
        c.rotTarget.x += c.spin.x * dt;
        c.rotTarget.y += c.spin.y * dt;
        c.spin.multiplyScalar(Math.exp(-dt * 2.5));
        busy = true;
      }
      // Inclinação passageira na direção do arrasto; some quando o ponteiro para.
      const tx = moving ? clamp((drag as Drag).vy * 0.3, 0.3) : 0;
      const ty = moving ? clamp((drag as Drag).vx * 0.3, 0.4) : 0;
      if (drag && moving) {
        const decay = Math.exp(-dt * 8);
        drag.vx *= decay;
        drag.vy *= decay;
      }
      c.tilt.x += (tx - c.tilt.x) * Math.min(dt * 12, 1);
      c.tilt.y += (ty - c.tilt.y) * Math.min(dt * 12, 1);
      if (Math.abs(c.tilt.x) + Math.abs(c.tilt.y) > 1e-4) busy = true;

      if (reduced) {
        c.pos.copy(c.target);
        c.rot.copy(c.rotTarget);
      } else {
        const [k, damp] = grabbed ? ([600, 48] as const) : ([170, 22] as const);
        busy = spring(c.pos, c.vel, c.target, k, damp, dt) || busy;
        busy = spring(c.rot, c.rotVel, c.rotTarget, grabbed ? 600 : 140, grabbed ? 48 : 16, dt) || busy;
      }

      // Entrada: sai de um monte no centro, gira e se espalha até a posição de repouso.
      const idle = reduced ? 0 : e;
      const deckY = -0.4;
      const deckZ = -0.6 + c.index * 0.04;
      c.body.position.set(
        c.pos.x * e,
        deckY + (c.pos.y - deckY) * e + Math.sin(time * 1.1 + c.phase) * 0.05 * idle,
        deckZ + (c.pos.z - deckZ) * e,
      );
      c.body.rotation.set(
        c.rot.x + c.tilt.x + (1 - e) * 0.9 + Math.sin(time * 0.8 + c.phase) * 0.03 * idle,
        c.rot.y + c.tilt.y - (1 - e) * 2.2,
        c.rot.z + Math.sin(time * 0.6 + c.phase) * 0.02 * idle,
      );
      c.body.scale.setScalar(0.7 + 0.3 * e);
    }

    const follow = Math.min(dt * 5, 1);
    tilt.x += (tiltTarget.x - tilt.x) * follow;
    tilt.y += (tiltTarget.y - tilt.y) * follow;
    if (Math.abs(tiltTarget.x - tilt.x) + Math.abs(tiltTarget.y - tilt.y) > 1e-4) busy = true;
    rig.rotation.set(tilt.x, tilt.y, 0);

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

  const aim = (ev: MouseEvent) => {
    const r = host.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  const pick = (ev: MouseEvent) => {
    aim(ev);
    const hit = raycaster.intersectObjects(
      cards.map((c) => c.body),
      true,
    )[0];
    const card = hit ? cards[hit.object.userData.card as number] : undefined;
    return hit && card ? { card, point: hit.point } : null;
  };

  const onDown = (ev: PointerEvent) => {
    if (ev.button !== 0 && ev.button !== 2) return;
    const hit = pick(ev);
    if (!hit) return;
    const card = hit.card;
    stack = [...stack.filter((c) => c !== card), card];
    card.spin.set(0, 0);
    // Move num plano voltado para a câmera, passando pelo ponto agarrado.
    camera.getWorldDirection(camDir);
    plane.setFromNormalAndCoplanarPoint(camDir, hit.point);
    const grab = card.body.getWorldPosition(new THREE.Vector3()).sub(hit.point);
    const { clientX: x, clientY: y, timeStamp: t } = ev;
    const mode = ev.button === 2 || ev.shiftKey ? "rotate" : "move";
    drag = { card, mode, grab, x0: x, y0: y, t0: t, lx: x, ly: y, lt: t, vx: 0, vy: 0, moved: false };
    host.setPointerCapture(ev.pointerId);
    host.style.cursor = "grabbing";
    kick();
  };

  const onMove = (ev: PointerEvent) => {
    if (drag) {
      const c = drag.card;
      const dtp = Math.max(ev.timeStamp - drag.lt, 1);
      const dx = ev.clientX - drag.lx;
      const dy = ev.clientY - drag.ly;
      if (drag.mode === "rotate") {
        c.rotTarget.y += dx * ROTATE_SPEED;
        c.rotTarget.x += dy * ROTATE_SPEED;
      } else {
        aim(ev);
        if (raycaster.ray.intersectPlane(plane, point)) {
          point.add(drag.grab);
          rig.worldToLocal(point);
          const b = bounds(c.target.z);
          c.rest.x = clamp(point.x, b.x);
          c.rest.y = clamp(point.y, b.y);
        }
      }
      drag.vx = dx / dtp;
      drag.vy = dy / dtp;
      drag.lx = ev.clientX;
      drag.ly = ev.clientY;
      drag.lt = ev.timeStamp;
      if (Math.hypot(ev.clientX - drag.x0, ev.clientY - drag.y0) > TAP.px) drag.moved = true;
    } else {
      // Inclinação sutil da cena segue o ponteiro; destaque no cartão sob o mouse.
      const r = host.getBoundingClientRect();
      if (!reduced) {
        tiltTarget.x = (((ev.clientY - r.top) / r.height) * 2 - 1) * 0.06;
        tiltTarget.y = (((ev.clientX - r.left) / r.width) * 2 - 1) * 0.1;
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
    const tap = ev.type === "pointerup" && !drag.moved && ev.timeStamp - drag.t0 < TAP.ms;
    if (tap && drag.mode === "move") c.rotTarget.y += Math.PI;
    // Solto girando: mantém a velocidade (rad/s) e desacelera no frame.
    if (drag.mode === "rotate" && !reduced && ev.timeStamp - drag.lt < 80)
      c.spin.set(clamp(drag.vy * ROTATE_SPEED * 1000, 8), clamp(drag.vx * ROTATE_SPEED * 1000, 8));
    if (host.hasPointerCapture(ev.pointerId)) host.releasePointerCapture(ev.pointerId);
    drag = null;
    host.style.cursor = "";
    kick();
  };

  const onLeave = () => {
    if (drag) return;
    tiltTarget.x = 0;
    tiltTarget.y = 0;
    for (const c of cards) c.hover = false;
    host.style.cursor = "";
    kick();
  };

  // Botão direito sobre um cartão gira o modelo em vez de abrir o menu.
  const onContextMenu = (ev: MouseEvent) => {
    if (drag || pick(ev)) ev.preventDefault();
  };

  host.addEventListener("pointerdown", onDown);
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerup", onUp);
  host.addEventListener("pointercancel", onUp);
  host.addEventListener("pointerleave", onLeave);
  host.addEventListener("contextmenu", onContextMenu);

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

  let disposed = false;
  const dispose = () => {
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    vis.disconnect();
    host.removeEventListener("pointerdown", onDown);
    host.removeEventListener("pointermove", onMove);
    host.removeEventListener("pointerup", onUp);
    host.removeEventListener("pointercancel", onUp);
    host.removeEventListener("pointerleave", onLeave);
    host.removeEventListener("contextmenu", onContextMenu);
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

  // Cada cartão entra assim que o próprio arquivo chega (os downloads já começaram junto com o three.js);
  // o palco aparece com o primeiro. Se dois chegam juntos, a entrada é escalonada.
  let lastBorn = -Infinity;
  const loaded = cards.map((c, i) =>
    (downloads[i] as Promise<ArrayBuffer>)
      .then((buffer) => loader.parseAsync(buffer, ""))
      .then((gltf) => {
        if (disposed) return;
        if (MODELS[i]?.flip) gltf.scene.rotation.y = Math.PI;
        gltf.scene.traverse((o) => (o.userData.card = i));
        c.body.add(gltf.scene);
        c.body.visible = true;
        c.born = Math.max(performance.now(), lastBorn + STAGGER_MS);
        lastBorn = c.born;
        kick();
      }),
  );
  await Promise.any(loaded).catch((err: unknown) => {
    dispose();
    throw err;
  });

  return {
    reset: () => {
      if (layout) applyLayout(layout, reduced);
      kick();
    },
    dispose,
  };
}
