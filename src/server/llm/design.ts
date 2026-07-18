import "server-only";
import type { DesignSpec } from "~/engine/spec";
import { TERMINAL_NEXUS_SPEC } from "~/engine/presets/terminal-nexus";
import type { ProfileData } from "~/server/profile/model";
import type { UsageRecord } from "./cost";

/**
 * GHOST_PROTOCOL — a single, hand-crafted design: an encrypted AI workstation.
 * An almost-black void, monospace throughout, restrained green signal + muted
 * telemetry, a slow liquid-glass particle core, and deliberate (not noisy)
 * motion. Every generation renders this world. The vibe is stored but does not
 * (yet) branch the design; the GitHub copy comes from the facts layer.
 */
export async function buildDesignSpec(
  _data: ProfileData,
  _vibe: string,
): Promise<{ spec: DesignSpec; usage: UsageRecord | null }> {
  return { spec: TERMINAL_NEXUS_SPEC, usage: null };
}
