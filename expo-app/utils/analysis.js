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
export function buildPromotionPlan(classes, learners) {
  const activeLearners = learners.filter((s) => !s.graduated);
  const findTargetClass = (grade, streamPart) =>
    classes.find(
      (c) => getGradeForClass(c) === grade && getStreamPart(c).toLowerCase() === streamPart.toLowerCase()
    );

  const moves = [];
  const graduates = [];
  const unresolved = [];

  activeLearners.forEach((s) => {
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

// Computes everything the Analysis screen and its PDF need for one assessment,
// across every class/stream and grade — not scoped to a single class like
// the Assessment Report tab.
export function computeAnalysis({ examScores, classes, students: learnersInput, subjects: learningAreasInput, bands }) {
  const learners = learnersInput || [];
  const learningAreas = learningAreasInput || [];

  const rows = learners
    .filter((s) => !s.graduated)
    .map((s) => {
      const classObj = classes.find((c) => c.id === s.classId);
      const grade = getGradeForClass(classObj);
      const subjScores = {};
      let total = 0, count = 0, totalPoints = 0;
      learningAreas.forEach((sub) => {
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
      // regardless of any learning area missing a score — a missing learning area
      // dilutes the average rather than being excluded from it.
      const mean = count ? total / (learningAreas.length || 1) : null;
      const meanPoints = count ? totalPoints / (learningAreas.length || 1) : null;
      return { student: s, learner: s, classObj, grade, subjScores, total, mean, meanPoints, totalPoints, count };
    })
    .filter((r) => r.count > 0);

  const gradesPresent = [...new Set(rows.map((r) => r.grade))].sort();

  // General, grade-wide ranked mark sheet: every learner in the grade,
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
      return { grade: g, meanPoints: avg, studentCount: gradeRows.length, learnerCount: gradeRows.length };
    })
    .sort((a, b) => b.meanPoints - a.meanPoints);
  gradeStats.forEach((g, i) => { g.rank = i + 1; });

  // How each stream (class) is doing against every other stream.
  const streamStats = classes
    .map((cls) => {
      const clsRows = rows.filter((r) => r.classObj?.id === cls.id);
      const vals = clsRows.map((r) => r.meanPoints).filter((v) => v !== null);
      const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { classId: cls.id, className: cls.name, initials: getStreamInitials(cls), grade: getGradeForClass(cls), meanPoints: avg, studentCount: clsRows.length, learnerCount: clsRows.length };
    })
    .filter((s) => s.studentCount > 0)
    .sort((a, b) => b.meanPoints - a.meanPoints);
  streamStats.forEach((s, i) => { s.rank = i + 1; });

  // Overall mean % per learning area, across every included learner regardless of grade —
  // used as the baseline for deviation-from-term comparisons and to rank learning areas.
  const subjectOverallMean = {};
  learningAreas.forEach((sub) => {
    const vals = rows.map((r) => r.subjScores[sub.id]).filter((v) => v !== undefined && v !== null);
    subjectOverallMean[sub.id] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
  });

  // Learning areas ordered best-performing first — used everywhere a learning area list
  // is displayed, so results read top-to-bottom by strength.
  const subjectsRanked = [...learningAreas].sort((a, b) => {
    const av = subjectOverallMean[a.id];
    const bv = subjectOverallMean[b.id];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  });

  // Per-learning-area mean %, broken out by grade.
  const subjectByGrade = subjectsRanked.map((sub) => {
    const perGrade = {};
    gradesPresent.forEach((g) => {
      const vals = rows
        .filter((r) => r.grade === g)
        .map((r) => r.subjScores[sub.id])
        .filter((v) => v !== undefined && v !== null);
      perGrade[g] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
    });
    return { subject: sub, learningArea: sub, perGrade };
  });

  // Grade columns ordered best-performing first, for display.
  const gradesPresentRanked = gradeStats.map((g) => g.grade);

  // How many learners land in each performance level, per learning area (ranked order).
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
    return { subject: sub, learningArea: sub, counts };
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
    const genderRows = rows.filter((r) => r.student?.gender === g.code);
    const vals = genderRows.map((r) => r.mean).filter((v) => v !== null);
    const meanPercent = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const pointVals = genderRows.map((r) => r.meanPoints).filter((v) => v !== null);
    const meanPoints = pointVals.length ? pointVals.reduce((a, b) => a + b, 0) / pointVals.length : null;
    return { gender: g.code, label: g.label, meanPercent, meanPoints, studentCount: genderRows.length, learnerCount: genderRows.length };
  });

  // Per-learning-area mean %, broken out by gender (same ranked learning area order).
  const subjectByGender = subjectsRanked.map((sub) => {
    const perGender = {};
    GENDERS.forEach((g) => {
      const vals = rows
        .filter((r) => r.student?.gender === g.code)
        .map((r) => r.subjScores[sub.id])
        .filter((v) => v !== undefined && v !== null);
      perGender[g.code] = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
    });
    return { subject: sub, learningArea: sub, perGender };
  });

  // How many boys/girls land in each overall performance level.
  const genderLevelCounts = GENDERS.map((g) => {
    const counts = {};
    bands.forEach((b) => { counts[b.short] = 0; });
    rows
      .filter((r) => r.student?.gender === g.code)
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
    subjectsRanked, learningAreasRanked: subjectsRanked, subjectByGrade, learningAreaByGrade: subjectByGrade,
    subjectOverallMean, learningAreaOverallMean: subjectOverallMean,
    subjectLevelCounts, learningAreaLevelCounts: subjectLevelCounts, streamLevelCounts,
    genderStats, subjectByGender, learningAreaByGender: subjectByGender, genderLevelCounts,
  };
}

// Short initials for a full name — "Jane Doe" -> "JD" — used where space is
// tight (e.g. the per-learning-area Teacher column on report cards).
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

// An assessment with no grade set (or "All Grades") applies to every grade;
// otherwise it only applies to the one grade it was created for.
export function examAppliesToGrade(exam, grade) {
  return !exam?.grade || exam.grade === "All Grades" || exam.grade === grade;
}

// A "term" for selection purposes is a term+year combination, derived from
// whatever assessments already exist (e.g. "Term 2, 2026" covering CAT 1, CAT 2,
// Mid-Term, End-Term — however many assessments were recorded that term).
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

// Averages every assessment within a term, per learner per learning area, so an
// assessment report card can show "all the assessments for that term" plus an average
// column. scoresByExam is {examId: {learnerId: {learningAreaId: score}}}.
export function buildTermAverageScores(examIds, scoresByExam, learners, learningAreas) {
  const avgScores = {};
  const perExamScores = {};
  learners.forEach((s) => {
    avgScores[s.id] = {};
    perExamScores[s.id] = {};
    learningAreas.forEach((sub) => {
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

/**
 * Calculates deviations between current assessment scores and previous assessment scores.
 * Returns a map keyed by learnerId containing differences for:
 * - learningAreas (score differences)
 * - totalMarks (difference in total marks)
 * - totalPoints (difference in total points)
 * - meanPercent (difference in mean percentage)
 * - meanPoints (difference in mean points)
 * - streamRank (difference in stream rank: positive means climbed ranks)
 * - gradeRank (difference in grade rank: positive means climbed ranks)
 */
export function computeAssessmentDeviations({
  currentRows,
  previousScores,
  classes,
  learners,
  learningAreas,
  bands,
}) {
  if (!previousScores || Object.keys(previousScores).length === 0) {
    return {};
  }

  // Build previous assessment rows for comparison
  const prevRows = learners
    .filter((s) => !s.graduated)
    .map((s) => {
      const classObj = classes.find((c) => c.id === s.classId);
      const grade = getGradeForClass(classObj);
      const subjScores = {};
      let total = 0, count = 0, totalPoints = 0;
      learningAreas.forEach((sub) => {
        const v = previousScores?.[s.id]?.[sub.id];
        subjScores[sub.id] = v;
        if (v !== undefined && v !== null) {
          total += Number(v);
          count++;
          const band = getBand(v, bands);
          totalPoints += band ? band.points || 0 : 0;
        }
      });
      const mean = count ? total / (learningAreas.length || 1) : null;
      const meanPoints = count ? totalPoints / (learningAreas.length || 1) : null;
      return { learnerId: s.id, classObj, grade, subjScores, total, mean, meanPoints, totalPoints, count };
    })
    .filter((r) => r.count > 0);

  // Compute previous stream and grade ranks
  const prevStreamRanks = {};
  classes.forEach((cls) => {
    const streamRows = prevRows
      .filter((r) => r.classObj?.id === cls.id)
      .sort((a, b) => (b.meanPoints ?? -1) - (a.meanPoints ?? -1));
    streamRows.forEach((r, i) => { prevStreamRanks[r.learnerId] = i + 1; });
  });

  const prevGradeRanks = {};
  const grades = [...new Set(prevRows.map((r) => r.grade))];
  grades.forEach((g) => {
    const gradeRows = prevRows
      .filter((r) => r.grade === g)
      .sort((a, b) => (b.meanPoints ?? -1) - (a.meanPoints ?? -1));
    gradeRows.forEach((r, i) => { prevGradeRanks[r.learnerId] = i + 1; });
  });

  const prevRowMap = new Map(prevRows.map((r) => [r.learnerId, r]));
  const deviations = {};

  currentRows.forEach((curr) => {
    const learnerId = curr.learner?.id || curr.student?.id;
    const prev = prevRowMap.get(learnerId);

    if (!prev) {
      deviations[learnerId] = null;
      return;
    }

    const learningAreaDev = {};
    learningAreas.forEach((sub) => {
      const currVal = curr.subjScores?.[sub.id];
      const prevVal = prev.subjScores?.[sub.id];
      if (currVal !== undefined && currVal !== null && prevVal !== undefined && prevVal !== null) {
        learningAreaDev[sub.id] = Number(currVal) - Number(prevVal);
      } else {
        learningAreaDev[sub.id] = null;
      }
    });

    const totalMarksDev = (curr.total !== null && prev.total !== null) ? (curr.total - prev.total) : null;
    const totalPointsDev = (curr.totalPoints !== null && prev.totalPoints !== null) ? (curr.totalPoints - prev.totalPoints) : null;
    const meanPercentDev = (curr.mean !== null && prev.mean !== null) ? (curr.mean - prev.mean) : null;
    const meanPointsDev = (curr.meanPoints !== null && prev.meanPoints !== null) ? (curr.meanPoints - prev.meanPoints) : null;

    // For ranks: if rank went from 5 to 2, prev (5) - curr (2) = +3 (improvement)
    const prevSR = prevStreamRanks[learnerId];
    const currSR = curr.streamRank;
    const streamRankDev = (prevSR && currSR) ? (prevSR - currSR) : null;

    const prevGR = prevGradeRanks[learnerId];
    const currGR = curr.gradeRank;
    const gradeRankDev = (prevGR && currGR) ? (prevGR - currGR) : null;

    deviations[learnerId] = {
      learningAreas: learningAreaDev,
      totalMarks: totalMarksDev,
      totalPoints: totalPointsDev,
      meanPercent: meanPercentDev,
      meanPoints: meanPointsDev,
      streamRank: streamRankDev,
      gradeRank: gradeRankDev,
    };
  });

  return deviations;
}
