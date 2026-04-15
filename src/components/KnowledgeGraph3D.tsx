'use client';
// @refresh reset
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
} from 'd3-force-3d';
import {
  getCategoryColor,
  getCategoryLabel,
  resolveCategoryKey,
} from '@/lib/categoryColors';
import {
  derivePlanetColors,
  getPlanetRotation,
  PLANET_FRAG,
  PLANET_VERT,
} from '@/lib/planetShader';
import { LegendRenderer } from '@/components/LegendRenderer';

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
  // Log-scale for high-connection nodes to prevent a few giant spheres
  return 3.0 + Math.min(Math.sqrt(connections) * 1.4, 8.0);
}

/**
 * Edge-type quadrant seeding:
 *  DEPENDS_ON     → +X +Z
 *  COMPATIBLE_WITH → -X +Z
 *  ALTERNATIVE_TO → +X -Z
 *  EXTENDS        → -X -Z
 *  SIMILAR_TO     → no quadrant bias (centroid only)
 * Y axis = scaled connection count (more connected = higher Y)
 */
const QUADRANT_SEEDS: Record<string, { xSign: number; zSign: number }> = {
  DEPENDS_ON:      { xSign:  1, zSign:  1 },
  COMPATIBLE_WITH: { xSign: -1, zSign:  1 },
  ALTERNATIVE_TO:  { xSign:  1, zSign: -1 },
  EXTENDS:         { xSign: -1, zSign: -1 },
};

