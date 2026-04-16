import type { GraphEdge, NodeMeta } from '@/components/KnowledgeGraph3D'
import type { EnrichedRepo, LibraryData } from '@/types/repo'

interface ApiRepoNode {
  name: string
  description?: string | null
  category?: string | null
  upstream?: string | null
  owner?: string | null
}

interface ApiEdge {
  source?: ApiRepoNode
  target?: ApiRepoNode
  source_name?: string
  source_owner?: string
  source_upstream?: string
  target_name?: string
  target_owner?: string
  target_upstream?: string
  edgeType?: string
  edge_type?: string
  weight?: number
}

interface ApiResponse {
  total?: number
  total_repos?: number
  total_edges?: number
  total_knowledge_graph_edges?: number
  nodes?: ApiRepoNode[]
  edges: ApiEdge[]
}

export interface GraphDataset {
  edges: GraphEdge[]
  nodeMetadata: Map<string, NodeMeta>
  totalRepos: number
  totalEdges: number
  source: 'api' | 'snapshot'
  message: string | null
}

interface LoadGraphOptions {
  apiUrl: string
  limit: number
  neighbours?: number
  minSimilarity?: number
  signal?: AbortSignal
}

type RepoFeatures = {
  repo: EnrichedRepo
  nodeId: string
  category: string | null
  language: string | null
  builders: Set<string>
  tags: Set<string>
  taxonomy: Set<string>
  score: number
}

const SNAPSHOT_EDGE_CAP = 2200

function getBasePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH || ''
}

function normalizeToken(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ')
  return normalized || null
}

function intersectCount(left: Set<string>, right: Set<string>, limit = Infinity): number {
  if (left.size === 0 || right.size === 0) return 0
  const [small, large] = left.size <= right.size ? [left, right] : [right, left]
  let count = 0
  for (const value of small) {
    if (!large.has(value)) continue
    count += 1
    if (count >= limit) return count
  }
  return count
}

function repoNodeId(repo: EnrichedRepo): string {
  if (repo.parentStats?.owner) return `${repo.parentStats.owner}/${repo.name}`
  return repo.fullName || repo.name
}

function repoCategory(repo: EnrichedRepo): string | null {
  return repo.dbCategory ?? repo.primaryCategory ?? null
}

function repoBuilders(repo: EnrichedRepo): Set<string> {
  return new Set(
    (repo.builders ?? [])
      .map((builder) => normalizeToken(builder.login))
      .filter((value): value is string => Boolean(value)),
  )
}

function repoTags(repo: EnrichedRepo): Set<string> {
  const values = new Set<string>()
  for (const tag of repo.enrichedTags ?? []) {
    const normalized = normalizeToken(tag)
    if (normalized) values.add(normalized)
  }
  for (const topic of repo.topics ?? []) {
    const normalized = normalizeToken(topic)
    if (normalized) values.add(normalized)
  }
  for (const skill of repo.aiDevSkills ?? []) {
    const normalized = normalizeToken(skill.skill)
    if (normalized) values.add(normalized)
  }
  return values
}

function repoTaxonomy(repo: EnrichedRepo): Set<string> {
  const values = new Set<string>()
  for (const entry of repo.taxonomy ?? []) {
    const normalized = normalizeToken(`${entry.dimension}:${entry.value}`)
    if (normalized) values.add(normalized)
  }
  return values
}

function prominenceScore(repo: EnrichedRepo): number {
  const stars = Math.log10((repo.parentStats?.stars ?? repo.stars ?? 0) + 1) * 18
  const recentActivity =
    (repo.commitStats?.last30Days ?? 0) * 1.5 +
    (repo.commitStats?.last7Days ?? 0) * 4
  const qualityBoost =
    repo.qualitySignals?.quality === 'high' || repo.quality_signals?.quality === 'high'
      ? 8
      : 0
  return stars + recentActivity + qualityBoost
}

function apiNodeId(
  node: ApiRepoNode | undefined,
  flatUpstream?: string,
  flatOwner?: string,
  flatName?: string,
): string {
  if (node) {
    return node.upstream ?? (node.owner ? `${node.owner}/${node.name}` : node.name)
  }
  return flatUpstream ?? (flatOwner ? `${flatOwner}/${flatName ?? ''}` : flatName ?? 'unknown')
}

function mapApiResponse(data: ApiResponse): GraphDataset {
  const edges: GraphEdge[] = data.edges.map((edge) => ({
    source: apiNodeId(edge.source, edge.source_upstream, edge.source_owner, edge.source_name),
    target: apiNodeId(edge.target, edge.target_upstream, edge.target_owner, edge.target_name),
    edge_type: edge.edgeType ?? edge.edge_type ?? 'SIMILAR_TO',
    weight: edge.weight,
  }))

  const nodeMetadata = new Map<string, NodeMeta>()

  // Seed from the full nodes array first — this captures isolated repos with no edges
  if (data.nodes) {
    for (const node of data.nodes) {
      const id = apiNodeId(node)
      nodeMetadata.set(id, {
        category: node.category ?? null,
        description: node.description ?? null,
      })
    }
  }

  // Supplement / overwrite from edge endpoints (edges carry category/description too)
  for (const edge of data.edges) {
    const sourceId = apiNodeId(edge.source, edge.source_upstream, edge.source_owner, edge.source_name)
    const targetId = apiNodeId(edge.target, edge.target_upstream, edge.target_owner, edge.target_name)
    if (edge.source) {
      nodeMetadata.set(sourceId, {
        category: edge.source.category ?? nodeMetadata.get(sourceId)?.category ?? null,
        description: edge.source.description ?? nodeMetadata.get(sourceId)?.description ?? null,
      })
    }
    if (edge.target) {
      nodeMetadata.set(targetId, {
        category: edge.target.category ?? nodeMetadata.get(targetId)?.category ?? null,
        description: edge.target.description ?? nodeMetadata.get(targetId)?.description ?? null,
      })
    }
  }

  return {
    edges,
    nodeMetadata,
    totalRepos: data.total_repos ?? 0,
    totalEdges: data.total_knowledge_graph_edges ?? data.total ?? data.total_edges ?? edges.length,
    source: 'api',
    message: null,
  }
}

