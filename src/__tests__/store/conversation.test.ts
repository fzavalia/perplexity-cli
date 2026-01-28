import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createConversationStore } from "../../store/conversation.js";
import type { ConversationStore } from "../../store/conversation.js";

let tempDir: string;
let store: ConversationStore;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "conv-test-"));
  store = createConversationStore(tempDir);
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("ensureDirectory", () => {
  it("creates the directory and empty index.json", async () => {
    await store.ensureDirectory();
    const content = await readFile(join(tempDir, "index.json"), "utf-8");
    expect(JSON.parse(content)).toEqual([]);
  });

  it("does not overwrite existing index", async () => {
    await store.ensureDirectory();
    const conv = await store.create("First");
    await store.ensureDirectory();
    const content = await readFile(join(tempDir, "index.json"), "utf-8");
    const summaries = JSON.parse(content);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(conv.id);
  });

  it("is idempotent", async () => {
    await store.ensureDirectory();
    await store.ensureDirectory();
    await store.ensureDirectory();
    const content = await readFile(join(tempDir, "index.json"), "utf-8");
    expect(JSON.parse(content)).toEqual([]);
  });
});

describe("create", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("returns correct shape with 10-char id", async () => {
    const conv = await store.create("Hello world");
    expect(conv.id).toHaveLength(10);
    expect(conv.title).toBe("Hello world");
    expect(conv.createdAt).toBeTruthy();
    expect(conv.updatedAt).toBeTruthy();
    expect(conv.messages).toEqual([]);
  });

  it("truncates title at 60 chars with ellipsis", async () => {
    const longTitle = "a".repeat(100);
    const conv = await store.create(longTitle);
    expect(conv.title).toHaveLength(60);
    expect(conv.title.endsWith("…")).toBe(true);
  });

  it("persists conversation JSON file", async () => {
    const conv = await store.create("Test");
    const content = await readFile(join(tempDir, `${conv.id}.json`), "utf-8");
    const loaded = JSON.parse(content);
    expect(loaded.id).toBe(conv.id);
    expect(loaded.title).toBe("Test");
  });

  it("adds entry to index", async () => {
    const conv = await store.create("Test");
    const summaries = await store.listSummaries();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(conv.id);
  });
});

describe("load", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("loads conversation by id", async () => {
    const conv = await store.create("Test");
    const loaded = await store.load(conv.id);
    expect(loaded.id).toBe(conv.id);
    expect(loaded.title).toBe("Test");
  });

  it("rejects path traversal with ../", async () => {
    await expect(store.load("../etc/passwd")).rejects.toThrow("Invalid conversation id");
  });

  it("rejects path traversal with /", async () => {
    await expect(store.load("/etc/passwd")).rejects.toThrow("Invalid conversation id");
  });

  it("rejects path traversal with backslash", async () => {
    await expect(store.load("..\\etc")).rejects.toThrow("Invalid conversation id");
  });

  it("throws on missing file", async () => {
    await expect(store.load("nonexistent")).rejects.toThrow();
  });

  it("throws on corrupted JSON", async () => {
    const conv = await store.create("Test");
    const { writeFile: wf } = await import("node:fs/promises");
    await wf(join(tempDir, `${conv.id}.json`), "not valid json");
    await expect(store.load(conv.id)).rejects.toThrow();
  });
});

describe("save", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("updates file on disk", async () => {
    const conv = await store.create("Test");
    store.addMessage(conv, "user", "hello");
    await store.save(conv);
    const loaded = await store.load(conv.id);
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0].content).toBe("hello");
  });

  it("updates updatedAt", async () => {
    const conv = await store.create("Test");
    const originalUpdatedAt = conv.updatedAt;
    await new Promise((r) => setTimeout(r, 10));
    await store.save(conv);
    expect(conv.updatedAt).not.toBe(originalUpdatedAt);
  });

  it("updates index entry", async () => {
    const conv = await store.create("Test");
    await new Promise((r) => setTimeout(r, 10));
    await store.save(conv);
    const summaries = await store.listSummaries();
    expect(summaries[0].updatedAt).toBe(conv.updatedAt);
  });
});

describe("addMessage", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("appends message to conversation", async () => {
    const conv = await store.create("Test");
    store.addMessage(conv, "user", "hello");
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].content).toBe("hello");
  });

  it("returns message with id and createdAt", async () => {
    const conv = await store.create("Test");
    const msg = store.addMessage(conv, "user", "hello");
    expect(msg.id).toBeTruthy();
    expect(msg.id).toHaveLength(10);
    expect(msg.createdAt).toBeTruthy();
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("hello");
  });

  it("generates unique ids", async () => {
    const conv = await store.create("Test");
    const msg1 = store.addMessage(conv, "user", "hello");
    const msg2 = store.addMessage(conv, "assistant", "hi");
    expect(msg1.id).not.toBe(msg2.id);
  });

  it("is synchronous (does not write to disk)", async () => {
    const conv = await store.create("Test");
    store.addMessage(conv, "user", "hello");
    // Load from disk — should still have 0 messages since addMessage doesn't persist
    const loaded = await store.load(conv.id);
    expect(loaded.messages).toHaveLength(0);
  });
});

describe("listSummaries", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("returns empty array when no conversations", async () => {
    const summaries = await store.listSummaries();
    expect(summaries).toEqual([]);
  });

  it("returns summaries sorted by updatedAt desc", async () => {
    const conv1 = await store.create("First");
    await new Promise((r) => setTimeout(r, 10));
    const conv2 = await store.create("Second");
    const summaries = await store.listSummaries();
    expect(summaries[0].id).toBe(conv2.id);
    expect(summaries[1].id).toBe(conv1.id);
  });
});

describe("hasConversations", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("returns false when empty", async () => {
    expect(await store.hasConversations()).toBe(false);
  });

  it("returns true after create", async () => {
    await store.create("Test");
    expect(await store.hasConversations()).toBe(true);
  });
});

describe("getLastUpdated", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("returns null when empty", async () => {
    expect(await store.getLastUpdated()).toBeNull();
  });

  it("returns most recently updated", async () => {
    await store.create("First");
    await new Promise((r) => setTimeout(r, 10));
    const conv2 = await store.create("Second");
    const last = await store.getLastUpdated();
    expect(last?.id).toBe(conv2.id);
  });
});

describe("index lock", () => {
  beforeEach(async () => {
    await store.ensureDirectory();
  });

  it("concurrent saves don't corrupt index", async () => {
    const conv1 = await store.create("First");
    const conv2 = await store.create("Second");

    store.addMessage(conv1, "user", "msg1");
    store.addMessage(conv2, "user", "msg2");

    await Promise.all([store.save(conv1), store.save(conv2)]);

    const summaries = await store.listSummaries();
    expect(summaries).toHaveLength(2);
    const ids = summaries.map((s) => s.id).sort();
    expect(ids).toEqual([conv1.id, conv2.id].sort());
  });
});
