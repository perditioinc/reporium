'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { getCategoryColor, getCategoryLabel } from '@/lib/categoryColors';
import {
  derivePlanetColors,
  getPlanetRotation,
  PLANET_FRAG,
  PLANET_VERT,
} from '@/lib/planetShader';

interface LegendRendererProps {
  categories: string[];
  hiddenCategories: Set<string>;
  onToggleCategory: (category: string) => void;
}

interface LegendSphereEntry {
  category: string;
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  glow: THREE.Mesh;
  glowMaterial: THREE.MeshBasicMaterial;
  baseRadius: number;
  rotAxis: THREE.Vector3;
  rotSpeed: number;
  phase: number;
}

export function LegendRenderer({
  categories,
  hiddenCategories,
  onToggleCategory,
}: LegendRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sphereGeoRef = useRef<THREE.SphereGeometry | null>(null);
  const glowGeoRef = useRef<THREE.SphereGeometry | null>(null);
  const entriesRef = useRef<Map<string, LegendSphereEntry>>(new Map());
  const timeUniformRef = useRef<{ value: number }>({ value: 0.0 });
  const hiddenCategoriesRef = useRef(hiddenCategories);
  const categoriesRef = useRef(categories);
  const animFrameRef = useRef<number>(0);
  const needsLayoutRef = useRef(true);
  const measureRef = useRef<(() => void) | null>(null);
  const buildEntriesRef = useRef<(() => void) | null>(null);
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    hiddenCategoriesRef.current = hiddenCategories;
  }, [hiddenCategories]);

  useEffect(() => {
    categoriesRef.current = categories;
  }, [categories]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const initialRect = container.getBoundingClientRect();
    const initialWidth = Math.max(Math.round(initialRect.width), 1);
    const initialHeight = Math.max(Math.round(initialRect.height), 1);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.pointerEvents = 'none';
    renderer.domElement.style.zIndex = '0';
    rendererRef.current = renderer;
    container.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(0, initialWidth, initialHeight, 0, -500, 500);
    camera.position.set(0, 0, 160);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    sphereGeoRef.current = new THREE.SphereGeometry(1, 24, 18);
    glowGeoRef.current = new THREE.SphereGeometry(1, 12, 8);

    const layoutSpheres = () => {
      const host = containerRef.current;
      if (!host) return;
      const hostRect = host.getBoundingClientRect();
      for (const [category, entry] of entriesRef.current) {
        const slot = slotRefs.current[category];
        if (!slot) {
          entry.mesh.visible = false;
          entry.glow.visible = false;
          continue;
        }

        const slotRect = slot.getBoundingClientRect();
        const radius = Math.max(slotRect.width, slotRect.height) / 2;
        const centerX = slotRect.left - hostRect.left + slotRect.width / 2;
        const centerY = slotRect.top - hostRect.top + slotRect.height / 2;
        entry.baseRadius = radius;
        entry.mesh.position.set(centerX, hostRect.height - centerY, 0);
        entry.glow.position.copy(entry.mesh.position);
        entry.mesh.visible = true;
        entry.glow.visible = true;
      }
      needsLayoutRef.current = false;
    };
    measureRef.current = layoutSpheres;

    const disposeEntries = () => {
      for (const entry of entriesRef.current.values()) {
        scene.remove(entry.mesh);
        scene.remove(entry.glow);
        entry.material.dispose();
        entry.glowMaterial.dispose();
      }
      entriesRef.current.clear();
    };

    const buildEntries = () => {
      if (!sceneRef.current || !sphereGeoRef.current || !glowGeoRef.current) return;
      disposeEntries();

      for (let i = 0; i < categoriesRef.current.length; i++) {
        const category = categoriesRef.current[i];
        const [c1, c2, c3] = derivePlanetColors(getCategoryColor(category), i);
        const { rotAxis, rotSpeed } = getPlanetRotation(i);
        const material = new THREE.ShaderMaterial({
          uniforms: {
            uC1:       { value: c1.clone() },
            uC2:       { value: c2.clone() },
            uC3:       { value: c3.clone() },
            uSeed:     { value: i * 1.618033 },
            uTime:     timeUniformRef.current,
            uEmissive: { value: 0.8 },
            uOpacity:  { value: 0.96 },
          },
          vertexShader: PLANET_VERT,
          fragmentShader: PLANET_FRAG,
          transparent: true,
          depthWrite: false,
        });
        const mesh = new THREE.Mesh(sphereGeoRef.current, material);
        mesh.renderOrder = 10;

        const glowMaterial = new THREE.MeshBasicMaterial({
          color: c1,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        const glow = new THREE.Mesh(glowGeoRef.current, glowMaterial);
        glow.renderOrder = 9;

        sceneRef.current.add(glow);
        sceneRef.current.add(mesh);
        entriesRef.current.set(category, {
          category,
          mesh,
          material,
          glow,
          glowMaterial,
          baseRadius: 8,
          rotAxis,
          rotSpeed,
          phase: i * 0.37,
        });
      }

      needsLayoutRef.current = true;
      requestAnimationFrame(() => {
        measureRef.current?.();
      });
    };
    buildEntriesRef.current = buildEntries;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(Math.round(rect.width), 1);
      const height = Math.max(Math.round(rect.height), 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      camera.left = 0;
      camera.right = width;
      camera.top = height;
      camera.bottom = 0;
      camera.position.set(0, 0, 160);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      needsLayoutRef.current = true;
    };

    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => {
      reduceMotionRef.current = motionMedia.matches;
    };
    updateMotion();
    motionMedia.addEventListener('change', updateMotion);

    const resizeObs = new ResizeObserver(() => {
      resize();
      requestAnimationFrame(() => measureRef.current?.());
    });
    resizeObs.observe(container);

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        needsLayoutRef.current = true;
        measureRef.current?.();
      });
    }

    const clock = new THREE.Clock();
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (needsLayoutRef.current) measureRef.current?.();

      const elapsed = clock.getElapsedTime();
      timeUniformRef.current.value = elapsed;

      for (const entry of entriesRef.current.values()) {
        const isHidden = hiddenCategoriesRef.current.has(entry.category);
        const pulse = 1 + Math.sin(elapsed * 0.9 + entry.phase) * 0.05;
        const glowPulse = 1 + Math.sin(elapsed * 0.7 + entry.phase + Math.PI * 0.5) * 0.14;
        entry.mesh.scale.setScalar(entry.baseRadius * pulse);
        entry.glow.scale.setScalar(entry.baseRadius * 1.95 * glowPulse);
        entry.glow.position.copy(entry.mesh.position);
        entry.material.uniforms.uEmissive.value = isHidden
          ? 0.15
          : 0.72 + 0.18 * (0.5 + 0.5 * Math.sin(elapsed * 0.55 + entry.phase));
        entry.material.uniforms.uOpacity.value = isHidden ? 0.28 : 0.98;
        entry.glowMaterial.opacity = isHidden ? 0.015 : 0.09 + 0.03 * Math.sin(elapsed * 0.6 + entry.phase);

        if (!reduceMotionRef.current) {
          entry.mesh.rotateOnAxis(entry.rotAxis, entry.rotSpeed);
        }
      }

      renderer.render(scene, camera);
    };

    resize();
    buildEntries();
    animate();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      resizeObs.disconnect();
      motionMedia.removeEventListener('change', updateMotion);
      disposeEntries();
      sphereGeoRef.current?.dispose();
      glowGeoRef.current?.dispose();
      sphereGeoRef.current = null;
      glowGeoRef.current = null;
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      buildEntriesRef.current = null;
      measureRef.current = null;
    };
  }, []);

  useEffect(() => {
    buildEntriesRef.current?.();
  }, [categories]);

  const setSlotRef = (category: string) => (node: HTMLSpanElement | null) => {
    slotRefs.current[category] = node;
    needsLayoutRef.current = true;
    requestAnimationFrame(() => measureRef.current?.());
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative z-10 flex flex-wrap items-center justify-center gap-x-2 sm:gap-x-3 gap-y-1 pb-0.5 sm:pb-0">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mr-1">Nodes</span>
        {categories.map((category) => {
          const isHidden = hiddenCategories.has(category);
          const color = getCategoryColor(category);
          return (
            <button
              key={category}
              onClick={(e) => { e.stopPropagation(); onToggleCategory(category); }}
              className={`relative inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] whitespace-nowrap transition-all shrink-0 ${
                isHidden
                  ? 'opacity-30 hover:opacity-60'
                  : 'opacity-90 hover:opacity-100'
              }`}
              title={`${isHidden ? 'Show' : 'Hide'} ${getCategoryLabel(category)}`}
            >
              <span
                ref={setSlotRef(category)}
                className="inline-block w-4 h-4 sm:w-5 sm:h-5 rounded-full shrink-0"
                style={{
                  // Always keep the CSS gradient dot visible as the base — the
                  // WebGL sphere overlays it when positioned. If the measurement
                  // pass misses a slot (layout race, multi-row wrap), this dot
                  // guarantees every category shows a sphere next to its label.
                  opacity: isHidden ? 0.3 : 1,
                  background: `radial-gradient(circle at 35% 35%, ${color}ff 0%, ${color}dd 35%, ${color}77 70%, ${color}33 100%)`,
                  boxShadow: `0 0 4px 1px ${color}66`,
                }}
              />
              <span className={`hidden sm:inline ${isHidden ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                {getCategoryLabel(category)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
