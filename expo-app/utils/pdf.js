import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { getBand, maxPointsOf, AUTO_COMMENTS } from "./constants";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BASE_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1C2B27; }
  h1 { font-size: 18px; color: #1F4B43; margin: 0; }
  h2 { font-size: 15px; margin: 0 0 2px; color: #1C2B27; }
  .meta { font-size: 11.5px; color: #5B6A64; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #1F4B43; color: #fff; padding: 6px; font-size: 10.5px; text-align: center; }
  td { padding: 6px; border-bottom: 1px solid #DBE1DA; font-size: 11px; }
`;

function sortByRank(rows) {
  return [...rows].sort((a, b) => {
    const ra = a.rank === "—" ? Infinity : a.rank;
    const rb = b.rank === "—" ? Infinity : b.rank;
    return ra - rb;
  });
}

export async function generateAndSharePdf(html, dialogTitle) {
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle });
  }
  return uri;
}

// ---------- Class report: whole class, ranked 1st to last ----------
export function buildClassReportHtml({ schoolName, examName, className, subjects, rows, bands }) {
  const sorted = sortByRank(rows);

  const legend = bands
    .map(
      (b) => `<span style="display:inline-flex;align-items:center;margin-right:10px;font-size:9.5px;">
        <span style="width:9px;height:9px;background:${b.color};display:inline-block;margin-right:3px;border-radius:2px;"></span>${esc(b.short)} (${b.min}-${b.max}%)
      </span>`
    )
    .join("");

  const headerCols = subjects.map((s) => `<th>${esc(s.code)}</th>`).join("");

  const bodyRows = sorted
    .map((r) => {
      const cells = subjects
        .map((s) => {
          const v = r.subjScores[s.id];
          const band = getBand(v, bands);
          const bg = band ? band.color + "33" : "#fff";
          return `<td style="text-align:center;background:${bg};font-weight:${band ? 700 : 400};">${
            v === undefined || v === null ? "—" : v
          }</td>`;
        })
        .join("");
      return `<tr>
        <td style="text-align:center;font-weight:700;">${r.rank}</td>
        <td style="text-align:left;font-weight:600;">${esc(r.student.name)}</td>
        ${cells}
        <td style="text-align:center;">${r.mean !== null ? r.mean.toFixed(1) : "—"}</td>
        <td style="text-align:center;font-weight:700;">${r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"}</td>
      </tr>`;
    })
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:26px;}</style></head>
  <body>
    <h1>${esc(schoolName || "School")}</h1>
    <div class="meta">${esc(examName)} — ${esc(className)}</div>
    <div style="margin:10px 0 6px;">${legend}</div>
    <table>
      <thead><tr><th>Rank</th><th style="text-align:left;">Student</th>${headerCols}<th>Mean%</th><th>Mean Pts</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`;
}

// ---------- Individual report cards, one page per learner, ranked 1st to last ----------
export function buildStudentReportCardsHtml({ schoolName, examName, className, subjects, rows, bands }) {
  const sorted = sortByRank(rows);
  const maxPoints = maxPointsOf(bands);
  const totalMax = subjects.length * 100;
  const pointsMax = subjects.length * maxPoints;
  const descriptorHtml = buildDescriptorTableHtml(bands);

  const summaryBox = (label, value) => `
    <div style="flex:1;border:1px solid #DBE1DA;border-radius:6px;padding:8px;text-align:center;">
      <div style="font-size:8.5px;color:#5B6A64;text-transform:uppercase;letter-spacing:0.3px;">${esc(label)}</div>
      <div style="font-size:13px;font-weight:700;color:#1F4B43;margin-top:2px;">${esc(value)}</div>
    </div>`;

  const pages = sorted
    .map((r) => {
      const subjectRows = subjects
        .map((s) => {
          const v = r.subjScores[s.id];
          const band = getBand(v, bands);
          const chipBg = band ? band.color + "40" : "#eee";
          return `<tr>
            <td>${esc(s.name)}</td>
            <td style="text-align:center;">${v === undefined || v === null ? "—" : v + "%"}</td>
            <td style="text-align:center;"><span style="background:${chipBg};color:#1C2B27;font-weight:700;padding:2px 8px;border-radius:10px;">${
              band ? esc(band.short) : "—"
            }</span></td>
            <td style="font-size:10px;color:#5B6A64;">${esc(AUTO_COMMENTS[band?.short] || "")}</td>
          </tr>`;
        })
        .join("");

      const overallBand = getBand(r.mean, bands);

      return `<div style="page-break-after:always;padding:28px;">
        <div style="border-bottom:3px solid #1F4B43;padding-bottom:8px;margin-bottom:14px;">
          <h1>${esc(schoolName || "School")}</h1>
          <div class="meta">${esc(examName)} — ${esc(className)} &middot; Academic Report</div>
        </div>

        <h2>${esc(r.student.name)}</h2>
        <div class="meta" style="margin-bottom:12px;">Adm. No. ${esc(r.student.admNo || "—")} &middot; ${esc(className)}</div>

        <div style="display:flex;gap:8px;margin-bottom:16px;">
          ${summaryBox("Performance Level", overallBand ? overallBand.short : "—")}
          ${summaryBox("Total Marks", `${r.total || 0}/${totalMax}`)}
          ${summaryBox("Total Points", `${r.totalPoints.toFixed(1)}/${pointsMax.toFixed(1)}`)}
          ${summaryBox("Mean Points", r.meanPoints !== null ? `${r.meanPoints.toFixed(2)}/${maxPoints.toFixed(1)}` : "—")}
          ${summaryBox("Class Rank", `${r.rank} of ${sorted.length}`)}
        </div>

        <table>
          <thead><tr><th style="text-align:left;">Learning area</th><th>Marks</th><th>Level</th><th style="text-align:left;">Comment</th></tr></thead>
          <tbody>${subjectRows}</tbody>
        </table>

        <div style="display:flex;gap:14px;margin-top:20px;">
          <div style="flex:1;border:1px solid #DBE1DA;border-radius:6px;padding:12px;">
            <div style="font-weight:700;font-size:10px;color:#1F4B43;margin-bottom:30px;">CLASS TEACHER REMARKS</div>
            <div style="border-top:1px solid #DBE1DA;padding-top:6px;font-size:9.5px;color:#5B6A64;">Signature: ____________________</div>
          </div>
          <div style="flex:1;border:1px solid #DBE1DA;border-radius:6px;padding:12px;">
            <div style="font-weight:700;font-size:10px;color:#1F4B43;margin-bottom:30px;">HEAD TEACHER REMARKS</div>
            <div style="border-top:1px solid #DBE1DA;padding-top:6px;font-size:9.5px;color:#5B6A64;">Signature: ____________________</div>
          </div>
        </div>

        <div style="margin-top:18px;">
          <div style="font-weight:700;font-size:10px;color:#1F4B43;margin-bottom:6px;">GRADE DESCRIPTORS</div>
          ${descriptorHtml}
        </div>
      </div>`;
    })
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>${pages}</body></html>`;
}

function buildDescriptorTableHtml(bands) {
  const cols = bands.map((b) => `<th>${esc(b.short)}</th>`).join("");
  const points = bands.map((b) => `<td style="text-align:center;">${b.points}</td>`).join("");
  const ranges = bands.map((b) => `<td style="text-align:center;">${b.min}-${b.max}</td>`).join("");
  return `<table style="font-size:9px;">
    <thead><tr><th style="text-align:left;">Level</th>${cols}</tr></thead>
    <tbody>
      <tr><td style="text-align:left;font-weight:600;">Points</td>${points}</tr>
      <tr><td style="text-align:left;font-weight:600;">Range (%)</td>${ranges}</tr>
    </tbody>
  </table>`;
}
