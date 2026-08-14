/** Provider-neutral external infrastructure boundaries. Implement these in the worker/runtime deployment. */
export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, options?: { ttlSeconds?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface ObjectStorage {
  put(input: { key: string; bytes: Uint8Array; contentType: string }): Promise<{ key: string; url?: string }>;
  get(input: { key: string }): Promise<{ bytes: Uint8Array; contentType?: string }>;
  remove(key: string): Promise<void>;
}

export type ScheduleDefinition = {
  id: string;
  organizationId: number;
  cron: string;
  timezone: string;
  target: { type: "workflow.execute" | "task.enqueue"; id: string };
};

export interface Scheduler {
  register(schedule: ScheduleDefinition): Promise<{ externalId: string }>;
  pause(externalId: string): Promise<void>;
  remove(externalId: string): Promise<void>;
}

export type ApiKeyVerifier = {
  verify(input: { organizationId: number; token: string; requiredScopes: string[] }): Promise<{ keyId: string; scopes: string[] }>;
};
