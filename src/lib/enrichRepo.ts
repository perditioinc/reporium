import { EnrichedRepo } from '@/types/repo';

/** Language to category tag mappings */
const LANGUAGE_TAGS: Record<string, string[]> = {
  Python: ['Python', 'Backend'],
  TypeScript: ['TypeScript', 'Frontend'],
  JavaScript: ['JavaScript', 'Full Stack'],
  Rust: ['Rust', 'Systems'],
  Go: ['Go', 'Backend'],
  Java: ['Java', 'Backend'],
  'C++': ['C++', 'Systems'],
  C: ['C', 'Systems'],
  'C#': ['C#', 'Backend'],
  Shell: ['Shell', 'DevOps'],
  Bash: ['Bash', 'DevOps'],
  Ruby: ['Ruby', 'Backend'],
  PHP: ['PHP', 'Backend'],
  Swift: ['Swift', 'Mobile'],
  Kotlin: ['Kotlin', 'Mobile'],
  Dart: ['Dart', 'Mobile'],
  Scala: ['Scala', 'Backend'],
  Elixir: ['Elixir', 'Backend'],
  Haskell: ['Haskell', 'Systems'],
  R: ['R', 'Data Science'],
};

/** Topic keyword to category tag mappings */
const TOPIC_TAGS: Record<string, string> = {
  // AI / LLM
  llm: 'Large Language Models',
  gpt: 'Large Language Models',
  openai: 'Large Language Models',
  anthropic: 'Large Language Models',
  claude: 'Large Language Models',
  chatgpt: 'Large Language Models',
  // RAG
  rag: 'RAG',
  retrieval: 'RAG',
  'vector-db': 'RAG',
  vectordb: 'RAG',
  pinecone: 'RAG',
  // AI Agents
  agent: 'AI Agents',
  agents: 'AI Agents',
  agentic: 'AI Agents',
  langgraph: 'AI Agents',
  autogen: 'AI Agents',
  crewai: 'AI Agents',
  // Computer Vision
  'computer-vision': 'Computer Vision',
  cv: 'Computer Vision',
  yolo: 'Computer Vision',
  opencv: 'Computer Vision',
  // NLP
  nlp: 'NLP',
  'natural-language': 'NLP',
  transformers: 'NLP',
  'text-classification': 'NLP',
  // Frontend
  react: 'Frontend Framework',
  nextjs: 'Frontend Framework',
  'next-js': 'Frontend Framework',
  vue: 'Frontend Framework',
  svelte: 'Frontend Framework',
  angular: 'Frontend Framework',
  remix: 'Frontend Framework',
  astro: 'Frontend Framework',
  // API
  api: 'API',
  rest: 'API',
  graphql: 'API',
  fastapi: 'API',
  grpc: 'API',
  // DevOps
  docker: 'DevOps',
  kubernetes: 'DevOps',
  k8s: 'DevOps',
  devops: 'DevOps',
  terraform: 'DevOps',
  ansible: 'DevOps',
  ci: 'DevOps',
  'github-actions': 'DevOps',
  // Database
  firebase: 'Database',
  supabase: 'Database',
  mongodb: 'Database',
  postgres: 'Database',
  postgresql: 'Database',
  mysql: 'Database',
  redis: 'Database',
  sqlite: 'Database',
  // Machine Learning
  ml: 'Machine Learning',
  'machine-learning': 'Machine Learning',
  'deep-learning': 'Machine Learning',
  pytorch: 'Machine Learning',
  tensorflow: 'Machine Learning',
  sklearn: 'Machine Learning',
  'scikit-learn': 'Machine Learning',
  // Automation
  automation: 'Automation',
  workflow: 'Automation',
  n8n: 'Automation',
  zapier: 'Automation',
  // Open Source
  'open-source': 'Open Source',
  opensource: 'Open Source',
  // CLI
  cli: 'CLI Tool',
  terminal: 'CLI Tool',
  // Mobile
  mobile: 'Mobile',
  ios: 'Mobile',
  android: 'Mobile',
  'react-native': 'Mobile',
  flutter: 'Mobile',
  // Web3
  blockchain: 'Web3',
  web3: 'Web3',
  solidity: 'Web3',
  ethereum: 'Web3',
  // Data Science
  data: 'Data Science',
  analytics: 'Data Science',
  pandas: 'Data Science',
  jupyter: 'Data Science',
  // Security
  security: 'Security',
  auth: 'Security',
  oauth: 'Security',
  jwt: 'Security',
  // Testing
  testing: 'Testing',
  jest: 'Testing',
  pytest: 'Testing',
  // Game Dev
  game: 'Game Dev',
  gamedev: 'Game Dev',
  unity: 'Game Dev',
};

