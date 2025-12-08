import { incrementalSync } from "../scraper/incrementalSync";

async function main() {
  const pageId = process.argv[2];

  if (!pageId) {
    console.error("Usage: npm run incrementalSync -- <pageId>");
    process.exit(1);
  }

  await incrementalSync(pageId);
}

main().catch((err) => {
  console.error("[incrementalSyncCli] Error:", err);
  process.exit(1);
});
