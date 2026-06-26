import { ZERO_TRUST } from "./zero-trust";
import { HIPAA, SOC2, PCI } from "./frameworks";
import type { ComplianceFramework } from "./shared";

export * from "./shared";

/** All compliance frameworks — combinable overlays (e.g. Zero Trust + HIPAA). */
export const FRAMEWORKS: ComplianceFramework[] = [ZERO_TRUST, HIPAA, SOC2, PCI];

export const FRAMEWORK_BY_ID = new Map(FRAMEWORKS.map((f) => [f.id, f]));

export function getFramework(id: string): ComplianceFramework | undefined {
  return FRAMEWORK_BY_ID.get(id);
}

export { ZERO_TRUST, HIPAA, SOC2, PCI };
