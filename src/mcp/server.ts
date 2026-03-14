#!/usr/bin/env node
/**
 * Reporium MCP Server
 *
 * Exposes your GitHub library as tools Claude can query.
 * Reads from public/data/library.json — no GitHub API calls at query time.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { LibraryData, EnrichedRepo } from '../types/repo.js';

/** Load library.json from disk */
function loadLibrary(): LibraryData {
  const libraryPath = process.env.LIBRARY_PATH
    || path.join(process.cwd(), 'public', 'data', 'library.json');
  if (!fs.existsSync(libraryPath)) {
    throw new Error(`library.json not found at ${libraryPath}. Run: npm run generate`);
  }
  return JSON.parse(fs.readFileSync(libraryPath, 'utf-8')) as LibraryData;
}

/** Score a repo against a text query (simple keyword match) */
function scoreRepo(repo: EnrichedRepo, query: string): number {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/);
  let score = 0;
  for (const term of terms) {
    if (repo.name.toLowerCase().includes(term)) score += 3;
    if ((repo.description ?? '').toLowerCase().includes(term)) score += 2;
    if (repo.enrichedTags.some(t => t.toLowerCase().includes(term))) score += 2;
    if (repo.primaryCategory.toLowerCase().includes(term)) score += 1;
  }
  return score;
}

