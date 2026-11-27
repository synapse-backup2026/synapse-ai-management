import { fileURLToPath } from "node:url";

const cli = new URL("../node_modules/next/dist/bin/next", import.meta.url);
process.argv.splice(1, 1, fileURLToPath(cli), "start");
await import(cli.href);