/** Maps README keyword patterns to enriched tag names */
const readmeKeywordMap: Array<{ keywords: string[]; tag: string }> = [
  // AI Core
  { keywords: ['large language model', 'llm', 'language model'], tag: 'Large Language Models' },
  { keywords: ['gpt', 'openai', 'chatgpt'], tag: 'OpenAI' },
  { keywords: ['claude', 'anthropic'], tag: 'Anthropic / Claude' },
  { keywords: ['gemini', 'vertex ai', 'google ai'], tag: 'Google AI' },
  // removed standalone 'rag' (matches "storage", "diagram", "fragile")
  { keywords: ['retrieval augmented', 'retrieval-augmented'], tag: 'RAG' },
  { keywords: ['vector database', 'vector db', 'vector store', 'embedding store'], tag: 'Vector Database' },
  { keywords: ['embedding', 'embeddings'], tag: 'Embeddings' },
  // removed 'lora' (matches "explore", "folklore", "electoral")
  { keywords: ['fine-tun', 'finetuning', 'fine tuning', 'qlora'], tag: 'Fine-Tuning' },
  // removed 'ppo' (matches "support", "opportunity")
  { keywords: ['reinforcement learning', 'rlhf', 'reward model'], tag: 'Reinforcement Learning' },
  { keywords: ['ai agent', 'agentic', 'autonomous agent', 'multi-agent', 'agent framework', 'agent workflow'], tag: 'AI Agents' },
  { keywords: ['mcp', 'model context protocol'], tag: 'MCP' },
  // AI Frameworks
  { keywords: ['langchain', 'lang chain'], tag: 'LangChain' },
  { keywords: ['langgraph', 'lang graph'], tag: 'LangGraph' },
  { keywords: ['llamaindex', 'llama index', 'llama_index'], tag: 'LlamaIndex' },
  { keywords: ['crewai', 'crew ai'], tag: 'CrewAI' },
  { keywords: ['autogen', 'auto gen'], tag: 'AutoGen' },
  { keywords: ['hugging face', 'huggingface', 'transformers library'], tag: 'HuggingFace' },
  { keywords: ['ollama'], tag: 'Ollama' },
  { keywords: ['vllm', 'llm serving', 'model serving'], tag: 'LLM Serving' },
  { keywords: ['onnx', 'tensorrt', 'model optimization'], tag: 'Model Optimization' },
  { keywords: ['lora ', 'qlora', 'peft'], tag: 'LoRA / PEFT' },
  { keywords: ['comfyui', 'comfy ui'], tag: 'ComfyUI' },
  { keywords: ['openai whisper'], tag: 'Whisper' },
  { keywords: ['n8n', 'make.com', 'zapier'], tag: 'No-Code Automation' },
  { keywords: ['multiagent', 'multi-agent', 'agent swarm'], tag: 'Multi-Agent' },
  { keywords: ['function calling', 'tool calling', 'tool use'], tag: 'Tool Use' },
  { keywords: ['structured output', 'json mode', 'pydantic'], tag: 'Structured Output' },
  { keywords: ['benchmark', 'evaluation', 'evals', 'llm eval'], tag: 'Evals' },
  { keywords: ['synthetic data', 'data generation'], tag: 'Synthetic Data' },
  { keywords: ['quantization', 'gguf', 'quantized'], tag: 'Quantization' },
  { keywords: ['inference server', 'inference engine'], tag: 'Inference' },
  { keywords: ['long context', 'context extension'], tag: 'Long Context' },
  { keywords: ['agent memory', 'persistent memory'], tag: 'Agent Memory' },
  { keywords: ['chain of thought', 'task planning'], tag: 'Planning / CoT' },
  { keywords: ['simulator', 'simulation', 'gazebo'], tag: 'Simulation' },
  { keywords: ['slam algorithm', 'localization and mapping'], tag: 'SLAM' },
  { keywords: ['humanoid', 'bipedal', 'legged robot'], tag: 'Humanoid Robotics' },
  { keywords: ['diffusion policy', 'imitation learning', 'robot learning'], tag: 'Robot Learning' },
  { keywords: ['prompt engineering', 'prompt template', 'system prompt'], tag: 'Prompt Engineering' },
  { keywords: ['context engineering', 'context window'], tag: 'Context Engineering' },
  // ML & Deep Learning
  { keywords: ['machine learning', 'ml model', 'sklearn', 'scikit-learn'], tag: 'Machine Learning' },
  { keywords: ['deep learning', 'neural network', 'deep neural'], tag: 'Deep Learning' },
  // removed 'bert' (matches "robert", "albert")
  { keywords: ['transformer', 'transformers', 'attention mechanism', 'gpt-2'], tag: 'Transformers' },
  { keywords: ['pytorch', 'torch'], tag: 'PyTorch' },
  { keywords: ['tensorflow', 'tf.keras'], tag: 'TensorFlow' },
  { keywords: ['keras'], tag: 'Keras' },
  // removed 'jax' (matches "ajax"); keeping 'flax' which is specific
  { keywords: ['flax'], tag: 'JAX' },
  { keywords: ['mlops', 'ml pipeline', 'model deployment', 'model serving'], tag: 'MLOps' },
  { keywords: ['cuda', 'gpu programming', 'gpu performance', 'triton kernel'], tag: 'GPU / CUDA' },
  // Generative AI
  { keywords: ['diffusion model', 'stable diffusion', 'comfyui', 'image generation', 'text to image'], tag: 'Image Generation' },
  // removed 'wan' (3 chars, matches "want", "wand", "swanky")
  { keywords: ['video generation', 'video model', 'video diffusion', 'ltx-video'], tag: 'Video Generation' },
  // removed 'tts' (3 chars, matches "watts", "settings")
  { keywords: ['text to speech', 'speech synthesis', 'voice cloning', 'voice generation'], tag: 'Text to Speech' },
  // removed 'stt' (3 chars)
  { keywords: ['speech to text', 'speech recognition', 'transcription', 'whisper'], tag: 'Speech to Text' },
  { keywords: ['music generation', 'audio generation', 'audio model', 'sound synthesis'], tag: 'Music / Audio AI' },
  // removed 'vlm' (3 chars)
  { keywords: ['multimodal', 'vision language', 'image understanding'], tag: 'Multimodal AI' },
  // Computer Vision & Spatial
  { keywords: ['computer vision', 'object detection', 'image segmentation', 'yolo', 'opencv'], tag: 'Computer Vision' },
  { keywords: ['point cloud', 'lidar', 'depth estimation', '3d reconstruction', 'nerf'], tag: 'Point Cloud / 3D Vision' },
  { keywords: ['robotics', 'ros ', 'robot operating', 'robotic arm', 'autonomous robot'], tag: 'Robotics' },
  { keywords: ['robot arm', 'robotic arm', 'gripper', 'actuator'], tag: 'Robot Arms' },
  { keywords: ['autonomous vehicle', 'self-driving', 'slam algorithm', 'autonomous robot', 'autonomous system'], tag: 'Autonomous Systems' },
  // removed 'xr' (2 chars)
  { keywords: ['extended reality', 'webxr', 'mixed reality', 'spatial computing'], tag: 'XR / Spatial Computing' },
  { keywords: ['virtual reality', 'vr headset', 'oculus', 'meta quest'], tag: 'Virtual Reality' },
  // removed 'ar ' (matches "library", "particular", "similar")
  { keywords: ['augmented reality', 'arkit', 'arcore'], tag: 'Augmented Reality' },
  { keywords: ['volumetric', 'immersive media', 'immersive experience'], tag: 'Immersive Media' },
  // Languages & Frameworks
  { keywords: ['python'], tag: 'Python' },
  { keywords: ['typescript', 'tsx'], tag: 'TypeScript' },
  // removed 'js' (2 chars)
  { keywords: ['javascript'], tag: 'JavaScript' },
  { keywords: ['rust'], tag: 'Rust' },
  // removed 'go ' (matches "to go", "algorithms go")
  { keywords: ['golang'], tag: 'Go' },
  { keywords: ['java '], tag: 'Java' },
  { keywords: ['c++', 'cpp'], tag: 'C++' },
  { keywords: ['react', 'nextjs', 'next.js'], tag: 'React / Next.js' },
  { keywords: ['fastapi', 'flask', 'django'], tag: 'Python Web Framework' },
  { keywords: ['node.js', 'nodejs', 'express'], tag: 'Node.js' },
  // Infrastructure & DevOps
  { keywords: ['docker', 'dockerfile', 'containeriz'], tag: 'Docker' },
  { keywords: ['kubernetes', 'k8s', 'helm chart'], tag: 'Kubernetes' },
  { keywords: ['rest api', 'api endpoint', 'api reference', 'swagger', 'openapi', 'http api'], tag: 'API' },
  { keywords: ['graphql'], tag: 'GraphQL' },
  { keywords: ['database', 'postgresql', 'mysql', 'sqlite'], tag: 'Database' },
  { keywords: ['redis', 'caching', 'cache layer', 'memcached'], tag: 'Caching' },
  // removed standalone 'aws' (matches "claws", "draws", "straws")
  { keywords: ['amazon web services', 's3', 'ec2'], tag: 'AWS' },
  { keywords: ['google cloud', 'gcp', 'firebase', 'vertex'], tag: 'Google Cloud' },
  { keywords: ['automation', 'workflow automation', 'n8n', 'zapier'], tag: 'Automation' },
  { keywords: ['command-line', 'command line interface', 'terminal tool', 'cli tool', 'command line tool'], tag: 'CLI Tool' },
  // Knowledge & Learning
  { keywords: ['tutorial', 'beginner', 'getting started', 'introduction to'], tag: 'Tutorial' },
  { keywords: ['course', 'curriculum', 'lesson', 'lecture'], tag: 'Course' },
  { keywords: ['roadmap', 'learning path'], tag: 'Roadmap' },
  { keywords: ['cheat sheet', 'cheatsheet', 'quick reference'], tag: 'Cheat Sheet' },
  { keywords: ['awesome ', 'curated list', 'collection of'], tag: 'Curated List' },
  { keywords: ['interview', 'interview prep', 'interview question'], tag: 'Interview Prep' },
  { keywords: ['research paper', 'arxiv', 'paper implementation'], tag: 'Research / Papers' },
  { keywords: ['open source'], tag: 'Open Source' },
  // Domains
  { keywords: ['fintech', 'financial', 'payment', 'banking'], tag: 'FinTech' },
  { keywords: ['healthcare', 'medical', 'clinical', 'biomedical'], tag: 'Healthcare AI' },
  { keywords: ['music', 'song', 'audio production', 'daw'], tag: 'Music Tech' },
  { keywords: ['unity game', 'unreal engine', 'game engine', 'pygame', 'godot', 'gaming'], tag: 'Game Dev' },
  { keywords: ['security', 'cybersecurity', 'vulnerability', 'penetration'], tag: 'Security' },
  { keywords: ['blockchain', 'web3', 'solidity', 'smart contract'], tag: 'Web3' },
  { keywords: ['mobile', 'ios', 'android', 'react native', 'flutter'], tag: 'Mobile' },
  { keywords: ['data science', 'data analysis', 'pandas', 'jupyter'], tag: 'Data Science' },
  // removed standalone 'graph' (matches "paragraph", "photograph")
  { keywords: ['knowledge graph', 'graph rag', 'graphrag'], tag: 'Knowledge Graph' },
  // removed 'live' (far too generic)
  { keywords: ['streaming', 'real-time', 'websocket'], tag: 'Real-Time / Streaming' },
  // Specific AI frameworks (new for 1.0.0)
  { keywords: ['dspy', 'ds-py'], tag: 'DSPy' },
  { keywords: ['instructor library', 'instructor-python'], tag: 'Instructor' },
  { keywords: ['microsoft guidance', 'guidance ai'], tag: 'Guidance' },
  { keywords: ['semantic kernel'], tag: 'Semantic Kernel' },
  { keywords: ['haystack', 'deepset haystack'], tag: 'Haystack' },
  { keywords: ['litellm', 'lite llm'], tag: 'LiteLLM' },
  { keywords: ['sglang', 'sg-lang'], tag: 'SGLang' },
  { keywords: ['unsloth'], tag: 'Unsloth' },
  { keywords: ['axolotl training', 'axolotl finetuning'], tag: 'Axolotl' },
  { keywords: ['mergekit', 'merge kit', 'model merging'], tag: 'MergeKit' },
  { keywords: ['open-webui', 'openwebui', 'open webui'], tag: 'Open WebUI' },
  { keywords: ['flowise'], tag: 'Flowise' },
  { keywords: ['vllm', 'v-llm inference'], tag: 'vLLM' },
  { keywords: ['text-generation-inference', 'huggingface tgi'], tag: 'TGI' },
  { keywords: ['triton inference server', 'nvidia triton'], tag: 'Triton' },
  { keywords: ['tensorrt-llm', 'tensorrt llm'], tag: 'TensorRT' },
  { keywords: ['llama.cpp', 'llama cpp', 'llamacpp'], tag: 'llama.cpp' },
  { keywords: ['exllamav2', 'exllama v2'], tag: 'ExLlama' },
  { keywords: ['gpt4all', 'gpt-4-all', 'gpt 4 all'], tag: 'GPT4All' },
  { keywords: ['privategpt', 'private gpt chat'], tag: 'PrivateGPT' },
  { keywords: ['continue.dev', 'continuedev'], tag: 'Continue.dev' },
  { keywords: ['aider coding', 'aider-chat'], tag: 'Aider' },
  { keywords: ['swe-agent', 'sweagent'], tag: 'SWE-Agent' },
  { keywords: ['opendevin', 'open devin'], tag: 'OpenDevin' },
  // Evals and benchmarking (new for 1.0.0)
  { keywords: ['benchmarking', 'leaderboard ranking', 'model leaderboard'], tag: 'Benchmarking' },
  { keywords: ['mmlu benchmark'], tag: 'MMLU' },
  { keywords: ['humaneval benchmark', 'human-eval'], tag: 'HumanEval' },
  { keywords: ['red-teaming', 'red team attack', 'redteaming'], tag: 'Red Teaming' },
  { keywords: ['deepeval', 'deep-eval framework'], tag: 'DeepEval' },
  { keywords: ['ragas evaluation', 'ragas framework'], tag: 'RAGAS' },
  // Observability (new for 1.0.0)
  { keywords: ['langsmith', 'lang smith tracing'], tag: 'LangSmith' },
  { keywords: ['arize phoenix', 'phoenix tracing'], tag: 'Phoenix' },
  { keywords: ['mlflow tracking', 'mlflow experiment'], tag: 'MLflow' },
  { keywords: ['weights and biases', 'wandb logging', 'weights & biases'], tag: 'Weights & Biases' },
  { keywords: ['opentelemetry tracing', 'otel tracing'], tag: 'Tracing' },
  { keywords: ['model monitoring', 'llm monitoring system'], tag: 'Monitoring' },
  // Training specific (new for 1.0.0)
  { keywords: ['rlhf training', 'reinforcement learning from human feedback'], tag: 'RLHF' },
  { keywords: ['direct preference optimization', 'dpo training'], tag: 'DPO' },
  { keywords: ['grpo training', 'group relative policy optimization'], tag: 'GRPO' },
  { keywords: ['knowledge distillation', 'model distillation'], tag: 'Distillation' },
  { keywords: ['deepspeed training', 'deepspeed zero'], tag: 'DeepSpeed' },
  { keywords: ['fsdp training', 'fully sharded data parallel'], tag: 'FSDP' },
  { keywords: ['trl library', 'transformer reinforcement learning'], tag: 'TRL' },
  { keywords: ['axolotl'], tag: 'Axolotl' },
  // Inference optimization (new for 1.0.0)
  { keywords: ['speculative decoding', 'speculative sampling'], tag: 'Speculative Decoding' },
  { keywords: ['kv cache', 'kv-cache', 'key value cache'], tag: 'KV Cache' },
  { keywords: ['continuous batching', 'dynamic batching'], tag: 'Batching' },
  // RAG specific (new for 1.0.0)
  { keywords: ['reranking', 'cross-encoder rerank', 're-ranking'], tag: 'Reranking' },
  { keywords: ['hybrid search bm25', 'sparse dense retrieval'], tag: 'Hybrid Search' },
  { keywords: ['document parsing', 'pdf parsing', 'document extraction'], tag: 'Document Processing' },
  { keywords: ['text chunking', 'text splitting', 'recursive splitter'], tag: 'Chunking' },
  { keywords: ['semantic search', 'dense retrieval'], tag: 'Semantic Search' },
  // Computer vision specific (new for 1.0.0)
  { keywords: ['object detection model', 'yolo detection', 'yolov'], tag: 'Object Detection' },
  { keywords: ['image segmentation', 'semantic segmentation', 'instance segmentation'], tag: 'Segmentation' },
  { keywords: ['monocular depth', 'depth estimation model'], tag: 'Depth Estimation' },
  { keywords: ['pose estimation', 'keypoint detection', 'human pose'], tag: 'Pose Estimation' },
  { keywords: ['neural radiance field', 'nerf rendering', 'gaussian splatting', '3d reconstruction'], tag: '3D Reconstruction' },
  // Robotics specific (new for 1.0.0)
  { keywords: ['ros2 ', 'ros 2 ', 'robot operating system'], tag: 'ROS' },
  { keywords: ['motion planning algorithm', 'path planning robot', 'trajectory optimization'], tag: 'Motion Planning' },
  { keywords: ['robot grasping', 'pick and place', 'robot manipulation'], tag: 'Grasping' },
  { keywords: ['sim-to-real', 'sim2real transfer', 'domain randomization'], tag: 'Sim-to-Real' },
  // Generative media specific (new for 1.0.0)
  { keywords: ['stable diffusion', 'sdxl', 'sd3 ', 'stablediffusion'], tag: 'Stable Diffusion' },
  { keywords: ['controlnet', 'control net conditioning'], tag: 'ControlNet' },
  { keywords: ['voice cloning model', 'voice synthesis model', 'tts clone'], tag: 'Voice Cloning' },
  { keywords: ['musicgen', 'music generation model', 'audio generation model'], tag: 'Music Generation' },
  // MLOps specific (new for 1.0.0)
  { keywords: ['dvc data versioning', 'data version control'], tag: 'DVC' },
  { keywords: ['zenml pipeline', 'zen ml'], tag: 'ZenML' },
  { keywords: ['prefect workflow', 'prefect flow'], tag: 'Prefect' },
  { keywords: ['apache airflow', 'airflow dag'], tag: 'Airflow' },
  { keywords: ['ray cluster', 'ray tune', 'ray distributed'], tag: 'Ray' },
  { keywords: ['feature store', 'feast feature'], tag: 'Feature Store' },
  { keywords: ['model registry', 'model versioning system'], tag: 'Model Registry' },
  // Security and safety (new for 1.0.0)
  { keywords: ['ai safety research', 'model safety'], tag: 'AI Safety' },
  { keywords: ['adversarial attack', 'adversarial robustness', 'adversarial example'], tag: 'Adversarial' },
  { keywords: ['watermarking model', 'ai watermark', 'content provenance'], tag: 'Watermarking' },
  { keywords: ['differential privacy', 'federated learning', 'privacy preserving ml'], tag: 'Privacy' },
  // XR specific (new for 1.0.0)
  { keywords: ['webxr api', 'web xr'], tag: 'WebXR' },
  { keywords: ['arkit framework', 'ios arkit'], tag: 'ARKit' },
  { keywords: ['arcore framework', 'android arcore'], tag: 'ARCore' },
  { keywords: ['meta quest', 'oculus quest', 'quest 3 '], tag: 'Meta Quest' },
  { keywords: ['apple vision pro', 'visionos', 'apple vision'], tag: 'Apple Vision' },
  // Data Science (new for 1.0.0)
  { keywords: ['numpy', 'numerical computing'], tag: 'NumPy' },
  { keywords: ['data visualization', 'matplotlib', 'plotly chart'], tag: 'Visualization' },
  { keywords: ['data engineering pipeline', 'etl pipeline', 'data pipeline'], tag: 'Data Engineering' },
  { keywords: ['statistics', 'statistical analysis', 'statistical modeling'], tag: 'Statistics' },

  // Observability
  { keywords: ['langfuse'], tag: 'Langfuse' },
  { keywords: ['openllmetry', 'open llmetry'], tag: 'OpenLLMetry' },
  { keywords: ['openlit'], tag: 'OpenLIT' },
  { keywords: ['helicone'], tag: 'Helicone' },
  { keywords: ['arize', 'phoenix arize'], tag: 'Phoenix' },
  { keywords: ['traceloop'], tag: 'Traceloop' },
  { keywords: ['weights biases', 'wandb', 'w&b'], tag: 'Weights & Biases' },
  { keywords: ['mlflow'], tag: 'MLflow' },
  { keywords: ['opentelemetry', 'otel'], tag: 'OpenTelemetry' },

  // Evals
  { keywords: ['deepeval', 'deep eval'], tag: 'DeepEval' },
  { keywords: ['ragas'], tag: 'RAGAS' },
  { keywords: ['promptfoo', 'prompt foo'], tag: 'PromptFoo' },
  { keywords: ['lm-evaluation-harness', 'lm eval harness'], tag: 'LM Eval Harness' },
  { keywords: ['evals framework', 'llm eval', 'model eval'], tag: 'Evals' },
  { keywords: ['red team', 'redteam', 'red-team'], tag: 'Red Teaming' },
  { keywords: ['garak'], tag: 'Garak' },
  { keywords: ['pyrit'], tag: 'PyRIT' },
  { keywords: ['benchmark', 'benchmarking', 'leaderboard'], tag: 'Benchmarking' },
  { keywords: ['mmlu'], tag: 'MMLU' },
  { keywords: ['humaneval', 'human eval'], tag: 'HumanEval' },

  // Inference & Serving
  { keywords: ['vllm', 'v-llm'], tag: 'vLLM' },
  { keywords: ['sglang', 'sg-lang'], tag: 'SGLang' },
  { keywords: ['text-generation-inference', 'tgi'], tag: 'TGI' },
  { keywords: ['triton inference', 'triton server'], tag: 'Triton' },
  { keywords: ['tensorrt', 'tensor rt', 'trt'], tag: 'TensorRT' },
  { keywords: ['onnx'], tag: 'ONNX' },
  { keywords: ['llama.cpp', 'llamacpp', 'llama cpp'], tag: 'llama.cpp' },
  { keywords: ['llamafile'], tag: 'Llamafile' },
  { keywords: ['exllamav2', 'exllama'], tag: 'ExLlama' },
  { keywords: ['pageattention', 'paged attention', 'continuous batching'], tag: 'vLLM' },
  { keywords: ['speculative decoding', 'speculative sampling'], tag: 'Speculative Decoding' },
  { keywords: ['kv cache', 'kv-cache'], tag: 'KV Cache' },
  { keywords: ['model serving', 'llm serving', 'inference server'], tag: 'LLM Serving' },
  { keywords: ['quantization', 'quantized', 'gguf', 'ggml'], tag: 'Quantization' },

  // Fine-tuning & Training
  { keywords: ['unsloth'], tag: 'Unsloth' },
  { keywords: ['axolotl'], tag: 'Axolotl' },
  { keywords: ['trl', 'transformer reinforcement learning'], tag: 'TRL' },
  { keywords: ['torchtune', 'torch tune'], tag: 'TorchTune' },
  { keywords: ['mergekit', 'merge kit', 'model merging'], tag: 'MergeKit' },
  { keywords: ['lora', 'lo-ra', 'low-rank adaptation'], tag: 'LoRA / PEFT' },
  { keywords: ['qlora', 'q-lora'], tag: 'LoRA / PEFT' },
  { keywords: ['peft'], tag: 'LoRA / PEFT' },
  { keywords: ['rlhf', 'reinforcement learning from human feedback'], tag: 'RLHF' },
  { keywords: ['dpo', 'direct preference optimization'], tag: 'DPO' },
  { keywords: ['grpo', 'group relative policy'], tag: 'GRPO' },
  { keywords: ['deepspeed'], tag: 'DeepSpeed' },
  { keywords: ['fsdp', 'fully sharded'], tag: 'FSDP' },
  { keywords: ['synthetic data', 'data synthesis'], tag: 'Synthetic Data' },
  { keywords: ['distillation', 'knowledge distillation'], tag: 'Distillation' },

  // Structured Output & Reliability
  { keywords: ['instructor library', 'jxnl instructor'], tag: 'Instructor' },
  { keywords: ['outlines text', 'dottxt outlines'], tag: 'Outlines' },
  { keywords: ['guidance microsoft', 'microsoft guidance'], tag: 'Guidance' },
  { keywords: ['guardrails ai', 'guardrails library'], tag: 'Guardrails' },
  { keywords: ['nemo guardrails', 'nvidia guardrails'], tag: 'NeMo Guardrails' },
  { keywords: ['structured output', 'json mode', 'json schema output'], tag: 'Structured Output' },
  { keywords: ['function calling', 'tool calling', 'tool use'], tag: 'Tool Use' },
  { keywords: ['pydantic'], tag: 'Pydantic' },

  // Agent Frameworks
  { keywords: ['langgraph', 'lang graph'], tag: 'LangGraph' },
  { keywords: ['dspy', 'ds-py'], tag: 'DSPy' },
  { keywords: ['semantic kernel', 'semantickernel'], tag: 'Semantic Kernel' },
  { keywords: ['haystack deepset', 'deepset haystack'], tag: 'Haystack' },
  { keywords: ['litellm', 'lite llm'], tag: 'LiteLLM' },
  { keywords: ['agno framework'], tag: 'Agno' },
  { keywords: ['letta', 'memgpt'], tag: 'Letta / MemGPT' },
  { keywords: ['mem0', 'memory layer'], tag: 'Mem0' },
  { keywords: ['openai swarm', 'swarm agents'], tag: 'Swarm' },
  { keywords: ['openai agents sdk'], tag: 'OpenAI Agents SDK' },
  { keywords: ['multi-agent', 'multiagent', 'agent swarm'], tag: 'Multi-Agent' },
  { keywords: ['agent memory', 'persistent memory', 'long term memory'], tag: 'Agent Memory' },
  { keywords: ['planning', 'chain of thought', 'cot', 'tree of thought'], tag: 'Planning / CoT' },
  { keywords: ['context engineering', 'context management'], tag: 'Context Engineering' },

  // RAG specific
  { keywords: ['chroma', 'chromadb'], tag: 'Chroma' },
  { keywords: ['qdrant'], tag: 'Qdrant' },
  { keywords: ['milvus'], tag: 'Milvus' },
  { keywords: ['weaviate'], tag: 'Weaviate' },
  { keywords: ['pinecone'], tag: 'Pinecone' },
  { keywords: ['pgvector', 'pg vector'], tag: 'pgvector' },
  { keywords: ['rerank', 'reranking', 'cross-encoder', 'cohere rerank'], tag: 'Reranking' },
  { keywords: ['hybrid search', 'bm25'], tag: 'Hybrid Search' },
  { keywords: ['graphrag', 'graph rag', 'microsoft graphrag'], tag: 'GraphRAG' },
  { keywords: ['document parsing', 'pdf parsing', 'unstructured'], tag: 'Document Processing' },

  // Coding Assistants
  { keywords: ['openhands', 'open hands', 'opendevin'], tag: 'OpenHands' },
  { keywords: ['cline', 'cline vscode'], tag: 'Cline' },
  { keywords: ['continue dev', 'continuedev'], tag: 'Continue.dev' },
  { keywords: ['aider'], tag: 'Aider' },
  { keywords: ['swe-agent', 'sweagent'], tag: 'SWE-Agent' },
  { keywords: ['claude code', 'claudecode'], tag: 'Claude Code' },
  { keywords: ['gemini cli', 'geminicli'], tag: 'Gemini CLI' },
  { keywords: ['kilocode'], tag: 'Kilocode' },

  // Visual / No-code
  { keywords: ['langflow'], tag: 'Langflow' },
  { keywords: ['flowise'], tag: 'Flowise' },
  { keywords: ['n8n'], tag: 'n8n' },
  { keywords: ['comfyui', 'comfy ui'], tag: 'ComfyUI' },
  { keywords: ['automatic1111', 'stable diffusion webui'], tag: 'SD WebUI' },

  // Models
  { keywords: ['deepseek'], tag: 'DeepSeek' },
  { keywords: ['qwen', 'qwen2'], tag: 'Qwen' },
  { keywords: ['llama3', 'llama 3', 'meta llama'], tag: 'Llama' },
  { keywords: ['mistral', 'mixtral'], tag: 'Mistral' },
  { keywords: ['phi-3', 'phi3', 'microsoft phi'], tag: 'Phi' },
  { keywords: ['gemma', 'google gemma'], tag: 'Gemma' },
  { keywords: ['claude', 'anthropic claude'], tag: 'Claude' },
  { keywords: ['gpt-4', 'gpt4', 'openai gpt'], tag: 'GPT' },
  { keywords: ['open-r1', 'openr1', 'reasoning model'], tag: 'Reasoning Models' },

  // MLOps
  { keywords: ['dvc', 'data version control'], tag: 'DVC' },
  { keywords: ['zenml'], tag: 'ZenML' },
  { keywords: ['prefect'], tag: 'Prefect' },
  { keywords: ['airflow', 'apache airflow'], tag: 'Airflow' },
  { keywords: ['ray cluster', 'ray tune', 'ray serve'], tag: 'Ray' },
  { keywords: ['kubeflow'], tag: 'Kubeflow' },
  { keywords: ['feast feature store'], tag: 'Feature Store' },

  // Security
  { keywords: ['prompt injection', 'jailbreak', 'jail break'], tag: 'Prompt Injection' },
  { keywords: ['ai safety', 'model safety', 'alignment'], tag: 'AI Safety' },
  { keywords: ['watermark', 'watermarking'], tag: 'Watermarking' },
  { keywords: ['federated learning', 'differential privacy'], tag: 'Privacy-Preserving AI' },

  // Robotics specific (stricter)
  { keywords: ['ros2', 'ros 2', 'robot operating system 2'], tag: 'ROS 2' },
  { keywords: [' ros ', 'robot operating system'], tag: 'ROS' },
  { keywords: ['motion planning', 'path planning', 'trajectory planning'], tag: 'Motion Planning' },
  { keywords: ['grasping', 'manipulation', 'pick and place'], tag: 'Grasping' },
  { keywords: ['humanoid robot', 'bipedal robot', 'legged robot'], tag: 'Humanoid Robotics' },
  { keywords: ['sim-to-real', 'sim2real'], tag: 'Sim-to-Real' },
  { keywords: ['diffusion policy', 'imitation learning', 'behavior cloning'], tag: 'Robot Learning' },
  { keywords: ['slam', 'simultaneous localization and mapping'], tag: 'SLAM' },

  // XR specific (stricter - no 'ar ' substring)
  { keywords: ['webxr', 'web xr'], tag: 'WebXR' },
  { keywords: ['arkit', 'ar kit'], tag: 'ARKit' },
  { keywords: ['arcore', 'ar core'], tag: 'ARCore' },
  { keywords: ['meta quest', 'oculus quest'], tag: 'Meta Quest' },
  { keywords: ['apple vision pro', 'visionos'], tag: 'Apple Vision Pro' },
  { keywords: ['augmented reality'], tag: 'Augmented Reality' },
  { keywords: ['virtual reality'], tag: 'Virtual Reality' },
  { keywords: ['mixed reality', 'extended reality'], tag: 'Mixed Reality' },

  // Data science
  { keywords: ['pandas', 'dataframe'], tag: 'Pandas' },
  { keywords: ['jupyter notebook', 'ipynb'], tag: 'Jupyter' },
  { keywords: ['matplotlib', 'seaborn', 'plotly visualization'], tag: 'Data Visualization' },
  { keywords: ['scikit-learn', 'sklearn'], tag: 'Scikit-learn' },
  { keywords: ['numpy'], tag: 'NumPy' },
  { keywords: ['apache spark', 'pyspark'], tag: 'Spark' },

  // Cloud & Platforms
  { keywords: ['vertex ai', 'vertexai'], tag: 'Vertex AI' },
  { keywords: ['sagemaker', 'amazon sagemaker'], tag: 'SageMaker' },
  { keywords: ['azure openai', 'azure ai'], tag: 'Azure AI' },
  { keywords: ['bedrock', 'amazon bedrock'], tag: 'AWS Bedrock' },
  { keywords: ['hugging face', 'huggingface'], tag: 'HuggingFace' },
];

