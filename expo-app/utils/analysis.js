import { getBand } from "./constants";

// Classes created via the new Setup UI carry an explicit `grade` field.
// Older classes (created before this feature) fall back to parsing the
// grade out of their free-text name, e.g. "Grade 7 Green" -> "Grade 7".
export function getGradeForClass(cls) {
  if (cls?.grade) return cls.grade;
  const m = /grade\s*(7|8|9)/i.exec(cls?.name || "");
  if (m) return `Grade ${m[1]}`;
  return "Other";
}

// Computes everything the Analysis screen and its PDF need for one exam,
// across every class/stream and grade — not scoped to a single class like
// the Reports tab.
export function computeAnalysis({ examScores, classes, students, subjects, bands }) {
  const rows = students
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
      const mean = count ? total / count : null;
      const meanPoints = count ? totalPoints / count : null;
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
      return { classId: cls.id, className: cls.name, grade: getGradeForClass(cls), meanPoints: avg, studentCount: clsRows.length };
    })
    .filter((s) => s.studentCount > 0)
    .sort((a, b) => b.meanPoints - a.meanPoints);
  streamStats.forEach((s, i) => { s.rank = i + 1; });

  // Per-subject mean %, broken out by grade.
  const subjectByGrade = subjects.map((sub) => {
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

  return { rows, gradesPresent, gradeMarkSheets, gradeStats, streamStats, subjectByGrade };
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
