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

// 3D force: apply z-axis forces manually
function force3D(nodes: GNode[], alpha: number) {
  for (const node of nodes) {
    if (node.z === undefined) node.z = 0;
    if (node.vz === undefined) node.vz = 0;
    node.vz += -node.z * 0.03 * alpha;
    node.vz *= 0.85;
    node.z += node.vz;
  }
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

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface KnowledgeGraph3DProps {
  edges: GraphEdge[];
  nodeMetadata: Map<string, NodeMeta>;
  height?: number;
  onNodeClick?: (nodeId: string) => void;
  compact?: boolean;
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
  const adjacencyRef = useRef<Map<string, Set<string>>>(new Map());
  const edgeIndexRef = useRef<Map<string, number[]>>(new Map());
  const baseEdgeColorsRef = useRef<Float32Array>(new Float32Array(0));
  const linksRef = useRef<GLink[]>([]);
  const containerSizeRef = useRef({ w: 0, h: 0 });
  const nodeLabelSpritesRef = useRef<THREE.Sprite[]>([]);

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

  // Build node/link data
  const { nodes, links, adjacency, edgeIndex } = useMemo(() => {
    const nodes = buildNodes(edges, nodeMetadata);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const links = buildLinks(edges, nodeIds);
    const adjacency = buildAdjacency(edges);
    const edgeIndex = buildEdgeIndex(links, nodes);
    return { nodes, links, adjacency, edgeIndex };
  }, [edges, nodeMetadata]);

  // Refs for highlight logic (accessible from animate loop)
  const hoveredNodeRef = useRef<GNode | null>(null);
  const selectedNodeRef = useRef<GNode | null>(null);
  const hiddenCategoriesRef = useRef<Set<string>>(new Set());

  // Sync state → refs
  useEffect(() => { hoveredNodeRef.current = hoveredNode; }, [hoveredNode]);
  useEffect(() => { selectedNodeRef.current = selectedNode; }, [selectedNode]);
  useEffect(() => { hiddenCategoriesRef.current = hiddenCategories; }, [hiddenCategories]);

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
    scene.fog = new THREE.FogExp2('#0a0a0f', 0.0018);
    sceneRef.current = scene;

    // Camera
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

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.2);
    dirLight.position.set(100, 100, 100);
    scene.add(dirLight);

    // Store refs
    nodesRef.current = nodes;
    adjacencyRef.current = adjacency;
    edgeIndexRef.current = edgeIndex;
    linksRef.current = links;

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

    // Create edge lines
    const lineGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(links.length * 6);
    const colors = new Float32Array(links.length * 6);
    for (let i = 0; i < links.length; i++) {
      const idx = i * 6;
      positions[idx] = positions[idx + 1] = positions[idx + 2] = 0;
      positions[idx + 3] = positions[idx + 4] = positions[idx + 5] = 0;
      const w = links[i].weight ?? 0.6;
      const intensity = 0.08 + w * 0.14;
      colors[idx] = colors[idx + 3] = intensity * 0.7;
      colors[idx + 1] = colors[idx + 4] = intensity * 0.8;
      colors[idx + 2] = colors[idx + 5] = intensity;
    }
    lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Save base edge colors for reset
    baseEdgeColorsRef.current = new Float32Array(colors);

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.22,
    });
    const lineSegments = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(lineSegments);
    lineRef.current = lineSegments;

    // Category cluster labels — computed after simulation settles
    const clusterSprites: THREE.Sprite[] = [];
    let clustersCreated = false;

    // Force simulation
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

    // Animation loop with highlight logic
    function animate() {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();

      const activeNode = selectedNodeRef.current ?? hoveredNodeRef.current;
      const hidden = hiddenCategoriesRef.current;
      const colArr = lineSegments.geometry.attributes.color.array as Float32Array;
      const baseCol = baseEdgeColorsRef.current;

      if (activeNode) {
        // Get connected set
        const connSet = adjacencyRef.current.get(activeNode.id) ?? new Set<string>();
        const connEdgeIndices = new Set(edgeIndexRef.current.get(activeNode.id) ?? []);
        const activeColor = hexToRGB(getCategoryColor(activeNode.category));

        // Highlight/dim nodes + show/hide name labels
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const mat = meshes[i].material as THREE.MeshPhongMaterial;
          const gMat = glows[i].material as THREE.MeshBasicMaterial;
          const isHidden = n.category && hidden.has(n.category);

          if (isHidden) {
            mat.opacity = 0.03;
            gMat.opacity = 0.0;
            nodeLabels[i].visible = false;
          } else if (n.id === activeNode.id) {
            // The active node itself
            mat.opacity = 1.0;
            mat.emissiveIntensity = 1.2;
            gMat.opacity = 0.45;
            nodeLabels[i].visible = true;
          } else if (connSet.has(n.id)) {
            // Connected node — bright + show label
            mat.opacity = 0.95;
            mat.emissiveIntensity = 0.9;
            gMat.opacity = 0.25;
            nodeLabels[i].visible = true;
          } else {
            // Unrelated — dim
            mat.opacity = 0.08;
            mat.emissiveIntensity = 0.2;
            gMat.opacity = 0.0;
            nodeLabels[i].visible = false;
          }
        }

        // Highlight/dim edges
        for (let i = 0; i < links.length; i++) {
          const idx = i * 6;
          if (connEdgeIndices.has(i)) {
            // Connected edge — bright with active node's color
            colArr[idx] = colArr[idx + 3] = activeColor.r * 0.8;
            colArr[idx + 1] = colArr[idx + 4] = activeColor.g * 0.8;
            colArr[idx + 2] = colArr[idx + 5] = activeColor.b * 0.8;
          } else {
            // Dim edge
            colArr[idx] = colArr[idx + 3] = baseCol[idx] * 0.15;
            colArr[idx + 1] = colArr[idx + 4] = baseCol[idx + 1] * 0.15;
            colArr[idx + 2] = colArr[idx + 5] = baseCol[idx + 2] * 0.15;
          }
        }
        lineSegments.geometry.attributes.color.needsUpdate = true;
        lineMat.opacity = 0.7; // Boost opacity when highlighting
      } else {
        // Reset all nodes + hide all labels
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const mat = meshes[i].material as THREE.MeshPhongMaterial;
          const gMat = glows[i].material as THREE.MeshBasicMaterial;
          const isHidden = n.category && hidden.has(n.category);

          if (isHidden) {
            mat.opacity = 0.03;
            gMat.opacity = 0.0;
          } else {
            mat.opacity = 0.95;
            mat.emissiveIntensity = 0.8;
            gMat.opacity = 0.12;
          }
          nodeLabels[i].visible = false;
        }

        // Reset edge colors
        for (let i = 0; i < colArr.length; i++) {
          colArr[i] = baseCol[i];
        }
        lineSegments.geometry.attributes.color.needsUpdate = true;
        lineMat.opacity = 0.22;
      }

      // Hide cluster labels for hidden categories
      for (const sprite of clusterSprites) {
        const cat = sprite.userData.category as string;
        sprite.visible = !hidden.has(cat);
      }

      // Raycasting for hover
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(meshes);
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
      const intersects = raycasterRef.current.intersectObjects(nodeMeshesRef.current);

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
      className={`relative ${isFullscreen ? 'fixed inset-0 z-[45] bg-[#0a0a0f]' : ''}`}
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

      {/* Category Legend — scrollable on mobile, wraps on desktop */}
      <div className={`absolute ${
        isFullscreen ? 'bottom-4 left-2 right-2 sm:left-4 sm:right-4' : 'bottom-2 left-2 right-2'
      } rounded-lg bg-zinc-900/80 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2`}>
        <div className="flex gap-x-2 sm:gap-x-3 gap-y-1 items-center overflow-x-auto sm:flex-wrap sm:justify-center pb-0.5 sm:pb-0">
          {activeCategories.map((cat) => {
            const isHidden = hiddenCategories.has(cat);
            return (
              <button
                key={cat}
                onClick={(e) => { e.stopPropagation(); toggleCategory(cat); }}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[10px] whitespace-nowrap transition-all shrink-0 ${
                  isHidden
                    ? 'opacity-30 hover:opacity-60'
                    : 'opacity-90 hover:opacity-100'
                }`}
                title={`${isHidden ? 'Show' : 'Hide'} ${CATEGORY_LABELS[cat] ?? cat}`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: CATEGORY_COLORS[cat] ?? '#52525b',
                    opacity: isHidden ? 0.3 : 1,
                  }}
                />
                <span className={`${isHidden ? 'text-zinc-600 line-through' : 'text-zinc-400'}`}>
                  {CATEGORY_LABELS[cat] ?? cat}
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
