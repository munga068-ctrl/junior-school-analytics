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
