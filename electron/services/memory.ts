/**
 * VoxNote Memory Service
 * Handles project context, entity extraction, and semantic memory (RAG)
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getSupabase, getSession } from './supabase';
import OpenAI from 'openai';

// ============================================
// LOCAL PROJECT STORAGE
// ============================================

const getProjectsFilePath = (): string => {
  return path.join(app.getPath('userData'), 'projects.json');
};

function ensureProjectsFile(): void {
  const filePath = getProjectsFilePath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '[]', 'utf-8');
  }
}

function readLocalProjects(): Project[] {
  ensureProjectsFile();
  const filePath = getProjectsFilePath();

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as Project[];
  } catch {
    return [];
  }
}

function writeLocalProjects(projects: Project[]): void {
  ensureProjectsFile();
  const filePath = getProjectsFilePath();
  fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf-8');
}

async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await getSession();
    return !!session?.user?.id;
  } catch {
    return false;
  }
}

// Types
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  context?: string;
  stack?: string[];
  team?: TeamMember[];
  settings?: Record<string, unknown>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  name: string;
  role?: string;
  email?: string;
}

export interface Entity {
  id: string;
  project_id: string;
  user_id: string;
  type: 'person' | 'concept' | 'decision' | 'deadline' | 'task' | 'tool' | 'custom';
  name: string;
  context?: string;
  aliases: string[];
  mentions: number;
  first_mentioned: string;
  last_mentioned: string;
  metadata?: Record<string, unknown>;
  related_entities: string[];
  created_at: string;
  updated_at: string;
}

export interface MemoryChunk {
  id: string;
  project_id: string;
  user_id: string;
  artifact_id?: string;
  content: string;
  summary?: string;
  embedding?: number[];
  chunk_type: 'transcript' | 'decision' | 'action_item' | 'context' | 'summary';
  chunk_index: number;
  token_count?: number;
  metadata?: Record<string, unknown>;
  entity_ids: string[];
  created_at: string;
}

export interface MemorySearchResult {
  id: string;
  content: string;
  summary?: string;
  chunk_type: string;
  similarity: number;
  artifact_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface EntitySearchResult {
  id: string;
  type: string;
  name: string;
  context?: string;
  aliases: string[];
  mentions: number;
  similarity: number;
}

// OpenAI client for embeddings
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ============================================
// EMBEDDINGS
// ============================================

export async function generateEmbedding(text: string): Promise<number[]> {
  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

// ============================================
// PROJECTS
// ============================================

export async function listProjects(): Promise<Project[]> {
  // Check if authenticated - use Supabase if so, otherwise local
  const authenticated = await isAuthenticated();

  if (authenticated) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  // Use local storage
  const projects = readLocalProjects()
    .filter((p) => p.is_active)
    .sort((a, b) => {
      // Default projects first
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      // Then by updated_at
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  return projects;
}

export async function getProject(projectId: string): Promise<Project | null> {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  }

  // Use local storage
  const projects = readLocalProjects();
  return projects.find((p) => p.id === projectId) || null;
}

export async function createProject(project: {
  name: string;
  description?: string;
  context?: string;
  stack?: string[];
  team?: TeamMember[];
  is_default?: boolean;
}): Promise<Project> {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not initialized');

    const session = await getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');

    // If setting as default, unset other defaults first
    if (project.is_default) {
      await supabase
        .from('projects')
        .update({ is_default: false })
        .eq('user_id', session.user.id);
    }

    const { data, error } = await supabase
      .from('projects')
      .insert({
        user_id: session.user.id,
        name: project.name,
        description: project.description,
        context: project.context,
        stack: project.stack,
        team: project.team || [],
        is_default: project.is_default || false,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Use local storage
  const projects = readLocalProjects();
  const now = new Date().toISOString();

  // If setting as default, unset other defaults
  if (project.is_default) {
    projects.forEach((p) => {
      p.is_default = false;
    });
  }

  const newProject: Project = {
    id: uuidv4(),
    user_id: 'local',
    name: project.name,
    description: project.description,
    context: project.context,
    stack: project.stack,
    team: project.team || [],
    settings: {},
    is_active: true,
    is_default: project.is_default || false,
    created_at: now,
    updated_at: now,
  };

  projects.push(newProject);
  writeLocalProjects(projects);
  return newProject;
}

export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>
): Promise<Project> {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not initialized');

    const session = await getSession();
    if (!session?.user?.id) throw new Error('Not authenticated');

    // If setting as default, unset other defaults first
    if (updates.is_default) {
      await supabase
        .from('projects')
        .update({ is_default: false })
        .eq('user_id', session.user.id)
        .neq('id', projectId);
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', projectId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Use local storage
  const projects = readLocalProjects();
  const index = projects.findIndex((p) => p.id === projectId);
  if (index === -1) throw new Error('Project not found');

  // If setting as default, unset other defaults
  if (updates.is_default) {
    projects.forEach((p, i) => {
      if (i !== index) p.is_default = false;
    });
  }

  projects[index] = {
    ...projects[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };

  writeLocalProjects(projects);
  return projects[index];
}

export async function deleteProject(projectId: string): Promise<void> {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not initialized');

    // Soft delete - just mark as inactive
    const { error } = await supabase
      .from('projects')
      .update({ is_active: false })
      .eq('id', projectId);

    if (error) throw error;
    return;
  }

  // Use local storage - soft delete
  const projects = readLocalProjects();
  const index = projects.findIndex((p) => p.id === projectId);
  if (index !== -1) {
    projects[index].is_active = false;
    writeLocalProjects(projects);
  }
}

export async function getDefaultProject(): Promise<Project | null> {
  const authenticated = await isAuthenticated();

  if (authenticated) {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not initialized');

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  }

  // Use local storage
  const projects = readLocalProjects();
  return projects.find((p) => p.is_default && p.is_active) || null;
}

// ============================================
// ENTITIES
// ============================================

export async function listEntities(
  projectId: string,
  type?: Entity['type']
): Promise<Entity[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  let query = supabase
    .from('entities')
    .select('*')
    .eq('project_id', projectId)
    .order('mentions', { ascending: false });

  if (type) {
    query = query.eq('type', type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function findEntities(
  projectId: string,
  searchText: string,
  limit: number = 10
): Promise<EntitySearchResult[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.rpc('find_entities', {
    p_project_id: projectId,
    p_search_text: searchText,
    p_limit: limit,
  });

  if (error) throw error;
  return data || [];
}

export async function createEntity(entity: {
  project_id: string;
  type: Entity['type'];
  name: string;
  context?: string;
  aliases?: string[];
  metadata?: Record<string, unknown>;
}): Promise<Entity> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const session = await getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('entities')
    .insert({
      ...entity,
      user_id: session.user.id,
      aliases: entity.aliases || [],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEntity(
  entityId: string,
  updates: Partial<Omit<Entity, 'id' | 'project_id' | 'user_id' | 'created_at'>>
): Promise<Entity> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('entities')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', entityId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function incrementEntityMention(entityId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  // Get current mentions count
  const { data: entity } = await supabase
    .from('entities')
    .select('mentions')
    .eq('id', entityId)
    .single();

  await supabase
    .from('entities')
    .update({
      mentions: (entity?.mentions || 0) + 1,
      last_mentioned: new Date().toISOString(),
    })
    .eq('id', entityId);
}

export async function upsertEntity(
  projectId: string,
  entity: {
    type: Entity['type'];
    name: string;
    context?: string;
    aliases?: string[];
  }
): Promise<Entity> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  // Check if entity exists
  const existing = await findEntities(projectId, entity.name, 1);

  if (existing.length > 0 && existing[0].similarity > 0.8) {
    // Update existing entity
    await incrementEntityMention(existing[0].id);

    // Merge context if new context provided
    if (entity.context) {
      const { data } = await supabase
        .from('entities')
        .select('context')
        .eq('id', existing[0].id)
        .single();

      const mergedContext = data?.context
        ? `${data.context}\n${entity.context}`
        : entity.context;

      await updateEntity(existing[0].id, { context: mergedContext });
    }

    const { data } = await supabase
      .from('entities')
      .select('*')
      .eq('id', existing[0].id)
      .single();

    return data!;
  }

  // Create new entity
  return createEntity({ project_id: projectId, ...entity });
}

// ============================================
// MEMORY CHUNKS
// ============================================

export async function createMemoryChunk(chunk: {
  project_id: string;
  artifact_id?: string;
  content: string;
  summary?: string;
  chunk_type: MemoryChunk['chunk_type'];
  chunk_index?: number;
  metadata?: Record<string, unknown>;
  entity_ids?: string[];
}): Promise<MemoryChunk> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const session = await getSession();
  if (!session?.user?.id) throw new Error('Not authenticated');

  // Generate embedding
  const embedding = await generateEmbedding(chunk.content);

  // Estimate token count (rough estimate: 4 chars per token)
  const tokenCount = Math.ceil(chunk.content.length / 4);

  const { data, error } = await supabase
    .from('memory_chunks')
    .insert({
      ...chunk,
      user_id: session.user.id,
      embedding,
      token_count: tokenCount,
      chunk_index: chunk.chunk_index || 0,
      entity_ids: chunk.entity_ids || [],
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function searchMemory(
  projectId: string,
  query: string,
  limit: number = 5,
  threshold: number = 0.7
): Promise<MemorySearchResult[]> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  // Generate embedding for query
  const embedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc('search_memory', {
    p_project_id: projectId,
    p_embedding: embedding,
    p_limit: limit,
    p_threshold: threshold,
  });

  if (error) throw error;
  return data || [];
}

export async function deleteMemoryChunksForArtifact(artifactId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('memory_chunks')
    .delete()
    .eq('artifact_id', artifactId);

  if (error) throw error;
}

// ============================================
// ENTITY EXTRACTION (LLM-powered)
// ============================================

const ENTITY_EXTRACTION_PROMPT = `Analysiere den folgenden Text und extrahiere wichtige Entities.

Kategorien:
- person: Namen von Personen (mit Rolle falls erkennbar)
- concept: Wichtige Konzepte, Technologien, Produkte
- decision: Getroffene Entscheidungen
- deadline: Termine und Deadlines
- task: Aufgaben und TODOs
- tool: Tools, Software, Frameworks

Antworte NUR mit validem JSON:
{
  "entities": [
    {
      "type": "person|concept|decision|deadline|task|tool",
      "name": "Name der Entity",
      "context": "Kurze Beschreibung/Kontext (max 100 Zeichen)",
      "aliases": ["alternative Namen falls vorhanden"]
    }
  ]
}

Extrahiere nur die wichtigsten Entities (max 10). Ignoriere generische Begriffe.`;

export interface ExtractedEntity {
  type: Entity['type'];
  name: string;
  context?: string;
  aliases?: string[];
}

export async function extractEntities(text: string): Promise<ExtractedEntity[]> {
  const openai = getOpenAI();

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: ENTITY_EXTRACTION_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    return parsed.entities || [];
  } catch (error) {
    console.error('Entity extraction failed:', error);
    return [];
  }
}

// ============================================
// CONTEXT BUILDING
// ============================================

export interface ProjectContext {
  project: Project;
  recentEntities: Entity[];
  relevantMemories: MemorySearchResult[];
}

export async function buildProjectContext(
  projectId: string,
  currentTranscript: string,
  maxMemories: number = 5
): Promise<ProjectContext | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  // Get mentioned entities
  const words = currentTranscript.split(/\s+/);
  const entityPromises = words
    .filter((w) => w.length > 2)
    .slice(0, 20) // Limit to first 20 words
    .map((word) => findEntities(projectId, word, 2));

  const entityResults = await Promise.all(entityPromises);
  const allEntities = entityResults.flat();

  // Deduplicate and sort by mentions
  const entityMap = new Map<string, Entity>();
  for (const e of allEntities) {
    if (!entityMap.has(e.id) || e.mentions > entityMap.get(e.id)!.mentions) {
      entityMap.set(e.id, e as unknown as Entity);
    }
  }
  const recentEntities = Array.from(entityMap.values())
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 10);

  // Get relevant memories via semantic search
  const relevantMemories = await searchMemory(
    projectId,
    currentTranscript,
    maxMemories,
    0.6 // Lower threshold for more results
  );

  return {
    project,
    recentEntities,
    relevantMemories,
  };
}

export function formatContextForLLM(context: ProjectContext): string {
  let formatted = `## Projekt: ${context.project.name}\n`;

  if (context.project.description) {
    formatted += `${context.project.description}\n`;
  }

  if (context.project.context) {
    formatted += `\n### Projekt-Kontext:\n${context.project.context}\n`;
  }

  if (context.project.team && context.project.team.length > 0) {
    formatted += `\n### Team:\n`;
    for (const member of context.project.team) {
      formatted += `- ${member.name}${member.role ? ` (${member.role})` : ''}\n`;
    }
  }

  if (context.project.stack && context.project.stack.length > 0) {
    formatted += `\n### Tech Stack: ${context.project.stack.join(', ')}\n`;
  }

  if (context.recentEntities.length > 0) {
    formatted += `\n### Bekannte Personen/Konzepte:\n`;
    for (const entity of context.recentEntities) {
      formatted += `- **${entity.name}** (${entity.type})`;
      if (entity.context) {
        formatted += `: ${entity.context}`;
      }
      formatted += '\n';
    }
  }

  if (context.relevantMemories.length > 0) {
    formatted += `\n### Relevante frühere Gespräche:\n`;
    for (const memory of context.relevantMemories) {
      const date = new Date(memory.created_at).toLocaleDateString('de-DE');
      formatted += `- [${date}] ${memory.summary || memory.content.slice(0, 100)}...\n`;
    }
  }

  return formatted;
}

// ============================================
// PROCESS ARTIFACT (Full Pipeline)
// ============================================

export async function processArtifactForMemory(
  projectId: string,
  artifactId: string,
  transcript: string,
  resultMarkdown: string
): Promise<void> {
  // 1. Extract entities from transcript
  const extractedEntities = await extractEntities(transcript);

  // 2. Upsert entities
  const entityIds: string[] = [];
  for (const entity of extractedEntities) {
    try {
      const saved = await upsertEntity(projectId, entity);
      entityIds.push(saved.id);
    } catch (error) {
      console.error('Failed to save entity:', entity.name, error);
    }
  }

  // 3. Create memory chunk for transcript
  await createMemoryChunk({
    project_id: projectId,
    artifact_id: artifactId,
    content: transcript,
    summary: transcript.slice(0, 200),
    chunk_type: 'transcript',
    chunk_index: 0,
    entity_ids: entityIds,
    metadata: { source: 'voice' },
  });

  // 4. Extract decisions and action items from result
  const decisions = extractDecisionsFromMarkdown(resultMarkdown);
  for (let i = 0; i < decisions.length; i++) {
    await createMemoryChunk({
      project_id: projectId,
      artifact_id: artifactId,
      content: decisions[i],
      chunk_type: 'decision',
      chunk_index: i + 1,
      entity_ids: entityIds,
    });
  }

  const actionItems = extractActionItemsFromMarkdown(resultMarkdown);
  for (let i = 0; i < actionItems.length; i++) {
    await createMemoryChunk({
      project_id: projectId,
      artifact_id: artifactId,
      content: actionItems[i],
      chunk_type: 'action_item',
      chunk_index: decisions.length + i + 1,
      entity_ids: entityIds,
    });
  }
}

// Helper functions to extract structured content from markdown
function extractDecisionsFromMarkdown(markdown: string): string[] {
  const decisions: string[] = [];

  // Look for "Entscheidungen" or "Decisions" section
  const decisionMatch = markdown.match(/##\s*(Entscheidungen?|Decisions?)\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (decisionMatch) {
    const lines = decisionMatch[2].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, '').trim();
      if (cleaned && cleaned.length > 10) {
        decisions.push(cleaned);
      }
    }
  }

  return decisions;
}

function extractActionItemsFromMarkdown(markdown: string): string[] {
  const actionItems: string[] = [];

  // Look for checkbox items
  const checkboxRegex = /- \[[ x]\]\s*(.+)/gi;
  let match;
  while ((match = checkboxRegex.exec(markdown)) !== null) {
    const item = match[1].trim();
    if (item && item.length > 5) {
      actionItems.push(item);
    }
  }

  return actionItems;
}

export default {
  // Projects
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getDefaultProject,

  // Entities
  listEntities,
  findEntities,
  createEntity,
  updateEntity,
  upsertEntity,
  extractEntities,

  // Memory
  createMemoryChunk,
  searchMemory,
  deleteMemoryChunksForArtifact,

  // Context
  buildProjectContext,
  formatContextForLLM,

  // Pipeline
  processArtifactForMemory,
  generateEmbedding,
};
