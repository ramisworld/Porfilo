import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PORFILO_FAVICON_ID,
  porfiloMarkSvgString,
} from "../src/lib/porfilo-mark-string.ts";

const root = process.cwd();

writeFileSync(
  join(root, "src/app/icon.svg"),
  porfiloMarkSvgString(PORFILO_FAVICON_ID, 32),
);
writeFileSync(
  join(root, "src/app/apple-icon.svg"),
  porfiloMarkSvgString(PORFILO_FAVICON_ID, 180),
);

console.log("brand icons synced -> src/app/icon.svg, src/app/apple-icon.svg");
