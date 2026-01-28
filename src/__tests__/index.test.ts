import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockRunChat, mockRunQuery } = vi.hoisted(() => ({
  mockRunChat: vi.fn(),
  mockRunQuery: vi.fn(),
}));

vi.mock("../commands/chat.js", () => ({
  runChat: mockRunChat,
}));

vi.mock("../commands/query.js", () => ({
  runQuery: mockRunQuery,
}));

import { handleAction } from "../index.js";

let exitSpy: ReturnType<typeof vi.spyOn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe("handleAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunChat.mockResolvedValue(undefined);
    mockRunQuery.mockResolvedValue(undefined);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls runChat when no question", async () => {
    await handleAction(undefined, {});
    expect(mockRunChat).toHaveBeenCalled();
    expect(mockRunQuery).not.toHaveBeenCalled();
  });

  it("calls runQuery with question", async () => {
    await handleAction("What is TypeScript?", {});
    expect(mockRunQuery).toHaveBeenCalledWith("What is TypeScript?", undefined);
    expect(mockRunChat).not.toHaveBeenCalled();
  });

  it("calls runQuery with question and followUp", async () => {
    await handleAction("Follow up question", { followUp: "conv-123" });
    expect(mockRunQuery).toHaveBeenCalledWith("Follow up question", "conv-123");
  });

  it("exits with error when --follow-up without question", async () => {
    await expect(handleAction(undefined, { followUp: "conv-123" })).rejects.toThrow(
      "process.exit"
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("--follow-up requires a question")
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
