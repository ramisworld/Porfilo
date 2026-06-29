import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PORFILO_FAVICON_ID,
  porfiloMarkSvgString,
} from "../src/lib/porfilo-mark-string.ts";

const root = process.cwd();
const svg = porfiloMarkSvgString(PORFILO_FAVICON_ID, 32);

writeFileSync(join(root, "src/app/icon.svg"), svg);

console.log("brand icons synced -> src/app/icon.svg");
