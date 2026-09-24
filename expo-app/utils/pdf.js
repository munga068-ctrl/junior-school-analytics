import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Alert } from "react-native";
import { getBand, maxPointsOf, AUTO_COMMENTS, CLASS_TEACHER_REMARKS, HEAD_TEACHER_REMARKS, getOrdinalSuffix } from "./constants";
import { getStreamInitials } from "./analysis";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BASE_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1C2B27; }
  h1 { font-size: 18px; color: #1F4B43; margin: 0; }
  h2 { font-size: 14px; margin: 18px 0 8px; color: #1F4B43; }
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

// "Mid-Term Assessment (1st) — Term 2, 2026"
function assessmentLine(exam) {
  if (!exam) return "";
  const parts = [exam.name];
  if (exam.sequence) parts[0] += ` (${exam.sequence}${getOrdinalSuffix(exam.sequence)})`;
  const metaParts = [];
  if (exam.term) metaParts.push(`Term ${exam.term}`);
  if (exam.year) metaParts.push(String(exam.year));
  if (metaParts.length) parts.push(metaParts.join(", "));
  return parts.join(" — ");
}

export async function generateAndSharePdf(html, dialogTitle) {
  const { uri } = await Print.printToFileAsync({ html });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle });
  }
  return uri;
}

export async function generateAndDownloadPdf(html, filename) {
  const { uri } = await Print.printToFileAsync({ html });
  const cleanName = filename.replace(/[^a-zA-Z0-9_-]/g, "_");
  const targetUri = `${FileSystem.documentDirectory}${cleanName}.pdf`;
  try {
    await FileSystem.copyAsync({ from: uri, to: targetUri });
    Alert.alert("PDF Downloaded", `Saved to device:\n${cleanName}.pdf`, [
      {
        text: "Share / Open",
        onPress: async () => {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(targetUri, { mimeType: "application/pdf" });
          }
        }
      },
      { text: "OK" }
    ]);
  } catch {
    // If copy fails, fallback to sharing the original file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    }
  }
  return targetUri;
}

function buildLegendHtml(bands) {
  const items = bands
    .map(
      (b) => `<span style="display:inline-flex;align-items:center;margin:0 14px 6px 0;font-size:9.5px;">
        <span style="width:9px;height:9px;background:${b.color};display:inline-block;margin-right:4px;border-radius:2px;"></span>${esc(b.short)} (${b.min}-${b.max}%)
      </span>`
    )
    .join("");
  return `<div style="display:flex;flex-wrap:wrap;margin:8px 0 4px;line-height:1.9;">${items}</div>`;
}

// Centered school header block used by every report type.
function buildSchoolHeaderHtml(meta) {
  const contactLine = [meta?.address, meta?.tel ? `Tel: ${meta.tel}` : null, meta?.email]
    .filter(Boolean)
    .map(esc)
    .join(" &middot; ");
  const hasLogo = !!meta?.logoUrl;
  return `<div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #1F4B43;padding-bottom:10px;margin-bottom:14px;">
    ${hasLogo ? `<img src="${esc(meta.logoUrl)}" style="height:54px;width:54px;object-fit:contain;flex-shrink:0;" />` : ""}
    <div style="flex:1;text-align:center;">
      <h1>${esc(meta?.schoolName || "Junior School")}</h1>
      ${contactLine ? `<div class="meta">${contactLine}</div>` : ""}
    </div>
    ${hasLogo ? `<div style="width:54px;flex-shrink:0;"></div>` : ""}
  </div>`;
}

function buildTermDatesHtml(meta) {
  if (!meta?.termEndDate && !meta?.nextTermBeginsDate) return "";
  return `<div style="display:flex;gap:14px;margin-top:16px;">
    <div style="flex:1;text-align:center;border:1px solid #DBE1DA;border-radius:6px;padding:8px;">
      <div style="color:#5B6A64;font-size:8.5px;text-transform:uppercase;">Term Ends</div>
      <div style="font-weight:700;color:#1F4B43;font-size:12px;">${esc(meta.termEndDate || "—")}</div>
    </div>
    <div style="flex:1;text-align:center;border:1px solid #DBE1DA;border-radius:6px;padding:8px;">
      <div style="color:#5B6A64;font-size:8.5px;text-transform:uppercase;">Next Term Begins</div>
      <div style="font-weight:700;color:#1F4B43;font-size:12px;">${esc(meta.nextTermBeginsDate || "—")}</div>
    </div>
  </div>`;
}

