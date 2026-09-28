import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { getBand, maxPointsOf, AUTO_COMMENTS, CLASS_TEACHER_REMARKS, HEAD_TEACHER_REMARKS } from "./constants";
import { getStreamInitials } from "./analysis";

const esc = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const BASE_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1C2B27; }
  h1 { font-size: 18px; color: #3498DB; margin: 0; }
  h2 { font-size: 14px; margin: 18px 0 8px; color: #3498DB; }
  .meta { font-size: 11.5px; color: #5B6A64; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #3498DB; color: #fff; padding: 6px; font-size: 10.5px; text-align: center; }
  td { padding: 6px; border-bottom: 1px solid #DBE1DA; font-size: 11px; }
`;

function sortByRank(rows) {
  return [...rows].sort((a, b) => {
    const ra = a.rank === "—" ? Infinity : a.rank;
    const rb = b.rank === "—" ? Infinity : b.rank;
    return ra - rb;
  });
}

// "Mid-Term Assessment — Term 2, 2026"
function examLine(exam) {
  if (!exam) return "";
  const parts = [exam.name];
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

// Saves a PDF straight to the device rather than opening the share sheet.
// On Android the person picks a folder once (e.g. Downloads) and the file is
// written there directly. On iOS there's no direct "save to storage" outside
// the share sheet, so this falls back to it there — "Save to Files" in that
// sheet is the closest iOS equivalent to a download.
export async function downloadPdf(html, filename) {
  const { uri } = await Print.printToFileAsync({ html });
  const safeName = `${(filename || "report").replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "report"}.pdf`;

  if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
    try {
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (perm.granted) {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const destUri = await FileSystem.StorageAccessFramework.createFileAsync(
          perm.directoryUri, safeName, "application/pdf"
        );
        await FileSystem.writeAsStringAsync(destUri, base64, { encoding: FileSystem.EncodingType.Base64 });
        return { downloaded: true };
      }
    } catch (e) {
      // Fall through to the share sheet below.
    }
  }
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Save ${safeName}` });
    return { downloaded: false, shared: true };
  }
  return { downloaded: false, shared: false, uri };
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
// Letterhead: logo on the left, school name / address / tel / email centred
// and bold. Optional `topLine` (small centred line above it) and `banner`
// (dark bar underneath) are used by the learner report cards.
function buildSchoolHeaderHtml(meta, opts = {}) {
  const hasLogo = !!meta?.logoUrl;
  const line = (label, value) =>
    value ? `<div style="font-size:11px;font-weight:700;margin-top:3px;">${label}${esc(value)}</div>` : "";
  return `${opts.topLine ? `<div style="text-align:center;font-size:10px;margin-bottom:6px;">${esc(opts.topLine)}</div>` : ""}
  <div style="display:flex;align-items:center;margin-bottom:${opts.banner ? "8px" : "14px"};">
    <div style="width:110px;flex-shrink:0;">
      ${hasLogo ? `<img src="${esc(meta.logoUrl)}" style="height:64px;max-width:110px;object-fit:contain;" />` : ""}
    </div>
    <div style="flex:1;text-align:center;">
      <div style="font-size:18px;font-weight:700;color:#000;text-transform:uppercase;">${esc(meta?.schoolName || "School")}</div>
      ${line("Address: ", meta?.address)}
      ${line("Tel: ", meta?.tel)}
      ${line("Email: ", meta?.email)}
    </div>
    <div style="width:110px;flex-shrink:0;"></div>
  </div>
  ${opts.banner ? `<div style="background:#555;color:#fff;font-weight:700;font-size:10.5px;text-align:center;padding:7px 8px;letter-spacing:0.3px;text-transform:uppercase;margin-bottom:14px;">${esc(opts.banner)}</div>` : ""}`;
}

function buildTermDatesHtml(meta) {
  if (!meta?.termEndDate && !meta?.nextTermBeginsDate) return "";
  return `<div style="display:flex;gap:14px;margin-top:16px;">
    <div style="flex:1;text-align:center;border:1px solid #DBE1DA;border-radius:6px;padding:8px;">
      <div style="color:#5B6A64;font-size:8.5px;text-transform:uppercase;">Term Ends</div>
      <div style="font-weight:700;color:#3498DB;font-size:12px;">${esc(meta.termEndDate || "—")}</div>
    </div>
    <div style="flex:1;text-align:center;border:1px solid #DBE1DA;border-radius:6px;padding:8px;">
      <div style="color:#5B6A64;font-size:8.5px;text-transform:uppercase;">Next Term Begins</div>
      <div style="font-weight:700;color:#3498DB;font-size:12px;">${esc(meta.nextTermBeginsDate || "—")}</div>
    </div>
  </div>`;
}

// Small ▲/▼ deviation line used under a value in class report PDF cells,
// mirroring the in-app DeviationCell component.
function devLine(dev, formatFn) {
  if (!dev) return "";
  const color = dev.dir === "up" ? "#1a9850" : dev.dir === "down" ? "#d73027" : "#9AA6A0";
  const arrow = dev.dir === "up" ? "▲" : dev.dir === "down" ? "▼" : "–";
  const amount = dev.dir !== "flat" ? formatFn(Math.abs(dev.diff)) : "";
  return `<div style="font-size:7.5px;font-weight:700;color:${color};margin-top:1px;">${arrow}${amount}</div>`;
}

// ---------- Class report: whole class, ranked 1st to last ----------
export function buildClassReportHtml({ meta, exam, className, subjects, rows, bands, compareLabel }) {
  const sorted = sortByRank(rows);
  const legend = buildLegendHtml(bands);
  const headerCols = subjects.map((s) => `<th>${esc(s.code)}</th>`).join("");
  const hasDeviation = rows.some((r) => r.deviation);

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
      const overallBand = r.mean !== null ? getBand(r.mean, bands) : null;
      const dev = r.deviation;
      return `<tr>
        <td style="text-align:center;font-weight:700;">${r.rank}${devLine(dev?.streamRank, (n) => n)}</td>
        ${hasDeviation ? `<td style="text-align:center;font-weight:700;">${r.gradeRank ?? "—"}${devLine(dev?.gradeRank, (n) => n)}</td>` : ""}
        <td style="text-align:left;font-weight:600;">${esc(r.student.name)}</td>
        ${cells}
        <td style="text-align:center;font-weight:700;">${overallBand?.short || "—"}${devLine(dev?.level, () => "")}</td>
        <td style="text-align:center;font-weight:700;">${r.total || 0}${devLine(dev?.total, (n) => n)}</td>
        <td style="text-align:center;">${r.mean !== null ? r.mean.toFixed(1) : "—"}${devLine(dev?.mean, (n) => n.toFixed(1))}</td>
        <td style="text-align:center;font-weight:700;">${r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"}${devLine(dev?.meanPoints, (n) => n.toFixed(2))}</td>
      </tr>`;
    })
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:26px;}</style></head>
  <body>
    ${buildSchoolHeaderHtml(meta)}
    <div style="text-align:center;margin-bottom:6px;" class="meta">${esc(examLine(exam))} — ${esc(className)}</div>
    ${hasDeviation ? `<div style="text-align:center;margin-bottom:6px;" class="meta">▲/▼ vs ${esc(compareLabel || "previous assessment")}</div>` : ""}
    ${legend}
    <table>
      <thead><tr><th>Rank</th>${hasDeviation ? "<th>Grade Rank</th>" : ""}<th style="text-align:left;">Learner</th>${headerCols}<th>Level</th><th>Total</th><th>Mean%</th><th>Mean Pts</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`;
}

function buildComparisonChartSvg(subjects, studentScores, classAverages) {
  const W = 500, H = 150, padL = 26, padR = 8, padT = 10, padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = subjects.length;
  const xStep = n > 1 ? plotW / (n - 1) : 0;
  const xFor = (i) => padL + i * xStep;
  const yFor = (v) => padT + plotH - (Math.max(0, Math.min(100, v)) / 100) * plotH;

  const grid = [0, 25, 50, 75, 100]
    .map(
      (v) => `<line x1="${padL}" y1="${yFor(v)}" x2="${W - padR}" y2="${yFor(v)}" stroke="#EEF1EE" stroke-width="1" />
      <text x="${padL - 4}" y="${yFor(v) + 3}" font-size="7" fill="#9AA6A0" text-anchor="end">${v}</text>`
    )
    .join("");

  const classPts = subjects.map((s, i) => `${xFor(i)},${yFor(classAverages[s.id] ?? 0)}`).join(" ");
  const classDots = subjects
    .map((s, i) => `<circle cx="${xFor(i)}" cy="${yFor(classAverages[s.id] ?? 0)}" r="2.5" fill="#D9A441" />`)
    .join("");

  const presentIdx = subjects.map((s, i) => (studentScores[s.id] != null ? i : null)).filter((i) => i !== null);
  const studentPts = presentIdx.map((i) => `${xFor(i)},${yFor(studentScores[subjects[i].id])}`).join(" ");
  const studentDots = presentIdx
    .map((i) => `<circle cx="${xFor(i)}" cy="${yFor(studentScores[subjects[i].id])}" r="3" fill="#3498DB" />`)
    .join("");

  const xLabels = subjects
    .map((s, i) => `<text x="${xFor(i)}" y="${H - 6}" font-size="8" fill="#5B6A64" text-anchor="middle">${esc(s.code)}</text>`)
    .join("");

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    <polyline points="${classPts}" fill="none" stroke="#D9A441" stroke-width="2" />
    ${classDots}
    <polyline points="${studentPts}" fill="none" stroke="#3498DB" stroke-width="2" />
    ${studentDots}
    ${xLabels}
  </svg>`;
}

