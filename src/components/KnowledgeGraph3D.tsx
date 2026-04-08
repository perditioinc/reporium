'use client';

/**
 * KAN-160: Interactive 3D knowledge graph with Three.js.
 *
 * Interactions:
 * - Hover node → highlight connected edges + connected nodes, dim rest
 * - Click node → info panel with connections list, edges light up
 * - Category legend → clickable filters, responsive horizontal layout
 * - Cluster labels → category centroids rendered as text sprites
 * - Fullscreen toggle, auto-rotation, zoom/rotate/pan
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
      x: (Math.random() - 0.5) * 300,
      y: (Math.random() - 0.5) * 300,
      z: (Math.random() - 0.5) * 300,
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

/** Build adjacency map: nodeId → Set of connected nodeIds */
function buildAdjacency(edges: GraphEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

/** Build edge index: for each nodeId, which link indices connect to it */
function buildEdgeIndex(links: GLink[], nodes: GNode[]): Map<string, number[]> {
  const idx = new Map<string, number[]>();
  for (const n of nodes) idx.set(n.id, []);
  for (let i = 0; i < links.length; i++) {
    const sId = typeof links[i].source === 'string'
      ? links[i].source as string
      : (links[i].source as unknown as GNode).id;
    const tId = typeof links[i].target === 'string'
      ? links[i].target as string
      : (links[i].target as unknown as GNode).id;
    idx.get(sId)?.push(i);
    idx.get(tId)?.push(i);
  }
  return idx;
}

function hexToRGB(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

// 3D force: apply z-axis forces manually using random sampling for efficiency
function force3D(nodes: GNode[], alpha: number) {
  const n = nodes.length;
  for (const node of nodes) {
    if (node.z === undefined) node.z = 0;
    if (node.vz === undefined) node.vz = 0;
    // Weak centering force toward z=0
    node.vz += -node.z * 0.008 * alpha;
    node.vz *= 0.88;
    node.z += node.vz;
  }
  // Random-sampled z repulsion — covers all nodes proportionally
  const samples = Math.min(n * 4, 4000);
  for (let k = 0; k < samples; k++) {
    const i = Math.floor(Math.random() * n);
    const j = Math.floor(Math.random() * n);
    if (i === j) continue;
    const a = nodes[i];
    const b = nodes[j];
    const dz = (a.z ?? 0) - (b.z ?? 0);
    const dx = (a.x ?? 0) - (b.x ?? 0);
    const dy = (a.y ?? 0) - (b.y ?? 0);
    const dist2 = dx * dx + dy * dy + dz * dz + 1;
    const force = (alpha * 40) / dist2;
    const fz = dz * force;
    a.vz = (a.vz ?? 0) + fz;
    b.vz = (b.vz ?? 0) - fz;
  }
}

/** Create a text sprite for cluster labels */
function createTextSprite(text: string, color: string, fontSize = 22, alpha = 0.6, scale: [number, number, number] = [30, 7.5, 1]): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 512;
  canvas.height = 64;
  ctx.clearRect(0, 0, 512, 64);
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fillText(text, 256, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(...scale);
  return sprite;
}

/** Create a smaller name label sprite for node hover labels */
function createNodeLabel(text: string, color: string): THREE.Sprite {
  return createTextSprite(text, color, 28, 0.95, [18, 3.5, 1]);
}

/** Quadratic bezier point at parameter t between src (a) and tgt (c) via control (b) */
function quadBezier(
  t: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  cx: number, cy: number, cz: number,
): [number, number, number] {
  const mt = 1 - t;
  return [
    mt * mt * ax + 2 * mt * t * bx + t * t * cx,
    mt * mt * ay + 2 * mt * t * by + t * t * cy,
    mt * mt * az + 2 * mt * t * bz + t * t * cz,
  ];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface KnowledgeGraph3DProps {
  edges: GraphEdge[];
  nodeMetadata: Map<string, NodeMeta>;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  compact?: boolean;
  /** External selection — when set, auto-selects and focuses the matching node */
  selectedNodeId?: string | null;
}

export function KnowledgeGraph3D({
  edges,
  nodeMetadata,
  height = 560,
  onNodeClick,
  compact = false,
  selectedNodeId,
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
  const adjacencyRef = useRef<Map<string, Set<string>>>(new Map());
  const edgeIndexRef = useRef<Map<string, number[]>>(new Map());
  const baseEdgeColorsRef = useRef<Float32Array>(new Float32Array(0));
  const linksRef = useRef<GLink[]>([]);
  const containerSizeRef = useRef({ w: 0, h: 0 });
  const nodeLabelSpritesRef = useRef<THREE.Sprite[]>([]);

  // Typed edge LineSegments (separate from SIMILAR_TO for distinct geometry)
  const compatLineRef = useRef<THREE.LineSegments | null>(null); // COMPATIBLE_WITH arcs
  const altLineRef    = useRef<THREE.LineSegments | null>(null); // ALTERNATIVE_TO dashes
  const depLineRef    = useRef<THREE.LineSegments | null>(null); // DEPENDS_ON lines
  const depConesRef   = useRef<THREE.InstancedMesh | null>(null); // DEPENDS_ON arrowheads
  const extLineRef    = useRef<THREE.LineSegments | null>(null); // EXTENDS double-lines
  // Invisible click-target spheres (2× radius) for easier hit detection
  const clickSpheresRef = useRef<THREE.Mesh[]>([]);
  // Base color buffers per typed edge type (for highlight reset)
  const compatBaseColRef = useRef<Float32Array>(new Float32Array(0));
  const altBaseColRef    = useRef<Float32Array>(new Float32Array(0));
  const depBaseColRef    = useRef<Float32Array>(new Float32Array(0));
  const extBaseColRef    = useRef<Float32Array>(new Float32Array(0));
  // Split link arrays per type (populated in useEffect)
  const simLinksRef    = useRef<GLink[]>([]);
  const compatLinksRef = useRef<GLink[]>([]);
  const altLinksRef    = useRef<GLink[]>([]);
  const depLinksRef    = useRef<GLink[]>([]);
  const extLinksRef    = useRef<GLink[]>([]);
  // Edge-index maps per type: nodeId → indices into that type's link array
  const compatEdgeIdxRef = useRef<Map<string, number[]>>(new Map());
  const altEdgeIdxRef    = useRef<Map<string, number[]>>(new Map());
  const depEdgeIdxRef    = useRef<Map<string, number[]>>(new Map());
  const extEdgeIdxRef    = useRef<Map<string, number[]>>(new Map());

  const [hoveredNode, setHoveredNode] = useState<GNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  // Track which node IDs are connected to hovered/selected node for the info panel
  const [connectedNames, setConnectedNames] = useState<string[]>([]);

  // Active categories for legend
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const [, meta] of nodeMetadata) {
      if (meta.category) cats.add(meta.category);
    }
    return Array.from(cats).sort();
  }, [nodeMetadata]);

  // Build node/link data (edgeIndex rebuilt per-type in useEffect)
  const { nodes, links, adjacency } = useMemo(() => {
    const nodes = buildNodes(edges, nodeMetadata);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = buildLinks(edges, nodeIds);
    const adjacency = buildAdjacency(edges);
    return { nodes, links, adjacency };
  }, [edges, nodeMetadata]);

  // Refs for highlight logic (accessible from animate loop)
  const hoveredNodeRef = useRef<GNode | null>(null);
  const selectedNodeRef = useRef<GNode | null>(null);
  const hiddenCategoriesRef = useRef<Set<string>>(new Set());

  // Sync state → refs
  useEffect(() => { hoveredNodeRef.current = hoveredNode; }, [hoveredNode]);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { hiddenCategoriesRef.current = hiddenCategories; }, [hiddenCategories]);

  // Sync external selection → internal state
  useEffect(() => {
    if (selectedNodeId === undefined) return; // prop not provided
    if (selectedNodeId === null) {
      // External deselection
      if (selectedNode) {
        setSelectedNode(null);
        setIsAutoRotating(true);
      }
      return;
    }
    // Find matching node — try exact match first, then match by label (short name)
    const match =
      nodes.find((n) => n.id === selectedNodeId) ??
      nodes.find((n) => n.label === selectedNodeId) ??
      nodes.find((n) => n.id.endsWith(`/${selectedNodeId}`));
    if (match && match.id !== selectedNode?.id) {
      setSelectedNode(match);
      setIsAutoRotating(false);
      // Pan camera toward the selected node
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (camera && controls && match.x !== undefined && match.y !== undefined) {
        const targetPos = new THREE.Vector3(match.x, match.y, match.z ?? 0);
        controls.target.lerp(targetPos, 0.5);
        controls.update();
      }
    }
  }, [selectedNodeId, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize Three.js scene
  useEffect(() => {
    const container = containerRef.current;
    if (!container || nodes.length === 0) return;

    const width = container.clientWidth;
    const h = height;
    containerSizeRef.current = { w: width, h };

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0a0f');
    scene.fog = new THREE.FogExp2('#0a0a0f', 0.0006);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / h, 0.1, 4000);
    camera.position.set(0, 0, compact ? 700 : 900);
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
    controls.maxDistance = 2000;
    controls.enablePan = true;
    controlsRef.current = controls;

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.2);
    dirLight.position.set(100, 100, 100);
    scene.add(dirLight);

    // Store refs
    nodesRef.current = nodes;
    adjacencyRef.current = adjacency;
    linksRef.current = links;
    // edgeIndexRef will be rebuilt after link-type split to cover simLinks only

    // Create node meshes
    const meshes: THREE.Mesh[] = [];
    const glows: THREE.Mesh[] = [];
    for (const node of nodes) {
      const r = nodeRadius(node.connections);
      const color = hexToRGB(getCategoryColor(node.category));

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
      mesh.userData = { nodeId: node.id, baseColor: color.clone(), baseOpacity: 0.95 };
      scene.add(mesh);
      meshes.push(mesh);

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

    // Create name label sprites (one per node, hidden by default)
    const nodeLabels: THREE.Sprite[] = [];
    for (const node of nodes) {
      const color = getCategoryColor(node.category);
      const label = createNodeLabel(node.label, color);
      label.visible = false;
      label.position.set(node.x ?? 0, (node.y ?? 0) + nodeRadius(node.connections) + 3, node.z ?? 0);
      scene.add(label);
      nodeLabels.push(label);
    }
    nodeLabelSpritesRef.current = nodeLabels;

    // ── Split links by edge type ──────────────────────────────────────────────
    const TYPED_RGB: Record<string, THREE.Color> = {
      ALTERNATIVE_TO: new THREE.Color(0.95, 0.60, 0.05), // amber
      COMPATIBLE_WITH: new THREE.Color(0.10, 0.75, 0.25), // green
      DEPENDS_ON:      new THREE.Color(0.20, 0.50, 1.00), // blue
      EXTENDS:         new THREE.Color(0.95, 0.28, 0.60), // pink
    };
    const simLinks: GLink[]    = [];
    const compatLinks: GLink[] = [];
    const altLinks: GLink[]    = [];
    const depLinks: GLink[]    = [];
    const extLinks: GLink[]    = [];
    for (const l of links) {
      const t = (l.edge_type ?? '').toUpperCase();
      if      (t === 'COMPATIBLE_WITH') compatLinks.push(l);
      else if (t === 'ALTERNATIVE_TO')  altLinks.push(l);
      else if (t === 'DEPENDS_ON')      depLinks.push(l);
      else if (t === 'EXTENDS')         extLinks.push(l);
      else                              simLinks.push(l);
    }
    simLinksRef.current    = simLinks;
    compatLinksRef.current = compatLinks;
    altLinksRef.current    = altLinks;
    depLinksRef.current    = depLinks;
    extLinksRef.current    = extLinks;
    // edgeIndexRef covers only simLinks so animate-loop indices are correct
    edgeIndexRef.current = buildEdgeIndex(simLinks, nodes);

    // Build per-type edge indices (nodeId → indices into that type's array)
    function buildTypeIdx(arr: GLink[]): Map<string, number[]> {
      const m = new Map<string, number[]>();
      for (let i = 0; i < arr.length; i++) {
        const sId = arr[i].source as string;
        const tId = arr[i].target as string;
        if (!m.has(sId)) m.set(sId, []);
        if (!m.has(tId)) m.set(tId, []);
        m.get(sId)!.push(i);
        m.get(tId)!.push(i);
      }
      return m;
    }
    compatEdgeIdxRef.current = buildTypeIdx(compatLinks);
    altEdgeIdxRef.current    = buildTypeIdx(altLinks);
    depEdgeIdxRef.current    = buildTypeIdx(depLinks);
    extEdgeIdxRef.current    = buildTypeIdx(extLinks);

    // Node id → category RGB (for SIMILAR_TO edge coloring by source cluster)
    const nodeCatColor = new Map<string, THREE.Color>();
    for (const node of nodes) {
      nodeCatColor.set(node.id, hexToRGB(getCategoryColor(node.category)));
    }

    // ── SIMILAR_TO: thin straight LineSegments (most numerous) ───────────────
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(simLinks.length * 6);
    const colors = new Float32Array(simLinks.length * 6);
    for (let i = 0; i < simLinks.length; i++) {
      const idx = i * 6;
      const srcId = simLinks[i].source as string;
      const cat = nodeCatColor.get(srcId) ?? new THREE.Color('#8888aa');
      const dim = 0.45;
      colors[idx]     = colors[idx + 3] = cat.r * dim;
      colors[idx + 1] = colors[idx + 4] = cat.g * dim;
      colors[idx + 2] = colors[idx + 5] = cat.b * dim;
    }
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    baseEdgeColorsRef.current = new Float32Array(colors);
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineSegments);
    lineRef.current = lineSegments;

    // ── COMPATIBLE_WITH: curved arcs (8 quad-bezier segments per edge) ───────
    const COMPAT_SEGS = 8; // segments per arc
    const COMPAT_VPE  = COMPAT_SEGS * 2; // vertex-pairs per edge (16 vertices)
    {
      const pos = new Float32Array(compatLinks.length * COMPAT_VPE * 3);
      const col = new Float32Array(compatLinks.length * COMPAT_VPE * 3);
      const c = TYPED_RGB.COMPATIBLE_WITH;
      for (let i = 0; i < compatLinks.length; i++) {
        const dim = 0.75 + (compatLinks[i].weight ?? 0.5) * 0.25;
        for (let v = 0; v < COMPAT_VPE; v++) {
          const off = (i * COMPAT_VPE + v) * 3;
          col[off] = c.r * dim; col[off + 1] = c.g * dim; col[off + 2] = c.b * dim;
        }
      }
      compatBaseColRef.current = new Float32Array(col);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65 });
      const ls = new THREE.LineSegments(geo, mat);
      scene.add(ls);
      compatLineRef.current = ls;
    }

    // ── ALTERNATIVE_TO: dashed lines (3 dash segments per edge) ──────────────
    const ALT_DASHES = 3;
    const ALT_VPE    = ALT_DASHES * 2; // 6 vertices per edge
    {
      const pos = new Float32Array(altLinks.length * ALT_VPE * 3);
      const col = new Float32Array(altLinks.length * ALT_VPE * 3);
      const c = TYPED_RGB.ALTERNATIVE_TO;
      for (let i = 0; i < altLinks.length; i++) {
        const dim = 0.75 + (altLinks[i].weight ?? 0.5) * 0.25;
        for (let v = 0; v < ALT_VPE; v++) {
          const off = (i * ALT_VPE + v) * 3;
          col[off] = c.r * dim; col[off + 1] = c.g * dim; col[off + 2] = c.b * dim;
        }
      }
      altBaseColRef.current = new Float32Array(col);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65 });
      const ls = new THREE.LineSegments(geo, mat);
      scene.add(ls);
      altLineRef.current = ls;
    }

    // ── DEPENDS_ON: straight lines + cone arrowheads (InstancedMesh) ─────────
    {
      const pos = new Float32Array(depLinks.length * 6);
      const col = new Float32Array(depLinks.length * 6);
      const c = TYPED_RGB.DEPENDS_ON;
      for (let i = 0; i < depLinks.length; i++) {
        const dim = 0.75 + (depLinks[i].weight ?? 0.5) * 0.25;
        col[i*6]     = col[i*6+3] = c.r * dim;
        col[i*6+1]   = col[i*6+4] = c.g * dim;
        col[i*6+2]   = col[i*6+5] = c.b * dim;
      }
      depBaseColRef.current = new Float32Array(col);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65 });
      const ls = new THREE.LineSegments(geo, mat);
      scene.add(ls);
      depLineRef.current = ls;

      if (depLinks.length > 0) {
        const coneGeo = new THREE.ConeGeometry(1.5, 5, 6);
        const coneMat = new THREE.MeshBasicMaterial({ color: TYPED_RGB.DEPENDS_ON, transparent: true, opacity: 0.8 });
        const cones = new THREE.InstancedMesh(coneGeo, coneMat, depLinks.length);
        // Init instanceColor so we can update it per-instance later
        for (let i = 0; i < depLinks.length; i++) cones.setColorAt(i, TYPED_RGB.DEPENDS_ON);
        cones.instanceColor!.needsUpdate = true;
        scene.add(cones);
        depConesRef.current = cones;
      }
    }

    // ── EXTENDS: double lines (2 parallel lines per edge, ±2 unit offset) ─────
    const EXT_VPE = 4; // 2 pairs × 2 vertices
    {
      const pos = new Float32Array(extLinks.length * EXT_VPE * 3);
      const col = new Float32Array(extLinks.length * EXT_VPE * 3);
      const c = TYPED_RGB.EXTENDS;
      for (let i = 0; i < extLinks.length; i++) {
        const dim = 0.75 + (extLinks[i].weight ?? 0.5) * 0.25;
        for (let v = 0; v < EXT_VPE; v++) {
          const off = (i * EXT_VPE + v) * 3;
          col[off] = c.r * dim; col[off + 1] = c.g * dim; col[off + 2] = c.b * dim;
        }
      }
      extBaseColRef.current = new Float32Array(col);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65 });
      const ls = new THREE.LineSegments(geo, mat);
      scene.add(ls);
      extLineRef.current = ls;
    }

    // ── Invisible click-target spheres (larger radius for easier selection) ───
    const clickSpheres: THREE.Mesh[] = [];
    for (const node of nodes) {
      const r = nodeRadius(node.connections) * 2.5;
      const geo = new THREE.SphereGeometry(r, 6, 4);
      const mat = new THREE.MeshBasicMaterial({ visible: false });
      const sphere = new THREE.Mesh(geo, mat);
      sphere.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      sphere.userData = { nodeId: node.id };
      scene.add(sphere);
      clickSpheres.push(sphere);
    }
    clickSpheresRef.current = clickSpheres;

    // Category cluster labels — computed after simulation settles
    const clusterSprites: THREE.Sprite[] = [];
    let clustersCreated = false;

    // Force simulation
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const forceLinks = links.map((l) => ({
      source: l.source as string,
      target: l.target as string,
      weight: l.weight,
    }));

    const sim = forceSimulation<GNode>(nodes)
      .force('charge', forceManyBody().strength(-60).distanceMax(300))
      .force(
        'link',
        forceLink<GNode, SimulationLinkDatum<GNode>>(forceLinks as SimulationLinkDatum<GNode>[])
          .id((d) => (d as GNode).id)
          .distance(30)
          .strength(0.3),
      )
      .force('center', forceCenter(0, 0).strength(0.04))
      .force('collide', forceCollide<GNode>().radius((d) => nodeRadius(d.connections) + 2))
      .alphaDecay(0.015)
      .on('tick', () => {
        force3D(nodes, sim.alpha());

        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const pos = new THREE.Vector3(n.x ?? 0, n.y ?? 0, n.z ?? 0);
          meshes[i].position.copy(pos);
          glows[i].position.copy(pos);
          // Keep label above node
          if (nodeLabels[i]) {
            nodeLabels[i].position.set(n.x ?? 0, (n.y ?? 0) + nodeRadius(n.connections) + 3, n.z ?? 0);
          }
        }

        // ── SIMILAR_TO: straight positions ────────────────────────────────────
        {
          const posArr = lineSegments.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < simLinks.length; i++) {
            const sl = simLinks[i];
            const srcId = typeof sl.source === 'string' ? sl.source : (sl.source as unknown as GNode).id;
            const tgtId = typeof sl.target === 'string' ? sl.target : (sl.target as unknown as GNode).id;
            const src = nodeMap.get(srcId);
            const tgt = nodeMap.get(tgtId);
            if (!src || !tgt) continue;
            const idx = i * 6;
            posArr[idx]     = src.x ?? 0; posArr[idx + 1] = src.y ?? 0; posArr[idx + 2] = src.z ?? 0;
            posArr[idx + 3] = tgt.x ?? 0; posArr[idx + 4] = tgt.y ?? 0; posArr[idx + 5] = tgt.z ?? 0;
          }
          lineSegments.geometry.attributes.position.needsUpdate = true;
        }

        // ── COMPATIBLE_WITH: quadratic bezier arcs ────────────────────────────
        if (compatLineRef.current && compatLinks.length > 0) {
          const posArr = compatLineRef.current.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < compatLinks.length; i++) {
            const cl = compatLinks[i];
            const srcId = typeof cl.source === 'string' ? cl.source : (cl.source as unknown as GNode).id;
            const tgtId = typeof cl.target === 'string' ? cl.target : (cl.target as unknown as GNode).id;
            const src = nodeMap.get(srcId); const tgt = nodeMap.get(tgtId);
            if (!src || !tgt) continue;
            const sx = src.x ?? 0, sy = src.y ?? 0, sz = src.z ?? 0;
            const tx = tgt.x ?? 0, ty = tgt.y ?? 0, tz = tgt.z ?? 0;
            const edgeLen = Math.sqrt((tx-sx)**2 + (ty-sy)**2 + (tz-sz)**2);
            const dx = tx - sx, dy = ty - sy;
            const perpLen = Math.sqrt(dx*dx + dy*dy) || 1;
            const bow = edgeLen * 0.15;
            const cx2 = (sx+tx)/2 + (-dy/perpLen)*bow;
            const cy2 = (sy+ty)/2 + (dx/perpLen)*bow;
            const cz2 = (sz+tz)/2;
            const base = i * COMPAT_SEGS * 2 * 3;
            for (let seg = 0; seg < COMPAT_SEGS; seg++) {
              const [bx0,by0,bz0] = quadBezier(seg/COMPAT_SEGS,     sx,sy,sz, cx2,cy2,cz2, tx,ty,tz);
              const [bx1,by1,bz1] = quadBezier((seg+1)/COMPAT_SEGS, sx,sy,sz, cx2,cy2,cz2, tx,ty,tz);
              const off = base + seg * 6;
              posArr[off]=bx0; posArr[off+1]=by0; posArr[off+2]=bz0;
              posArr[off+3]=bx1; posArr[off+4]=by1; posArr[off+5]=bz1;
            }
          }
          compatLineRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // ── ALTERNATIVE_TO: dashed segments ───────────────────────────────────
        if (altLineRef.current && altLinks.length > 0) {
          const posArr = altLineRef.current.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < altLinks.length; i++) {
            const al = altLinks[i];
            const srcId = typeof al.source === 'string' ? al.source : (al.source as unknown as GNode).id;
            const tgtId = typeof al.target === 'string' ? al.target : (al.target as unknown as GNode).id;
            const src = nodeMap.get(srcId); const tgt = nodeMap.get(tgtId);
            if (!src || !tgt) continue;
            const sx = src.x ?? 0, sy = src.y ?? 0, sz = src.z ?? 0;
            const tx = tgt.x ?? 0, ty = tgt.y ?? 0, tz = tgt.z ?? 0;
            const len = Math.sqrt((tx-sx)**2+(ty-sy)**2+(tz-sz)**2) || 1;
            const dirX=(tx-sx)/len, dirY=(ty-sy)/len, dirZ=(tz-sz)/len;
            // 3 dashes: starts at 1/7, 3/7, 5/7; ends at 2/7, 4/7, 6/7
            for (let d = 0; d < ALT_DASHES; d++) {
              const t0 = (d*2+1)/7, t1 = (d*2+2)/7;
              const off = (i * ALT_VPE + d * 2) * 3;
              posArr[off]   = sx+dirX*t0*len; posArr[off+1] = sy+dirY*t0*len; posArr[off+2] = sz+dirZ*t0*len;
              posArr[off+3] = sx+dirX*t1*len; posArr[off+4] = sy+dirY*t1*len; posArr[off+5] = sz+dirZ*t1*len;
            }
          }
          altLineRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // ── DEPENDS_ON: straight lines + update cone transforms ───────────────
        if (depLineRef.current && depLinks.length > 0) {
          const posArr = depLineRef.current.geometry.attributes.position.array as Float32Array;
          const dummy = new THREE.Object3D();
          const up = new THREE.Vector3(0, 1, 0);
          for (let i = 0; i < depLinks.length; i++) {
            const dl = depLinks[i];
            const srcId = typeof dl.source === 'string' ? dl.source : (dl.source as unknown as GNode).id;
            const tgtId = typeof dl.target === 'string' ? dl.target : (dl.target as unknown as GNode).id;
            const src = nodeMap.get(srcId); const tgt = nodeMap.get(tgtId);
            if (!src || !tgt) continue;
            const sx=src.x??0, sy=src.y??0, sz=src.z??0;
            const tx=tgt.x??0, ty=tgt.y??0, tz=tgt.z??0;
            posArr[i*6]=sx; posArr[i*6+1]=sy; posArr[i*6+2]=sz;
            posArr[i*6+3]=tx; posArr[i*6+4]=ty; posArr[i*6+5]=tz;
            if (depConesRef.current) {
              const dir = new THREE.Vector3(tx-sx, ty-sy, tz-sz).normalize();
              const tgtR = nodeRadius(tgt.connections) + 3;
              dummy.position.set(tx - dir.x*tgtR, ty - dir.y*tgtR, tz - dir.z*tgtR);
              if (Math.abs(dir.dot(up)) < 0.999) {
                dummy.quaternion.setFromUnitVectors(up, dir);
              } else {
                dummy.quaternion.setFromUnitVectors(up, dir.x >= 0 ? new THREE.Vector3(1,0,0) : new THREE.Vector3(-1,0,0));
              }
              dummy.updateMatrix();
              depConesRef.current.setMatrixAt(i, dummy.matrix);
            }
          }
          depLineRef.current.geometry.attributes.position.needsUpdate = true;
          if (depConesRef.current) depConesRef.current.instanceMatrix.needsUpdate = true;
        }

        // ── EXTENDS: double parallel lines ────────────────────────────────────
        if (extLineRef.current && extLinks.length > 0) {
          const posArr = extLineRef.current.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < extLinks.length; i++) {
            const el = extLinks[i];
            const srcId = typeof el.source === 'string' ? el.source : (el.source as unknown as GNode).id;
            const tgtId = typeof el.target === 'string' ? el.target : (el.target as unknown as GNode).id;
            const src = nodeMap.get(srcId); const tgt = nodeMap.get(tgtId);
            if (!src || !tgt) continue;
            const sx=src.x??0, sy=src.y??0, sz=src.z??0;
            const tx=tgt.x??0, ty=tgt.y??0, tz=tgt.z??0;
            const dx=tx-sx, dy=ty-sy;
            const perpLen = Math.sqrt(dx*dx+dy*dy) || 1;
            const px = (-dy/perpLen)*2, py = (dx/perpLen)*2;
            const off = i * EXT_VPE * 3;
            posArr[off]   =sx+px; posArr[off+1] =sy+py; posArr[off+2] =sz;
            posArr[off+3] =tx+px; posArr[off+4] =ty+py; posArr[off+5] =tz;
            posArr[off+6] =sx-px; posArr[off+7] =sy-py; posArr[off+8] =sz;
            posArr[off+9] =tx-px; posArr[off+10]=ty-py; posArr[off+11]=tz;
          }
          extLineRef.current.geometry.attributes.position.needsUpdate = true;
        }

        // ── Keep click spheres aligned with nodes ─────────────────────────────
        for (let i = 0; i < nodes.length; i++) {
          clickSpheres[i].position.set(nodes[i].x??0, nodes[i].y??0, nodes[i].z??0);
        }

        // Create cluster labels once simulation is mostly settled
        if (!clustersCreated && sim.alpha() < 0.15) {
          clustersCreated = true;
          const catPositions = new Map<string, { sx: number; sy: number; sz: number; count: number }>();
          for (const n of nodes) {
            if (!n.category) continue;
            const entry = catPositions.get(n.category) ?? { sx: 0, sy: 0, sz: 0, count: 0 };
            entry.sx += n.x ?? 0;
            entry.sy += n.y ?? 0;
            entry.sz += n.z ?? 0;
            entry.count++;
            catPositions.set(n.category, entry);
          }
          for (const [cat, pos] of catPositions) {
            if (pos.count < 3) continue; // skip tiny clusters
            const label = getCategoryLabel(cat);
            const color = getCategoryColor(cat);
            const sprite = createTextSprite(label, color);
            sprite.position.set(
              pos.sx / pos.count,
              pos.sy / pos.count + 8, // offset above centroid
              pos.sz / pos.count,
            );
            sprite.userData = { category: cat };
            scene.add(sprite);
            clusterSprites.push(sprite);
          }
        }
      });

    // Helper to highlight/dim a typed-edge LineSegments buffer
    function applyTypedHighlight(
      ls: THREE.LineSegments | null,
      linkArr: GLink[],
      connSet: Set<number>,
      baseCol: Float32Array,
      vertsPerEdge: number,
      activeColor: THREE.Color,
      dim: number,
    ) {
      if (!ls || linkArr.length === 0) return;
      const col = ls.geometry.attributes.color.array as Float32Array;
      for (let i = 0; i < linkArr.length; i++) {
        const isConn = connSet.has(i);
        const base = i * vertsPerEdge * 3;
        for (let v = 0; v < vertsPerEdge; v++) {
          const off = base + v * 3;
          if (isConn) {
            col[off]   = activeColor.r * 0.9;
            col[off+1] = activeColor.g * 0.9;
            col[off+2] = activeColor.b * 0.9;
          } else {
            col[off]   = baseCol[off]   * dim;
            col[off+1] = baseCol[off+1] * dim;
            col[off+2] = baseCol[off+2] * dim;
          }
        }
      }
      ls.geometry.attributes.color.needsUpdate = true;
      (ls.material as THREE.LineBasicMaterial).opacity = 0.9;
    }

    function resetTypedColors(ls: THREE.LineSegments | null, baseCol: Float32Array) {
      if (!ls) return;
      const col = ls.geometry.attributes.color.array as Float32Array;
      for (let i = 0; i < col.length; i++) col[i] = baseCol[i];
      ls.geometry.attributes.color.needsUpdate = true;
      (ls.material as THREE.LineBasicMaterial).opacity = 0.65;
    }

    // Animation loop with highlight logic
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      const activeNode = selectedNodeRef.current ?? hoveredNodeRef.current;
      const hidden = hiddenCategoriesRef.current;
      const colArr = lineSegments.geometry.attributes.color.array as Float32Array;
      const baseCol = baseEdgeColorsRef.current;

      if (activeNode) {
        const connSet = adjacencyRef.current.get(activeNode.id) ?? new Set<string>();
        const simConnSet = new Set(edgeIndexRef.current.get(activeNode.id) ?? []);
        const activeColor = hexToRGB(getCategoryColor(activeNode.category));

        // Nodes
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const mat = meshes[i].material as THREE.MeshPhongMaterial;
          const gMat = glows[i].material as THREE.MeshBasicMaterial;
          const isHidden = n.category && hidden.has(n.category);
          if (isHidden) {
            mat.opacity = 0.03; gMat.opacity = 0.0; nodeLabels[i].visible = false;
          } else if (n.id === activeNode.id) {
            mat.opacity = 1.0; mat.emissiveIntensity = 1.2; gMat.opacity = 0.45; nodeLabels[i].visible = true;
          } else if (connSet.has(n.id)) {
            mat.opacity = 0.95; mat.emissiveIntensity = 0.9; gMat.opacity = 0.25; nodeLabels[i].visible = true;
          } else {
            mat.opacity = 0.08; mat.emissiveIntensity = 0.2; gMat.opacity = 0.0; nodeLabels[i].visible = false;
          }
        }

        // SIMILAR_TO edges
        for (let i = 0; i < simLinks.length; i++) {
          const idx = i * 6;
          if (simConnSet.has(i)) {
            colArr[idx]=colArr[idx+3]=activeColor.r*0.8;
            colArr[idx+1]=colArr[idx+4]=activeColor.g*0.8;
            colArr[idx+2]=colArr[idx+5]=activeColor.b*0.8;
          } else {
            colArr[idx]=colArr[idx+3]=baseCol[idx]*0.12;
            colArr[idx+1]=colArr[idx+4]=baseCol[idx+1]*0.12;
            colArr[idx+2]=colArr[idx+5]=baseCol[idx+2]*0.12;
          }
        }
        lineSegments.geometry.attributes.color.needsUpdate = true;
        lineMat.opacity = 0.9;

        // Typed edges
        const compatConn = new Set(compatEdgeIdxRef.current.get(activeNode.id) ?? []);
        const altConn    = new Set(altEdgeIdxRef.current.get(activeNode.id) ?? []);
        const depConn    = new Set(depEdgeIdxRef.current.get(activeNode.id) ?? []);
        const extConn    = new Set(extEdgeIdxRef.current.get(activeNode.id) ?? []);
        applyTypedHighlight(compatLineRef.current, compatLinks, compatConn, compatBaseColRef.current, COMPAT_VPE, activeColor, 0.12);
        applyTypedHighlight(altLineRef.current,    altLinks,    altConn,    altBaseColRef.current,    ALT_VPE,    activeColor, 0.12);
        applyTypedHighlight(depLineRef.current,    depLinks,    depConn,    depBaseColRef.current,    2,          activeColor, 0.12);
        applyTypedHighlight(extLineRef.current,    extLinks,    extConn,    extBaseColRef.current,    EXT_VPE,    activeColor, 0.12);

        // Dep cones: per-instance highlight
        if (depConesRef.current) {
          const dimColor = TYPED_RGB.DEPENDS_ON.clone().multiplyScalar(0.1);
          for (let i = 0; i < depLinks.length; i++) {
            depConesRef.current.setColorAt(i, depConn.has(i) ? TYPED_RGB.DEPENDS_ON : dimColor);
          }
          depConesRef.current.instanceColor!.needsUpdate = true;
        }
      } else {
        // Reset all nodes + hide all labels
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const mat = meshes[i].material as THREE.MeshPhongMaterial;
          const gMat = glows[i].material as THREE.MeshBasicMaterial;
          const isHidden = n.category && hidden.has(n.category);
          if (isHidden) {
            mat.opacity = 0.03; gMat.opacity = 0.0;
          } else {
            mat.opacity = 0.95; mat.emissiveIntensity = 0.8; gMat.opacity = 0.12;
          }
          nodeLabels[i].visible = false;
        }

        // Reset SIMILAR_TO colors
        for (let i = 0; i < colArr.length; i++) colArr[i] = baseCol[i];
        lineSegments.geometry.attributes.color.needsUpdate = true;
        lineMat.opacity = 0.5;

        // Reset typed edge colors
        resetTypedColors(compatLineRef.current, compatBaseColRef.current);
        resetTypedColors(altLineRef.current,    altBaseColRef.current);
        resetTypedColors(depLineRef.current,    depBaseColRef.current);
        resetTypedColors(extLineRef.current,    extBaseColRef.current);

        // Reset cone colors
        if (depConesRef.current) {
          for (let i = 0; i < depLinks.length; i++) depConesRef.current.setColorAt(i, TYPED_RGB.DEPENDS_ON);
          depConesRef.current.instanceColor!.needsUpdate = true;
        }
      }

      // Hide cluster labels for hidden categories
      for (const sprite of clusterSprites) {
        const cat = sprite.userData.category as string;
        sprite.visible = !hidden.has(cat);
      }

      // Raycasting for hover — use click spheres (larger target area)
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(clickSpheres);
      if (intersects.length > 0) {
        const nodeId = intersects[0].object.userData.nodeId;
        const node = nodes.find((n) => n.id === nodeId);
        if (node && !(node.category && hidden.has(node.category))) {
          const vec = new THREE.Vector3(node.x ?? 0, node.y ?? 0, node.z ?? 0);
          vec.project(camera);
          const cw = containerSizeRef.current.w;
          const ch = containerSizeRef.current.h;
          const x = (vec.x * 0.5 + 0.5) * cw;
          const y = (-vec.y * 0.5 + 0.5) * ch;
          setHoveredNode(node);
          setTooltipPos({ x, y });
          if (container) container.style.cursor = 'pointer';
        }
      } else {
        if (hoveredNodeRef.current) {
          setHoveredNode(null);
          setTooltipPos(null);
        }
        if (container) container.style.cursor = 'grab';
      }

      renderer.render(scene, camera);
    }
    animate();

    // Resize handler
    const handleResize = () => {
      const w = container.clientWidth;
      const newH = isFullscreen ? window.innerHeight - 56 : height;
      containerSizeRef.current = { w, h: newH };
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

  // Esc key
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Update connected names when selected node changes
  useEffect(() => {
    if (!selectedNode) {
      setConnectedNames([]);
      return;
    }
    const connSet = adjacency.get(selectedNode.id);
    if (!connSet) {
      setConnectedNames([]);
      return;
    }
    // Sort by name, take top 20
    const names = Array.from(connSet).sort().slice(0, 20);
    setConnectedNames(names);
  }, [selectedNode, adjacency]);

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
      // Use click spheres (2× radius) for wider hit area
      const intersects = raycasterRef.current.intersectObjects(
        clickSpheresRef.current.length > 0 ? clickSpheresRef.current : nodeMeshesRef.current,
      );

      if (intersects.length > 0) {
        const nodeId = intersects[0].object.userData.nodeId;
        const node = nodesRef.current.find((n) => n.id === nodeId);
        if (node) {
          setSelectedNode((prev) => (prev?.id === node.id ? null : node));
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
      setTimeout(() => {
        if (containerRef.current && rendererRef.current && cameraRef.current) {
          const w = containerRef.current.clientWidth;
          const h = next ? window.innerHeight - 56 : height;
          containerSizeRef.current = { w, h };
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }, 50);
      return next;
    });
  }, [height]);

  // Toggle category filter
  const toggleCategory = useCallback((cat: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  const selectedMeta = selectedNode ? nodeMetadata.get(selectedNode.id) : null;

  return (
    <div
      className={`${isFullscreen ? 'fixed inset-0 z-[45] bg-[#0a0a0f]' : 'relative overflow-hidden'}`}
      style={isFullscreen ? { bottom: '56px', top: '0px' } : undefined}
    >
      {/* 3D Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full ${isFullscreen ? '' : 'rounded-xl border border-zinc-800'} overflow-hidden`}
        style={{ height: isFullscreen ? 'calc(100vh - 56px)' : height }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* Hover tooltip */}
      {hoveredNode && tooltipPos && !selectedNode && (
        <div
          className="absolute pointer-events-none z-20 rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-2 shadow-xl backdrop-blur-md"
          style={{
            left: Math.min(tooltipPos.x + 16, (containerSizeRef.current.w) - 240),
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
          <p className="text-xs text-zinc-500 mt-0.5">
            {hoveredNode.connections} connections · click to explore
          </p>
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
            {/* Header */}
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

            {/* Description */}
            {selectedMeta?.description && (
              <p className="text-xs text-zinc-400 mt-2 line-clamp-3 leading-relaxed">
                {selectedMeta.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex items-center gap-3 mt-3 text-xs text-zinc-500">
              <span>{selectedNode.connections} connections</span>
            </div>

            {/* Connected repos list */}
            {connectedNames.length > 0 && (
              <div className="mt-3 border-t border-zinc-800 pt-3">
                <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-1.5">
                  Connected repos
                </p>
                <div className="max-h-32 overflow-y-auto space-y-0.5 pr-1">
                  {connectedNames.map((name) => {
                    const meta = nodeMetadata.get(name);
                    const label = name.includes('/') ? name.split('/').pop()! : name;
                    return (
                      <button
                        key={name}
                        onClick={(e) => {
                          e.stopPropagation();
                          const node = nodesRef.current.find((n) => n.id === name);
                          if (node) setSelectedNode(node);
                        }}
                        className="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: getCategoryColor(meta?.category ?? null) }}
                        />
                        <span className="font-mono truncate">{label}</span>
                      </button>
                    );
                  })}
                  {(adjacency.get(selectedNode.id)?.size ?? 0) > 20 && (
                    <p className="text-[10px] text-zinc-600 px-1.5 pt-1">
                      +{(adjacency.get(selectedNode.id)?.size ?? 0) - 20} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Open repo button */}
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

      {/* Bottom legend bar — edge types above, category filters below */}
      <div className={`absolute ${
        isFullscreen ? 'bottom-4 left-2 right-2 sm:left-4 sm:right-4' : 'bottom-2 left-2 right-2'
      } rounded-lg bg-zinc-900/80 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 z-10`}>

        {/* Edge type legend row */}
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 items-center border-b border-zinc-800 pb-1.5 mb-1.5">
          {[
            { color: '#f59e0b', label: 'Alternative' },
            { color: '#22c55e', label: 'Compatible'  },
            { color: '#3b82f6', label: 'Dependency'  },
            { color: '#f472b6', label: 'Extends'     },
          ].map(({ color, label }) => (
            <span key={label} className="inline-flex items-center gap-1.5 text-[9px] text-zinc-500">
              <span className="inline-block w-4 h-px rounded" style={{ backgroundColor: color, opacity: 0.9 }} />
              {label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 text-[9px] text-zinc-600">
            <span className="inline-block w-4 h-px rounded bg-gradient-to-r from-violet-400 via-teal-400 to-amber-400 opacity-70" />
            Similarity by cluster
          </span>
        </div>

        {/* Category filter row */}
        <div className="flex flex-wrap justify-center gap-x-2 sm:gap-x-3 gap-y-1 items-center pb-0.5 sm:pb-0">
          {activeCategories.map((cat) => {
            const isHidden = hiddenCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                className={`inline-flex items-center gap-1 px-1 sm:px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] whitespace-nowrap transition-all shrink-0 ${
                  isHidden
                    ? 'opacity-30 hover:opacity-60'
                    : 'opacity-90 hover:opacity-100'
                }`}
                title={`${isHidden ? 'Show' : 'Hide'} ${getCategoryLabel(cat)}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: getCategoryColor(cat),
                    opacity: isHidden ? 0.3 : 1,
                  }}
                />
                {/* Label hidden on mobile — dots only save ~40px of legend height */}
                <span className={`hidden sm:inline ${isHidden ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                  {getCategoryLabel(cat)}
                </span>
              </button>
            );
          })}
        </div>
        <div className="hidden sm:block text-center text-[9px] text-zinc-600 mt-1">
          Scroll to zoom · Drag to rotate · Click node to explore
        </div>
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

      {/* Fullscreen close button (top-right, always visible) + escape hint (desktop only) */}
      {isFullscreen && (
        <>
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 rounded-lg bg-zinc-800/80 p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/80 transition-colors backdrop-blur-sm z-10"
            aria-label="Exit fullscreen"
            title="Exit fullscreen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div className="hidden sm:block absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-800/60 px-4 py-1.5 text-[11px] text-zinc-500 backdrop-blur-sm">
            Press Esc to exit fullscreen
          </div>
        </>
      )}

    </div>
  );
}
