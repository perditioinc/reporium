/**
 * KAN-124: Category color mappings for the knowledge graph visualization.
 * Maps the 16 primary_category values to visually distinct colors
 * optimised for dark backgrounds and accessibility.
 */

export const CATEGORY_COLORS: Record<string, string> = {
  'foundation-models':    '#4078e7', // royal blue
  'ai-agents':            '#e7b040', // gold
  'datasets':             '#40e778', // spring green
  'rag-retrieval':        '#40e7b0', // jade
  'model-training':       '#e74040', // scarlet
  'evals-benchmarking':   '#78e740', // lime green
  'other':                '#6b7280', // gray
  'observability':        '#40e7e7', // aqua
  'deployment-inference': '#40b0e7', // sky blue
  'code-generation':      '#4040e7', // indigo blue
  'data-engineering':     '#b0e740', // chartreuse
  'security-safety':      '#e77840', // orange
  'tooling':              '#e7e740', // yellow
  'ui-frontend':          '#e740b0', // hot pink
  'mlops':                '#b040e7', // purple
  'multimodal':           '#7840e7', // violet
  'robotics-embodied':    '#e740e7', // magenta
  'research-papers':      '#e74078', // rose
  'developer-tools':      '#40e740', // vivid green
};

export const CATEGORY_LABELS: Record<string, string> = {
  'foundation-models':    'Foundation Models',
  'ai-agents':            'AI Agents',
  'datasets':             'Datasets',
  'rag-retrieval':        'RAG & Retrieval',
  'model-training':       'Model Training',
  'evals-benchmarking':   'Evals & Benchmarking',
  'other':                'Other',
  'observability':        'Observability',
  'deployment-inference': 'Deployment & Inference',
  'code-generation':      'Code Generation',
  'data-engineering':     'Data Engineering',
  'security-safety':      'Security & Safety',
  'tooling':              'Tooling',
  'ui-frontend':          'UI & Frontend',
  'mlops':                'MLOps',
  'multimodal':           'Multimodal',
  'robotics-embodied':    'Robotics & Embodied',
  'research-papers':      'Research Papers',
  'developer-tools':      'Developer Tools',
};

const FALLBACK_COLOR = '#52525b';

// Common aliases from older taxonomy / API variations → canonical kebab keys
const CATEGORY_ALIASES: Record<string, string> = {
  'agents':               'ai-agents',
  'ai-agent':             'ai-agents',
  'rag':                  'rag-retrieval',
  'rag-knowledge':        'rag-retrieval',
  'retrieval':            'rag-retrieval',
  'fine-tuning':          'model-training',
  'finetuning':           'model-training',
  'training':             'model-training',
  'inference':            'deployment-inference',
  'inference-serving':    'deployment-inference',
  'llm-serving':          'deployment-inference',
  'serving':              'deployment-inference',
  'evals':                'evals-benchmarking',
  'evaluation':           'evals-benchmarking',
  'benchmarking':         'evals-benchmarking',
  'monitoring':           'observability',
  'security':             'security-safety',
  'multimodal-vision':    'multimodal',
  'computer-vision':      'multimodal',
  'vision':               'multimodal',
  'robotics':             'robotics-embodied',
  'embodied':             'robotics-embodied',
  'research':             'research-papers',
  'tools':                'developer-tools',
  'dev-tools':            'developer-tools',
  'generative-media':     'multimodal',
  'speech-audio':         'multimodal',
  'nlp-text':             'foundation-models',
  'nlp':                  'foundation-models',
  'data-processing':      'data-engineering',
  'data':                 'data-engineering',
  'infrastructure':       'mlops',
  'orchestration':        'ai-agents',
  'vector-databases':     'rag-retrieval',
};

// Normalize: lowercase + collapse spaces/& to hyphens
function normalizeCategory(cat: string): string {
  return cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Deterministic hue from string for unknown categories
function hashHue(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
  return Math.abs(h) % 360;
}

export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return FALLBACK_COLOR;
  // 1. Direct match
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  // 2. Normalized match (handles "Code Generation" → "code-generation")
  const norm = normalizeCategory(category);
  if (CATEGORY_COLORS[norm]) return CATEGORY_COLORS[norm];
  // 3. Alias match
  const canonical = CATEGORY_ALIASES[norm];
  if (canonical && CATEGORY_COLORS[canonical]) return CATEGORY_COLORS[canonical];
  // 4. Deterministic color for unknown categories (not grey)
  const hue = hashHue(norm);
  return `hsl(${hue}, 65%, 55%)`;
}

export function getCategoryLabel(category: string | null | undefined): string {
  if (!category) return 'Uncategorized';
  if (CATEGORY_LABELS[category]) return CATEGORY_LABELS[category];
  const norm = normalizeCategory(category);
  if (CATEGORY_LABELS[norm]) return CATEGORY_LABELS[norm];
  return category;
}
