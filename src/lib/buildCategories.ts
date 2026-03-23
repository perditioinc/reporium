import { EnrichedRepo, Category } from '@/types/repo';

/**
 * Hardcoded list of exactly 21 content categories.
 * These are fixed buckets — never derived dynamically from tags.
 * A repo can belong to multiple categories (allCategories).
 * primaryCategory = category with the most matching tags.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'foundation-models',
    name: 'Foundation Models',
    icon: '🔬',
    color: '#6366f1',
    repoCount: 0,
    description: 'LLMs, model architecture, pretraining, and base models',
    tags: [
      'Large Language Models', 'Transformers', 'OpenAI', 'Anthropic / Claude',
      'Google AI', 'HuggingFace', 'Long Context', 'Multimodal AI',
      'Quantization', 'llama.cpp', 'GGUF'
    ]
  },
  {
    id: 'ai-agents',
    name: 'AI Agents',
    icon: '🤖',
    color: '#8b5cf6',
    repoCount: 0,
    description: 'Agentic frameworks, orchestration, and multi-agent systems',
    tags: [
      'AI Agents', 'Multi-Agent', 'Autonomous Systems', 'Agent Memory',
      'Planning / CoT', 'Tool Use', 'LangChain', 'LangGraph', 'CrewAI',
      'AutoGen', 'MCP', 'Prompt Engineering', 'Context Engineering',
      'Structured Output', 'Function Calling'
    ]
  },
  {
    id: 'rag-retrieval',
    name: 'RAG & Retrieval',
    icon: '📡',
    color: '#06b6d4',
    repoCount: 0,
    description: 'Retrieval-augmented generation, vector search, and knowledge systems',
    tags: [
      'RAG', 'Vector Database', 'Embeddings', 'Knowledge Graph',
      'Semantic Search', 'Hybrid Search', 'Reranking', 'LlamaIndex',
      'Document Processing', 'Chunking'
    ]
  },
  {
    id: 'model-training',
    name: 'Model Training',
    icon: '⚗️',
    color: '#f59e0b',
    repoCount: 0,
    description: 'Fine-tuning, RLHF, LoRA, and training infrastructure',
    tags: [
      'Fine-Tuning', 'Reinforcement Learning', 'LoRA / PEFT', 'RLHF',
      'Synthetic Data', 'Dataset', 'Training Infrastructure',
      'Unsloth', 'Axolotl', 'TRL', 'DeepSpeed', 'FSDP',
      'PyTorch', 'TensorFlow', 'Keras', 'JAX'
    ]
  },
  {
    id: 'evals-benchmarking',
    name: 'Evals & Benchmarking',
    icon: '📊',
    color: '#ef4444',
    repoCount: 0,
    description: 'Model evaluation, benchmarks, and testing frameworks',
    tags: [
      'Evals', 'Benchmarking', 'Model Evaluation', 'LLM Testing',
      'Red Teaming', 'Safety Evaluation', 'MMLU', 'HumanEval',
      'Code Evaluation', 'Alignment'
    ]
  },
  {
    id: 'observability',
    name: 'Observability & Monitoring',
    icon: '👁️',
    color: '#10b981',
    repoCount: 0,
    description: 'Tracing, logging, monitoring, and debugging AI systems',
    tags: [
      'Observability', 'Tracing', 'Monitoring', 'LLM Monitoring',
      'Logging', 'Debugging', 'LangSmith', 'Phoenix', 'MLflow',
      'Weights & Biases', 'Experiment Tracking'
    ]
  },
  {
    id: 'inference-serving',
    name: 'Inference & Serving',
    icon: '🚀',
    color: '#f97316',
    repoCount: 0,
    description: 'Model serving, optimization, and inference infrastructure',
    tags: [
      'Inference', 'LLM Serving', 'Model Optimization', 'vLLM',
      'TensorRT', 'Triton', 'Ollama', 'TGI', 'Batching',
      'Caching', 'GPU / CUDA', 'Real-Time / Streaming'
    ]
  },
  {
    id: 'generative-media',
    name: 'Generative Media',
    icon: '🎨',
    color: '#ec4899',
    repoCount: 0,
    description: 'Image, video, and audio generation models and tools',
    tags: [
      'Image Generation', 'Video Generation', 'Text to Speech',
      'Speech to Text', 'Music / Audio AI', 'ComfyUI',
      'Diffusion Models', 'ControlNet', 'LoRA', 'Stable Diffusion'
    ]
  },
  {
    id: 'computer-vision',
    name: 'Computer Vision',
    icon: '👁',
    color: '#84cc16',
    repoCount: 0,
    description: '2D and 3D vision, object detection, and perception',
    tags: [
      'Computer Vision', 'Point Cloud / 3D Vision', 'Object Detection',
      'Segmentation', 'Depth Estimation', 'SLAM',
      'Optical Flow', '3D Reconstruction', 'Pose Estimation'
    ]
  },
  {
    id: 'robotics',
    name: 'Robotics',
    icon: '🦾',
    color: '#f59e0b',
    repoCount: 0,
    description: 'Robot arms, autonomous mobile robots, and control systems',
    tags: [
      'Robotics', 'Robot Arms', 'Robot Learning', 'Humanoid Robotics',
      'Simulation', 'ROS', 'Motion Planning', 'Grasping',
      'Manipulation', 'Navigation', 'Control Systems'
    ]
  },
  {
    id: 'spatial-xr',
    name: 'Spatial & XR',
    icon: '👓',
    color: '#a855f7',
    repoCount: 0,
    description: 'AR, VR, mixed reality, and spatial computing',
    tags: [
      'XR / Spatial Computing', 'Virtual Reality', 'Augmented Reality',
      'Immersive Media', 'WebXR', 'Spatial AI', 'ARKit', 'ARCore',
      'Meta Quest', 'Apple Vision'
    ]
  },
  {
    id: 'mlops-infrastructure',
    name: 'MLOps & Infrastructure',
    icon: '⚙️',
    color: '#64748b',
    repoCount: 0,
    description: 'ML pipelines, deployment, and production infrastructure',
    tags: [
      'MLOps', 'Docker', 'Kubernetes', 'CI/CD', 'Pipeline',
      'Feature Store', 'Model Registry', 'Data Versioning',
      'DVC', 'ZenML', 'Prefect', 'Airflow', 'Ray',
      'Distributed Computing', 'DevOps'
    ]
  },
  {
    id: 'dev-tools',
    name: 'Dev Tools & Automation',
    icon: '🛠️',
    color: '#0ea5e9',
    repoCount: 0,
    description: 'CLI tools, coding assistants, and developer automation',
    tags: [
      'CLI Tool', 'API', 'Automation', 'SDK', 'Developer Tools',
      'Code Generation', 'Coding Assistant', 'Systems', 'Security',
      'Database', 'Backend', 'Frontend', 'Full Stack', 'Node.js',
      'React / Next.js', 'Python Web Framework', 'Web3'
    ]
  },
  {
    id: 'cloud-platforms',
    name: 'Cloud & Platforms',
    icon: '☁️',
    color: '#3b82f6',
    repoCount: 0,
    description: 'Cloud providers, AI platforms, and managed services',
    tags: [
      'Google Cloud', 'AWS', 'Azure', 'Google AI',
      'Vertex AI', 'SageMaker', 'Bedrock'
    ]
  },
  {
    id: 'learning-resources',
    name: 'Learning Resources',
    icon: '📚',
    color: '#78716c',
    repoCount: 0,
    description: 'Courses, tutorials, roadmaps, papers, and reference material',
    tags: [
      'Tutorial', 'Course', 'Roadmap', 'Cheat Sheet', 'Curated List',
      'Interview Prep', 'Research / Papers', 'Open Source', 'Book',
      'Workshop', 'Lecture Notes'
    ]
  },
  {
    id: 'industry-healthcare',
    name: 'Industry: Healthcare',
    icon: '🏥',
    color: '#22c55e',
    repoCount: 0,
    description: 'AI applications in healthcare and medicine',
    tags: [
      'Healthcare AI', 'Medical Imaging', 'Drug Discovery',
      'Clinical NLP', 'Bioinformatics', 'Genomics'
    ]
  },
  {
    id: 'industry-fintech',
    name: 'Industry: FinTech',
    icon: '💰',
    color: '#eab308',
    repoCount: 0,
    description: 'AI applications in finance and financial technology',
    tags: [
      'FinTech', 'Trading AI', 'Risk Modeling',
      'Fraud Detection', 'Financial NLP'
    ]
  },
  {
    id: 'industry-audio-music',
    name: 'Industry: Audio & Music',
    icon: '🎵',
    color: '#a78bfa',
    repoCount: 0,
    description: 'Music technology, audio processing, and creative audio AI',
    tags: [
      'Music Tech', 'Audio AI', 'Music / Audio AI',
      'Music Generation', 'Audio Processing', 'Voice Cloning'
    ]
  },
  {
    id: 'industry-gaming',
    name: 'Industry: Gaming',
    icon: '🎮',
    color: '#f43f5e',
    repoCount: 0,
    description: 'AI for game development, NPCs, and procedural generation',
    tags: [
      'Game Dev', 'NPC AI', 'Procedural Generation',
      'Game AI', 'Simulation'
    ]
  },
  {
    id: 'security-safety',
    name: 'Security & Safety',
    icon: '🔐',
    color: '#dc2626',
    repoCount: 0,
    description: 'AI security, red teaming, alignment, and safety research',
    tags: [
      'Security', 'AI Safety', 'Red Teaming', 'Alignment',
      'Adversarial', 'Privacy', 'Watermarking'
    ]
  },
  {
    id: 'data-science',
    name: 'Data Science & Analytics',
    icon: '📈',
    color: '#0891b2',
    repoCount: 0,
    description: 'Data analysis, visualization, and statistical modeling',
    tags: [
      'Data Science', 'Analytics', 'Visualization', 'Statistics',
      'Pandas', 'NumPy', 'Jupyter', 'Data Engineering'
    ]
  },
  {
    id: 'audio',
    name: 'Audio',
    icon: '🔊',
    color: '#a855f7',
    repoCount: 0,
    description: 'Speech, music, and audio processing AI',
    tags: ['Audio', 'Speech', 'TTS', 'ASR', 'Music AI', 'Voice']
  },
  {
    id: 'code-generation',
    name: 'Code Generation',
    icon: '💻',
    color: '#3b82f6',
    repoCount: 0,
    description: 'AI-powered code generation and coding assistants',
    tags: ['Code Generation', 'Coding Assistant', 'Copilot', 'Code Review']
  },
  {
    id: 'datasets',
    name: 'Datasets',
    icon: '📦',
    color: '#10b981',
    repoCount: 0,
    description: 'Training datasets, data curation, and data tools',
    tags: ['Datasets', 'Training Data', 'Data Curation', 'Benchmarks']
  },
  {
    id: 'deployment',
    name: 'Deployment',
    icon: '📤',
    color: '#f59e0b',
    repoCount: 0,
    description: 'Model deployment, packaging, and production serving',
    tags: ['Deployment', 'Packaging', 'Edge AI', 'Mobile AI', 'ONNX']
  },
  {
    id: 'evaluation',
    name: 'Evaluation',
    icon: '✅',
    color: '#6366f1',
    repoCount: 0,
    description: 'Model evaluation and quality assessment',
    tags: ['Evaluation', 'Testing', 'Quality', 'Metrics']
  },
  {
    id: 'fine-tuning',
    name: 'Fine Tuning',
    icon: '🎯',
    color: '#ef4444',
    repoCount: 0,
    description: 'Model fine-tuning, adaptation, and transfer learning',
    tags: ['Fine Tuning', 'LoRA', 'PEFT', 'Transfer Learning', 'Adaptation']
  },
  {
    id: 'uncategorized',
    name: 'Uncategorized',
    icon: '📁',
    color: '#94a3b8',
    repoCount: 0,
    description: 'Repos not yet categorized',
    tags: []
  }
];

/**
 * Determine the primary category for a repo based on its enriched tags.
 * Returns the category with the most tag matches. Returns '' if none match.
 */
