import { initialSync } from "../scraper/initialSync";

async function main() {
  const url = process.argv[2];
  const maxArg = process.argv[3];

  if (!url) {
    console.error("Usage: npm run initialSync -- <url> [max]");
    process.exit(1);
  }

  const max = maxArg ? Number(maxArg) : undefined;
  if (maxArg && Number.isNaN(max)) {
    console.error("max must be a number");
    process.exit(1);
  }

  await initialSync(url, max);
}

main().catch((err) => {
  console.error("[initialSyncCli] Error:", err);
  process.exit(1);
});
