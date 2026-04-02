'use client';

/**
 * KAN-124: 3D constellation knowledge graph using Three.js.
 *
 * Features:
 * - 3D force-directed layout with orbit controls (zoom, rotate, pan)
 * - Category-colored glowing nodes sized by connections
 * - Hover info bubbles with repo details
 * - Click to expand info panel (no forced navigation)
 * - Constellation aesthetic: dark background, glow, depth
 * - Fullscreen toggle
 */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  forceSimulation,
  forceManyBody,
  forceLink,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from 'd3-force';
import {
  getCategoryColor,
  getCategoryLabel,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
} from '@/lib/categoryColors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface GraphEdge {
  source: string;
  target: string;
  edge_type: string;
  weight?: number;
}

export interface NodeMeta {
  category: string | null;
  description: string | null;
}

interface GNode extends SimulationNodeDatum {
  id: string;
  label: string;
  category: string | null;
  connections: number;
  // 3D position
  z?: number;
  vz?: number;
}

interface GLink extends SimulationLinkDatum<GNode> {
  edge_type: string;
  weight?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function nodeRadius(connections: number): number {
  return 1.0 + Math.min(connections * 0.35, 3.5);
}

function buildNodes(
  edges: GraphEdge[],
  metadata: Map<string, NodeMeta>,
): GNode[] {
  const connCount = new Map<string, number>();
  for (const e of edges) {
    connCount.set(e.source, (connCount.get(e.source) ?? 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) ?? 0) + 1);
  }
  const nodes: GNode[] = [];
  for (const [id, count] of connCount) {
    const meta = metadata.get(id);
    nodes.push({
      id,
      label: id.includes('/') ? id.split('/').pop()! : id,
      category: meta?.category ?? null,
      connections: count,
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 80,
      z: (Math.random() - 0.5) * 40,
    });
  }
  return nodes;
}

function buildLinks(edges: GraphEdge[], nodeIds: Set<string>): GLink[] {
  return edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      source: e.source,
      target: e.target,
      edge_type: e.edge_type,
      weight: e.weight,
    }));
}

