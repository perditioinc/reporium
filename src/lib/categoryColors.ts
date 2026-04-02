/**
 * KAN-124: Category color mappings for the knowledge graph visualization.
 * Maps the 16 DB primary_category values to distinct colors for the dark theme.
 */

export const CATEGORY_COLORS: Record<string, string> = {
  'agents':           '#3b82f6', // blue
  'rag-retrieval':    '#8b5cf6', // violet
  'llm-serving':      '#f59e0b', // amber
  'fine-tuning':      '#ef4444', // red
  'evaluation':       '#22c55e', // green
  'orchestration':    '#06b6d4', // cyan
  'vector-databases': '#ec4899', // pink
  'observability':    '#14b8a6', // teal
  'security-safety':  '#f97316', // orange
  'code-generation':  '#6366f1', // indigo
  'data-processing':  '#84cc16', // lime
  'computer-vision':  '#a855f7', // purple
  'nlp-text':         '#0ea5e9', // sky
  'speech-audio':     '#d946ef', // fuchsia
  'generative-media': '#f43f5e', // rose
  'infrastructure':   '#78716c', // stone
};

export const CATEGORY_LABELS: Record<string, string> = {
  'agents':           'Agents',
  'rag-retrieval':    'RAG & Retrieval',
  'llm-serving':      'LLM Serving',
  'fine-tuning':      'Fine-tuning',
  'evaluation':       'Evaluation',
  'orchestration':    'Orchestration',
  'vector-databases': 'Vector DBs',
  'observability':    'Observability',
  'security-safety':  'Security & Safety',
  'code-generation':  'Code Gen',
  'data-processing':  'Data Processing',
  'computer-vision':  'Computer Vision',
  'nlp-text':         'NLP & Text',
  'speech-audio':     'Speech & Audio',
  'generative-media': 'Generative Media',
  'infrastructure':   'Infrastructure',
};

const FALLBACK_COLOR = '#52525b';

export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return FALLBACK_COLOR;
  return CATEGORY_COLORS[category] ?? FALLBACK_COLOR;
}

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Uncategorized';
  return CATEGORY_LABELS[category] ?? category;
}
