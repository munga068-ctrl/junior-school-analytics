import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { getBand } from "./constants";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BASE_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1C2B27; }
  h1 { font-size: 19px; color: #1F4B43; margin: 0 0 2px; }
  h2 { font-size: 15px; margin: 18px 0 8px; color: #1C2B27; }
  .meta { font-size: 12px; color: #5B6A64; margin-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; margin-top: 10px; }
  th { background: #1F4B43; color: #fff; padding: 7px; font-size: 11px; text-align: center; }
  td { padding: 7px; border-bottom: 1px solid #DBE1DA; font-size: 11.5px; }
`;

export async function generateAndSharePdf(html, dialogTitle) {
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle });
  }
  return uri;
}

export function buildClassReportHtml({ schoolName, examName, className, subjects, rows, bands }) {
  const legend = bands
    .map(
      (b) =>
        `<span style="display:inline-flex;align-items:center;margin-right:14px;font-size:11px;">
          <span style="width:10px;height:10px;background:${b.color};display:inline-block;margin-right:4px;border-radius:2px;"></span>${esc(b.short)}
        </span>`
    )
    .join("");

  const headerCols = subjects.map((s) => `<th>${esc(s.code)}</th>`).join("");

  const bodyRows = rows
    .map((r, i) => {
      const cells = subjects
        .map((s) => {
          const v = r.subjScores[s.id];
          const band = getBand(v, bands);
          const bg = band ? band.color + "26" : "#fff";
          const color = band ? band.color : "#555";
          const weight = band ? 700 : 400;
          return `<td style="text-align:center;background:${bg};color:${color};font-weight:${weight};">${
            v === undefined || v === null ? "—" : v
          }</td>`;
        })
        .join("");
      return `<tr>
        <td>${i + 1}</td>
        <td style="text-align:left;font-weight:600;">${esc(r.student.name)}</td>
        ${cells}
        <td style="text-align:center;font-weight:700;">${r.mean !== null ? r.mean.toFixed(1) : "—"}</td>
        <td style="text-align:center;font-weight:700;">${r.rank}</td>
      </tr>`;
    })
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:28px;}</style></head>
  <body>
    <h1>${esc(schoolName || "School")}</h1>
    <div class="meta">${esc(examName)} — ${esc(className)}</div>
    <div style="margin:10px 0 4px;">${legend}</div>
    <table>
      <thead><tr><th>#</th><th style="text-align:left;">Student</th>${headerCols}<th>Mean</th><th>Rank</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`;
}

export function buildStudentReportCardsHtml({ schoolName, examName, className, subjects, rows, bands }) {
  const pages = rows
    .map((r) => {
      const subjectRows = subjects
        .map((s) => {
          const v = r.subjScores[s.id];
          const band = getBand(v, bands);
          const color = band ? band.color : "#555";
          return `<tr>
            <td>${esc(s.name)}</td>
            <td style="text-align:center;">${v === undefined || v === null ? "—" : v}</td>
            <td style="text-align:center;color:${color};font-weight:700;">${band ? esc(band.short) : "—"}</td>
          </tr>`;
        })
        .join("");
      return `<div style="page-break-after:always;padding:32px;">
        <h1>${esc(schoolName || "School")}</h1>
        <div class="meta">${esc(examName)} — ${esc(className)}</div>
        <h2>${esc(r.student.name)}${r.student.admNo ? ` (Adm. No. ${esc(r.student.admNo)})` : ""}</h2>
        <table>
          <thead><tr><th style="text-align:left;">Learning area</th><th>Score</th><th>Level</th></tr></thead>
          <tbody>${subjectRows}</tbody>
        </table>
        <div style="margin-top:18px;display:flex;gap:28px;font-size:13px;">
          <div><strong>Total:</strong> ${r.total || "—"}</div>
          <div><strong>Mean:</strong> ${r.mean !== null ? r.mean.toFixed(1) : "—"}</div>
          <div><strong>Class rank:</strong> ${r.rank}</div>
        </div>
      </div>`;
    })
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE}</style></head><body>${pages}</body></html>`;
}
