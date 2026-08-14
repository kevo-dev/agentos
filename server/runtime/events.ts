export type AgentOSEventName = `agent.${string}` | `task.${string}` | `tool.${string}` | `workflow.${string}` | `approval.${string}`;

export type AgentOSEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  name: AgentOSEventName;
  organizationId: number;
  aggregateId?: string;
  payload: TPayload;
  occurredAt: Date;
};

export interface EventBus {
  publish(event: AgentOSEvent): Promise<void>;
  subscribe(name: AgentOSEventName | `${string}.*`, handler: (event: AgentOSEvent) => Promise<void> | void): () => void;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<(event: AgentOSEvent) => Promise<void> | void>>();

  subscribe(name: AgentOSEventName | `${string}.*`, handler: (event: AgentOSEvent) => Promise<void> | void) {
    const handlers = this.handlers.get(name) ?? new Set();
    handlers.add(handler);
    this.handlers.set(name, handlers);
    return () => handlers.delete(handler);
  }

  async publish(event: AgentOSEvent) {
    const namespace = `${event.name.split(".")[0]}.*`;
    const listeners = Array.from(this.handlers.get(event.name) ?? []).concat(Array.from(this.handlers.get(namespace) ?? []));
    await Promise.all(listeners.map(listener => listener(event)));
  }
}