export async function startMCPServer(): Promise<void> {
  const server = new Server(
    { name: 'reporium', version: '0.9.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_repos',
        description: 'Search your GitHub library by topic, tag, or keyword',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query, e.g. "RAG implementations in Python"' },
            category: { type: 'string', description: 'Optional category filter' },
            limit: { type: 'number', description: 'Max results (default 10)' }
          },
          required: ['query']
        }
      },
      {
        name: 'get_repos_by_tag',
        description: 'Get all repos with a specific tag',
        inputSchema: {
          type: 'object',
          properties: {
            tag: { type: 'string', description: 'Tag name, e.g. "RAG"' },
            sortBy: { type: 'string', enum: ['stars', 'recent', 'behind'], description: 'Sort order' }
          },
          required: ['tag']
        }
      },
      {
        name: 'get_repos_by_category',
        description: 'Get all repos in a category',
        inputSchema: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category name or id, e.g. "AI & Machine Learning" or "ai-ml"' }
          },
          required: ['category']
        }
      },
      {
        name: 'get_library_stats',
        description: 'Get overview stats of the GitHub library',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_repo_details',
        description: 'Get full details for a specific repo',
        inputSchema: {
          type: 'object',
          properties: {
            repoName: { type: 'string', description: 'Repository name' }
          },
          required: ['repoName']
        }
      },
      {
        name: 'find_related_repos',
        description: 'Find repos similar to a given repo based on shared tags',
        inputSchema: {
          type: 'object',
          properties: {
            repoName: { type: 'string', description: 'Repository name to find related repos for' },
            limit: { type: 'number', description: 'Max results (default 5)' }
          },
          required: ['repoName']
        }
      },
      {
        name: 'get_outdated_forks',
        description: 'Get forks that are behind their upstream by N or more commits',
        inputSchema: {
          type: 'object',
          properties: {
            minBehindBy: { type: 'number', description: 'Minimum commits behind (default 50)' }
          }
        }
      },
      {
        name: 'get_library_intelligence',
        description: 'Get the latest trend signals, releases, and gaps from your library',
        inputSchema: { type: 'object', properties: {} }
      },
      {
        name: 'get_daily_digest',
        description: 'Get a compressed daily intelligence briefing about your GitHub library',
        inputSchema: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['full', 'brief'], description: 'Response size (brief = <500 tokens)' }
          }
        }
      }
    ]
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const library = loadLibrary();
    const { name, arguments: args } = request.params;

    try {
      if (name === 'search_repos') {
        const { query, category, limit = 10 } = args as { query: string; category?: string; limit?: number };
        let repos = library.repos;
        if (category) {
          repos = repos.filter(r => r.primaryCategory.toLowerCase().includes(category.toLowerCase()) ||
            r.allCategories.some(c => c.toLowerCase().includes(category.toLowerCase())));
        }
        const scored = repos
          .map(r => ({ repo: r, score: scoreRepo(r, query) }))
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
          .map(x => ({
            name: x.repo.name,
            description: x.repo.description,
            tags: x.repo.enrichedTags.slice(0, 5),
            category: x.repo.primaryCategory,
            parentStars: x.repo.parentStats?.stars ?? x.repo.stars,
            syncStatus: x.repo.forkSync?.state ?? 'unknown',
            url: x.repo.url,
          }));
        return { content: [{ type: 'text', text: JSON.stringify(scored, null, 2) }] };
      }

      if (name === 'get_repos_by_tag') {
        const { tag, sortBy = 'stars' } = args as { tag: string; sortBy?: string };
        let repos = library.repos.filter(r => r.enrichedTags.includes(tag));
        if (sortBy === 'stars') repos.sort((a, b) => (b.parentStats?.stars ?? b.stars) - (a.parentStats?.stars ?? a.stars));
        else if (sortBy === 'recent') repos.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
        else if (sortBy === 'behind') repos.sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0));
        return { content: [{ type: 'text', text: JSON.stringify(repos.map(r => ({
          name: r.name, description: r.description, tags: r.enrichedTags.slice(0, 5),
          parentStars: r.parentStats?.stars ?? r.stars,
          syncStatus: r.forkSync?.state ?? 'unknown',
          behindBy: r.forkSync?.behindBy ?? 0,
        })), null, 2) }] };
      }

      if (name === 'get_repos_by_category') {
        const { category } = args as { category: string };
        const cat = library.categories.find(c =>
          c.name.toLowerCase() === category.toLowerCase() || c.id === category.toLowerCase());
        if (!cat) return { content: [{ type: 'text', text: `Category "${category}" not found. Available: ${library.categories.map(c => c.name).join(', ')}` }] };
        const repos = library.repos.filter(r => r.primaryCategory === cat.name || r.allCategories?.includes(cat.name));
        return { content: [{ type: 'text', text: JSON.stringify({ category: cat.name, repoCount: repos.length, repos: repos.map(r => ({ name: r.name, description: r.description, tags: r.enrichedTags.slice(0, 5), parentStars: r.parentStats?.stars ?? r.stars })) }, null, 2) }] };
      }

      if (name === 'get_library_stats') {
        const syncCounts = { 'up-to-date': 0, behind: 0, ahead: 0, diverged: 0, unknown: 0 };
        for (const r of library.repos) {
          const state = r.forkSync?.state ?? 'unknown';
          syncCounts[state as keyof typeof syncCounts]++;
        }
        return { content: [{ type: 'text', text: JSON.stringify({
          username: library.username, generatedAt: library.generatedAt,
          total: library.stats.total, built: library.stats.built, forked: library.stats.forked,
          topLanguages: library.stats.languages.slice(0, 5),
          topTags: library.stats.topTags.slice(0, 10),
          categories: library.categories.map(c => ({ name: c.name, icon: c.icon, repoCount: c.repoCount })),
          syncHealth: syncCounts,
        }, null, 2) }] };
      }

      if (name === 'get_repo_details') {
        const { repoName } = args as { repoName: string };
        const repo = library.repos.find(r => r.name.toLowerCase() === repoName.toLowerCase());
        if (!repo) return { content: [{ type: 'text', text: `Repo "${repoName}" not found.` }] };
        return { content: [{ type: 'text', text: JSON.stringify({
          name: repo.name, description: repo.description, url: repo.url,
          isFork: repo.isFork, forkedFrom: repo.forkedFrom,
          tags: repo.enrichedTags, category: repo.primaryCategory, allCategories: repo.allCategories,
          language: repo.language, stars: repo.stars,
          parentStats: repo.parentStats,
          forkSync: repo.forkSync,
          commitStats: repo.commitStats,
          languagePercentages: repo.languagePercentages,
        }, null, 2) }] };
      }

      if (name === 'find_related_repos') {
        const { repoName, limit = 5 } = args as { repoName: string; limit?: number };
        const repo = library.repos.find(r => r.name.toLowerCase() === repoName.toLowerCase());
        if (!repo) return { content: [{ type: 'text', text: `Repo "${repoName}" not found.` }] };
        const scored = library.repos
          .filter(r => r.name !== repo.name)
          .map(r => {
            const shared = repo.enrichedTags.filter(t => r.enrichedTags.includes(t));
            return { repo: r, sharedTags: shared, score: shared.length };
          })
          .filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
        return { content: [{ type: 'text', text: JSON.stringify(scored.map(x => ({
          name: x.repo.name, description: x.repo.description,
          sharedTags: x.sharedTags, parentStars: x.repo.parentStats?.stars ?? x.repo.stars,
        })), null, 2) }] };
      }

      if (name === 'get_outdated_forks') {
        const { minBehindBy = 50 } = args as { minBehindBy?: number };
        const outdated = library.repos
          .filter(r => r.forkSync?.state === 'behind' && (r.forkSync?.behindBy ?? 0) >= minBehindBy)
          .sort((a, b) => (b.forkSync?.behindBy ?? 0) - (a.forkSync?.behindBy ?? 0))
          .slice(0, 20)
          .map(r => ({ name: r.name, behindBy: r.forkSync?.behindBy ?? 0, url: r.url, lastUpdated: r.lastUpdated }));
        return { content: [{ type: 'text', text: JSON.stringify(outdated, null, 2) }] };
      }

      if (name === 'get_library_intelligence') {
        const trendsPath = process.env.LIBRARY_PATH
          ? process.env.LIBRARY_PATH.replace('library.json', 'trends.json')
          : path.join(process.cwd(), 'public', 'data', 'trends.json');
        const trends = fs.existsSync(trendsPath)
          ? JSON.parse(fs.readFileSync(trendsPath, 'utf-8'))
          : null;
        const response = {
          trending: trends?.trending?.slice(0, 5) ?? [],
          emerging: trends?.emerging?.slice(0, 3) ?? [],
          cooling: trends?.cooling?.slice(0, 3) ?? [],
          newReleases: trends?.newReleases?.slice(0, 5) ?? [],
          gaps: library.gapAnalysis?.gaps?.slice(0, 3) ?? [],
          insights: trends?.insights ?? ['No trend data yet.'],
          generatedAt: trends?.generatedAt ?? library.generatedAt,
        };
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      }

      if (name === 'get_daily_digest') {
        const { format = 'full' } = args as { format?: 'full' | 'brief' };
        const digestPath = path.join(process.cwd(), 'DIGEST.md');
        if (!fs.existsSync(digestPath)) {
          return { content: [{ type: 'text', text: 'DIGEST.md not found. Run: npm run digest' }] };
        }
        let content = fs.readFileSync(digestPath, 'utf-8');
        if (format === 'brief') {
          // Return only first ~500 tokens (approx 2000 chars)
          content = content.slice(0, 2000) + (content.length > 2000 ? '\n\n[...truncated for brief mode]' : '');
        }
        return { content: [{ type: 'text', text: content }] };
      }

      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${(err as Error).message}` }], isError: true };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Reporium MCP server started');
}
