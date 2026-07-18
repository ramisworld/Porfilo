-- The approved catalog uses kebab-case world ids. Older portfolios used the
-- Engine experience id directly; point them at the canonical world and refresh
-- the timestamp so social crawlers receive the corrected versioned image URL.
UPDATE "Portfolio"
SET "template" = 'terminal-nexus',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "template" IN ('terminalNexus', 'terminal-nexus');
