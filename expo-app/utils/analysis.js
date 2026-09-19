import { getBand } from "./constants";

// Classes created via the Setup UI carry an explicit `grade` field. Older
// classes, or ones without it, fall back to reading the first standalone
// 7/8/9 digit out of the free-text name — matches "Grade 7 Green", "7 Green",
// "7Green", "Stream 9B", etc. without requiring the literal word "Grade".
export function getGradeForClass(cls) {
  if (cls?.grade) return cls.grade;
  const m = /\d+/.exec(cls?.name || "");
  if (m && ["7", "8", "9"].includes(m[0])) return `Grade ${m[0]}`;
  return "Other";
}

// The stream name alone, with the grade word/number stripped out —
// "Grade 7 Green" -> "Green", "9 Yellow" -> "Yellow".
export function getStreamPart(cls) {
  return (cls?.name || "").replace(/grade/i, "").replace(/\d+/, "").trim();
}

// Short "7Y" style label for a class — grade number + first letter of the
// stream name — used where table columns are too tight for a full name.
export function getStreamInitials(cls) {
  if (!cls) return "";
  const grade = getGradeForClass(cls);
  const gradeNum = (grade.match(/\d+/) || [])[0] || "";
  const streamPart = getStreamPart(cls);
  const streamInitial = streamPart ? streamPart[0].toUpperCase() : "";
  return gradeNum ? `${gradeNum}${streamInitial}` : cls.name || "";
}

// Plans a year-end promotion: every active Grade 7 learner moves to the
// Grade 8 class with the same stream name, Grade 8 -> Grade 9, and Grade 9
// learners graduate (flagged, not deleted, so history stays intact).
// Streams that don't yet have a matching next-grade class are left in
// `unresolved` so the admin can create it before promoting.
export function buildPromotionPlan(classes, students) {
  const activeStudents = students.filter((s) => !s.graduated);
  const findTargetClass = (grade, streamPart) =>
    classes.find(
      (c) => getGradeForClass(c) === grade && getStreamPart(c).toLowerCase() === streamPart.toLowerCase()
    );

  const moves = [];
  const graduates = [];
  const unresolved = [];

  activeStudents.forEach((s) => {
    const cls = classes.find((c) => c.id === s.classId);
    const grade = getGradeForClass(cls);
    if (grade === "Grade 7" || grade === "Grade 8") {
      const targetGrade = grade === "Grade 7" ? "Grade 8" : "Grade 9";
      const target = findTargetClass(targetGrade, getStreamPart(cls));
      if (target) moves.push({ student: s, fromClass: cls, toClass: target });
      else unresolved.push({ student: s, fromClass: cls, targetGrade });
    } else if (grade === "Grade 9") {
      graduates.push({ student: s, fromClass: cls });
    }
    // Classes with an unrecognized grade are left alone — not part of the cycle.
  });

  return { moves, graduates, unresolved };
}