/** Whole-word boundary match — never matches substrings */
function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'i');
  return pattern.test(text);
}

/**
 * Extracts enriched tags from raw README text using keyword matching.
 * Case-insensitive. Returns deduplicated tags.
 * @param readmeText - Raw README content
 * @returns Array of matched tag strings
 */
export function extractTagsFromReadme(readmeText: string): string[] {
  const tags = new Set<string>();
  for (const { keywords, tag } of readmeKeywordMap) {
    if (keywords.some((kw) => matchesKeyword(readmeText, kw))) {
      tags.add(tag);
    }
  }
  return Array.from(tags);
}

/**
 * Generate enriched tags from a repo's GitHub metadata.
 * Pure function — no external calls, fully deterministic.
 * @param repo - Partial repo data (before enrichedTags are computed)
 */
export function generateTags(
  repo: Pick<
    EnrichedRepo,
    'language' | 'topics' | 'stars' | 'lastUpdated' | 'isFork' | 'isArchived'
  >
): string[] {
  const tags = new Set<string>();

  // Language tags
  if (repo.language && LANGUAGE_TAGS[repo.language]) {
    for (const tag of LANGUAGE_TAGS[repo.language]) {
      tags.add(tag);
    }
  }

  // Topic tags
  for (const topic of repo.topics) {
    const normalized = topic.toLowerCase().replace(/\s+/g, '-');
    if (TOPIC_TAGS[normalized]) {
      tags.add(TOPIC_TAGS[normalized]);
    }
  }

  // Metadata tags
  if (repo.stars > 1000) {
    tags.add('Popular');
  }

  const now = new Date();
  const updatedAt = new Date(repo.lastUpdated);
  const daysSinceUpdate = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceUpdate < 30) {
    tags.add('Active');
  } else if (daysSinceUpdate > 365) {
    tags.add('Inactive');
  }

  if (repo.isFork) {
    tags.add('Forked');
  } else {
    tags.add('Built by Me');
  }

  if (repo.isArchived) {
    tags.add('Archived');
  }

  return Array.from(tags);
}

