export const DEFAULT_SUBJECTS = [
  { id: "mat", name: "Mathematics", code: "MAT" },
  { id: "eng", name: "English", code: "ENG" },
  { id: "kis", name: "Kiswahili", code: "KIS" },
  { id: "int", name: "Integrated Science", code: "INT" },
  { id: "pre", name: "Pre-Technical Studies", code: "PRE" },
  { id: "sst", name: "Social Studies", code: "SST" },
  { id: "ca", name: "Creative Arts", code: "CA" },
  { id: "cre", name: "CRE", code: "CRE" },
  { id: "agr", name: "Agriculture", code: "AGR" },
];

export const DEFAULT_BANDS = [
  { id: "ee", short: "EE", label: "Exceeding Expectation", min: 80, max: 100, color: "#1F6F4A" },
  { id: "me", short: "ME", label: "Meeting Expectation", min: 50, max: 79, color: "#6B8E23" },
  { id: "ae", short: "AE", label: "Approaching Expectation", min: 30, max: 49, color: "#E08E2B" },
  { id: "be", short: "BE", label: "Below Expectation", min: 0, max: 29, color: "#C0392B" },
];

export const COLORS = {
  bg: "#F5F6F2",
  surface: "#FFFFFF",
  ink: "#1C2B27",
  inkSoft: "#5B6A64",
  primary: "#1F4B43",
  accent: "#D9A441",
  border: "#DBE1DA",
};

export function getBand(score, bands) {
  if (score === null || score === undefined || score === "") return null;
  const n = Number(score);
  for (const b of bands) {
    if (n >= b.min && n <= b.max) return b;
  }
  return bands[bands.length - 1];
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}
