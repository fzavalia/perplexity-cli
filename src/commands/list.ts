import { createConversationStore } from "../store/conversation.js";

const DEFAULT_LIMIT = 20;

export async function runList(options: { limit?: number }): Promise<void> {
  const store = createConversationStore();
  await store.ensureDirectory();

  const summaries = await store.listSummaries();

  if (summaries.length === 0) {
    console.log("No conversations yet.");
    return;
  }

  const limit = options.limit ?? DEFAULT_LIMIT;
  const displayed = summaries.slice(0, limit);

  const idWidth = Math.max(...displayed.map((s) => s.id.length), 2);
  const titleWidth = Math.max(...displayed.map((s) => s.title.length), 5);

  const header = `${"ID".padEnd(idWidth)}  ${"Title".padEnd(titleWidth)}  Last Updated`;
  const separator = "-".repeat(header.length);

  console.log(header);
  console.log(separator);

  for (const s of displayed) {
    const date = new Date(s.updatedAt).toLocaleString();
    console.log(`${s.id.padEnd(idWidth)}  ${s.title.padEnd(titleWidth)}  ${date}`);
  }
}
