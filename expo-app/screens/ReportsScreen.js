import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getBand } from "../utils/constants";
import { listenExamScores, getScoresForExams } from "../utils/db";
import { computeAnalysis, getGradeForClass, getTermKey, getTermOptions, buildTermAverageScores, getInitials } from "../utils/analysis";
import { generateAndSharePdf, buildClassReportHtml, buildStudentReportCardsHtml, buildCombinedStreamsHtml } from "../utils/pdf";

export default function ReportsScreen({ classes, subjects, students, exams, bands, meta, teachers }) {
  const [termKey, setTermKey] = useState("");
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [cardClassId, setCardClassId] = useState("");
  const [selectedStreamIds, setSelectedStreamIds] = useState([]);
  const [data, setData] = useState({});
  const [generating, setGenerating] = useState("");
  const [generatingCards, setGeneratingCards] = useState(false);
  const [generatingCombined, setGeneratingCombined] = useState(false);

  const termOptions = useMemo(() => getTermOptions(exams), [exams]);
  const examsInTerm = useMemo(() => exams.filter((e) => getTermKey(e) === termKey), [exams, termKey]);
  const termLabel = useMemo(() => {
    const t = termOptions.find((t) => t.key === termKey);
    return t ? `Term ${t.term}, ${t.year}` : "";
  }, [termOptions, termKey]);

  // Reset the exam/class choices whenever the term changes, since they only make sense within it.
  useEffect(() => { setExamId(""); setClassId(""); setSelectedStreamIds([]); }, [termKey]);

  useEffect(() => {
    if (!examId) { setData({}); return; }
    const unsub = listenExamScores(examId, setData);
    return unsub;
  }, [examId]);

  const classStudents = students.filter((s) => s.classId === classId);
  const exam = exams.find((e) => e.id === examId);
  const className = classes.find((c) => c.id === classId)?.name || "";

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
      const mean = count ? total / count : null;
      const meanPoints = count ? totalPoints / count : null;
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
  const handleGenerateClassReport = async () => {
    if (rows.length === 0) return;
    setGenerating("class");
    try {
      const html = buildClassReportHtml({ meta, exam, className, subjects, rows, bands });
      await generateAndSharePdf(html, "Class List");
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating("");
  };

  // ---------- Report cards: every assessment in the whole term + average ----------
  const handleGenerateReportCards = async () => {
    if (!termKey || !cardClassId || examsInTerm.length === 0) return;
    setGeneratingCards(true);
    try {
      const examIds = examsInTerm.map((e) => e.id);
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
        setGeneratingCards(false);
        return;
      }

      const cardClassName = classes.find((c) => c.id === cardClassId)?.name || "";
      const classTeacher = teachers?.find((t) => t.role === "Class Teacher" && t.classId === cardClassId);
      const headTeacher = teachers?.find((t) => t.role === "Head Teacher");
      const subjectTeachers = buildSubjectTeachers(cardClassId);

      const html = buildStudentReportCardsHtml({
        meta, examsInTerm, termLabel, className: cardClassName, subjects, rows: classRows, bands,
        classTeacherName: classTeacher?.name || "",
        headTeacherName: headTeacher?.name || "",
        subjectTeachers,
      });
      await generateAndSharePdf(html, "Report cards");
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGeneratingCards(false);
  };

  // ---------- Combined streams ranked list (one exam, any chosen streams) ----------
  const toggleStream = (id) => {
    setSelectedStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleGenerateCombined = async () => {
    if (!examId || selectedStreamIds.length === 0) return;
    setGeneratingCombined(true);
    try {
      const analysis = computeAnalysis({ examScores: data, classes, students, subjects, bands });
      const combined = analysis.rows.filter((r) => selectedStreamIds.includes(r.classObj?.id));
      if (combined.length === 0) {
        Alert.alert("No scores yet", "No scores have been recorded for the selected streams in this exam.");
        setGeneratingCombined(false);
        return;
      }
      const ranked = [...combined].sort((a, b) => (b.meanPoints ?? -1) - (a.meanPoints ?? -1));
      ranked.forEach((r, i) => { r.combinedRank = i + 1; });

      const label = selectedStreamIds
        .map((id) => classes.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(" & ");

      const html = buildCombinedStreamsHtml({ meta, exam, label, subjects, bands, rows: ranked });
      await generateAndSharePdf(html, `${label} combined list`);
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGeneratingCombined(false);
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
          <TouchableOpacity
            style={[styles.pdfBtn, { marginBottom: 22 }, (!cardClassId || examsInTerm.length === 0) && styles.pdfBtnDisabled]}
            onPress={handleGenerateReportCards}
            disabled={!cardClassId || examsInTerm.length === 0 || generatingCards}
          >
            {generatingCards ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Report cards (PDF)</Text>}
          </TouchableOpacity>

          {/* ---------- Exam picker shared by the two exam-specific sections below ---------- */}
          <Text style={styles.sectionLabel}>Exam (for the reports below)</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={examId} onValueChange={setExamId}>
              <Picker.Item label="Select exam" value="" />
              {examsInTerm.map((e) => <Picker.Item key={e.id} label={e.name} value={e.id} />)}
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

          {examId && classId && rows.length > 0 && (
            <TouchableOpacity style={[styles.pdfBtn, { marginBottom: 14 }]} onPress={handleGenerateClassReport} disabled={!!generating}>
              {generating === "class" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Class List (PDF)</Text>}
            </TouchableOpacity>
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
              </View>
              <ScrollView horizontal>
                <View>
                  <View style={styles.headerRow}>
                    <Text style={[styles.th, { width: 32 }]}>Rank</Text>
                    <Text style={[styles.th, { width: 130 }]}>Student</Text>
                    {subjects.map((s) => <Text key={s.id} style={[styles.th, { width: CELL, textAlign: "center" }]}>{s.code}</Text>)}
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Mean%</Text>
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Mean Pts</Text>
                  </View>
                  <ScrollView>
                    {rows.map((r) => (
                      <View key={r.student.id} style={styles.dataRow}>
                        <Text style={[styles.td, { width: 32, textAlign: "center", fontWeight: "700" }]}>{r.rank}</Text>
                        <Text style={[styles.td, { width: 130, fontWeight: "600" }]} numberOfLines={1}>{r.student.name}</Text>
                        {subjects.map((s) => {
                          const v = r.subjScores[s.id];
                          const band = getBand(v, bands);
                          return (
                            <Text
                              key={s.id}
                              style={[styles.td, { width: CELL, textAlign: "center", backgroundColor: band ? band.color + "33" : undefined, color: COLORS.ink, fontWeight: band ? "700" : "400" }]}
                            >
                              {v === undefined || v === null ? "—" : v}
                            </Text>
                          );
                        })}
                        <Text style={[styles.td, { width: CELL, textAlign: "center", fontWeight: "700" }]}>{r.mean !== null ? r.mean.toFixed(1) : "—"}</Text>
                        <Text style={[styles.td, { width: CELL, textAlign: "center", fontWeight: "700" }]}>{r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"}</Text>
                      </View>
                    ))}
                    {rows.length === 0 && <Text style={styles.hint}>No students in this class.</Text>}
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
          <TouchableOpacity
            style={[styles.pdfBtn, (!examId || selectedStreamIds.length === 0) && styles.pdfBtnDisabled]}
            onPress={handleGenerateCombined}
            disabled={!examId || selectedStreamIds.length === 0 || generatingCombined}
          >
            {generatingCombined ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Combined ranked list (PDF)</Text>}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 10 },
  hint: { color: COLORS.inkSoft, fontSize: 13.5, marginTop: 10 },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: COLORS.primary, marginBottom: 4, marginTop: 6 },
  hintSmall: { fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 8 },
  pdfBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  pdfBtnDisabled: { opacity: 0.5 },
  pdfBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
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
