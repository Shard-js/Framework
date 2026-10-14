import { describe, it, expect } from "vitest";
import {
  validateDockerTag,
  validateDockerPort,
  DOCKERFILE_CONTENT,
  DOCKERIGNORE_CONTENT,
} from "../src/commands/docker.js";

describe("Docker Security & Hardening (Issues #6 & #15)", () => {
  it("validates docker image tags and prevents shell injection metacharacters (Issue #6)", () => {
    expect(() => validateDockerTag("shard-bot:latest")).not.toThrow();
    expect(() => validateDockerTag("my-org/my-bot:v1.0.0")).not.toThrow();
    expect(() => validateDockerTag("bot:123")).not.toThrow();

    expect(() => validateDockerTag("x; id > /tmp/pwned #")).toThrowError(/Invalid Docker tag/);
    expect(() => validateDockerTag("latest $(whoami)")).toThrowError(/Invalid Docker tag/);
    expect(() => validateDockerTag("bot && rm -rf /")).toThrowError(/Invalid Docker tag/);
  });

  it("validates docker port numbers strictly (Issue #6)", () => {
    expect(validateDockerPort(3000)).toBe(3000);
    expect(validateDockerPort("8080")).toBe(8080);

    expect(() => validateDockerPort("3000 $(id)")).toThrowError(/Invalid port/);
    expect(() => validateDockerPort(0)).toThrowError(/Invalid port/);
    expect(() => validateDockerPort(70000)).toThrowError(/Invalid port/);
    expect(() => validateDockerPort("not-a-port")).toThrowError(/Invalid port/);
  });

  it("ensures .dockerignore contains secret files (Issue #15)", () => {
    expect(DOCKERIGNORE_CONTENT).toContain(".env");
    expect(DOCKERIGNORE_CONTENT).toContain(".git");
    expect(DOCKERIGNORE_CONTENT).toContain("node_modules");
    expect(DOCKERIGNORE_CONTENT).toContain(".shard/cache");
  });

  it("ensures Dockerfile uses unprivileged user and pinned pnpm (Issue #15)", () => {
    expect(DOCKERFILE_CONTENT).toContain("USER node");
    expect(DOCKERFILE_CONTENT).toContain("corepack prepare pnpm@");
    expect(DOCKERFILE_CONTENT).toContain("--frozen-lockfile");
    expect(DOCKERFILE_CONTENT).toContain("--chown=node:node");
    expect(DOCKERFILE_CONTENT).toContain("CMD [\"node\", \".shard/dist/runner.js\"]");
  });

  it("ensures Dockerfile contains native HTTP healthcheck", () => {
    expect(DOCKERFILE_CONTENT).toContain("HEALTHCHECK");
    expect(DOCKERFILE_CONTENT).toContain("/api/health");
  });
});
