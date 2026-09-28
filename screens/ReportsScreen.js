import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getBand } from "../utils/constants";
import { listenExamScores, getScoresForExams } from "../utils/db";
import { computeAnalysis, getGradeForClass, getTermKey, getTermOptions, buildTermAverageScores, getInitials, examAppliesToGrade, rankBySubset, ordinal, compareExamOrder } from "../utils/analysis";
import { generateAndSharePdf, downloadPdf, buildClassReportHtml, buildStudentReportCardsHtml, buildCombinedStreamsHtml } from "../utils/pdf";

// Shares or saves a generated PDF depending on which button was tapped.
async function outputPdf(html, filename, mode) {
  if (mode === "download") {
    const result = await downloadPdf(html, filename);
    if (result.downloaded) Alert.alert("Saved", "The report was saved to the folder you chose.");
    return;
  }
  await generateAndSharePdf(html, filename);
}

// Compares a current value against a previous one and says whether that's
// an improvement, a decline, or no change — direction depends on whether a
// bigger number is better (marks, points) or a smaller one is (rank).
function compareValues(curr, prev, higherIsBetter = true) {
  if (curr === null || curr === undefined || prev === null || prev === undefined) return null;
  const diff = higherIsBetter ? curr - prev : prev - curr;
  if (diff === 0) return { diff: 0, dir: "flat" };
  return { diff, dir: diff > 0 ? "up" : "down" };
}

// A table cell with an optional small deviation line underneath (green ↑ /
// red ↓ / grey — for no change), used throughout the class score sheet once
// a "compare with previous assessment" is selected.
function DeviationCell({ width, value, deviation, deltaFormat }) {
  return (
    <View style={{ width, alignItems: "center", justifyContent: "center" }}>
      <Text style={[styles.td, { textAlign: "center", fontWeight: "700" }]}>{value}</Text>
      {deviation && (
        <Text style={[styles.deviationText, deviation.dir === "up" ? styles.devUp : deviation.dir === "down" ? styles.devDown : styles.devFlat]}>
          {deviation.dir === "up" ? "▲" : deviation.dir === "down" ? "▼" : "–"}
          {deviation.dir !== "flat" ? deltaFormat(Math.abs(deviation.diff)) : ""}
        </Text>
      )}
    </View>
  );
}

