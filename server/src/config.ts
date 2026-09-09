import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const serverDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Support both `npm run dev` from the repository root and direct server starts.
loadDotenv({ path: resolve(serverDirectory, "../.env") });
loadDotenv({ path: resolve(serverDirectory, ".env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  databasePath: process.env.DATABASE_PATH ?? "./data/synapse.db",
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.OPENROUTER_MODEL ?? "nvidia/nemotron-3.5-lightning:free",
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    timeoutMs: Number(process.env.OPENROUTER_TIMEOUT_MS ?? 30_000),
    fallbackModels: (process.env.OPENROUTER_FALLBACK_MODELS ??
      "minimax/minimax-m3:free,nvidia/nemotron-3.5-lightning:free,poolside/laguna-s-2.1:free,minimax/minimax-m2.7:free,nvidia/nemotron-3-super-120b-a12b:free,inclusionai/ling-3.0-flash-fin:free,dots-studio/dots-3-note-preview:free")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean),
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY ?? "",
  },
} as const;

export const VERSION = "0.1.0";
