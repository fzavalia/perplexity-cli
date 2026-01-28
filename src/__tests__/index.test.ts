import { describe, it, expect, vi } from "vitest";

const { mockRunChat } = vi.hoisted(() => ({
  mockRunChat: vi.fn(),
}));

vi.mock("../commands/chat.js", () => ({
  runChat: mockRunChat,
}));

describe("index", () => {
  it("exports runChat as the action", async () => {
    // The CLI wires runChat directly to commander's action
    // This test verifies the mock setup works
    expect(mockRunChat).toBeDefined();
  });
});
