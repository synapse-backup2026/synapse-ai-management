import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASE_PRODUCTION_SERVER } from "next/constants.js";

/** @type {import("next").NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pg"],
  env: { SYNAPSE_STANDALONE_BUILD: "1" },
  webpack(config, { webpack }) {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".mjs": [".mts", ".mjs"],
    };
    config.module.rules.push({
      test: /\.ttf$/,
      resourceQuery: /^\?inline$/,
      use: resolve("runtime/inline-font.cjs"),
    });
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(
      /^cloudflare:workers$/,
      resolve("runtime/hostinger-env.mjs"),
    ));
    return config;
  },
};

let databaseReady;
async function prepareProductionDatabase() {
  const publicOrigin = process.env.SYNAPSE_PUBLIC_ORIGIN;
  const origin = publicOrigin ? new URL(publicOrigin) : null;
  if (!origin || !["http:", "https:"].includes(origin.protocol) || origin.origin !== publicOrigin) {
    throw new Error("SYNAPSE_PUBLIC_ORIGIN must be an absolute HTTP(S) origin without a path or trailing slash.");
  }

  const { migrateDatabase } = await import("./runtime/postgres.mjs");
  await migrateDatabase(fileURLToPath(new URL("./runtime/postgres/", import.meta.url)));
}

export default async function config(phase) {
  // Hostinger may start Next directly instead of calling the npm start script.
  if (phase === PHASE_PRODUCTION_SERVER) {
    databaseReady ??= prepareProductionDatabase();
    await databaseReady;
  }
  return nextConfig;
}