function hexToRGB(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// 3D force: apply z-axis forces manually
function force3D(nodes: GNode[], alpha: number) {
  for (const node of nodes) {
    if (node.z === undefined) node.z = 0;
    if (node.vz === undefined) node.vz = 0;
    // Stronger center pull on z to keep graph flatter
    node.vz += -node.z * 0.03 * alpha;
    // Damping
    node.vz *= 0.85;
    node.z += node.vz;
  }
  // Mild z-repulsion (only sample pairs for perf with large graphs)
  const maxPairs = Math.min(nodes.length, 200);
  for (let i = 0; i < maxPairs; i++) {
    for (let j = i + 1; j < maxPairs; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const dz = (a.z ?? 0) - (b.z ?? 0);
      const dx = (a.x ?? 0) - (b.x ?? 0);
      const dy = (a.y ?? 0) - (b.y ?? 0);
      const dist2 = dx * dx + dy * dy + dz * dz + 1;
      const force = (alpha * 20) / dist2;
      const fz = dz * force;
      a.vz = (a.vz ?? 0) + fz;
      b.vz = (b.vz ?? 0) - fz;
    }
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface KnowledgeGraph3DProps {
  edges: GraphEdge[];
  nodeMetadata: Map<string, NodeMeta>;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  compact?: boolean; // true for home page widget
}

export function KnowledgeGraph3D({
  edges,
  nodeMetadata,
  height = 560,
  onNodeClick,
  compact = false,
}: KnowledgeGraph3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const nodesRef = useRef<GNode[]>([]);
  const nodeMeshesRef = useRef<THREE.Mesh[]>([]);
  const lineRef = useRef<THREE.LineSegments | null>(null);
  const glowMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2(-9999, -9999));

  const [hoveredNode, setHoveredNode] = useState<GNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  // Active categories for legend
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const [, meta] of nodeMetadata) {
      if (meta.category) cats.add(meta.category);
    }
    return Array.from(cats).sort();
  }, [nodeMetadata]);

  // Build node/link data
  const { nodes, links } = useMemo(() => {
    const nodes = buildNodes(edges, nodeMetadata);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = buildLinks(edges, nodeIds);
    return { nodes, links };
  }, [edges, nodeMetadata]);

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;

    const width = container.clientWidth;
    const h = height;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0f');
    scene.fog = new THREE.FogExp2('#0a0a0f', 0.002);
    sceneRef.current = scene;

    // Camera — far enough to see the whole graph
    const camera = new THREE.PerspectiveCamera(60, width / h, 0.1, 2000);
    camera.position.set(0, 0, compact ? 260 : 320);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.3;
    controls.minDistance = 30;
    controls.maxDistance = 600;
    controls.enablePan = true;
    controlsRef.current = controls;

    // Ambient light
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    // Store nodes ref for simulation
    nodesRef.current = nodes;

    // Create node meshes
    const meshes: THREE.Mesh[] = [];
    const glows: THREE.Mesh[] = [];
    for (const node of nodes) {
      const r = nodeRadius(node.connections);
      const color = hexToRGB(getCategoryColor(node.category));

      // Core sphere
      const geo = new THREE.SphereGeometry(r, 16, 12);
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.8,
        shininess: 90,
        transparent: true,
        opacity: 0.95,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      mesh.userData = { nodeId: node.id };
      scene.add(mesh);
      meshes.push(mesh);

      // Glow sprite
      const glowGeo = new THREE.SphereGeometry(r * 2.2, 12, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(mesh.position);
      scene.add(glow);
      glows.push(glow);
    }
    nodeMeshesRef.current = meshes;
    glowMeshesRef.current = glows;

    // Create edge lines
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(links.length * 6);
    const colors = new Float32Array(links.length * 6);
    for (let i = 0; i < links.length; i++) {
      const idx = i * 6;
      positions[idx] = positions[idx + 1] = positions[idx + 2] = 0;
      positions[idx + 3] = positions[idx + 4] = positions[idx + 5] = 0;
      // Edge color: very subtle, weight-proportional
      const w = links[i].weight ?? 0.6;
      const intensity = 0.06 + w * 0.12;
      colors[idx] = colors[idx + 3] = intensity * 0.7;
      colors[idx + 1] = colors[idx + 4] = intensity * 0.8;
      colors[idx + 2] = colors[idx + 5] = intensity; // subtle blue tint
    }
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.18,
    });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineSegments);
    lineRef.current = lineSegments;

    // Run d3-force simulation
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const simLinks = links.map((l) => ({
      source: l.source as string,
      target: l.target as string,
      weight: l.weight,
    }));

    const sim = forceSimulation<GNode>(nodes)
      .force('charge', forceManyBody().strength(-18).distanceMax(120))
      .force(
        'link',
        forceLink<GNode, SimulationLinkDatum<GNode>>(simLinks as SimulationLinkDatum<GNode>[])
          .id((d) => (d as GNode).id)
          .distance(15)
          .strength(0.5),
      )
      .force('center', forceCenter(0, 0).strength(0.08))
      .force('collide', forceCollide<GNode>().radius((d) => nodeRadius(d.connections) + 0.5))
      .alphaDecay(0.02)
      .on('tick', () => {
        // Apply 3D z-forces
        force3D(nodes, sim.alpha());

        // Update mesh positions
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const pos = new THREE.Vector3(n.x ?? 0, n.y ?? 0, n.z ?? 0);
          meshes[i].position.copy(pos);
          glows[i].position.copy(pos);
        }

        // Update edge lines
        const posArr = lineSegments.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < simLinks.length; i++) {
          const src = typeof simLinks[i].source === 'string'
            ? nodeMap.get(simLinks[i].source)
            : (simLinks[i].source as unknown as GNode);
          const tgt = typeof simLinks[i].target === 'string'
            ? nodeMap.get(simLinks[i].target)
            : (simLinks[i].target as unknown as GNode);
          if (!src || !tgt) continue;
          const idx = i * 6;
          posArr[idx] = src.x ?? 0;
          posArr[idx + 1] = src.y ?? 0;
          posArr[idx + 2] = src.z ?? 0;
          posArr[idx + 3] = tgt.x ?? 0;
          posArr[idx + 4] = tgt.y ?? 0;
          posArr[idx + 5] = tgt.z ?? 0;
        }
        lineSegments.geometry.attributes.position.needsUpdate = true;
      });

    // Animation loop
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      // Raycasting for hover
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(meshes);
      if (intersects.length > 0) {
        const nodeId = intersects[0].object.userData.nodeId;
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          // Project to screen for tooltip
          const vec = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0);
          vec.project(camera);
          const x = (vec.x * 0.5 + 0.5) * width;
          const y = (-vec.y * 0.5 + 0.5) * h;
          setHoveredNode(node);
          setTooltipPos({ x, y });

          // Highlight: increase glow
          const idx = nodes.indexOf(node);
          if (idx >= 0 && glows[idx]) {
            (glows[idx].material as THREE.MeshBasicMaterial).opacity = 0.35;
          }
        }
      } else {
        setHoveredNode(null);
        setTooltipPos(null);
        // Reset all glows
        for (const g of glows) {
          (g.material as THREE.MeshBasicMaterial).opacity = 0.12;
        }
      }

      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth;
      const newH = isFullscreen ? window.innerHeight : height;
      camera.aspect = w / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(w, newH);
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    return () => {
      sim.stop();
      cancelAnimationFrame(animFrameRef.current);
      resizeObs.disconnect();
      controls.dispose();
      renderer.dispose();
      scene.clear();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links, height, compact]);

  // Update auto-rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = isAutoRotating;
    }
  }, [isAutoRotating]);

  // Esc key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Mouse move handler
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    },
    [],
  );

  // Click handler
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cameraRef.current || !rendererRef.current) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(nodeMeshesRef.current);

      if (intersects.length > 0) {
        const nodeId = intersects[0].object.userData.nodeId;
        const node = nodesRef.current.find((n) => n.id === nodeId);
        if (node) {
          setSelectedNode((prev) => (prev?.id === node.id ? null : node));
          // Stop auto-rotate when inspecting
          setIsAutoRotating(false);
        }
      } else {
        setSelectedNode(null);
      }
    },
    [],
  );

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      // Trigger resize after state update
      setTimeout(() => {
        if (containerRef.current && rendererRef.current && cameraRef.current) {
          const w = containerRef.current.clientWidth;
          const h = next ? window.innerHeight : height;
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }, 50);
      return next;
    });
  }, [height]);

  // Selected node details
  const selectedMeta = selectedNode ? nodeMetadata.get(selectedNode.id) : null;

  return (
    <div
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-[#0a0a0f]' : ''}`}
    >
      {/* 3D Canvas container */}
      <div
        ref={containerRef}
        className={`relative w-full ${isFullscreen ? '' : 'rounded-xl border border-zinc-800'} overflow-hidden cursor-grab active:cursor-grabbing`}
        style={{ height: isFullscreen ? '100vh' : height }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Hover tooltip */}
      {hoveredNode && tooltipPos && !selectedNode && (
        <div
          className="absolute pointer-events-none z-20 rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-md"
          style={{
            left: Math.min(tooltipPos.x + 16, (containerRef.current?.clientWidth ?? 800) - 220),
            top: Math.max(tooltipPos.y - 50, 8),
          }}
        >
          <p className="text-sm font-medium text-zinc-100 font-mono">{hoveredNode.label}</p>
          {hoveredNode.category && (
            <p className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: getCategoryColor(hoveredNode.category) }}
              />
              {getCategoryLabel(hoveredNode.category)}
            </p>
          )}
          <p className="text-xs text-zinc-500 mt-0.5">{hoveredNode.connections} connections</p>
        </div>
      )}

      {/* Selected node info panel */}
      {selectedNode && (
        <div
          className={`absolute z-20 ${
            isFullscreen
              ? 'top-4 right-4 w-80'
              : 'top-3 right-3 w-72'
          } rounded-xl border border-zinc-700/80 bg-zinc-900/95 shadow-2xl backdrop-blur-md overflow-hidden`}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100 font-mono truncate">
                  {selectedNode.label}
                </h3>
                {selectedNode.category && (
                  <p className="flex items-center gap-1.5 text-xs text-zinc-400 mt-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getCategoryColor(selectedNode.category) }}
                    />
                    {getCategoryLabel(selectedNode.category)}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedNode(null); setIsAutoRotating(true); }}
                className="shrink-0 rounded-full p-1 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedMeta?.description && (
              <p className="text-xs text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                {selectedMeta.description}
              </p>
            )}

            <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
              <span>{selectedNode.connections} connections</span>
              {selectedNode.category && (
                <span className="flex items-center gap-1">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: getCategoryColor(selectedNode.category) }}
                  />
                  {selectedNode.category}
                </span>
              )}
            </div>

            {onNodeClick && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNodeClick(selectedNode.id);
                }}
                className="mt-3 w-full rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors text-center"
              >
                Open repo details &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Category Legend (bottom-left) */}
      <div className={`absolute ${isFullscreen ? 'bottom-6 left-6' : 'bottom-3 left-3'} flex flex-col gap-0.5 max-h-48 overflow-y-auto`}>
        {activeCategories.map((cat) => (
          <span
            key={cat}
            className="inline-flex items-center gap-1.5 text-[10px] text-zinc-400"
          >
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#52525b' }}
            />
            {CATEGORY_LABELS[cat] ?? cat}
          </span>
        ))}
      </div>

      {/* Controls (top-left) */}
      <div className={`absolute ${isFullscreen ? 'top-4 left-4' : 'top-3 left-3'} flex items-center gap-1.5`}>
        <button
          onClick={toggleFullscreen}
          className="rounded-lg bg-zinc-800/80 p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80 transition-colors backdrop-blur-sm"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setIsAutoRotating((p) => !p)}
          className={`rounded-lg p-2 transition-colors backdrop-blur-sm ${
            isAutoRotating
              ? 'bg-zinc-700/80 text-zinc-200'
              : 'bg-zinc-800/80 text-zinc-500 hover:text-zinc-300'
          }`}
          title={isAutoRotating ? 'Stop rotation' : 'Auto-rotate'}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

      {/* Fullscreen escape hint */}
      {isFullscreen && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-800/60 px-4 py-1.5 text-[11px] text-zinc-500 backdrop-blur-sm">
          Press Esc or click the icon to exit fullscreen
        </div>
      )}

      {/* Bottom info */}
      {!compact && (
        <div className={`absolute ${isFullscreen ? 'bottom-6 right-6' : 'bottom-3 right-3'} text-[10px] text-zinc-600`}>
          Scroll to zoom &middot; Drag to rotate &middot; Right-drag to pan
        </div>
      )}
    </div>
  );
}
