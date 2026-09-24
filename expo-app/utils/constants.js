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
  { id: "ee1", short: "EE1", label: "Exceeding Expectation", min: 90, max: 100, points: 4.0, color: "#1a9850" },
  { id: "ee2", short: "EE2", label: "Exceeding Expectation", min: 75, max: 89, points: 3.5, color: "#66bd63" },
  { id: "me1", short: "ME1", label: "Meeting Expectation", min: 58, max: 74, points: 3.0, color: "#a6d96a" },
  { id: "me2", short: "ME2", label: "Meeting Expectation", min: 41, max: 57, points: 2.5, color: "#d9ef8b" },
  { id: "ae1", short: "AE1", label: "Approaching Expectation", min: 31, max: 40, points: 2.0, color: "#fee08b" },
  { id: "ae2", short: "AE2", label: "Approaching Expectation", min: 21, max: 30, points: 1.5, color: "#fdae61" },
  { id: "be1", short: "BE1", label: "Below Expectation", min: 11, max: 20, points: 1.0, color: "#f46d43" },
  { id: "be2", short: "BE2", label: "Below Expectation", min: 0, max: 10, points: 0.5, color: "#d73027" },
];

export const AUTO_COMMENTS = {
  EE1: "Outstanding performance — keep it up!",
  EE2: "Excellent work; maintain this consistency.",
  ME1: "Good performance; keep working hard.",
  ME2: "Fair performance; there is room to grow.",
  AE1: "Needs more effort and support.",
  AE2: "Requires close attention and extra practice.",
  BE1: "Struggling — needs targeted support.",
  BE2: "Serious concern — needs urgent intervention.",
};

export const CLASS_TEACHER_REMARKS = {
  EE1: "You have consistently exceeded expectations this term. Outstanding effort — keep it up!",
  EE2: "Excellent, consistent performance this term. Well done — keep pushing for even more.",
  ME1: "You are meeting expectations well. Keep working hard to reach the next level.",
  ME2: "A fair performance this term. With more consistent effort you can improve further.",
  AE1: "You are approaching the expected standard. More effort and support will help you grow.",
  AE2: "Your performance needs closer attention. Please put in extra practice going forward.",
  BE1: "You are struggling this term and need targeted support. Let's work together to improve.",
  BE2: "This is a serious concern. Urgent intervention and support are needed.",
};

export const HEAD_TEACHER_REMARKS = {
  EE1: "An excellent result. Keep up this outstanding standard of work.",
  EE2: "A very strong performance. Continue with this commendable effort.",
  ME1: "A good, steady performance. Keep building on this foundation.",
  ME2: "A fair result with room to grow. Stay focused and keep improving.",
  AE1: "Performance is below the expected standard. More effort is required.",
  AE2: "This performance needs significant improvement. Please seek extra support.",
  BE1: "A concerning result. Close support and follow-up are needed.",
  BE2: "A very concerning result requiring urgent intervention and support.",
};

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

export function maxPointsOf(bands) {
  return Math.max(...bands.map((b) => b.points || 0), 0) || 1;
}

export function uid() {
  return Math.random().toString(36).slice(2, 9);
}

export function getOrdinalSuffix(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