function computeClassAverages(subjects, rows) {
  const avg = {};
  subjects.forEach((s) => {
    const vals = rows.map((r) => r.subjScores[s.id]).filter((v) => v !== undefined && v !== null);
    avg[s.id] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
  });
  return avg;
}

// ---------- Individual report cards: one page per learner, showing every
// assessment recorded in the selected term plus an Average column ----------
export function buildStudentReportCardsHtml({ meta, examsInTerm, termLabel, gradeLabel, termShort, className, subjects, rows, bands, classTeacherName, headTeacherName, subjectTeachers }) {
  const sorted = sortByRank(rows);
  const maxPoints = maxPointsOf(bands);
  const totalMax = subjects.length * 100;
  const pointsMax = subjects.length * maxPoints;
  const descriptorHtml = buildDescriptorTableHtml(bands);
  const classAverages = computeClassAverages(subjects, rows);
  const gradePart = gradeLabel || className;
  const schoolHeader = buildSchoolHeaderHtml(meta, {
    topLine: `${gradePart} - (${termShort || termLabel})`,
    banner: `Academic Report Form - ${gradePart} - (${termShort || termLabel})`,
  });
  const termDates = buildTermDatesHtml(meta);
  const examCols = examsInTerm.map((e) => `<th>${esc(e.name)}</th>`).join("");

  const summaryBox = (label, value) => `
    <div style="flex:1;min-width:80px;border:1px solid #DBE1DA;border-radius:6px;padding:8px;text-align:center;">
      <div style="font-size:8.5px;color:#5B6A64;text-transform:uppercase;letter-spacing:0.3px;">${esc(label)}</div>
      <div style="font-size:13px;font-weight:700;color:#3498DB;margin-top:2px;">${esc(value)}</div>
    </div>`;

  const pages = sorted
    .map((r) => {
      const subjectRows = subjects
        .map((s) => {
          const examCells = examsInTerm
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
      const chartSvg = buildComparisonChartSvg(subjects, r.subjScores, classAverages);
      const classRemark = CLASS_TEACHER_REMARKS[overallBand?.short] || "";
      const headRemark = HEAD_TEACHER_REMARKS[overallBand?.short] || "";

      return `<div style="page-break-after:always;padding:28px;">
        ${schoolHeader}

        <h2 style="margin-top:0;">${esc(r.student.name)}</h2>
        <div class="meta" style="margin-bottom:12px;">ASS NO. ${esc(r.student.admNo || "—")} &middot; ${esc(className)}</div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
          ${summaryBox("Performance Level", overallBand ? overallBand.short : "—")}
          ${summaryBox("Total Marks", `${r.total || 0}/${totalMax}`)}
          ${summaryBox("Total Points", `${r.totalPoints.toFixed(1)}/${pointsMax.toFixed(1)}`)}
          ${summaryBox("Mean Points", r.meanPoints !== null ? `${r.meanPoints.toFixed(2)}/${maxPoints.toFixed(1)}` : "—")}
          ${summaryBox("Stream Rank", `${r.rank} of ${sorted.length}`)}
          ${summaryBox("Grade Rank", r.gradeRank !== undefined ? `${r.gradeRank} of ${r.gradeTotal}` : "—")}
        </div>

        <div style="margin-bottom:14px;">
          <div style="font-weight:700;font-size:10px;color:#3498DB;margin-bottom:2px;">
            SUBJECT PERFORMANCE — LEARNER vs CLASS AVERAGE (term average)
          </div>
          <div style="font-size:9px;color:#5B6A64;margin-bottom:4px;">
            <span style="color:#3498DB;">&#9632;</span> ${esc(r.student.name.split(" ")[0])}
            &nbsp;&nbsp;<span style="color:#D9A441;">&#9632;</span> Class average
          </div>
          ${chartSvg}
        </div>

        <table>
          <thead><tr><th style="text-align:left;">Learning area</th>${examCols}<th>Average</th><th>Level</th><th style="text-align:left;">Teacher</th><th style="text-align:left;">Comment</th></tr></thead>
          <tbody>${subjectRows}</tbody>
        </table>

        <div style="display:flex;gap:14px;margin-top:20px;">
          <div style="flex:1;border:1px solid #DBE1DA;border-radius:6px;padding:12px;">
            <div style="font-weight:700;font-size:10px;color:#3498DB;margin-bottom:6px;">CLASS TEACHER REMARKS</div>
            <div style="font-size:10px;color:#1C2B27;margin-bottom:16px;">${esc(classRemark)}</div>
            <div style="border-top:1px solid #DBE1DA;padding-top:6px;font-size:9.5px;color:#5B6A64;">
              ${classTeacherName ? `${esc(classTeacherName)}<br/>` : ""}Signature: ____________________
            </div>
          </div>
          <div style="flex:1;border:1px solid #DBE1DA;border-radius:6px;padding:12px;">
            <div style="font-weight:700;font-size:10px;color:#3498DB;margin-bottom:6px;">HEAD TEACHER REMARKS</div>
            <div style="font-size:10px;color:#1C2B27;margin-bottom:16px;">${esc(headRemark)}</div>
            <div style="border-top:1px solid #DBE1DA;padding-top:6px;font-size:9.5px;color:#5B6A64;">
              ${headTeacherName ? `${esc(headTeacherName)}<br/>` : ""}Signature: ____________________
            </div>
          </div>
        </div>

        <div style="margin-top:18px;">
          <div style="font-weight:700;font-size:10px;color:#3498DB;margin-bottom:6px;">GRADE DESCRIPTORS</div>
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
function buildBarChartSvg(items, { maxVal, unit = "", colors = ["#3498DB", "#D9A441", "#6B8E23", "#C0392B", "#2E6B5E", "#8E5FB0"] }) {
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
export function buildAnalysisReportHtml({ meta, exam, analysis, baseline, bands }) {
  const maxPoints = maxPointsOf(bands);

  const gradeChart = analysis.gradesPresent.length > 1
    ? buildBarChartSvg(
        analysis.gradeStats.map((g) => ({ label: `${g.rank}  ${g.grade}  ·  ${g.studentCount} learner${g.studentCount === 1 ? "" : "s"}`, value: g.meanPoints })),
        { maxVal: maxPoints, unit: " pts" }
      )
    : "";
  const streamChart = buildBarChartSvg(
    analysis.streamStats.map((s) => ({ label: `${s.rank}  ${s.className}`, value: s.meanPoints })),
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
      .map((g) => ({ label: `${g.label} (${g.studentCount})`, value: g.meanPoints })),
    { maxVal: maxPoints, unit: " pts", colors: ["#3498DB", "#D9A441"] }
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
    <div class="meta" style="text-align:center;margin-bottom:6px;">${esc(examLine(exam))} &middot; Performance Analysis</div>

    ${analysis.gradesPresent.length > 1 ? `<h2>Grade-Level Comparison</h2>${gradeChart}` : ""}

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

// ---------- Combined streams ranked list (Reports tab) — any chosen set of
// streams for one specific exam, ranked together as one list ----------
export function buildCombinedStreamsHtml({ meta, exam, label, subjects, bands, rows }) {
  const legend = buildLegendHtml(bands);
  const headerCols = subjects.map((s) => `<th>${esc(s.code)}</th>`).join("");

  const bodyRows = rows
    .map((r) => {
      const cells = subjects
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
        <td style="text-align:left;font-weight:600;">${esc(r.student.name)}</td>
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
    <div class="meta" style="text-align:center;margin-bottom:6px;">${esc(examLine(exam))} &middot; ${esc(label)} — Combined Ranked List</div>
    ${legend}
    <table>
      <thead><tr><th>Rank</th><th style="text-align:left;">Learner</th><th style="text-align:left;">Stream</th>${headerCols}<th>Total</th><th>Mean%</th><th>Mean Pts</th><th>Level</th></tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body></html>`;
}

// ---------- Class list: alphabetical roster for one class ----------
export function buildClassListHtml({ meta, classItem, students }) {
  const sorted = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const bodyRows = sorted
    .map(
      (s, i) => `<tr>
        <td style="text-align:center;">${i + 1}</td>
        <td style="text-align:left;font-weight:600;">${esc(s.name)}</td>
        <td style="text-align:center;">${esc(s.admNo || "—")}</td>
      </tr>`
    )
    .join("");

  return `<html><head><meta charset="utf-8" /><style>${BASE_STYLE} body{padding:26px;}</style></head>
  <body>
    ${buildSchoolHeaderHtml(meta)}
    <div class="meta" style="text-align:center;margin-bottom:10px;">Class List — ${esc(classItem?.name || "")}</div>
    <table>
      <thead><tr><th style="width:40px;">No.</th><th style="text-align:left;">Name</th><th>Assessment No.</th></tr></thead>
      <tbody>${bodyRows || `<tr><td colspan="3" style="text-align:center;color:#5B6A64;">No learners in this class.</td></tr>`}</tbody>
    </table>
    <div class="meta" style="margin-top:14px;">${sorted.length} learner${sorted.length === 1 ? "" : "s"}</div>
  </body></html>`;
}
