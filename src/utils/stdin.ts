export async function readStdinIfPiped(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  let buffer = "";
  for await (const chunk of process.stdin) {
    buffer += chunk.toString();
  }
  return buffer;
}
