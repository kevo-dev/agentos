export type JobStatus = "QUEUED" | "RUNNING" | "RETRYING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type AgentOSJob<TPayload = Record<string, unknown>> = {
  id: string;
  organizationId: number;
  type: string;
  payload: TPayload;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: Date;
};

export interface JobQueue {
  enqueue<TPayload>(job: Omit<AgentOSJob<TPayload>, "status" | "attempts">): Promise<AgentOSJob<TPayload>>;
  consume(handler: (job: AgentOSJob) => Promise<void>): Promise<number>;
  retry(jobId: string): Promise<void>;
  cancel(jobId: string): Promise<void>;
}

/** Development adapter only. Production workers should provide a durable JobQueue adapter. */
export class InMemoryJobQueue implements JobQueue {
  private readonly jobs = new Map<string, AgentOSJob>();

  async enqueue<TPayload>(job: Omit<AgentOSJob<TPayload>, "status" | "attempts">): Promise<AgentOSJob<TPayload>> {
    const record: AgentOSJob<TPayload> = { ...job, status: "QUEUED", attempts: 0 };
    this.jobs.set(record.id, record as AgentOSJob);
    return record;
  }

  async consume(handler: (job: AgentOSJob) => Promise<void>) {
    const ready = Array.from(this.jobs.values()).filter(job => job.status === "QUEUED" && job.runAfter <= new Date());
    for (const job of ready) {
      job.status = "RUNNING";
      try {
        await handler(job);
        job.status = "COMPLETED";
      } catch (error) {
        job.attempts += 1;
        job.status = job.attempts < job.maxAttempts ? "RETRYING" : "FAILED";
      }
    }
    return ready.length;
  }

  async retry(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || ["COMPLETED", "CANCELLED"].includes(job.status)) throw new Error("Job cannot be retried.");
    job.status = "QUEUED";
  }

  async cancel(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job || ["COMPLETED", "FAILED"].includes(job.status)) throw new Error("Job cannot be cancelled.");
    job.status = "CANCELLED";
  }
}
