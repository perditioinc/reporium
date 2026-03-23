# AI Knowledge Graph Taxonomy

> Version: 2.0 — Taxonomy Expansion (Issue #17)
> Replaces: 12 AI Dev Coverage badges → 28 Skill Areas

## Overview

This document defines the canonical AI taxonomy for Reporium: 28 skill areas organized into 6 lifecycle groups, 58 categories for sidebar navigation, and ~200 curated AI-specific tags.

---

## Level 1: Skill Areas (28 total, 6 lifecycle groups)

### Group 1 — Foundation & Training
| Skill Area | Description |
|---|---|
| Foundation Model Architecture | Transformer variants, attention mechanisms, model pre-training, scaling laws |
| Fine-tuning & Alignment | SFT, RLHF, DPO, LoRA, PEFT, instruction tuning, RLAIF |
| Data Engineering | Dataset curation, cleaning pipelines, data versioning, feature stores |
| Synthetic Data | LLM-generated datasets, data augmentation, simulation, distillation |

### Group 2 — Inference & Deployment
| Skill Area | Description |
|---|---|
| Inference & Serving | vLLM, TensorRT, batching, KV cache, serving frameworks, model APIs |
| Model Compression | Quantization, pruning, distillation, sparsity, mixed precision |
| Edge AI | On-device inference, mobile ML, embedded AI, WASM/WebGPU |

### Group 3 — LLM Application Layer
| Skill Area | Description |
|---|---|
| Agents & Orchestration | Agent loops, multi-agent systems, task planners, LangGraph, AutoGen |
| RAG & Retrieval | Vector search, hybrid retrieval, chunking strategies, re-ranking |
| Context Engineering | Context windows, long-context, memory systems, context compression |
| Tool Use | Function calling, code execution, browser use, MCP, plugin systems |
| Structured Output | JSON mode, schema enforcement, constrained decoding, extraction |
| Prompt Engineering | System prompts, chain-of-thought, few-shot, prompt optimization |
| Knowledge Graphs | Entity extraction, graph construction, ontologies, GraphRAG |

### Group 4 — Eval / Safety / Ops
| Skill Area | Description |
|---|---|
| Evaluation | Benchmarks, LLM-as-judge, evals frameworks, regression testing |
| Security & Guardrails | Jailbreak defense, content moderation, red teaming, prompt injection |
| Observability | Tracing, logging, dashboards, cost tracking, latency monitoring |
| MLOps | Experiment tracking, model registry, CI/CD for ML, deployment automation |
| AI Governance | Bias detection, compliance, model cards, audit logging, fairness |

### Group 5 — Modality-Specific
| Skill Area | Description |
|---|---|
| Computer Vision | Image classification, object detection, segmentation, vision transformers |
| Speech & Audio | ASR, TTS, audio generation, speaker diarization, audio LLMs |
| Generative Media | Image/video generation, diffusion models, creative AI, 3D generation |
| NLP | Text classification, NER, summarization, translation, classical NLP |
| Multimodal | Vision-language models, audio-visual, document understanding, VLMs |

### Group 6 — Applied AI
| Skill Area | Description |
|---|---|
| Coding Assistants | Code generation, completion, review, debugging, test generation |
| Robotics | Embodied AI, robot learning, sim-to-real, manipulation, navigation |
| AI for Science | Protein folding, drug discovery, climate, materials science, math |
| Recommendation Systems | Collaborative filtering, content-based, LLM recommendations |

---

## Level 2: Categories (58 total)

### Foundation & Training Categories
- Transformer Architecture
- Attention Mechanisms
- Pre-training & Scaling
- Fine-tuning Methods (LoRA, QLoRA, PEFT)
- RLHF & Alignment
- DPO & Preference Learning
- Dataset Curation
- Data Pipelines
- Synthetic Dataset Generation
- Data Augmentation

### Inference & Deployment Categories
- Inference Engines (vLLM, TGI)
- Serving Infrastructure
- KV Cache Optimization
- Quantization (GPTQ, AWQ, GGUF)
- Model Pruning
- Knowledge Distillation
- On-Device Inference
- Mobile & Edge ML
- WebGPU / WASM Inference

### LLM Application Layer Categories
- Agent Frameworks
- Multi-Agent Systems
- RAG Pipelines
- Vector Databases
- Chunking & Embedding
- Memory Systems
- Function Calling
- MCP Servers & Clients
- Browser Automation
- JSON / Structured Extraction
- Prompt Optimization
- Chain-of-Thought
- Graph Databases
- Entity Extraction

### Eval / Safety / Ops Categories
- Eval Frameworks
- Benchmarking
- LLM-as-Judge
- Content Moderation
- Red Teaming
- Prompt Injection Defense
- LLM Tracing & Logging
- Cost & Latency Monitoring
- Experiment Tracking
- Model Registry
- ML CI/CD
- Bias & Fairness
- Model Cards & Compliance

### Modality-Specific Categories
- Image Classification
- Object Detection
- Semantic Segmentation
- Vision Transformers
- Speech Recognition (ASR)
- Text-to-Speech (TTS)
- Audio Generation
- Diffusion Models
- Image Generation
- Video Generation
- Text Classification
- Named Entity Recognition
- Machine Translation
- Vision-Language Models
- Document Understanding

### Applied AI Categories
- Code Generation
- Code Review & Analysis
- Robot Learning
- Simulation & Sim-to-Real
- Protein Structure Prediction
- Drug Discovery
- Collaborative Filtering

---

## Level 3: Tag Curation Rules (~200 tags)

### Keep (AI-specific, high signal)
Tags to retain: transformer, attention, llm, rag, fine-tuning, lora, qlora, peft, rlhf, dpo, quantization, distillation, pruning, vllm, tgi, inference, embeddings, vector-search, langchain, langgraph, autogen, openai, anthropic, claude, gpt, gemini, llama, mistral, phi, mixtral, mcp, function-calling, structured-output, json-schema, prompt-engineering, chain-of-thought, agent, multi-agent, tool-use, rag-pipeline, chunking, re-ranking, faiss, qdrant, weaviate, pinecone, chroma, guardrails, red-teaming, jailbreak, content-moderation, evals, benchmarks, openai-evals, lm-evaluation-harness, mlflow, wandb, dvc, mlops, diffusion, stable-diffusion, flux, comfyui, controlnet, whisper, tts, asr, vision-language, clip, sam, yolo, detectron, segment-anything, protein-folding, alphafold, drug-discovery, robotics, ros, sim-to-real, recommendation, collaborative-filtering, knowledge-graph, graphrag, neo4j, edge-ai, mobile-ml, onnx, tensorrt, webgpu, synthetic-data, data-augmentation, dataset

### Remove (noise — not AI-specific)
Tags to prune: python, javascript, typescript, rust, go, java, c++, react, nextjs, nodejs, express, fastapi, flask, django, postgresql, mysql, mongodb, redis, docker, kubernetes, aws, gcp, azure, terraform, nginx, linux, macos, windows, git, github, api, rest, graphql, grpc, websocket, cli, sdk, library, framework, tutorial, example, demo, template, boilerplate, starter, awesome, list, collection, open-source, free, fast, simple, easy, lightweight, minimal

### Curation Policy
1. A tag must describe an AI/ML concept, tool, or technique — not a general programming language or infrastructure term
2. Repo-specific tags (one-off names, version numbers) are removed automatically
3. Tags appearing on fewer than 3 repos are candidates for removal unless highly specific (e.g., `alphafold`)
4. Aliases are collapsed: `gpt-4` → `gpt`, `claude-3` → `claude`, `llama-2` → `llama`

---

## Migration Plan

### Phase 1 — Schema (Week 1)
- Update `skillAreas` enum in DB schema from 12 to 28 values
- Add `lifecycleGroup` field to category model
- Run migration on staging

### Phase 2 — Re-enrichment (Week 2)
- Update Claude enrichment prompt with new taxonomy
- Re-enrich all 1,406 repos (estimated ~$4.20 at current token costs)
- Validate category distribution — target no skill area with >15% of repos

### Phase 3 — Frontend (Week 3)
- Update badge grid from 12 → 28 skill areas
- Group badges by lifecycle group (collapsible sections)
- Update sidebar category filter to 58 categories
- Tag cloud shows only curated ~200 tags

### Phase 4 — Cleanup (Week 4)
- Prune ~440 noise tags from DB
- Update API `/categories` and `/tags` endpoints
- Add unit tests for taxonomy validation
- Deploy to production + verify on reporium.com

---

## References
- Based on: MAD 2025, HuggingFace Hub categories, Papers with Code taxonomy, a16z AI stack
- Research doc: `ai-development-taxonomy.md` (internal)
- GitHub Issue: [#17](https://github.com/perditioinc/reporium/issues/17)
