/** ABO/RhD groups as stored (Postgres enum BloodGroup). "Unknown" is null, never a value. */
export const BLOOD_GROUPS = ["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

const LABELS: Readonly<Record<BloodGroup, string>> = {
  A_POS: "A+",
  A_NEG: "A−",
  B_POS: "B+",
  B_NEG: "B−",
  AB_POS: "AB+",
  AB_NEG: "AB−",
  O_POS: "O+",
  O_NEG: "O−",
};

/** Display label (A+, O−, …). Not translated: the notation is international. */
export function bloodGroupLabel(group: BloodGroup): string {
  return LABELS[group];
}

/** Which source a displayed group came from (spec D3). Never merge the two silently. */
export type BloodGroupBasis = "VERIFIED" | "SELF_REPORTED";

export function displayBloodGroup(donor: {
  verifiedBloodGroup: BloodGroup | null;
  selfReportedBloodGroup: BloodGroup | null;
}): { group: BloodGroup; basis: BloodGroupBasis } | null {
  if (donor.verifiedBloodGroup) return { group: donor.verifiedBloodGroup, basis: "VERIFIED" };
  if (donor.selfReportedBloodGroup) return { group: donor.selfReportedBloodGroup, basis: "SELF_REPORTED" };
  return null;
}
