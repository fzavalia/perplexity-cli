import { describe, it, expect } from "vitest";
import Perplexity from "@perplexity-ai/perplexity_ai";
import { classifyApiError } from "../../api/perplexity.js";

describe("classifyApiError", () => {
  it("returns connection message for APIConnectionError", () => {
    const error = new Perplexity.APIConnectionError({
      cause: new Error("ECONNREFUSED"),
    });
    expect(classifyApiError(error)).toBe(
      "Could not reach api.perplexity.ai. Check your connection."
    );
  });

  it("returns invalid key message for 401 APIError", () => {
    const error = new Perplexity.APIError(401, { message: "Unauthorized" }, "Unauthorized", {});
    expect(classifyApiError(error)).toBe(
      "Invalid API key. Check your PERPLEXITY_API_KEY."
    );
  });

  it("returns rate limit message for 429 APIError without retry-after", () => {
    const error = new Perplexity.APIError(429, { message: "Too Many Requests" }, "Too Many Requests", {});
    expect(classifyApiError(error)).toBe("Rate limited.");
  });

  it("returns rate limit message with retry-after for 429 APIError", () => {
    const error = new Perplexity.APIError(429, { message: "Too Many Requests" }, "Too Many Requests", {
      "retry-after": "30",
    });
    expect(classifyApiError(error)).toBe("Rate limited. Retry after 30s.");
  });

  it("returns server error message for 500+ APIError", () => {
    const error = new Perplexity.APIError(502, { message: "Bad Gateway" }, "Bad Gateway", {});
    expect(classifyApiError(error)).toBe(
      "Perplexity server error (502). Try again later."
    );
  });

  it("returns generic API error for other status codes", () => {
    const error = new Perplexity.APIError(403, { message: "Forbidden" }, "Forbidden", {});
    expect(classifyApiError(error)).toBe("API error (403): 403 Forbidden");
  });

  it("returns error.message for plain Error", () => {
    const error = new Error("Something broke");
    expect(classifyApiError(error)).toBe("Something broke");
  });

  it("returns unknown error message for non-Error values", () => {
    expect(classifyApiError("string")).toBe("An unknown error occurred.");
    expect(classifyApiError(42)).toBe("An unknown error occurred.");
    expect(classifyApiError(null)).toBe("An unknown error occurred.");
  });
});
