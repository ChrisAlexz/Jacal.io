// src/components/ParticleCityBackground.jsx
// Scroll-driven 3D particle "city" background for the marketing landing page.
// Adapted for Jacal: always-dark theme matching the page background (#0a0a0a),
// inline styles (no Tailwind dependency), pinned for React 18 / r3f v8.
import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Must match the marketing page --color-background so the fog blends seamlessly.
const BG = '#0a0a0a';
const PALETTE = {
  base: ['#64748b', '#475569', '#94a3b8', '#334155'],
  accent: ['#ea580c', '#dc2626', '#f59e0b'],
};

function buildCity() {
  const base = PALETTE.base.map((c) => new THREE.Color(c));
  const accent = PALETTE.accent.map((c) => new THREE.Color(c));
  const positions = [];
  const colors = [];
  const N = 32, SP = 3.4, FLOOR_H = 0.55;
  const center = (N - 1) / 2;

  const pushFacade = (cx, cz, hw, hd, floors) => {
    const stepX = Math.max(1, Math.round((hw * 2) / 0.75));
    const stepZ = Math.max(1, Math.round((hd * 2) / 0.75));
    for (let f = 0; f <= floors; f++) {
      const y = f * FLOOR_H;
      const lowLight = f <= 1;
      const put = (x, z) => {
        const c = lowLight && Math.random() < 0.1
          ? accent[(Math.random() * accent.length) | 0]
          : base[(Math.random() * base.length) | 0];
        positions.push(x, y, z);
        colors.push(c.r, c.g, c.b);
      };
      for (let a = 0; a <= stepX; a++) {
        const x = cx - hw + (2 * hw * a) / stepX;
        put(x, cz - hd); put(x, cz + hd);
      }
      for (let b = 1; b < stepZ; b++) {
        const z = cz - hd + (2 * hd * b) / stepZ;
        put(cx - hw, z); put(cx + hw, z);
      }
    }
  };

  const maxR = center * SP * 0.95;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i % 5 === 0 || j % 5 === 0) continue; // streets between blocks
      const cx = (i - center) * SP + (Math.random() - 0.5) * 0.5;
      const cz = (j - center) * SP + (Math.random() - 0.5) * 0.5;
      const r = Math.hypot(cx, cz);
      const heightScale = Math.max(0.22, 1 - r / maxR);
      const hw = SP * 0.34 + Math.random() * 0.3;
      const hd = SP * 0.34 + Math.random() * 0.3;
      const floors = 2 + Math.floor(Math.pow(Math.random(), 1.9) * 34 * heightScale);
      pushFacade(cx, cz, hw, hd, floors);
    }
  }
  // Signature downtown towers
  pushFacade(0, 0, 1.2, 1.2, 52);
  pushFacade(-6, 4, 1.0, 1.0, 44);
  pushFacade(7, -5, 1.0, 1.0, 40);

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
  };
}

// Camera waypoints keyed to scroll: top-down -> descend -> fly through -> back up.
const CAM_PATH = [
  [0, 42, 0.05], [0, 24, 6], [0, 15, 40],
  [10, 7.5, 26], [10, 7.5, 10], [0, 42, 0.05],
];

function City() {
  const ref = useRef();
  const progress = useRef(0);
  const scrollTarget = useRef(0);
  const { positions, colors } = useMemo(() => buildCity(), []);
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(CAM_PATH.map(([x, y, z]) => new THREE.Vector3(x, y, z))),
    []
  );
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      scrollTarget.current = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useFrame((state) => {
    const cam = state.camera;
    const fog = state.scene.fog;
    progress.current += (scrollTarget.current - progress.current) * 0.06;
    curve.getPointAt(progress.current, tmp);
    cam.position.copy(tmp);
    cam.lookAt(0, 0, 0);
    if (fog) {
      const dist = cam.position.length();
      fog.near = Math.max(1, dist * 0.2);
      fog.far = dist + 150;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        sizeAttenuation
        vertexColors
        transparent
        opacity={0.5}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export default function ParticleCityBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: BG,
      }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 42, 0.05], fov: 62, near: 0.1, far: 600 }}
      >
        <fog attach="fog" args={[BG, 35, 130]} />
        <City />
      </Canvas>
    </div>
  );
}
