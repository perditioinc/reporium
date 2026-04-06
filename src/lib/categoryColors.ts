/**
 * KAN-124: Category color mappings for the knowledge graph visualization.
 * Maps the 16 primary_category values to visually distinct colors
 * optimised for dark backgrounds and accessibility.
 */

export const CATEGORY_COLORS: Record<string, string> = {
  'foundation-models':    '#3b82f6', // blue
  'ai-agents':            '#f59e0b', // amber
  'rag-retrieval':        '#8b5cf6', // violet
  'model-training':       '#ef4444', // red
  'evals-benchmarking':   '#22c55e', // green
  'observability':        '#14b8a6', // teal
  'deployment-inference': '#06b6d4', // cyan
  'code-generation':      '#6366f1', // indigo
  'data-engineering':     '#84cc16', // lime
  'security-safety':      '#f97316', // orange
  'ui-frontend':          '#ec4899', // pink
  'mlops':                '#a855f7', // purple
  'multimodal':           '#0ea5e9', // sky
  'robotics-embodied':    '#d946ef', // fuchsia
  'research-papers':      '#f43f5e', // rose
  'developer-tools':      '#78716c', // stone
};

export const CATEGORY_LABELS: Record<string, string> = {
  'foundation-models':    'Foundation Models',
  'ai-agents':            'AI Agents',
  'rag-retrieval':        'RAG & Retrieval',
  'model-training':       'Model Training',
  'evals-benchmarking':   'Evals & Benchmarking',
  'observability':        'Observability',
  'deployment-inference': 'Deployment & Inference',
  'code-generation':      'Code Generation',
  'data-engineering':     'Data Engineering',
  'security-safety':      'Security & Safety',
  'ui-frontend':          'UI & Frontend',
  'mlops':                'MLOps',
  'multimodal':           'Multimodal',
  'robotics-embodied':    'Robotics & Embodied',
  'research-papers':      'Research Papers',
  'developer-tools':      'Developer Tools',
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
