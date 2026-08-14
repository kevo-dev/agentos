import { describe, expect, it } from "vitest";
import { assertTaskTransition } from "./agentosDb";

describe("AgentOS task lifecycle policy", () => {
  it("accepts the governed path through every required lifecycle state", () => {
    expect(() => assertTaskTransition("PENDING", "QUEUED")).not.toThrow();
    expect(() => assertTaskTransition("QUEUED", "RUNNING")).not.toThrow();
    expect(() => assertTaskTransition("RUNNING", "WAITING")).not.toThrow();
    expect(() => assertTaskTransition("WAITING", "BLOCKED")).not.toThrow();
    expect(() => assertTaskTransition("BLOCKED", "QUEUED")).not.toThrow();
    expect(() => assertTaskTransition("RUNNING", "REQUIRES_APPROVAL")).not.toThrow();
    expect(() => assertTaskTransition("REQUIRES_APPROVAL", "QUEUED")).not.toThrow();
    expect(() => assertTaskTransition("RUNNING", "COMPLETED")).not.toThrow();
    expect(() => assertTaskTransition("RUNNING", "FAILED")).not.toThrow();
    expect(() => assertTaskTransition("RUNNING", "CANCELLED")).not.toThrow();
  });

  it("rejects ungoverned and terminal transitions", () => {
    expect(() => assertTaskTransition("PENDING", "COMPLETED")).toThrow("not permitted");
    expect(() => assertTaskTransition("COMPLETED", "QUEUED")).toThrow("not permitted");
    expect(() => assertTaskTransition("FAILED", "RUNNING")).toThrow("not permitted");
    expect(() => assertTaskTransition("CANCELLED", "RUNNING")).toThrow("not permitted");
  });
});