function buildSnapshotGraph(library: LibraryData, requestedLimit: number): GraphDataset {
  const edgeBudget = Math.min(Math.max(requestedLimit, 400), SNAPSHOT_EDGE_CAP)
  const nodeBudget = Math.min(320, Math.max(140, Math.ceil(edgeBudget / 6)))
  const maxNeighbours = Math.min(10, Math.max(4, Math.ceil(edgeBudget / Math.max(nodeBudget, 1))))

  const candidates: RepoFeatures[] = [...library.repos]
    .filter((repo) => Boolean(repo.fullName || repo.name))
    .map((repo) => ({
      repo,
      nodeId: repoNodeId(repo),
      category: repoCategory(repo),
      language: normalizeToken(repo.language),
      builders: repoBuilders(repo),
      tags: repoTags(repo),
      taxonomy: repoTaxonomy(repo),
      score: prominenceScore(repo),
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, nodeBudget)

  const nodeMetadata = new Map<string, NodeMeta>()
  for (const candidate of candidates) {
    nodeMetadata.set(candidate.nodeId, {
      category: candidate.category,
      description: candidate.repo.description ?? null,
    })
  }

  const rankedEdges: GraphEdge[] = []
  const neighbourCounts = new Map<string, number>()
  const seenPairs = new Set<string>()
  const pairs: Array<{ left: string; right: string; score: number }> = []

  for (let index = 0; index < candidates.length; index += 1) {
    const left = candidates[index]
    for (let inner = index + 1; inner < candidates.length; inner += 1) {
      const right = candidates[inner]
      const sharedTags = intersectCount(left.tags, right.tags, 4)
      const sharedTaxonomy = intersectCount(left.taxonomy, right.taxonomy, 4)
      const sharedBuilders = intersectCount(left.builders, right.builders, 1)
      const sameCategory = left.category && right.category && left.category === right.category
      const sameLanguage = left.language && right.language && left.language === right.language

      let score = 0
      if (sameCategory) score += 0.34
      if (sameLanguage) score += 0.14
      score += sharedBuilders * 0.28
      score += sharedTags * 0.10
      score += sharedTaxonomy * 0.12

      if (score < 0.54) continue
      pairs.push({ left: left.nodeId, right: right.nodeId, score })
    }
  }

  pairs.sort((left, right) => right.score - left.score)

  for (const pair of pairs) {
    if (rankedEdges.length >= edgeBudget) break
    const key = pair.left < pair.right ? `${pair.left}::${pair.right}` : `${pair.right}::${pair.left}`
    if (seenPairs.has(key)) continue

    const leftCount = neighbourCounts.get(pair.left) ?? 0
    const rightCount = neighbourCounts.get(pair.right) ?? 0
    if (leftCount >= maxNeighbours || rightCount >= maxNeighbours) continue

    seenPairs.add(key)
    neighbourCounts.set(pair.left, leftCount + 1)
    neighbourCounts.set(pair.right, rightCount + 1)
    rankedEdges.push({
      source: pair.left,
      target: pair.right,
      edge_type: 'SIMILAR_TO',
      weight: Number(pair.score.toFixed(2)),
    })
  }

  return {
    edges: rankedEdges,
    nodeMetadata,
    totalRepos: library.totalRepos ?? library.repos.length,
    totalEdges: rankedEdges.length,
    source: 'snapshot',
    message: 'Live graph data is temporarily unavailable. Showing the latest bundled snapshot.',
  }
}

async function loadSnapshotGraph(limit: number, signal?: AbortSignal): Promise<GraphDataset> {
  const response = await fetch(`${getBasePath()}/data/library.json`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Snapshot error ${response.status}`)
  }
  const library: LibraryData = await response.json()
  return buildSnapshotGraph(library, limit)
}

export async function loadGraphDataset({
  apiUrl,
  limit,
  neighbours = 5,
  minSimilarity = 0.5,
  signal,
}: LoadGraphOptions): Promise<GraphDataset> {
  const params = new URLSearchParams({
    limit: String(limit),
    neighbours: String(neighbours),
    min_similarity: String(minSimilarity),
  })

  try {
    const response = await fetch(`${apiUrl}/graph/edges?${params}`, {
      signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`API error ${response.status}`)
    const data: ApiResponse = await response.json()
    if (data.edges.length === 0) throw new Error('API returned no graph edges')
    return mapApiResponse(data)
  } catch (apiError) {
    const snapshot = await loadSnapshotGraph(limit, signal)
    if (!snapshot.message && apiError instanceof Error) {
      snapshot.message = apiError.message
    }
    return snapshot
  }
}