function assignPrimaryCategory(repo: EnrichedRepo): string {
  let bestCategory = '';
  let bestCount = 0;
  for (const cat of CATEGORIES) {
    const count = repo.enrichedTags.filter(t => cat.tags.includes(t)).length;
    if (count > bestCount) {
      bestCount = count;
      bestCategory = cat.name;
    }
  }
  return bestCategory;
}

/**
 * Build category analytics and assign primaryCategory + allCategories to each repo.
 * Mutates each repo's primaryCategory and allCategories fields.
 * Always returns exactly the hardcoded CATEGORIES list (filtered to repoCount > 0).
 *
 * @param repos - All enriched repos
 * @returns Array of Category objects sorted by repoCount descending
 */
export function buildCategories(repos: EnrichedRepo[]): Category[] {
  // Assign primaryCategory and allCategories to each repo
  for (const repo of repos) {
    repo.primaryCategory = assignPrimaryCategory(repo);
    repo.allCategories = CATEGORIES
      .filter(cat => repo.enrichedTags.some(t => cat.tags.includes(t)))
      .map(cat => cat.name);
  }

  // Build repoCount for each category (count repos where category is in allCategories)
  return CATEGORIES
    .map(cat => ({
      ...cat,
      repoCount: repos.filter(r => r.allCategories.includes(cat.name)).length,
    }))
    .filter(c => c.repoCount > 0)
    .sort((a, b) => b.repoCount - a.repoCount);
}