// ---------- Class List report (Alphabetical learner roster) ----------
export function buildClassListPdf({ meta, className, learners }) {
  const bodyRows = learners
    .map((l, i) => `<tr>
      <td style="text-align:center;color:#5B6A64;">${i + 1}</td>
      <td style="text-align:left;font-weight:600;">${esc(l.name)}</td>
      <td style="text-align:center;">${esc(l.admNo || "—")}</td>
      <td style="text-align:center;">${esc(l.gender || "—")}</td>
    </tr>`)
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:26px;}</style></head>
  <body>
    ${buildSchoolHeaderHtml(meta)}
    <div style="text-align:center;margin-bottom:14px;" class="meta">
      <strong>${esc(className)} — Class Roster</strong> &middot; ${learners.length} Active Learner${learners.length === 1 ? "" : "s"}
    </div>
    <table>
      <thead>
        <tr>
          <th style="width:40px;">#</th>
          <th style="text-align:left;">LEARNER NAME</th>
          <th style="width:110px;">ASSESSMENT NO.</th>
          <th style="width:70px;">GENDER</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`;
}

// ---------- Class Assessment report: whole class, ranked 1st to last ----------
export function buildClassReportHtml({ meta, exam, assessment, className, subjects, learningAreas: laInput, rows, bands, deviations, previousAssessment }) {
  const learningAreas = laInput || subjects || [];
  const currentExam = assessment || exam;
  const sorted = sortByRank(rows);
  const legend = buildLegendHtml(bands);
  const headerCols = learningAreas.map((s) => `<th>${esc(s.code)}</th>`).join("");

  const bodyRows = sorted
    .map((r) => {
      const learnerId = r.student?.id || r.learner?.id;
      const dev = deviations?.[learnerId];

      const cells = learningAreas
        .map((s) => {
          const v = r.subjScores[s.id];
          const band = getBand(v, bands);
          const bg = band ? band.color + "33" : "#fff";
          const subDev = dev?.learningAreas?.[s.id];
          let devHtml = "";
          if (subDev !== undefined && subDev !== null) {
            const devColor = subDev >= 0 ? "#1a9850" : "#d73027";
            const devSign = subDev >= 0 ? "↑" : "↓";
            devHtml = `<div style="font-size:8.5px;font-weight:700;color:${devColor};">${devSign}${Math.abs(subDev).toFixed(1)}</div>`;
          }
          return `<td style="text-align:center;background:${bg};font-weight:${band ? 700 : 400};">${
            v === undefined || v === null ? "—" : v
          }${devHtml}</td>`;
        })
        .join("");

      let totalDevHtml = "";
      let meanDevHtml = "";
      let pointsDevHtml = "";
      let streamRankDevHtml = "";
      let gradeRankDevHtml = "";

      if (dev) {
        if (dev.totalMarks !== null && dev.totalMarks !== undefined) {
          const color = dev.totalMarks >= 0 ? "#1a9850" : "#d73027";
          totalDevHtml = `<div style="font-size:8.5px;font-weight:700;color:${color};">${dev.totalMarks >= 0 ? "↑" : "↓"}${Math.abs(dev.totalMarks).toFixed(1)}</div>`;
        }
        if (dev.meanPercent !== null && dev.meanPercent !== undefined) {
          const color = dev.meanPercent >= 0 ? "#1a9850" : "#d73027";
          meanDevHtml = `<div style="font-size:8.5px;font-weight:700;color:${color};">${dev.meanPercent >= 0 ? "↑" : "↓"}${Math.abs(dev.meanPercent).toFixed(1)}</div>`;
        }
        if (dev.meanPoints !== null && dev.meanPoints !== undefined) {
          const color = dev.meanPoints >= 0 ? "#1a9850" : "#d73027";
          pointsDevHtml = `<div style="font-size:8.5px;font-weight:700;color:${color};">${dev.meanPoints >= 0 ? "↑" : "↓"}${Math.abs(dev.meanPoints).toFixed(2)}</div>`;
        }
        if (dev.streamRank !== null && dev.streamRank !== undefined) {
          const color = dev.streamRank >= 0 ? "#1a9850" : "#d73027";
          streamRankDevHtml = `<div style="font-size:8.5px;font-weight:700;color:${color};">${dev.streamRank >= 0 ? "↑" : "↓"}${Math.abs(dev.streamRank)}</div>`;
        }
        if (dev.gradeRank !== null && dev.gradeRank !== undefined) {
          const color = dev.gradeRank >= 0 ? "#1a9850" : "#d73027";
          gradeRankDevHtml = `<div style="font-size:8.5px;font-weight:700;color:${color};">${dev.gradeRank >= 0 ? "↑" : "↓"}${Math.abs(dev.gradeRank)}</div>`;
        }
      }

      return `<tr>
        <td style="text-align:center;font-weight:700;">${r.rank}${streamRankDevHtml}</td>
        <td style="text-align:left;font-weight:600;">${esc(r.student?.name || r.learner?.name)}</td>
        ${cells}
        <td style="text-align:center;font-weight:700;">${r.total || 0}${totalDevHtml}</td>
        <td style="text-align:center;">${r.mean !== null ? r.mean.toFixed(1) : "—"}${meanDevHtml}</td>
        <td style="text-align:center;font-weight:700;">${r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"}${pointsDevHtml}</td>
        <td style="text-align:center;font-weight:700;">${r.gradeRank || "—"}${gradeRankDevHtml}</td>
      </tr>`;
    })
    .join("");

  const comparisonNote = previousAssessment
    ? `<div style="font-size:9px;color:#5B6A64;margin-bottom:6px;">Showing deviations from ${esc(previousAssessment.name)}. Green ↑ = improvement, Red ↓ = decline.</div>`
    : "";

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:26px;}</style></head>
  <body>
    ${buildSchoolHeaderHtml(meta)}
    <div style="text-align:center;margin-bottom:6px;" class="meta">${esc(assessmentLine(currentExam))} — ${esc(className)}</div>
    ${legend}
    ${comparisonNote}
    <table>
      <thead>
        <tr>
          <th>S.Rank</th>
          <th style="text-align:left;">Learner</th>
          ${headerCols}
          <th>Total</th>
          <th>Mean%</th>
          <th>Mean Pts</th>
          <th>G.Rank</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`;
}