// Computes everything the Analysis screen and its PDF need for one exam,
// across every class/stream and grade — not scoped to a single class like
// the Reports tab.
export function computeAnalysis({ examScores, classes, students, subjects, bands }) {
  const rows = students
    .filter((s) => !s.graduated)
    .map((s) => {
      const classObj = classes.find((c) => c.id === s.classId);
      const grade = getGradeForClass(classObj);
      const subjScores = {};
      let total = 0, count = 0, totalPoints = 0;
      subjects.forEach((sub) => {
        const v = examScores?.[s.id]?.[sub.id];
        subjScores[sub.id] = v;
        if (v !== undefined && v !== null) {
          total += Number(v);
          count++;
          const band = getBand(v, bands);
          totalPoints += band ? band.points || 0 : 0;
        }
      });
      // Mean is total marks divided by the full number of learning areas,
      // regardless of any subject missing a score — a missing subject
      // dilutes the average rather than being excluded from it.
      const mean = count ? total / subjects.length : null;
      const meanPoints = count ? totalPoints / subjects.length : null;
      return { student: s, classObj, grade, subjScores, total, mean, meanPoints, totalPoints, count };
    })
    .filter((r) => r.count > 0);

  const gradesPresent = [...new Set(rows.map((r) => r.grade))].sort();

  // General, grade-wide ranked mark sheet: every student in the grade,
  // across all its streams, ranked 1..n by mean points.
  const gradeMarkSheets = {};
  gradesPresent.forEach((g) => {
    const ranked = rows
      .filter((r) => r.grade === g)
      .sort((a, b) => (b.meanPoints ?? -1) - (a.meanPoints ?? -1));
    ranked.forEach((r, i) => { r.gradeRank = i + 1; });
    gradeMarkSheets[g] = ranked;
  });

  // How each grade is doing overall, ranked against the other grades.
  const gradeStats = gradesPresent
    .map((g) => {
      const gradeRows = rows.filter((r) => r.grade === g);
      const vals = gradeRows.map((r) => r.meanPoints).filter((v) => v !== null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { grade: g, meanPoints: avg, studentCount: gradeRows.length };
    })
    .sort((a, b) => b.meanPoints - a.meanPoints);
  gradeStats.forEach((g, i) => { g.rank = i + 1; });

  // How each stream (class) is doing against every other stream.
  const streamStats = classes
    .map((cls) => {
      const clsRows = rows.filter((r) => r.classObj?.id === cls.id);
      const vals = clsRows.map((r) => r.meanPoints).filter((v) => v !== null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { classId: cls.id, className: cls.name, initials: getStreamInitials(cls), grade: getGradeForClass(cls), meanPoints: avg, studentCount: clsRows.length };
    })
    .filter((s) => s.studentCount > 0)
    .sort((a, b) => b.meanPoints - a.meanPoints);
  streamStats.forEach((s, i) => { s.rank = i + 1; });

  // Overall mean % per subject, across every included student regardless of grade —
  // used as the baseline for deviation-from-term comparisons and to rank subjects.
  const subjectOverallMean = {};
  subjects.forEach((sub) => {
    const vals = rows.map((r) => r.subjScores[sub.id]).filter((v) => v !== undefined && v !== null);
    subjectOverallMean[sub.id] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
  });

  // Subjects ordered best-performing first — used everywhere a subject list
  // is displayed, so results read top-to-bottom by strength.
  const subjectsRanked = [...subjects].sort((a, b) => {
    const av = subjectOverallMean[a.id];
    const bv = subjectOverallMean[b.id];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  });

  // Per-subject mean %, broken out by grade.
  const subjectByGrade = subjectsRanked.map((sub) => {
    const perGrade = {};
    gradesPresent.forEach((g) => {
      const vals = rows
        .filter((r) => r.grade === g)
        .map((r) => r.subjScores[sub.id])
        .filter((v) => v !== undefined && v !== null);
      perGrade[g] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
    });
    return { subject: sub, perGrade };
  });

  // Grade columns ordered best-performing first, for display.
  const gradesPresentRanked = gradeStats.map((g) => g.grade);

  // How many learners land in each performance level, per subject (ranked order).
  const subjectLevelCounts = subjectsRanked.map((sub) => {
    const counts = {};
    bands.forEach((b) => { counts[b.short] = 0; });
    rows.forEach((r) => {
      const v = r.subjScores[sub.id];
      if (v !== undefined && v !== null) {
        const band = getBand(v, bands);
        if (band) counts[band.short] = (counts[band.short] || 0) + 1;
      }
    });
    return { subject: sub, counts };
  });

  // How many learners land in each performance level, per stream — ordered
  // best-performing stream first (matches streamStats' ranking).
  const streamLevelCounts = streamStats.map((s) => {
    const counts = {};
    bands.forEach((b) => { counts[b.short] = 0; });
    rows
      .filter((r) => r.classObj?.id === s.classId)
      .forEach((r) => {
        if (r.mean !== null) {
          const band = getBand(r.mean, bands);
          if (band) counts[band.short] = (counts[band.short] || 0) + 1;
        }
      });
    return { classId: s.classId, className: s.className, initials: s.initials, rank: s.rank, counts };
  });

  // ---------- Gender breakdown (Boys vs Girls) ----------
  const GENDERS = [
    { code: "M", label: "Boys" },
    { code: "F", label: "Girls" },
  ];

  // Overall mean % per gender.
  const genderStats = GENDERS.map((g) => {
    const genderRows = rows.filter((r) => r.student.gender === g.code);
    const vals = genderRows.map((r) => r.mean).filter((v) => v !== null);
    const meanPercent = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const pointVals = genderRows.map((r) => r.meanPoints).filter((v) => v !== null);
    const meanPoints = pointVals.length ? pointVals.reduce((a, b) => a + b, 0) / pointVals.length : null;
    return { gender: g.code, label: g.label, meanPercent, meanPoints, studentCount: genderRows.length };
  });

  // Per-subject mean %, broken out by gender (same ranked subject order).
  const subjectByGender = subjectsRanked.map((sub) => {
    const perGender = {};
    GENDERS.forEach((g) => {
      const vals = rows
        .filter((r) => r.student.gender === g.code)
        .map((r) => r.subjScores[sub.id])
        .filter((v) => v !== undefined && v !== null);
      perGender[g.code] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
    });
    return { subject: sub, perGender };
  });

  // How many boys/girls land in each overall performance level.
  const genderLevelCounts = GENDERS.map((g) => {
    const counts = {};
    bands.forEach((b) => { counts[b.short] = 0; });
    rows
      .filter((r) => r.student.gender === g.code)
      .forEach((r) => {
        if (r.mean !== null) {
          const band = getBand(r.mean, bands);
          if (band) counts[band.short] = (counts[band.short] || 0) + 1;
        }
      });
    return { gender: g.code, label: g.label, counts };
  });

  return {
    rows, gradesPresent, gradesPresentRanked, gradeMarkSheets, gradeStats, streamStats,
    subjectsRanked, subjectByGrade, subjectOverallMean, subjectLevelCounts, streamLevelCounts,
    genderStats, subjectByGender, genderLevelCounts,
  };
}

// Short initials for a full name — "Jane Doe" -> "JD" — used where space is
// tight (e.g. the per-subject Teacher column on report cards).
export function getInitials(name) {
  if (!name) return "";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);
}

// An exam with no grade set (or "All Grades") applies to every grade;
// otherwise it only applies to the one grade it was created for.
export function examAppliesToGrade(exam, grade) {
  return !exam?.grade || exam.grade === "All Grades" || exam.grade === grade;
}

// A "term" for selection purposes is a term+year combination, derived from
// whatever exams already exist (e.g. "Term 2, 2026" covering CAT 1, CAT 2,
// Mid-Term, End-Term — however many exams were recorded that term).
export function getTermKey(exam) {
  return `${exam?.term ?? ""}|${exam?.year ?? ""}`;
}

export function getTermOptions(exams) {
  const map = new Map();
  exams.forEach((e) => {
    const key = getTermKey(e);
    if (!map.has(key)) map.set(key, { key, term: e.term, year: e.year });
  });
  return Array.from(map.values()).sort((a, b) => (b.year || 0) - (a.year || 0) || (b.term || 0) - (a.term || 0));
}

// Averages every assessment within a term, per student per subject, so a
// report card can show "all the assessments for that term" plus an average
// column. scoresByExam is {examId: {studentId: {subjectId: score}}}.
export function buildTermAverageScores(examIds, scoresByExam, students, subjects) {
  const avgScores = {};
  const perExamScores = {};
  students.forEach((s) => {
    avgScores[s.id] = {};
    perExamScores[s.id] = {};
    subjects.forEach((sub) => {
      const perExam = {};
      const vals = [];
      examIds.forEach((examId) => {
        const v = scoresByExam[examId]?.[s.id]?.[sub.id];
        perExam[examId] = v === undefined ? null : v;
        if (v !== undefined && v !== null) vals.push(Number(v));
      });
      perExamScores[s.id][sub.id] = perExam;
      avgScores[s.id][sub.id] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : undefined;
    });
  });
  return { avgScores, perExamScores };
}
