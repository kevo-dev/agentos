export type MemoryModule = "ConversationMemory" | "WorkingMemory" | "LongTermMemory" | "EpisodicMemory" | "SemanticMemory";

export type MemoryRecord = {
  id: string;
  organizationId: number;
  module: MemoryModule;
  scope: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  expiresAt?: Date;
};

export interface VectorStore {
  upsert(record: MemoryRecord): Promise<void>;
  search(input: { organizationId: number; scope: string; query: string; limit: number }): Promise<MemoryRecord[]>;
  remove(id: string): Promise<void>;
}

export class InMemoryVectorStore implements VectorStore {
  private readonly records = new Map<string, MemoryRecord>();
  async upsert(record: MemoryRecord) { this.records.set(record.id, record); }
  async search(input: { organizationId: number; scope: string; query: string; limit: number }) {
    const query = input.query.toLowerCase();
    return Array.from(this.records.values())
      .filter(record => record.organizationId === input.organizationId && record.scope === input.scope && (!record.expiresAt || record.expiresAt > new Date()))
      .map(record => ({ record, score: record.content.toLowerCase().includes(query) ? 1 : 0 }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || b.record.createdAt.getTime() - a.record.createdAt.getTime())
      .slice(0, input.limit)
      .map(item => item.record);
  }
  async remove(id: string) { this.records.delete(id); }
}

export class MemoryManager {
  constructor(private readonly vectorStore: VectorStore) {}

  async write(record: MemoryRecord) { await this.vectorStore.upsert(record); }
  async recall(input: { organizationId: number; scope: string; query: string; limit?: number }) {
    return this.vectorStore.search({ ...input, limit: input.limit ?? 8 });
  }
  async forget(id: string) { await this.vectorStore.remove(id); }
}

export type ConversationMemory = Extract<MemoryRecord, { module: "ConversationMemory" }>;
export type WorkingMemory = Extract<MemoryRecord, { module: "WorkingMemory" }>;
export type LongTermMemory = Extract<MemoryRecord, { module: "LongTermMemory" }>;
export type EpisodicMemory = Extract<MemoryRecord, { module: "EpisodicMemory" }>;
export type SemanticMemory = Extract<MemoryRecord, { module: "SemanticMemory" }>;