function buildComparisonChartSvg(learningAreas, learnerScores, classAverages) {
  const W = 500, H = 150, padL = 26, padR = 8, padT = 10, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = learningAreas.length;
  const xStep = n > 1 ? plotW / (n - 1) : 0;
  const xFor = (i) => padL + i * xStep;
  const yFor = (v) => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  const grid = [0, 25, 50, 75, 100]
    .map(
      (v) => `<line x1="${padL}" y1="${yFor(v)}" x2="${W - padR}" y2="${yFor(v)}" stroke="#EEF1EE" stroke-width="1" />
      <text x="${padL - 4}" y="${yFor(v) + 3}" font-size="7" fill="#9AA6A0" text-anchor="end">${v}</text>`
    )
    .join("");

  const classPts = learningAreas.map((s, i) => `${xFor(i)},${yFor(classAverages[s.id] ?? 0)}`).join(" ");
  const classDots = learningAreas
    .map((s, i) => `<circle cx="${xFor(i)}" cy="${yFor(classAverages[s.id] ?? 0)}" r="2.5" fill="#D9A441" />`)
    .join("");

  const presentIdx = learningAreas.map((s, i) => (learnerScores[s.id] != null ? i : null)).filter((i) => i !== null);
  const studentPts = presentIdx.map((i) => `${xFor(i)},${yFor(learnerScores[learningAreas[i].id])}`).join(" ");
  const studentDots = presentIdx
    .map((i) => `<circle cx="${xFor(i)}" cy="${yFor(learnerScores[learningAreas[i].id])}" r="3" fill="#1F4B43" />`)
    .join("");

  const xLabels = learningAreas
    .map((s, i) => `<text x="${xFor(i)}" y="${H - 6}" font-size="8" fill="#5B6A64" text-anchor="middle">${esc(s.code)}</text>`)
    .join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <polyline points="${classPts}" fill="none" stroke="#D9A441" stroke-width="2" />
    ${classDots}
    <polyline points="${studentPts}" fill="none" stroke="#1F4B43" stroke-width="2" />
    ${studentDots}
    ${xLabels}
  </svg>`;
}

function computeClassAverages(learningAreas, rows) {
  const avg = {};
  learningAreas.forEach((s) => {
    const vals = rows.map((r) => r.subjScores[s.id]).filter((v) => v !== undefined && v !== null);
    avg[s.id] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
  });
  return avg;
}

// ---------- Individual report cards: one page per learner, showing every
// assessment recorded in the selected term plus an Average column ----------
export function buildStudentReportCardsHtml({
  meta,
  examsInTerm,
  assessmentsInTerm: aInTerm,
  termLabel,
  className,
  subjects,
  learningAreas: laInput,
  rows,
  bands,
  classTeacherName,
  headTeacherName,
  subjectTeachers,
}) {
  const learningAreas = laInput || subjects || [];
  const assessments = aInTerm || examsInTerm || [];
  const sorted = sortByRank(rows);
  const maxPoints = maxPointsOf(bands);
  const totalMax = learningAreas.length * 100;
  const pointsMax = learningAreas.length * maxPoints;
  const descriptorHtml = buildDescriptorTableHtml(bands);
  const classAverages = computeClassAverages(learningAreas, rows);
  const schoolHeader = buildSchoolHeaderHtml(meta);
  const termDates = buildTermDatesHtml(meta);
  const examCols = assessments.map((e) => `<th>${esc(e.name)}${e.sequence ? ` (${e.sequence}${getOrdinalSuffix(e.sequence)})` : ""}</th>`).join("");

  const summaryBox = (label, value) => `
    <div style="flex:1;min-width:80px;border:1px solid #DBE1DA;border-radius:6px;padding:8px;text-align:center;">
      <div style="font-size:8.5px;color:#5B6A64;text-transform:uppercase;letter-spacing:0.3px;">${esc(label)}</div>
      <div style="font-size:13px;font-weight:700;color:#1F4B43;margin-top:2px;">${esc(value)}</div>
    </div>`;

  const pages = sorted
    .map((r) => {
      const learnerName = r.student?.name || r.learner?.name || "";
      const learnerAdmNo = r.student?.admNo || r.learner?.admNo || "";

      const subjectRows = learningAreas
        .map((s) => {
          const examCells = assessments
            .map((e) => {
              const v = r.perExamScores?.[s.id]?.[e.id];
              return `<td style="text-align:center;">${v === undefined || v === null ? "—" : v}</td>`;
            })
            .join("");
          const avg = r.subjScores[s.id];
          const band = getBand(avg, bands);
          const chipBg = band ? band.color + "40" : "#eee";
          return `<tr>
            <td>${esc(s.name)}</td>
            ${examCells}
            <td style="text-align:center;font-weight:700;">${avg !== undefined && avg !== null ? avg.toFixed(1) : "—"}</td>
            <td style="text-align:center;"><span style="background:${chipBg};color:#1C2B27;font-weight:700;padding:3px 9px;border-radius:10px;display:inline-block;">${
              band ? esc(band.short) : "—"
            }</span></td>
            <td style="font-size:10px;color:#5B6A64;">${esc(subjectTeachers?.[s.id] || "—")}</td>
            <td style="font-size:10px;color:#5B6A64;">${esc(AUTO_COMMENTS[band?.short] || "")}</td>
          </tr>`;
        })
        .join("");

      const overallBand = getBand(r.mean, bands);
      const chartSvg = buildComparisonChartSvg(learningAreas, r.subjScores, classAverages);
      const classRemark = CLASS_TEACHER_REMARKS[overallBand?.short] || "";
      const headRemark = HEAD_TEACHER_REMARKS[overallBand?.short] || "";

      return `<div style="page-break-after:always;padding:28px;">
        ${schoolHeader}
        <div class="meta" style="text-align:center;margin-bottom:14px;">${esc(termLabel)} — ${esc(className)} &middot; Academic Report</div>

        <h2 style="margin-top:0;">${esc(learnerName)}</h2>
        <div class="meta" style="margin-bottom:12px;">ASS NO. ${esc(learnerAdmNo || "—")} &middot; ${esc(className)}</div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          ${summaryBox("Performance Level", overallBand ? overallBand.short : "—")}
          ${summaryBox("Total Marks", `${r.total || 0}/${totalMax}`)}
          ${summaryBox("Total Points", `${r.totalPoints.toFixed(1)}/${pointsMax.toFixed(1)}`)}
          ${summaryBox("Mean Points", r.meanPoints !== null ? `${r.meanPoints.toFixed(2)}/${maxPoints.toFixed(1)}` : "—")}
          ${summaryBox("Stream Rank", `${r.rank} of ${sorted.length}`)}
          ${summaryBox("Grade Rank", r.gradeRank !== undefined ? `${r.gradeRank} of ${r.gradeTotal || sorted.length}` : "—")}
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-weight:700;font-size:10px;color:#1F4B43;margin-bottom:2px;">
            LEARNING AREA PERFORMANCE — LEARNER vs CLASS AVERAGE (Term Average)
          </div>
          <div style="font-size:9px;color:#5B6A64;margin-bottom:4px;">
            <span style="color:#1F4B43;">&#9632;</span> ${esc(learnerName.split(" ")[0])}
            &nbsp;&nbsp;<span style="color:#D9A441;">&#9632;</span> Class average
          </div>
          ${chartSvg}
        </div>

        <table>
          <thead><tr><th style="text-align:left;">Learning Area</th>${examCols}<th>Average</th><th>Level</th><th style="text-align:left;">Teacher</th><th style="text-align:left;">Comment</th></tr></thead>
          <tbody>${subjectRows}</tbody>
        </table>

        <div style="display:flex;gap:14px;margin-top:20px;">
          <div style="flex:1;border:1px solid #DBE1DA;border-radius:6px;padding:12px;">
            <div style="font-weight:700;font-size:10px;color:#1F4B43;margin-bottom:6px;">CLASS TEACHER REMARKS</div>
            <div style="font-size:10px;color:#1C2B27;margin-bottom:16px;">${esc(classRemark)}</div>
            <div style="border-top:1px solid #DBE1DA;padding-top:6px;font-size:9.5px;color:#5B6A64;">
              ${classTeacherName ? `${esc(classTeacherName)}<br/>` : ""}Signature: ____________________
            </div>
          </div>
          <div style="flex:1;border:1px solid #DBE1DA;border-radius:6px;padding:12px;">
            <div style="font-weight:700;font-size:10px;color:#1F4B43;margin-bottom:6px;">HEAD TEACHER REMARKS</div>
            <div style="font-size:10px;color:#1C2B27;margin-bottom:16px;">${esc(headRemark)}</div>
            <div style="border-top:1px solid #DBE1DA;padding-top:6px;font-size:9.5px;color:#5B6A64;">
              ${headTeacherName ? `${esc(headTeacherName)}<br/>` : ""}Signature: ____________________
            </div>
          </div>
        </div>

        <div style="margin-top:18px;">
          <div style="font-weight:700;font-size:10px;color:#1F4B43;margin-bottom:6px;">PERFORMANCE LEVEL DESCRIPTORS</div>
          ${descriptorHtml}
        </div>

        ${termDates}
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

// ---------- Generic horizontal bar chart, used by the Analysis report ----------
function buildBarChartSvg(items, { maxVal, unit = "", colors = ["#1F4B43", "#D9A441", "#6B8E23", "#C0392B", "#2E6B5E", "#8E5FB0"] }) {
  const rowH = 26;
  const labelW = 130;
  const W = 500;
  const barMaxW = W - labelW - 70;
  const H = Math.max(1, items.length) * rowH + 16;

  const bars = items
    .map((it, i) => {
      const y = 10 + i * rowH;
      const w = maxVal > 0 ? (it.value / maxVal) * barMaxW : 0;
      const color = colors[i % colors.length];
      return `
        <text x="${labelW - 8}" y="${y + 13}" font-size="9.5" fill="#1C2B27" text-anchor="end">${esc(it.label)}</text>
        <rect x="${labelW}" y="${y}" width="${Math.max(2, w)}" height="16" rx="3" fill="${color}" />
        <text x="${labelW + Math.max(2, w) + 6}" y="${y + 13}" font-size="9.5" fill="#5B6A64">${it.value.toFixed(2)}${unit}</text>
      `;
    })
    .join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

// ---------- Cross-grade / cross-stream Analysis report ----------
export function buildAnalysisReportHtml({ meta, exam, assessment, analysis, baseline, bands }) {
  const currentExam = assessment || exam;
  const maxPoints = maxPointsOf(bands);

  const gradeChart = buildBarChartSvg(
    analysis.gradeStats.map((g) => ({ label: `${g.rank}.  ${g.grade} (${g.learnerCount} learners)`, value: g.meanPoints })),
    { maxVal: maxPoints, unit: " pts" }
  );
  const streamChart = buildBarChartSvg(
    analysis.streamStats.map((s) => ({ label: `${s.rank}.  ${s.className} (${s.learnerCount} learners)`, value: s.meanPoints })),
    { maxVal: maxPoints, unit: " pts" }
  );

  // Grade columns ordered best-performing first.
  const gradeCols = analysis.gradesPresentRanked;
  const subjTableHeader = gradeCols.map((g) => `<th>${esc(g)}</th>`).join("");
  const levelCols = bands.map((b) => `<th>${esc(b.short)}</th>`).join("");

  const subjRows = analysis.subjectByGrade
    .map((row) => {
      const cells = gradeCols
        .map((g) => {
          const v = row.perGrade[g];
          const band = v !== null ? getBand(v, bands) : null;
          const bg = band ? band.color + "33" : "#fff";
          return `<td style="text-align:center;background:${bg};font-weight:${band ? 700 : 400};">${v !== null ? v.toFixed(1) : "—"}</td>`;
        })
        .join("");

      const overall = analysis.subjectOverallMean[row.subject.id];
      const base = baseline?.subjectOverallMean?.[row.subject.id];
      const dev = overall !== null && overall !== undefined && base !== null && base !== undefined ? overall - base : null;
      const devColor = dev === null ? "#5B6A64" : dev >= 0 ? "#1a9850" : "#d73027";
      const devText = dev === null ? "—" : `${dev >= 0 ? "+" : ""}${dev.toFixed(1)}`;

      const levelCounts = analysis.subjectLevelCounts.find((c) => c.subject.id === row.subject.id)?.counts || {};
      const levelCells = bands.map((b) => `<td style="text-align:center;">${levelCounts[b.short] || 0}</td>`).join("");

      return `<tr>
        <td style="text-align:left;">${esc(row.subject.name)}</td>
        ${cells}
        <td style="text-align:center;font-weight:700;color:${devColor};">${devText}</td>
        ${levelCells}
      </tr>`;
    })
    .join("");

  const streamCols = analysis.streamLevelCounts.map((s) => `<th>${esc(s.initials || s.className)}</th>`).join("");
  const streamLevelRows = bands
    .map((b) => {
      const cells = analysis.streamLevelCounts.map((s) => `<td style="text-align:center;">${s.counts[b.short] || 0}</td>`).join("");
      return `<tr><td style="text-align:left;font-weight:600;">${esc(b.short)}</td>${cells}</tr>`;
    })
    .join("");

  const genderChart = buildBarChartSvg(
    analysis.genderStats
      .filter((g) => g.meanPoints !== null)
      .map((g) => ({ label: `${g.label} (${g.learnerCount})`, value: g.meanPoints })),
    { maxVal: maxPoints, unit: " pts", colors: ["#1F4B43", "#D9A441"] }
  );

  const genderSubjectRows = analysis.subjectByGender
    .map((row) => {
      const cell = (v) => {
        const band = v !== null ? getBand(v, bands) : null;
        const bg = band ? band.color + "33" : "#fff";
        return `<td style="text-align:center;background:${bg};font-weight:${band ? 700 : 400};">${v !== null ? v.toFixed(1) : "—"}</td>`;
      };
      return `<tr><td style="text-align:left;">${esc(row.subject.name)}</td>${cell(row.perGender.M)}${cell(row.perGender.F)}</tr>`;
    })
    .join("");

  const genderLevelRows = bands
    .map((b) => {
      const boys = analysis.genderLevelCounts.find((g) => g.gender === "M")?.counts[b.short] || 0;
      const girls = analysis.genderLevelCounts.find((g) => g.gender === "F")?.counts[b.short] || 0;
      return `<tr><td style="text-align:left;font-weight:600;">${esc(b.short)}</td><td style="text-align:center;">${boys}</td><td style="text-align:center;">${girls}</td></tr>`;
    })
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:26px;}</style></head>
  <body>
    ${buildSchoolHeaderHtml(meta)}
    <div class="meta" style="text-align:center;margin-bottom:6px;">${esc(assessmentLine(currentExam))} &middot; Performance Analysis</div>

    <h2>Grade Ranking &amp; Comparison</h2>
    ${gradeChart}

    <h2>Stream Performance</h2>
    ${streamChart}

    <h2>Learning Area Performance Across Grades</h2>
    <div style="font-size:9px;color:#5B6A64;margin-bottom:6px;">Deviation compares this assessment's learning area mean to the average of other assessments in the same term.</div>
    <table style="font-size:9.5px;">
      <thead><tr><th style="text-align:left;">Learning Area</th>${subjTableHeader}<th>Deviation</th>${levelCols}</tr></thead>
      <tbody>${subjRows}</tbody>
    </table>

    <h2>Performance Levels by Stream</h2>
    <div style="font-size:9px;color:#5B6A64;margin-bottom:6px;">Streams ordered best-performing first. Counts are number of learners at each level.</div>
    <table>
      <thead><tr><th style="text-align:left;">Level</th>${streamCols}</tr></thead>
      <tbody>${streamLevelRows}</tbody>
    </table>

    <h2>Gender Performance — Boys vs Girls</h2>
    ${genderChart}
    <table style="margin-top:10px;">
      <thead><tr><th style="text-align:left;">Learning Area</th><th>Boys</th><th>Girls</th></tr></thead>
      <tbody>${genderSubjectRows}</tbody>
    </table>
    <table style="margin-top:10px;">
      <thead><tr><th style="text-align:left;">Level</th><th>Boys</th><th>Girls</th></tr></thead>
      <tbody>${genderLevelRows}</tbody>
    </table>
  </body></html>`;
}

// ---------- Combined streams ranked list (Assessment Report tab) ----------
export function buildCombinedStreamsHtml({ meta, exam, assessment, label, subjects, learningAreas: laInput, bands, rows }) {
  const currentExam = assessment || exam;
  const learningAreas = laInput || subjects || [];
  const legend = buildLegendHtml(bands);
  const headerCols = learningAreas.map((s) => `<th>${esc(s.code)}</th>`).join("");

  const bodyRows = rows
    .map((r) => {
      const cells = learningAreas
        .map((s) => {
          const v = r.subjScores?.[s.id];
          const band = getBand(v, bands);
          const bg = band ? band.color + "33" : "#fff";
          return `<td style="text-align:center;background:${bg};font-weight:${band ? 700 : 400};">${
            v === undefined || v === null ? "—" : v
          }</td>`;
        })
        .join("");
      const overallBand = getBand(r.mean, bands);
      return `<tr>
        <td style="text-align:center;font-weight:700;">${r.combinedRank}</td>
        <td style="text-align:left;font-weight:600;">${esc(r.student?.name || r.learner?.name)}</td>
        <td style="text-align:left;">${esc(getStreamInitials(r.classObj) || r.classObj?.name || "—")}</td>
        ${cells}
        <td style="text-align:center;font-weight:700;">${r.total || 0}</td>
        <td style="text-align:center;">${r.mean !== null ? r.mean.toFixed(1) : "—"}</td>
        <td style="text-align:center;font-weight:700;">${r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"}</td>
        <td style="text-align:center;font-weight:700;">${overallBand ? esc(overallBand.short) : "—"}</td>
      </tr>`;
    })
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:26px;}</style></head>
  <body>
    ${buildSchoolHeaderHtml(meta)}
    <div class="meta" style="text-align:center;margin-bottom:6px;">${esc(assessmentLine(currentExam))} &middot; ${esc(label)} — Combined Ranked List</div>
    ${legend}
    <table>
      <thead><tr><th>Rank</th><th style="text-align:left;">Learner</th><th style="text-align:left;">Stream</th>${headerCols}<th>Total</th><th>Mean%</th><th>Mean Pts</th><th>Level</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`;
}