/**
 * Enrich a partial repo object with generated tags from all sources:
 * GitHub topics, language, metadata, and README content.
 * Tags are deduplicated and sorted alphabetically.
 * @param partialRepo - Repo without enrichedTags or readmeSummary
 * @param readmeText - Raw README content, or null if unavailable
 */
export function enrichRepo(
  partialRepo: Omit<EnrichedRepo, 'enrichedTags' | 'readmeSummary' | 'parentStats' | 'recentCommits' | 'forkSync' | 'weeklyCommitCount' | 'languageBreakdown' | 'languagePercentages' | 'commitsLast7Days' | 'commitsLast30Days' | 'commitsLast90Days' | 'totalCommitsFetched' | 'primaryCategory' | 'allCategories' | 'commitStats' | 'latestRelease' | 'aiDevSkills' | 'pmSkills' | 'industries' | 'programmingLanguages' | 'builders'>,
  readmeText: string | null = null
): EnrichedRepo {
  const metaTags = generateTags(partialRepo);
  const readmeTags = readmeText ? extractTagsFromReadme(readmeText) : [];
  const allTags = [...new Set([...metaTags, ...readmeTags])].sort();
  return {
    ...partialRepo,
    enrichedTags: allTags,
    readmeSummary: null,
    parentStats: null,
    recentCommits: [],
    forkSync: null,
    weeklyCommitCount: 0,
    languageBreakdown: {},
    languagePercentages: {},
    commitsLast7Days: [],
    commitsLast30Days: [],
    commitsLast90Days: [],
    totalCommitsFetched: 0,
    primaryCategory: '',
    allCategories: [],
    commitStats: { today: 0, last7Days: 0, last30Days: 0, last90Days: 0, recentCommits: [] },
    latestRelease: null,
    aiDevSkills: [],
    pmSkills: [],
    industries: [],
    programmingLanguages: [],
    builders: [],
  };
}
