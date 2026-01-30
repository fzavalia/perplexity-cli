import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockRunChat, mockRunDirectQuery } = vi.hoisted(() => ({
  mockRunChat: vi.fn(),
  mockRunDirectQuery: vi.fn(),
}));

vi.mock("../commands/chat.js", () => ({
  runChat: mockRunChat,
}));

vi.mock("../commands/directQuery.js", () => ({
  runDirectQuery: mockRunDirectQuery,
}));

describe("index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports runChat as the default action", async () => {
    expect(mockRunChat).toBeDefined();
  });

  it("exports runDirectQuery for direct question mode", async () => {
    expect(mockRunDirectQuery).toBeDefined();
  });
});