function buildNodes(
  edges: GraphEdge[],
  metadata: Map<string, NodeMeta>,
): GNode[] {
  const connCount = new Map<string, number>();
  // Track which typed edges each node participates in (for quadrant seeding)
  const nodeEdgeTypes = new Map<string, Map<string, number>>();
  for (const e of edges) {
    connCount.set(e.source, (connCount.get(e.source) ?? 0) + 1);
    connCount.set(e.target, (connCount.get(e.target) ?? 0) + 1);
    const t = (e.edge_type ?? '').toUpperCase();
    if (QUADRANT_SEEDS[t]) {
      // Count typed edges per node
      if (!nodeEdgeTypes.has(e.source)) nodeEdgeTypes.set(e.source, new Map());
      if (!nodeEdgeTypes.has(e.target)) nodeEdgeTypes.set(e.target, new Map());
      nodeEdgeTypes.get(e.source)!.set(t, (nodeEdgeTypes.get(e.source)!.get(t) ?? 0) + 1);
      nodeEdgeTypes.get(e.target)!.set(t, (nodeEdgeTypes.get(e.target)!.get(t) ?? 0) + 1);
    }
  }

  // Find max connections for Y-axis scaling
  let maxConn = 1;
  for (const c of connCount.values()) if (c > maxConn) maxConn = c;

  const SPREAD = 120; // quadrant offset magnitude
  const JITTER = 80;  // random scatter within quadrant

  const nodes: GNode[] = [];
  for (const [id, count] of connCount) {
    const meta = metadata.get(id);
    const typeCounts = nodeEdgeTypes.get(id);

    // Determine dominant typed edge for this node (if any)
    let seedX = 0, seedZ = 0;
    if (typeCounts && typeCounts.size > 0) {
      // Weight the quadrant position by how many of each type the node has
      let totalTyped = 0;
      for (const [t, n] of typeCounts) {
        const q = QUADRANT_SEEDS[t];
        if (q) {
          seedX += q.xSign * n;
          seedZ += q.zSign * n;
          totalTyped += n;
        }
      }
      if (totalTyped > 0) {
        seedX = (seedX / totalTyped) * SPREAD;
        seedZ = (seedZ / totalTyped) * SPREAD;
      }
    }

    // Y from connection count: more connections = higher (positive Y)
    const yBase = (Math.log2(count + 1) / Math.log2(maxConn + 1)) * 200 - 100;

    nodes.push({
      id,
      label: id.includes('/') ? id.split('/').pop()! : id,
      category: resolveCategoryKey(meta?.category) ?? null,
      connections: count,
      x: seedX + (Math.random() - 0.5) * JITTER,
      y: yBase + (Math.random() - 0.5) * JITTER,
      z: seedZ + (Math.random() - 0.5) * JITTER,
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

// Canonical edge-type colors — single source of truth for 3D rendering AND legend.
// IMPORTANT: These MUST NOT collide with any category color in categoryColors.ts.
// Category palette uses: blue, amber, violet, red, green, teal, cyan, indigo,
// lime, orange, pink, purple, sky, fuchsia, rose, stone.
// Edge type colors — each hex must be unique across all 16 category colors in
// categoryColors.ts. Chosen from hue gaps between categories and at clearly
// different lightness so they are never confusable with a node dot in the legend.
//
//   ALTERNATIVE_TO  yellow-400 #facc15  (58°)  — no category uses yellow
//   COMPATIBLE_WITH emerald-400 #34d399 (160°) — sits between green(142°) and teal(174°)
//   DEPENDS_ON      cyan-300 #67e8f9   (186°) — much lighter than cyan-500 #06b6d4
//   EXTENDS         fuchsia-300 #f0abfc (292°) — much lighter than fuchsia-500 #d946ef
const EDGE_TYPE_HEX: Record<string, string> = {
  ALTERNATIVE_TO:  '#facc15', // yellow-400  (58°)  — unique; no category is yellow
  COMPATIBLE_WITH: '#34d399', // emerald-400 (160°) — between green and teal
  DEPENDS_ON:      '#67e8f9', // cyan-300    (186°) — lighter than cyan-500/sky-400
  EXTENDS:         '#f0abfc', // fuchsia-300 (292°) — lighter than fuchsia-500/purple-500
};


// force3D removed — d3-force-3d handles X/Y/Z natively with octree Barnes-Hut

/**
 * Category clustering force — pulls same-category nodes toward their
 * centroid, but ONLY for nodes that participate in SIMILAR_TO edges.
 * Typed edges (DEPENDS_ON, etc.) have their own quadrant seeding.
 */
function forceCategoryClustering(
  nodes: GNode[],
  alpha: number,
  similarNodeIds: Set<string>,
) {
  // Compute category centroids from SIMILAR_TO-connected nodes only
  const centroids = new Map<string, { sx: number; sy: number; sz: number; n: number }>();
  for (const node of nodes) {
    if (!similarNodeIds.has(node.id)) continue;
    const cat = node.category ?? '__none__';
    const c = centroids.get(cat) ?? { sx: 0, sy: 0, sz: 0, n: 0 };
    c.sx += node.x ?? 0;
    c.sy += node.y ?? 0;
    c.sz += node.z ?? 0;
    c.n++;
    centroids.set(cat, c);
  }
  // Pull each SIMILAR_TO node toward its category centroid
  const PULL = 0.012;
  for (const node of nodes) {
    if (!similarNodeIds.has(node.id)) continue;
    const cat = node.category ?? '__none__';
    const c = centroids.get(cat);
    if (!c || c.n < 3) continue;
    const cx = c.sx / c.n;
    const cy = c.sy / c.n;
    const cz = c.sz / c.n;
    node.vx = (node.vx ?? 0) + (cx - (node.x ?? 0)) * PULL * alpha;
    node.vy = (node.vy ?? 0) + (cy - (node.y ?? 0)) * PULL * alpha;
    node.vz = (node.vz ?? 0) + (cz - (node.z ?? 0)) * PULL * alpha;
  }
}

/** Create a text sprite for cluster labels */
function createTextSprite(text: string, color: string, fontSize = 36, alpha = 0.9, scale: [number, number, number] = [80, 20, 1]): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 1024;
  canvas.height = 128;
  ctx.clearRect(0, 0, 1024, 128);

  // Background pill for readability
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const pillW = textWidth + 40;
  const pillH = fontSize + 20;
  const pillX = (1024 - pillW) / 2;
  const pillY = (128 - pillH) / 2;
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = '#0a0a0f';
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  // Color border — category accent
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2);
  ctx.stroke();

  // Text — always white for maximum legibility on dark backgrounds
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, 512, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: false, // always visible, rendered on top
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(...scale);
  sprite.renderOrder = 999; // render on top of nodes/edges
  return sprite;
}

/** Create a smaller name label sprite for node hover labels */
function createNodeLabel(text: string, color: string): THREE.Sprite {
  return createTextSprite(text, color, 32, 0.95, [28, 6, 1]);
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
  const timeUniformRef = useRef<{ value: number }>({ value: 0.0 });
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
  // Cluster halo hover state
  const [hoveredCluster, setHoveredCluster] = useState<{
    category: string;
    nodeCount: number;
    topRepos: string[];
  } | null>(null);
  const [clusterTooltipPos, setClusterTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const hoveredClusterRef = useRef<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());
  // Track which node IDs are connected to hovered/selected node for the info panel
  const [connectedNames, setConnectedNames] = useState<{ id: string; edgeType: string }[]>([]);

  // Active categories for legend
  const activeCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const [, meta] of nodeMetadata) {
      const canonical = resolveCategoryKey(meta.category);
      if (canonical) cats.add(canonical);
    }
    return Array.from(cats).sort();
  }, [nodeMetadata]);

  // Edge types actually present in the loaded edges — legend only shows these
  const presentEdgeTypes = useMemo(() => {
    const set = new Set<string>();
    for (const edge of edges) {
      const t = (edge.edge_type || 'SIMILAR_TO').toUpperCase();
      set.add(t);
    }
    return set;
  }, [edges]);

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
    scene.fog = new THREE.FogExp2('#0a0a0f', 0.0003);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(60, width / h, 0.1, 4000);
    // Slightly elevated + angled for 3D depth perception (not straight-on)
    camera.position.set(0, compact ? 60 : 80, compact ? 600 : 750);
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

    // Lights — ambient + two directional for 3D planet shading
    scene.add(new THREE.AmbientLight(0xffffff, 0.12));
    const dirLight1 = new THREE.DirectionalLight(0xfff5e0, 0.85);
    dirLight1.position.set(150, 200, 300);
    scene.add(dirLight1);
    const dirLight2 = new THREE.DirectionalLight(0xc0d8ff, 0.30);
    dirLight2.position.set(-200, -80, 150);
    scene.add(dirLight2);

    // Store refs
    nodesRef.current = nodes;
    adjacencyRef.current = adjacency;
    linksRef.current = links;
    // edgeIndexRef will be rebuilt after link-type split to cover simLinks only

    // Create planet-marble node meshes
    const meshes: THREE.Mesh[] = [];
    const glows: THREE.Mesh[] = [];
    const sharedTime = timeUniformRef.current; // single object shared by all planet materials

    for (let ni = 0; ni < nodes.length; ni++) {
      const node = nodes[ni];
      const r = nodeRadius(node.connections);
      const [c1, c2, c3] = derivePlanetColors(getCategoryColor(node.category), ni);

      const geo = new THREE.SphereGeometry(r, 32, 24);
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uC1:       { value: c1.clone() },
          uC2:       { value: c2.clone() },
          uC3:       { value: c3.clone() },
          uSeed:     { value: ni * 1.618033 },
          uTime:     sharedTime,            // shared reference — updated once per frame
          uEmissive: { value: 0.8 },
          uOpacity:  { value: 0.95 },
        },
        vertexShader:   PLANET_VERT,
        fragmentShader: PLANET_FRAG,
        transparent: true,
        depthWrite:  false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(node.x ?? 0, node.y ?? 0, node.z ?? 0);

      // Per-node rotation axis (tilted like real planets) and speed
      const { rotAxis, rotSpeed } = getPlanetRotation(ni);

      mesh.userData = {
        nodeId:    node.id,
        baseColor: c1.clone(),
        baseOpacity: 0.95,
        rotAxis,
        rotSpeed,
      };
      scene.add(mesh);
      meshes.push(mesh);

      // Soft glow halo
      const glowGeo = new THREE.SphereGeometry(r * 1.85, 12, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color: c1,
        transparent: true,
        opacity: 0.10,
        depthWrite: false,
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
      ALTERNATIVE_TO:  new THREE.Color(EDGE_TYPE_HEX.ALTERNATIVE_TO),
      COMPATIBLE_WITH: new THREE.Color(EDGE_TYPE_HEX.COMPATIBLE_WITH),
      DEPENDS_ON:      new THREE.Color(EDGE_TYPE_HEX.DEPENDS_ON),
      EXTENDS:         new THREE.Color(EDGE_TYPE_HEX.EXTENDS),
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

    // ── SIMILAR_TO: thin straight LineSegments — neutral dim grey only ─────
    const SIM_EDGE_COLOR = new THREE.Color('#333333');
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(simLinks.length * 6);
    const colors = new Float32Array(simLinks.length * 6);
    for (let i = 0; i < simLinks.length; i++) {
      const idx = i * 6;
      colors[idx]     = colors[idx + 3] = SIM_EDGE_COLOR.r;
      colors[idx + 1] = colors[idx + 4] = SIM_EDGE_COLOR.g;
      colors[idx + 2] = colors[idx + 5] = SIM_EDGE_COLOR.b;
    }
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    baseEdgeColorsRef.current = new Float32Array(colors);
    const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, depthWrite: false });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    lineSegments.renderOrder = 0; // render first (behind typed edges)
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
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
      const ls = new THREE.LineSegments(geo, mat);
      ls.renderOrder = 1;
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
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
      const ls = new THREE.LineSegments(geo, mat);
      ls.renderOrder = 1;
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
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
      const ls = new THREE.LineSegments(geo, mat);
      ls.renderOrder = 1;
      scene.add(ls);
      depLineRef.current = ls;

      if (depLinks.length > 0) {
        const coneGeo = new THREE.ConeGeometry(1.5, 5, 6);
        const coneMat = new THREE.MeshBasicMaterial({ color: TYPED_RGB.DEPENDS_ON, transparent: true, opacity: 0.8 });
        const cones = new THREE.InstancedMesh(coneGeo, coneMat, depLinks.length);
        for (let i = 0; i < depLinks.length; i++) cones.setColorAt(i, TYPED_RGB.DEPENDS_ON);
        cones.instanceColor!.needsUpdate = true;
        cones.renderOrder = 2;
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
      const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.8 });
      const ls = new THREE.LineSegments(geo, mat);
      ls.renderOrder = 1;
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
    // Invisible cluster hit-targets for hover tooltips (no visual halos)
    const clusterHitSpheres: THREE.Mesh[] = [];
    let clustersCreated = false;

    // ── Edge flow particles for high-degree nodes ──────────────────────────
    // Identify the top edges by source+target degree for particle animation
    const nodeDegreeSorted = [...nodes].sort((a, b) => b.connections - a.connections);
    const highDegreeIds = new Set(nodeDegreeSorted.slice(0, Math.max(20, Math.floor(nodes.length * 0.08))).map(n => n.id));
    // Collect edges where BOTH endpoints are high-degree
    const particleEdges: { link: GLink; weight: number }[] = [];
    for (const l of links) {
      const sId = typeof l.source === 'string' ? l.source : (l.source as unknown as GNode).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as unknown as GNode).id;
      if (highDegreeIds.has(sId) || highDegreeIds.has(tId)) {
        particleEdges.push({ link: l, weight: l.weight ?? 0.5 });
      }
    }
    // Cap to avoid GPU overload
    const MAX_PARTICLES = 500;
    const selectedParticleEdges = particleEdges
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_PARTICLES);

    let particlePoints: THREE.Points | null = null;
    const particlePositions = new Float32Array(selectedParticleEdges.length * 3);
    const particleSpeeds = new Float32Array(selectedParticleEdges.length); // 0..1 t parameter
    const particleWeights = new Float32Array(selectedParticleEdges.length);
    if (selectedParticleEdges.length > 0) {
      for (let i = 0; i < selectedParticleEdges.length; i++) {
        particleSpeeds[i] = Math.random(); // random start position along edge
        particleWeights[i] = 0.3 + (selectedParticleEdges[i].weight) * 0.7; // speed factor
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.8,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      particlePoints = new THREE.Points(particleGeo, particleMat);
      scene.add(particlePoints);
    }

    // Force simulation — d3-force-3d with native 3D octree Barnes-Hut
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const forceLinks = links.map((l) => ({
      source: l.source as string,
      target: l.target as string,
      weight: l.weight,
    }));

    // Build set of nodes connected by SIMILAR_TO edges (for category clustering)
    const similarNodeIds = new Set<string>();
    for (const l of links) {
      const t = (l.edge_type ?? '').toUpperCase();
      if (t === 'SIMILAR_TO' || t === '' || !QUADRANT_SEEDS[t]) {
        const sId = typeof l.source === 'string' ? l.source : (l.source as unknown as GNode).id;
        const tId = typeof l.target === 'string' ? l.target : (l.target as unknown as GNode).id;
        similarNodeIds.add(sId);
        similarNodeIds.add(tId);
      }
    }

    // numDimensions=3 → octree-based repulsion, 3D link springs, 3D centering
    const sim = forceSimulation<GNode>(nodes, 3)
      .force('charge', forceManyBody().strength(-90).distanceMax(400))
      .force(
        'link',
        forceLink<GNode, SimulationLinkDatum<GNode>>(forceLinks as SimulationLinkDatum<GNode>[])
          .id((d) => (d as GNode).id)
          .distance(25)
          .strength(0.35),
      )
      .force('center', forceCenter(0, 0, 0).strength(0.02))
      .force('collide', forceCollide<GNode>().radius((d) => nodeRadius(d.connections) + 3))
      .alphaDecay(0.012)
      .on('tick', () => {
        forceCategoryClustering(nodes, sim.alpha(), similarNodeIds);

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

        // Create cluster labels once simulation has begun settling
        if (!clustersCreated && sim.alpha() < 0.35) {
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
            if (pos.count < 5) continue; // skip tiny clusters
            const label = getCategoryLabel(cat);
            const color = getCategoryColor(cat);
            const sprite = createTextSprite(label, color);
            sprite.position.set(
              pos.sx / pos.count,
              pos.sy / pos.count + 25, // offset above centroid
              pos.sz / pos.count,
            );
            sprite.userData = { category: cat };
            scene.add(sprite);
            clusterSprites.push(sprite);
          }

          // ── Invisible cluster hit-target spheres for hover tooltips ──────────
          for (const [cat, pos] of catPositions) {
            if (pos.count < 5) continue;
            const cx = pos.sx / pos.count;
            const cy = pos.sy / pos.count;
            const cz = pos.sz / pos.count;
            // Compute cluster spread for hit-sphere radius
            let totalDist = 0;
            let catCount = 0;
            for (const n of nodes) {
              if (n.category !== cat) continue;
              const dx = (n.x ?? 0) - cx;
              const dy = (n.y ?? 0) - cy;
              const dz = (n.z ?? 0) - cz;
              totalDist += Math.sqrt(dx * dx + dy * dy + dz * dz);
              catCount++;
            }
            const avgDist = totalDist / catCount;
            if (avgDist < 3) continue;
            const hitGeo = new THREE.SphereGeometry(avgDist * 0.8, 8, 6);
            const hitMat = new THREE.MeshBasicMaterial({ visible: false });
            const hitSphere = new THREE.Mesh(hitGeo, hitMat);
            hitSphere.position.set(cx, cy, cz);
            hitSphere.userData = { category: cat, isClusterHit: true, nodeCount: pos.count };
            scene.add(hitSphere);
            clusterHitSpheres.push(hitSphere);
          }
        }

        // Continuously update cluster label positions to follow centroid drift
        if (clustersCreated && sim.alpha() > 0.01) {
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
          for (const sprite of clusterSprites) {
            const cat = sprite.userData.category as string;
            const pos = catPositions.get(cat);
            if (pos && pos.count > 0) {
              sprite.position.set(
                pos.sx / pos.count,
                pos.sy / pos.count + 15,
                pos.sz / pos.count,
              );
            }
          }
          // Keep invisible cluster hit-spheres centered on their cluster
          for (const hs of clusterHitSpheres) {
            const cat = hs.userData.category as string;
            const pos = catPositions.get(cat);
            if (pos && pos.count > 0) {
              hs.position.set(pos.sx / pos.count, pos.sy / pos.count, pos.sz / pos.count);
            }
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
      (ls.material as THREE.LineBasicMaterial).opacity = 0.8;
    }

    // Animation loop with highlight logic
    const animClock = new THREE.Clock();

    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      // ── Visual motion: pulse nodes proportional to connection count ──────
      const elapsed = animClock.getElapsedTime();
      // Update shared time uniform once per frame (all planet shaders read this)
      timeUniformRef.current.value = elapsed;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        // More connections → faster & larger pulse
        const intensity = Math.min(n.connections / 40, 1.0); // 0..1
        const speed = 0.6 + intensity * 1.8; // 0.6..2.4 Hz — organic breathing
        const amplitude = 0.04 + intensity * 0.14; // 4%..18% scale variation
        // Each node gets a phase offset based on index for organic feel
        const phase = i * 0.37;
        const pulse = 1 + Math.sin(elapsed * speed + phase) * amplitude;

        // Scale the node mesh
        meshes[i].scale.setScalar(pulse);

        // Glow breathes with inverse phase (expands when node contracts)
        const glowPulse = 1 + Math.sin(elapsed * speed * 0.7 + phase + Math.PI * 0.5) * amplitude * 1.8;
        glows[i].scale.setScalar(glowPulse);

        // Emissive pulse — update shader uniform (planet ShaderMaterial)
        const mat = meshes[i].material as THREE.ShaderMaterial;
        mat.uniforms.uEmissive.value = 0.7 + intensity * 0.5 * (0.5 + 0.5 * Math.sin(elapsed * speed * 0.5 + phase));

        // Planet self-rotation (independent of position/scale)
        meshes[i].rotateOnAxis(meshes[i].userData.rotAxis as THREE.Vector3, meshes[i].userData.rotSpeed as number);

        // Ambient micro-drift — ALL nodes get subtle continuous motion so graph feels alive
        // Magnitude: 0.05 base + connection-proportional bonus (up to 0.8 total)
        const driftBase = 0.05;
        const driftConn = intensity * 0.75;
        const drift = driftBase + driftConn;
        const dx = Math.sin(elapsed * 0.5 + phase) * drift;
        const dy = Math.cos(elapsed * 0.6 + phase * 1.3) * drift;
        const dz = Math.sin(elapsed * 0.4 + phase * 0.7) * drift;
        meshes[i].position.set((n.x ?? 0) + dx, (n.y ?? 0) + dy, (n.z ?? 0) + dz);
        glows[i].position.copy(meshes[i].position);
      }

      // ── Animated flowing edges — energy pulses along connections ───────────
      // SIMILAR_TO: directional energy ripple along each edge
      {
        const simCol = lineSegments.geometry.attributes.color.array as Float32Array;
        const simBase = baseEdgeColorsRef.current;
        for (let i = 0; i < simLinks.length; i++) {
          const idx = i * 6;
          const edgePhase = i * 0.19;
          // Two-harmonic ripple: slow base wave + faster sparkle
          const wave1 = Math.sin(elapsed * 1.0 + edgePhase);
          const wave2 = Math.sin(elapsed * 3.5 + edgePhase * 2.3) * 0.3;
          const wave  = Math.max(0.0, wave1 + wave2); // 0..1.3
          // Source vertex brighter (leading edge) vs target vertex dimmer (trailing)
          const bSrc = 0.15 + wave * 1.1;      // 0.15..1.4
          const bTgt = 0.05 + wave * 0.45;     // 0.05..0.5 — trailing dim
          simCol[idx]   = simBase[idx]   * bSrc;
          simCol[idx+1] = simBase[idx+1] * bSrc;
          simCol[idx+2] = simBase[idx+2] * bSrc;
          simCol[idx+3] = simBase[idx+3] * bTgt;
          simCol[idx+4] = simBase[idx+4] * bTgt;
          simCol[idx+5] = simBase[idx+5] * bTgt;
        }
        lineSegments.geometry.attributes.color.needsUpdate = true;
      }

      // Typed edges: flowing dash-like pulse animation (brightness cascades along segments)
      function animateTypedEdge(
        ls: THREE.LineSegments | null,
        baseCol: Float32Array,
        linkCount: number,
        vertsPerEdge: number,
        speed: number,
        phaseScale: number,
      ) {
        if (!ls || linkCount === 0) return;
        const col = ls.geometry.attributes.color.array as Float32Array;
        for (let i = 0; i < linkCount; i++) {
          const edgePhase = i * phaseScale;
          for (let v = 0; v < vertsPerEdge; v++) {
            const segPhase = v / vertsPerEdge; // 0..1 along the edge
            // Sharp traveling pulse: squared sine for tighter energy bolts
            const rawWave = Math.sin(elapsed * speed - segPhase * Math.PI * 4 + edgePhase);
            const wave = 0.05 + 0.95 * Math.max(0, rawWave * rawWave * Math.sign(rawWave));
            const off = (i * vertsPerEdge + v) * 3;
            col[off]     = baseCol[off]     * wave;
            col[off + 1] = baseCol[off + 1] * wave;
            col[off + 2] = baseCol[off + 2] * wave;
          }
        }
        ls.geometry.attributes.color.needsUpdate = true;
      }

      animateTypedEdge(compatLineRef.current, compatBaseColRef.current, compatLinks.length, COMPAT_VPE, 2.5, 0.23);
      animateTypedEdge(altLineRef.current,    altBaseColRef.current,    altLinks.length,    ALT_VPE,    3.0, 0.19);
      animateTypedEdge(depLineRef.current,    depBaseColRef.current,    depLinks.length,    2,          2.0, 0.31);
      animateTypedEdge(extLineRef.current,    extBaseColRef.current,    extLinks.length,    EXT_VPE,    2.8, 0.17);

      // Animated dep arrow cones — pulse opacity
      if (depConesRef.current && depLinks.length > 0) {
        const conePulse = 0.5 + 0.5 * Math.sin(elapsed * 2.0);
        (depConesRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 + conePulse * 0.4;
      }

      // ── Edge flow particles — travel along high-degree edges ──────────────
      if (particlePoints && selectedParticleEdges.length > 0) {
        const pPos = particlePoints.geometry.attributes.position.array as Float32Array;
        const dt = 0.008; // base speed per frame
        for (let i = 0; i < selectedParticleEdges.length; i++) {
          const pe = selectedParticleEdges[i];
          const l = pe.link;
          const sId = typeof l.source === 'string' ? l.source : (l.source as unknown as GNode).id;
          const tId = typeof l.target === 'string' ? l.target : (l.target as unknown as GNode).id;
          const src = nodeMap.get(sId);
          const tgt = nodeMap.get(tId);
          if (!src || !tgt) continue;
          // Advance t — speed proportional to edge weight
          particleSpeeds[i] = (particleSpeeds[i] + dt * particleWeights[i]) % 1.0;
          const t = particleSpeeds[i];
          // Lerp position along edge
          const sx = src.x ?? 0, sy = src.y ?? 0, sz = src.z ?? 0;
          const tx = tgt.x ?? 0, ty = tgt.y ?? 0, tz = tgt.z ?? 0;
          pPos[i * 3]     = sx + (tx - sx) * t;
          pPos[i * 3 + 1] = sy + (ty - sy) * t;
          pPos[i * 3 + 2] = sz + (tz - sz) * t;
        }
        particlePoints.geometry.attributes.position.needsUpdate = true;
      }

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
          const mat = meshes[i].material as THREE.ShaderMaterial;
          const gMat = glows[i].material as THREE.MeshBasicMaterial;
          const isHidden = n.category && hidden.has(n.category);
          if (isHidden) {
            mat.uniforms.uOpacity.value = 0.03; gMat.opacity = 0.0; nodeLabels[i].visible = false;
          } else if (n.id === activeNode.id) {
            mat.uniforms.uOpacity.value = 1.0; mat.uniforms.uEmissive.value = 1.4; gMat.opacity = 0.50; nodeLabels[i].visible = true;
          } else if (connSet.has(n.id)) {
            mat.uniforms.uOpacity.value = 0.95; mat.uniforms.uEmissive.value = 1.0; gMat.opacity = 0.28; nodeLabels[i].visible = true;
          } else {
            mat.uniforms.uOpacity.value = 0.06; mat.uniforms.uEmissive.value = 0.1; gMat.opacity = 0.0; nodeLabels[i].visible = false;
          }
        }

        // SIMILAR_TO edges — highlight as bright neutral white, dim as near-black
        const SIM_HIGHLIGHT = new THREE.Color('#999999');
        for (let i = 0; i < simLinks.length; i++) {
          const idx = i * 6;
          if (simConnSet.has(i)) {
            colArr[idx]=colArr[idx+3]=SIM_HIGHLIGHT.r;
            colArr[idx+1]=colArr[idx+4]=SIM_HIGHLIGHT.g;
            colArr[idx+2]=colArr[idx+5]=SIM_HIGHLIGHT.b;
          } else {
            colArr[idx]=colArr[idx+3]=baseCol[idx]*0.12;
            colArr[idx+1]=colArr[idx+4]=baseCol[idx+1]*0.12;
            colArr[idx+2]=colArr[idx+5]=baseCol[idx+2]*0.12;
          }
        }
        lineSegments.geometry.attributes.color.needsUpdate = true;
        lineMat.opacity = 0.35; // slightly brighter during hover, but still subtle

        // Typed edges — highlight with their OWN type color, not category color
        const compatConn = new Set(compatEdgeIdxRef.current.get(activeNode.id) ?? []);
        const altConn    = new Set(altEdgeIdxRef.current.get(activeNode.id) ?? []);
        const depConn    = new Set(depEdgeIdxRef.current.get(activeNode.id) ?? []);
        const extConn    = new Set(extEdgeIdxRef.current.get(activeNode.id) ?? []);
        applyTypedHighlight(compatLineRef.current, compatLinks, compatConn, compatBaseColRef.current, COMPAT_VPE, TYPED_RGB.COMPATIBLE_WITH, 0.12);
        applyTypedHighlight(altLineRef.current,    altLinks,    altConn,    altBaseColRef.current,    ALT_VPE,    TYPED_RGB.ALTERNATIVE_TO, 0.12);
        applyTypedHighlight(depLineRef.current,    depLinks,    depConn,    depBaseColRef.current,    2,          TYPED_RGB.DEPENDS_ON, 0.12);
        applyTypedHighlight(extLineRef.current,    extLinks,    extConn,    extBaseColRef.current,    EXT_VPE,    TYPED_RGB.EXTENDS, 0.12);

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
          const mat = meshes[i].material as THREE.ShaderMaterial;
          const gMat = glows[i].material as THREE.MeshBasicMaterial;
          const isHidden = n.category && hidden.has(n.category);
          if (isHidden) {
            mat.uniforms.uOpacity.value = 0.03; gMat.opacity = 0.0;
          } else {
            mat.uniforms.uOpacity.value = 0.95; mat.uniforms.uEmissive.value = 0.8; gMat.opacity = 0.12;
          }
          nodeLabels[i].visible = false;
        }

        // Edge colors already set by the flowing animation above — just restore opacity
        lineMat.opacity = 0.2;
        if (compatLineRef.current) (compatLineRef.current.material as THREE.LineBasicMaterial).opacity = 0.8;
        if (altLineRef.current)    (altLineRef.current.material as THREE.LineBasicMaterial).opacity = 0.8;
        if (depLineRef.current)    (depLineRef.current.material as THREE.LineBasicMaterial).opacity = 0.8;
        if (extLineRef.current)    (extLineRef.current.material as THREE.LineBasicMaterial).opacity = 0.8;
      }

      // Hide cluster labels for hidden categories
      for (const sprite of clusterSprites) {
        const cat = sprite.userData.category as string;
        sprite.visible = !hidden.has(cat);
      }

      // Raycasting for hover — check nodes first, then cluster halos
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
          // Clear cluster hover when hovering a node
          if (hoveredClusterRef.current) {
            hoveredClusterRef.current = null;
            setHoveredCluster(null);
            setClusterTooltipPos(null);
          }
        }
      } else {
        if (hoveredNodeRef.current) {
          setHoveredNode(null);
          setTooltipPos(null);
        }
        // Check invisible cluster hit-spheres when no node is hit
        if (clusterHitSpheres.length > 0) {
          const clusterIntersects = raycasterRef.current.intersectObjects(clusterHitSpheres);
          if (clusterIntersects.length > 0) {
            const hitObj = clusterIntersects[0].object;
            const cat = hitObj.userData.category as string;
            if (!hidden.has(cat) && hoveredClusterRef.current !== cat) {
              hoveredClusterRef.current = cat;
              // Compute top 3 most-connected repos in this category
              const catNodes = nodes
                .filter((n) => n.category === cat)
                .sort((a, b) => b.connections - a.connections);
              const topRepos = catNodes.slice(0, 3).map((n) => n.label);
              setHoveredCluster({
                category: cat,
                nodeCount: hitObj.userData.nodeCount as number,
                topRepos,
              });
              // Project cluster centroid to screen
              const vec = hitObj.position.clone().project(camera);
              const cw = containerSizeRef.current.w;
              const ch = containerSizeRef.current.h;
              setClusterTooltipPos({
                x: (vec.x * 0.5 + 0.5) * cw,
                y: (-vec.y * 0.5 + 0.5) * ch,
              });
            }
            if (container) container.style.cursor = 'pointer';
          } else {
            if (hoveredClusterRef.current) {
              hoveredClusterRef.current = null;
              setHoveredCluster(null);
              setClusterTooltipPos(null);
            }
            if (container) container.style.cursor = 'grab';
          }
        } else {
          if (container) container.style.cursor = 'grab';
        }
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
    // Build id → edge_type map from raw edges
    const edgeTypeMap = new Map<string, string>();
    for (const e of edges) {
      if (e.source === selectedNode.id && connSet.has(e.target)) {
        if (!edgeTypeMap.has(e.target)) edgeTypeMap.set(e.target, e.edge_type);
      } else if (e.target === selectedNode.id && connSet.has(e.source)) {
        if (!edgeTypeMap.has(e.source)) edgeTypeMap.set(e.source, e.edge_type);
      }
    }
    const items = Array.from(connSet)
      .map((id) => ({ id, edgeType: edgeTypeMap.get(id) ?? 'SIMILAR_TO' }))
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 20);
    setConnectedNames(items);
  }, [selectedNode, adjacency, edges]);

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

      {/* Cluster halo hover tooltip */}
      {hoveredCluster && clusterTooltipPos && !selectedNode && !hoveredNode && (
        <div
          className="absolute pointer-events-none z-20 rounded-lg border border-zinc-700/80 bg-zinc-900/95 px-3 py-2.5 shadow-xl backdrop-blur-md"
          style={{
            left: Math.min(clusterTooltipPos.x + 16, (containerSizeRef.current.w) - 260),
            top: Math.max(clusterTooltipPos.y - 60, 8),
          }}
        >
          <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: getCategoryColor(hoveredCluster.category) }}
            />
            {getCategoryLabel(hoveredCluster.category)}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            {hoveredCluster.nodeCount} repos in cluster
          </p>
          {hoveredCluster.topRepos.length > 0 && (
            <div className="mt-1.5 border-t border-zinc-800 pt-1.5">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">Top connected</p>
              {hoveredCluster.topRepos.map((name) => (
                <p key={name} className="text-xs text-zinc-400 font-mono truncate">{name}</p>
              ))}
            </div>
          )}
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
                <div className="max-h-40 overflow-y-auto space-y-0.5 pr-1">
                  {connectedNames.map(({ id, edgeType }) => {
                    const meta = nodeMetadata.get(id);
                    const label = id.includes('/') ? id.split('/').pop()! : id;
                    const edgeColor = EDGE_TYPE_HEX[edgeType] ?? '#71717a';
                    const edgeLabel = edgeType === 'SIMILAR_TO' ? 'similar'
                      : edgeType === 'DEPENDS_ON' ? 'depends'
                      : edgeType === 'COMPATIBLE_WITH' ? 'compatible'
                      : edgeType === 'ALTERNATIVE_TO' ? 'alt'
                      : edgeType === 'EXTENDS' ? 'extends'
                      : edgeType.toLowerCase().replace(/_/g, ' ');
                    return (
                      <button
                        key={id}
                        onClick={(e) => {
                          e.stopPropagation();
                          const node = nodesRef.current.find((n) => n.id === id);
                          if (node) setSelectedNode(node);
                        }}
                        className="flex items-center gap-1.5 w-full text-left rounded px-1.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 transition-colors"
                      >
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: getCategoryColor(meta?.category ?? null) }}
                        />
                        <span className="font-mono truncate flex-1">{label}</span>
                        <span
                          className="shrink-0 text-[9px] font-medium rounded px-1 py-0.5 uppercase tracking-wide"
                          style={{ color: edgeColor, backgroundColor: `${edgeColor}22`, border: `1px solid ${edgeColor}44` }}
                        >
                          {edgeLabel}
                        </span>
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

      {/* Bottom legend bar — two clearly labeled sections */}
      <div className={`absolute ${
        isFullscreen ? 'bottom-4 left-2 right-2 sm:left-4 sm:right-4' : 'bottom-2 left-2 right-2'
      } rounded-lg bg-zinc-900/85 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 z-10`}>

        {/* ── EDGE TYPES section — only types actually present in the data ─── */}
        {presentEdgeTypes.size > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 pb-1.5">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-zinc-500 mr-1">Edges</span>
            {[
              { key: 'ALTERNATIVE_TO',  color: EDGE_TYPE_HEX.ALTERNATIVE_TO,  label: 'Alternative' },
              { key: 'COMPATIBLE_WITH', color: EDGE_TYPE_HEX.COMPATIBLE_WITH, label: 'Compatible'  },
              { key: 'DEPENDS_ON',      color: EDGE_TYPE_HEX.DEPENDS_ON,      label: 'Dependency'  },
              { key: 'EXTENDS',         color: EDGE_TYPE_HEX.EXTENDS,         label: 'Extends'     },
            ]
              .filter(({ key }) => presentEdgeTypes.has(key))
              .map(({ color, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-[9px] text-zinc-400">
                  <span className="inline-block w-5 h-[2px] rounded-full" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            {presentEdgeTypes.has('SIMILAR_TO') && (
              <span className="inline-flex items-center gap-1.5 text-[9px] text-zinc-500">
                <span className="inline-block w-5 h-[2px] rounded-full bg-gradient-to-r from-violet-400 via-teal-400 to-amber-400 opacity-70" />
                Similarity
              </span>
            )}
          </div>
        )}

        {/* Divider only when both sections render */}
        {presentEdgeTypes.size > 0 && activeCategories.length > 0 && (
          <div className="border-t border-zinc-700/60 mb-1.5" />
        )}

        {/* ── CATEGORIES section — only when categories exist ────────────── */}
        {activeCategories.length > 0 && (
          <LegendRenderer
            categories={activeCategories}
            hiddenCategories={hiddenCategories}
            onToggleCategory={toggleCategory}
          />
        )}
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
