import { describe, it, expect } from "vitest";
import { ApiRouter, routeToMatcher } from "../src/router.js";

describe("ApiRouter & routeToMatcher (Security)", () => {
  it("escapes regex metacharacters in static route segments (Issue #14)", () => {
    const { pattern } = routeToMatcher("/api/v1.0");
    expect(pattern.test("/api/v1.0")).toBe(true);
    expect(pattern.test("/api/v1.0/")).toBe(true);
    expect(pattern.test("/api/v1x0")).toBe(false);
    expect(pattern.test("/api/v1-0")).toBe(false);
  });

  it("validates param names and rejects invalid characters like [user-id] (Issue #14)", () => {
    expect(() => routeToMatcher("/api/users/[user-id]")).toThrowError(
      /Invalid param name: "user-id"/
    );
    expect(() => routeToMatcher("/api/users/[123bad]")).toThrowError(
      /Invalid param name/
    );
  });

  it("throws on duplicate param names (Issue #14)", () => {
    expect(() => routeToMatcher("/api/[id]/sub/[id]")).toThrowError(
      /duplicate/
    );
  });

  it("prevents path traversal via %2F in single-segment params (Issue #12)", () => {
    const router = new ApiRouter();
    router.register("files/[name]/route.ts", {
      GET: () => new Response("ok"),
    });

    const matchNormal = router.match("/api/files/test.txt", "GET");
    expect(matchNormal).not.toBeNull();
    expect(matchNormal?.params.name).toBe("test.txt");

    const matchTraversal = router.match("/api/files/..%2F..%2F.env", "GET");
    expect(matchTraversal).toBeNull();
  });

  it("handles malformed percent-encoding safely without 500 crashes (Issue #12)", () => {
    const router = new ApiRouter();
    router.register("users/[id]/route.ts", {
      GET: () => new Response("ok"),
    });

    const matchMalformed = router.match("/api/users/%E0%A4%A", "GET");
    expect(matchMalformed).not.toBeNull();
    expect(matchMalformed?.malformed).toBe(true);
  });
});