export default function ReportsScreen({ classes, subjects, students, exams, bands, meta, teachers }) {
  const [termKey, setTermKey] = useState("");
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [cardClassId, setCardClassId] = useState("");
  const [selectedStreamIds, setSelectedStreamIds] = useState([]);
  const [data, setData] = useState({});
  const [compareExamId, setCompareExamId] = useState("");
  const [compareData, setCompareData] = useState({});
  const [generating, setGenerating] = useState("");
  const [generatingCards, setGeneratingCards] = useState("");
  const [generatingCombined, setGeneratingCombined] = useState("");

  const termOptions = useMemo(() => getTermOptions(exams), [exams]);
  const examsInTerm = useMemo(() => exams.filter((e) => getTermKey(e) === termKey), [exams, termKey]);
  const cardClassGrade = useMemo(
    () => (cardClassId ? getGradeForClass(classes.find((c) => c.id === cardClassId)) : ""),
    [cardClassId, classes]
  );
  const examsForCardClass = useMemo(
    () => examsInTerm.filter((e) => examAppliesToGrade(e, cardClassGrade)),
    [examsInTerm, cardClassGrade]
  );
  const termLabel = useMemo(() => {
    const t = termOptions.find((t) => t.key === termKey);
    return t ? `Term ${t.term}, ${t.year}` : "";
  }, [termOptions, termKey]);

  const termShort = useMemo(() => {
    const t = termOptions.find((t) => t.key === termKey);
    return t ? `${t.year} Term ${t.term}` : "";
  }, [termOptions, termKey]);

  // Reset the exam/class choices whenever the term changes, since they only make sense within it.
  useEffect(() => { setExamId(""); setClassId(""); setSelectedStreamIds([]); }, [termKey]);

  useEffect(() => {
    if (!examId) { setData({}); return; }
    const unsub = listenExamScores(examId, setData);
    return unsub;
  }, [examId]);

  const classStudents = students.filter((s) => s.classId === classId && !s.graduated);
  const exam = exams.find((e) => e.id === examId);
  const className = classes.find((c) => c.id === classId)?.name || "";
  const classGradeForCompare = useMemo(
    () => (classId ? getGradeForClass(classes.find((c) => c.id === classId)) : ""),
    [classId, classes]
  );

  // Every other assessment for this class's grade, most recent first —
  // candidates for "compare with previous assessment".
  const candidatePrevExams = useMemo(
    () => exams.filter((e) => e.id !== examId && examAppliesToGrade(e, classGradeForCompare)).sort((a, b) => compareExamOrder(b, a)),
    [exams, examId, classGradeForCompare]
  );

  // Auto-suggest whichever candidate came immediately before the selected
  // assessment (by year/term/sequence) — the person can always override it.
  useEffect(() => {
    if (!examId || !exam) { setCompareExamId(""); return; }
    const before = candidatePrevExams.find((e) => compareExamOrder(e, exam) < 0);
    setCompareExamId(before?.id || "");
  }, [examId, classId]);

  useEffect(() => {
    if (!compareExamId) { setCompareData({}); return; }
    let cancelled = false;
    getScoresForExams([compareExamId]).then((map) => { if (!cancelled) setCompareData(map[compareExamId] || {}); });
    return () => { cancelled = true; };
  }, [compareExamId]);

  // Rows are automatically ranked by mean points (1st to last) and returned
  // in that order, so both the on-screen table and generated PDFs follow it.
  const rows = useMemo(() => {
    const r = classStudents.map((s) => {
      const subjScores = {};
      let total = 0, count = 0, totalPoints = 0;
      subjects.forEach((sub) => {
        const v = data?.[s.id]?.[sub.id];
        subjScores[sub.id] = v;
        if (v !== undefined && v !== null) {
          total += Number(v);
          count++;
          const band = getBand(v, bands);
          totalPoints += band ? band.points || 0 : 0;
        }
      });
      // Mean is total marks divided by the full number of learning areas,
      // regardless of any subject missing a score.
      const mean = count ? total / subjects.length : null;
      const meanPoints = count ? totalPoints / subjects.length : null;
      return { student: s, subjScores, total, mean, totalPoints, meanPoints, count };
    });

    const ranked = [...r].filter((x) => x.meanPoints !== null).sort((a, b) => b.meanPoints - a.meanPoints);
    r.forEach((x) => {
      x.rank = x.meanPoints === null ? "—" : ranked.findIndex((y) => y.student.id === x.student.id) + 1;
    });

    return [...r].sort((a, b) => {
      const ra = a.rank === "—" ? Infinity : a.rank;
      const rb = b.rank === "—" ? Infinity : b.rank;
      return ra - rb;
    });
  }, [data, classStudents, subjects, bands]);

  // ---------- Deviation vs a previous assessment (optional) ----------
  const currentAnalysis = useMemo(
    () => computeAnalysis({ examScores: data, classes, students, subjects, bands }),
    [data, classes, students, subjects, bands]
  );
  const prevAnalysis = useMemo(
    () => (compareExamId ? computeAnalysis({ examScores: compareData, classes, students, subjects, bands }) : null),
    [compareExamId, compareData, classes, students, subjects, bands]
  );
  const prevStreamRankMap = useMemo(
    () => (prevAnalysis && classId ? rankBySubset(prevAnalysis.rows.filter((r) => r.classObj?.id === classId)) : new Map()),
    [prevAnalysis, classId]
  );
  const deviationsByStudent = useMemo(() => {
    const map = new Map();
    if (!prevAnalysis) return map;
    rows.forEach((r) => {
      const prevRow = prevAnalysis.rows.find((p) => p.student.id === r.student.id);
      if (!prevRow) return;
      const currGradeRank = currentAnalysis.rows.find((c) => c.student.id === r.student.id)?.gradeRank ?? null;
      const prevGradeRank = prevRow.gradeRank ?? null;
      const prevStreamRank = prevStreamRankMap.get(r.student.id) ?? null;
      const currBand = r.mean !== null ? getBand(r.mean, bands) : null;
      const prevBand = prevRow.mean !== null ? getBand(prevRow.mean, bands) : null;
      map.set(r.student.id, {
        total: compareValues(r.total, prevRow.total, true),
        mean: compareValues(r.mean, prevRow.mean, true),
        meanPoints: compareValues(r.meanPoints, prevRow.meanPoints, true),
        streamRank: compareValues(typeof r.rank === "number" ? r.rank : null, prevStreamRank, false),
        gradeRank: compareValues(currGradeRank, prevGradeRank, false),
        level: currBand && prevBand ? compareValues(currBand.points, prevBand.points, true) : null,
        currGradeRank,
      });
    });
    return map;
  }, [rows, prevAnalysis, prevStreamRankMap, currentAnalysis, bands]);

  const CELL = 58;

  const buildSubjectTeachers = (forClassId) => {
    const map = {};
    subjects.forEach((s) => {
      const t = teachers?.find(
        (t) => t.role === "Subject Teacher" && t.subjectId === s.id && t.classId === forClassId
      );
      map[s.id] = t?.name ? getInitials(t.name) : "";
    });
    return map;
  };

  // ---------- Class / stream score sheet (single exam) ----------
  const handleGenerateClassReport = async (mode) => {
    if (rows.length === 0) return;
    setGenerating(mode === "download" ? "class-download" : "class");
    try {
      const rowsForPdf = rows.map((r) => ({
        ...r,
        gradeRank: deviationsByStudent.get(r.student.id)?.currGradeRank ?? currentAnalysis.rows.find((c) => c.student.id === r.student.id)?.gradeRank ?? "—",
        deviation: deviationsByStudent.get(r.student.id) || null,
      }));
      const html = buildClassReportHtml({ meta, exam, className, subjects, rows: rowsForPdf, bands, compareLabel: exams.find((e) => e.id === compareExamId)?.name });
      await outputPdf(html, "Class List", mode);
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating("");
  };

  // ---------- Report cards: every assessment in the whole term + average ----------
  const handleGenerateReportCards = async (mode) => {
    if (!termKey || !cardClassId || examsForCardClass.length === 0) return;
    setGeneratingCards(mode === "download" ? "download" : "share");
    try {
      const examIds = examsForCardClass.map((e) => e.id);
      const scoresByExam = await getScoresForExams(examIds);
      const { avgScores, perExamScores } = buildTermAverageScores(examIds, scoresByExam, students, subjects);

      const analysis = computeAnalysis({ examScores: avgScores, classes, students, subjects, bands });
      const grade = getGradeForClass(classes.find((c) => c.id === cardClassId));
      const gradeSheet = analysis.gradeMarkSheets[grade] || [];

      let classRows = analysis.rows
        .filter((r) => r.classObj?.id === cardClassId)
        .map((r) => {
          const match = gradeSheet.find((g) => g.student.id === r.student.id);
          return {
            ...r,
            gradeRank: match?.gradeRank ?? "—",
            gradeTotal: gradeSheet.length,
            perExamScores: perExamScores[r.student.id],
          };
        });

      const streamRanked = [...classRows].filter((r) => r.meanPoints !== null).sort((a, b) => b.meanPoints - a.meanPoints);
      classRows.forEach((r) => {
        r.rank = r.meanPoints === null ? "—" : streamRanked.findIndex((x) => x.student.id === r.student.id) + 1;
      });
      classRows = classRows.sort((a, b) => {
        const ra = a.rank === "—" ? Infinity : a.rank;
        const rb = b.rank === "—" ? Infinity : b.rank;
        return ra - rb;
      });

      if (classRows.length === 0) {
        Alert.alert("No scores yet", "No scores have been recorded for this class in this term.");
        setGeneratingCards("");
        return;
      }

      const cardClassName = classes.find((c) => c.id === cardClassId)?.name || "";
      const classTeacher = teachers?.find((t) => t.role === "Class Teacher" && t.classId === cardClassId);
      const headTeacher = teachers?.find((t) => t.role === "Head Teacher");
      const subjectTeachers = buildSubjectTeachers(cardClassId);

      const html = buildStudentReportCardsHtml({
        meta, examsInTerm: examsForCardClass, termLabel, gradeLabel: cardClassGrade, termShort, className: cardClassName, subjects, rows: classRows, bands,
        classTeacherName: classTeacher?.name || "",
        headTeacherName: headTeacher?.name || "",
        subjectTeachers,
      });
      await outputPdf(html, "Report cards", mode);
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGeneratingCards("");
  };

  // ---------- Combined streams ranked list (one exam, any chosen streams) ----------
  const toggleStream = (id) => {
    setSelectedStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleGenerateCombined = async (mode) => {
    if (!examId || selectedStreamIds.length === 0) return;
    setGeneratingCombined(mode === "download" ? "download" : "share");
    try {
      const analysis = computeAnalysis({ examScores: data, classes, students, subjects, bands });
      const combined = analysis.rows.filter((r) => selectedStreamIds.includes(r.classObj?.id));
      if (combined.length === 0) {
        Alert.alert("No scores yet", "No scores have been recorded for the selected streams in this exam.");
        setGeneratingCombined("");
        return;
      }
      const ranked = [...combined].sort((a, b) => (b.meanPoints ?? -1) - (a.meanPoints ?? -1));
      ranked.forEach((r, i) => { r.combinedRank = i + 1; });

      const label = selectedStreamIds
        .map((id) => classes.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(" & ");

      const html = buildCombinedStreamsHtml({ meta, exam, label, subjects, bands, rows: ranked });
      await outputPdf(html, `${label} combined list`, mode);
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGeneratingCombined("");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 14 }}>
      <Text style={styles.sectionLabel}>Term</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={termKey} onValueChange={setTermKey}>
          <Picker.Item label="Select term" value="" />
          {termOptions.map((t) => <Picker.Item key={t.key} label={`Term ${t.term}, ${t.year}`} value={t.key} />)}
        </Picker>
      </View>

      {!termKey && <Text style={styles.hint}>Choose a term to generate reports.</Text>}

      {termKey && (
        <>
          {/* ---------- Report cards ---------- */}
          <Text style={styles.sectionLabel}>Report cards</Text>
          <Text style={styles.hintSmall}>Includes every assessment recorded this term for the class, plus an average per subject.</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={cardClassId} onValueChange={setCardClassId}>
              <Picker.Item label="Select class" value="" />
              {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
            </Picker>
          </View>
          <View style={[styles.pdfBtnRow, { marginBottom: 6 }]}>
            <TouchableOpacity
              style={[styles.pdfBtn, { flex: 1 }, (!cardClassId || examsForCardClass.length === 0) && styles.pdfBtnDisabled]}
              onPress={() => handleGenerateReportCards("share")}
              disabled={!cardClassId || examsForCardClass.length === 0 || !!generatingCards}
            >
              {generatingCards === "share" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Share (PDF)</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pdfBtnAlt, { flex: 1 }, (!cardClassId || examsForCardClass.length === 0) && styles.pdfBtnDisabled]}
              onPress={() => handleGenerateReportCards("download")}
              disabled={!cardClassId || examsForCardClass.length === 0 || !!generatingCards}
            >
              {generatingCards === "download" ? <ActivityIndicator color={COLORS.primary} size="small" /> : <Text style={styles.pdfBtnAltText}>Download</Text>}
            </TouchableOpacity>
          </View>
          {cardClassId && examsForCardClass.length === 0 && (
            <Text style={[styles.hintSmall, { marginBottom: 16 }]}>No assessments found for {cardClassGrade} in this term yet — add one in Setup → Assessments.</Text>
          )}
          {(!cardClassId || examsForCardClass.length > 0) && <View style={{ marginBottom: 16 }} />}

          {/* ---------- Assessment picker shared by the two assessment-specific sections below ---------- */}
          <Text style={styles.sectionLabel}>Assessment (for the reports below)</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={examId} onValueChange={setExamId}>
              <Picker.Item label="Select assessment" value="" />
              {examsInTerm.map((e) => <Picker.Item key={e.id} label={`${e.name} (${e.grade || "All Grades"})`} value={e.id} />)}
            </Picker>
          </View>

          {/* ---------- Class / stream score sheet ---------- */}
          <Text style={styles.sectionLabel}>Class List</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={classId} onValueChange={setClassId}>
              <Picker.Item label="Select class" value="" />
              {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
            </Picker>
          </View>

          {examId && classId && candidatePrevExams.length > 0 && (
            <>
              <Text style={styles.miniLabel}>Compare with previous assessment</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={compareExamId} onValueChange={setCompareExamId}>
                  <Picker.Item label="None" value="" />
                  {candidatePrevExams.map((e) => (
                    <Picker.Item
                      key={e.id}
                      label={`${e.sequence ? `${ordinal(e.sequence)} · ` : ""}${e.name} (Term ${e.term}, ${e.year})`}
                      value={e.id}
                    />
                  ))}
                </Picker>
              </View>
            </>
          )}

          {examId && classId && rows.length > 0 && (
            <View style={[styles.pdfBtnRow, { marginBottom: 14, marginTop: 10 }]}>
              <TouchableOpacity style={[styles.pdfBtn, { flex: 1 }]} onPress={() => handleGenerateClassReport("share")} disabled={!!generating}>
                {generating === "class" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Share (PDF)</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pdfBtnAlt, { flex: 1 }]} onPress={() => handleGenerateClassReport("download")} disabled={!!generating}>
                {generating === "class-download" ? <ActivityIndicator color={COLORS.primary} size="small" /> : <Text style={styles.pdfBtnAltText}>Download</Text>}
              </TouchableOpacity>
            </View>
          )}

          {examId && classId && (
            <>
              <View style={styles.legend}>
                {bands.map((b) => (
                  <View key={b.id} style={styles.legendItem}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: b.color, marginRight: 4 }} />
                    <Text style={styles.legendText}>{b.short}</Text>
                  </View>
                ))}
                {compareExamId && <Text style={styles.legendText}>· ▲/▼ vs previous assessment</Text>}
              </View>
              <ScrollView horizontal>
                <View>
                  <View style={styles.headerRow}>
                    <Text style={[styles.th, { width: 32 }]}>Rank</Text>
                    <Text style={[styles.th, { width: 32 }]}>Grade{"\n"}Rank</Text>
                    <Text style={[styles.th, { width: 130 }]}>Learner</Text>
                    {subjects.map((s) => <Text key={s.id} style={[styles.th, { width: CELL, textAlign: "center" }]}>{s.code}</Text>)}
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Level</Text>
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Total</Text>
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Mean%</Text>
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Mean Pts</Text>
                  </View>
                  <ScrollView>
                    {rows.map((r) => {
                      const dev = deviationsByStudent.get(r.student.id);
                      const band = r.mean !== null ? getBand(r.mean, bands) : null;
                      return (
                        <View key={r.student.id} style={styles.dataRow}>
                          <DeviationCell width={32} value={r.rank} deviation={dev?.streamRank} deltaFormat={(n) => n} />
                          <DeviationCell width={32} value={dev?.currGradeRank ?? "—"} deviation={dev?.gradeRank} deltaFormat={(n) => n} />
                          <Text style={[styles.td, { width: 130, fontWeight: "600" }]} numberOfLines={1}>{r.student.name}</Text>
                          {subjects.map((s) => {
                            const v = r.subjScores[s.id];
                            const sBand = getBand(v, bands);
                            return (
                              <Text
                                key={s.id}
                                style={[styles.td, { width: CELL, textAlign: "center", backgroundColor: sBand ? sBand.color + "33" : undefined, color: COLORS.ink, fontWeight: sBand ? "700" : "400" }]}
                              >
                                {v === undefined || v === null ? "—" : v}
                              </Text>
                            );
                          })}
                          <View style={{ width: CELL, alignItems: "center", justifyContent: "center" }}>
                            <Text style={[styles.td, { textAlign: "center", fontWeight: "700" }]}>{band?.short || "—"}</Text>
                            {dev?.level && (
                              <Text style={[styles.deviationText, dev.level.dir === "up" ? styles.devUp : dev.level.dir === "down" ? styles.devDown : styles.devFlat]}>
                                {dev.level.dir === "up" ? "▲" : dev.level.dir === "down" ? "▼" : "–"}
                              </Text>
                            )}
                          </View>
                          <DeviationCell width={CELL} value={r.total || 0} deviation={dev?.total} deltaFormat={(n) => n} />
                          <DeviationCell width={CELL} value={r.mean !== null ? r.mean.toFixed(1) : "—"} deviation={dev?.mean} deltaFormat={(n) => n.toFixed(1)} />
                          <DeviationCell width={CELL} value={r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"} deviation={dev?.meanPoints} deltaFormat={(n) => n.toFixed(2)} />
                        </View>
                      );
                    })}
                    {rows.length === 0 && <Text style={styles.hint}>No learners in this class.</Text>}
                  </ScrollView>
                </View>
              </ScrollView>
            </>
          )}

          {/* ---------- Combined streams ranked list ---------- */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Combined streams ranked list</Text>
          <Text style={styles.hintSmall}>Pick one or more streams (e.g. 9 Yellow, or 9 Yellow &amp; 9 Green together) for the exam selected above.</Text>
          <View style={styles.streamGrid}>
            {classes.map((c) => {
              const checked = selectedStreamIds.includes(c.id);
              return (
                <TouchableOpacity key={c.id} style={[styles.streamChip, checked && styles.streamChipActive]} onPress={() => toggleStream(c.id)}>
                  <Text style={[styles.streamChipText, checked && styles.streamChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.pdfBtnRow}>
            <TouchableOpacity
              style={[styles.pdfBtn, { flex: 1 }, (!examId || selectedStreamIds.length === 0) && styles.pdfBtnDisabled]}
              onPress={() => handleGenerateCombined("share")}
              disabled={!examId || selectedStreamIds.length === 0 || !!generatingCombined}
            >
              {generatingCombined === "share" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Share (PDF)</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pdfBtnAlt, { flex: 1 }, (!examId || selectedStreamIds.length === 0) && styles.pdfBtnDisabled]}
              onPress={() => handleGenerateCombined("download")}
              disabled={!examId || selectedStreamIds.length === 0 || !!generatingCombined}
            >
              {generatingCombined === "download" ? <ActivityIndicator color={COLORS.primary} size="small" /> : <Text style={styles.pdfBtnAltText}>Download</Text>}
            </TouchableOpacity>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 10 },
  hint: { color: COLORS.inkSoft, fontSize: 13.5, marginTop: 10 },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: COLORS.ink, marginBottom: 4, marginTop: 6 },
  miniLabel: { fontSize: 12, fontWeight: "700", color: COLORS.ink, marginBottom: 4, marginTop: 4 },
  hintSmall: { fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 8 },
  deviationText: { fontSize: 9.5, fontWeight: "700", marginTop: 1 },
  devUp: { color: "#1a9850" },
  devDown: { color: "#d73027" },
  devFlat: { color: COLORS.inkSoft },
  pdfBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  pdfBtnDisabled: { opacity: 0.5 },
  pdfBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  pdfBtnRow: { flexDirection: "row", gap: 8 },
  pdfBtnAlt: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.primary, borderRadius: 6, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  pdfBtnAltText: { color: COLORS.ink, fontWeight: "700", fontSize: 12.5 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10, rowGap: 8, columnGap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  legendText: { fontSize: 11, color: COLORS.inkSoft },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.primary },
  th: { color: "#fff", fontSize: 11, fontWeight: "700", padding: 8 },
  dataRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff" },
  td: { fontSize: 12, padding: 8, color: COLORS.ink },
  streamGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  streamChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "#fff" },
  streamChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  streamChipText: { fontSize: 12.5, color: COLORS.ink, fontWeight: "600" },
  streamChipTextActive: { color: "#fff" },
});
