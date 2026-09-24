import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getBand, getOrdinalSuffix } from "../utils/constants";
import { listenAssessmentScores, getScoresForAssessments } from "../utils/db";
import { computeAnalysis, computeAssessmentDeviations, getGradeForClass, getTermKey, getTermOptions, buildTermAverageScores, getInitials, examAppliesToGrade } from "../utils/analysis";
import { generateAndSharePdf, generateAndDownloadPdf, buildClassReportHtml, buildStudentReportCardsHtml, buildCombinedStreamsHtml } from "../utils/pdf";

export default function ReportsScreen({ schoolId, classes, learningAreas, learners, assessments, bands, meta, teachers }) {
  const [termKey, setTermKey] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [classId, setClassId] = useState("");
  const [cardClassId, setCardClassId] = useState("");
  const [selectedStreamIds, setSelectedStreamIds] = useState([]);
  const [compareAssessmentId, setCompareAssessmentId] = useState("");
  const [data, setData] = useState({});
  const [previousData, setPreviousData] = useState({});
  const [generating, setGenerating] = useState("");
  const [generatingCards, setGeneratingCards] = useState(false);
  const [generatingCombined, setGeneratingCombined] = useState(false);

  const termOptions = useMemo(() => getTermOptions(assessments), [assessments]);
  const assessmentsInTerm = useMemo(() => assessments.filter((e) => getTermKey(e) === termKey), [assessments, termKey]);
  const cardClassGrade = useMemo(
    () => (cardClassId ? getGradeForClass(classes.find((c) => c.id === cardClassId)) : ""),
    [cardClassId, classes]
  );
  const assessmentsForCardClass = useMemo(
    () => assessmentsInTerm.filter((e) => examAppliesToGrade(e, cardClassGrade)),
    [assessmentsInTerm, cardClassGrade]
  );
  const termLabel = useMemo(() => {
    const t = termOptions.find((t) => t.key === termKey);
    return t ? `Term ${t.term}, ${t.year}` : "";
  }, [termOptions, termKey]);

  const currentAssessment = assessments.find((e) => e.id === assessmentId);
  const suggestedPreviousAssessment = useMemo(() => {
    if (!currentAssessment || !currentAssessment.sequence) return null;
    const prevSeq = currentAssessment.sequence - 1;
    if (prevSeq < 1) return null;
    return assessments.find((e) =>
      e.sequence === prevSeq &&
      e.term === currentAssessment.term &&
      e.year === currentAssessment.year &&
      e.grade === currentAssessment.grade
    );
  }, [currentAssessment, assessments]);

  // Auto-select previous assessment when current assessment changes
  useEffect(() => {
    if (suggestedPreviousAssessment && !compareAssessmentId) {
      setCompareAssessmentId(suggestedPreviousAssessment.id);
    }
  }, [suggestedPreviousAssessment]);

  // Reset the assessment/class choices whenever the term changes
  useEffect(() => { setAssessmentId(""); setClassId(""); setSelectedStreamIds([]); setCompareAssessmentId(""); }, [termKey]);

  useEffect(() => {
    if (!assessmentId) { setData({}); return; }
    const unsub = listenAssessmentScores(schoolId, assessmentId, setData);
    return unsub;
  }, [schoolId, assessmentId]);

  useEffect(() => {
    if (!compareAssessmentId) { setPreviousData({}); return; }
    const unsub = listenAssessmentScores(schoolId, compareAssessmentId, setPreviousData);
    return unsub;
  }, [schoolId, compareAssessmentId]);

  const classLearners = learners.filter((s) => s.classId === classId && !s.graduated);
  const assessment = assessments.find((e) => e.id === assessmentId);
  const className = classes.find((c) => c.id === classId)?.name || "";

  // Compute rows with stream rankings
  const rows = useMemo(() => {
    const r = classLearners.map((s) => {
      const subjScores = {};
      let total = 0, count = 0, totalPoints = 0;
      learningAreas.forEach((sub) => {
        const v = data?.[s.id]?.[sub.id];
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
      return { student: s, learner: s, subjScores, total, mean, totalPoints, meanPoints, count };
    });

    const ranked = [...r].filter((x) => x.meanPoints !== null).sort((a, b) => b.meanPoints - a.meanPoints);
    r.forEach((x) => {
      x.streamRank = x.meanPoints === null ? null : ranked.findIndex((y) => y.student.id === x.student.id) + 1;
      x.rank = x.streamRank || "—";
    });

    return [...r].sort((a, b) => {
      const ra = a.rank === "—" ? Infinity : a.rank;
      const rb = b.rank === "—" ? Infinity : b.rank;
      return ra - rb;
    });
  }, [data, classLearners, learningAreas, bands]);

  // Compute grade rankings for deviation tracking
  const analysis = useMemo(() => {
    if (!assessmentId || Object.keys(data).length === 0) return null;
    return computeAnalysis({ examScores: data, classes, students: learners, subjects: learningAreas, bands });
  }, [assessmentId, data, classes, learners, learningAreas, bands]);

  const rowsWithGradeRank = useMemo(() => {
    if (!analysis) return rows;
    const grade = getGradeForClass(classes.find((c) => c.id === classId));
    const gradeSheet = analysis.gradeMarkSheets[grade] || [];
    return rows.map((r) => {
      const match = gradeSheet.find((g) => g.student?.id === r.student?.id);
      return { ...r, gradeRank: match?.gradeRank || null };
    });
  }, [rows, analysis, classes, classId]);

  // Compute deviations
  const deviations = useMemo(() => {
    if (!compareAssessmentId || Object.keys(previousData).length === 0) return {};
    return computeAssessmentDeviations({
      currentRows: rowsWithGradeRank,
      previousScores: previousData,
      classes,
      learners,
      learningAreas,
      bands,
    });
  }, [compareAssessmentId, previousData, rowsWithGradeRank, classes, learners, learningAreas, bands]);

  const CELL = 58;

  const buildSubjectTeachers = (forClassId) => {
    const map = {};
    learningAreas.forEach((s) => {
      const t = teachers?.find(
        (t) => t.role === "Subject Teacher" && t.subjectId === s.id && t.classId === forClassId
      );
      map[s.id] = t?.name ? getInitials(t.name) : "";
    });
    return map;
  };

  // Deviation indicator component
  const DeviationIndicator = ({ value, isRank }) => {
    if (value === null || value === undefined) return <Text style={styles.deviationText}>—</Text>;
    const diff = Number(value);
    if (diff === 0) return <Text style={styles.deviationText}>—</Text>;

    // For ranks, positive means improvement (went from rank 5 to rank 2 = +3)
    const isImprovement = isRank ? diff > 0 : diff > 0;
    const color = isImprovement ? '#27AE60' : '#E74C3C';
    const arrow = isImprovement ? '↑' : '↓';

    return (
      <Text style={[styles.deviationText, { color, fontWeight: '700' }]}>
        {arrow} {Math.abs(diff).toFixed(1)}
      </Text>
    );
  };

  // ---------- Class / stream score sheet (single assessment) ----------
  const handleGenerateClassReport = async () => {
    if (rowsWithGradeRank.length === 0) return;
    setGenerating("class");
    try {
      const html = buildClassReportHtml({
        meta,
        exam: assessment,
        assessment,
        className,
        subjects: learningAreas,
        learningAreas,
        rows: rowsWithGradeRank,
        bands,
        deviations: compareAssessmentId ? deviations : null,
        previousAssessment: compareAssessmentId ? assessments.find((a) => a.id === compareAssessmentId) : null,
      });
      await generateAndSharePdf(html, "Class Assessment Report");
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating("");
  };

  const handleDownloadClassReport = async () => {
    if (rowsWithGradeRank.length === 0) return;
    setGenerating("classDownload");
    try {
      const html = buildClassReportHtml({
        meta,
        exam: assessment,
        assessment,
        className,
        subjects: learningAreas,
        learningAreas,
        rows: rowsWithGradeRank,
        bands,
        deviations: compareAssessmentId ? deviations : null,
        previousAssessment: compareAssessmentId ? assessments.find((a) => a.id === compareAssessmentId) : null,
      });
      await generateAndDownloadPdf(html, `${className}_Assessment_Report`);
    } catch (e) {
      Alert.alert("Couldn't download PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating("");
  };

  // ---------- Report cards: every assessment in the whole term + average ----------
  const handleGenerateReportCards = async () => {
    if (!termKey || !cardClassId || assessmentsForCardClass.length === 0) return;
    setGeneratingCards(true);
    try {
      const examIds = assessmentsForCardClass.map((e) => e.id);
      const scoresByExam = await getScoresForAssessments(schoolId, examIds);
      const { avgScores, perExamScores } = buildTermAverageScores(examIds, scoresByExam, learners, learningAreas);

      const cardAnalysis = computeAnalysis({ examScores: avgScores, classes, students: learners, subjects: learningAreas, bands });
      const grade = getGradeForClass(classes.find((c) => c.id === cardClassId));
      const gradeSheet = cardAnalysis.gradeMarkSheets[grade] || [];

      let classRows = cardAnalysis.rows
        .filter((r) => r.classObj?.id === cardClassId)
        .map((r) => {
          const match = gradeSheet.find((g) => g.student?.id === r.student?.id);
          return {
            ...r,
            gradeRank: match?.gradeRank ?? "—",
            gradeTotal: gradeSheet.length,
            perExamScores: perExamScores[r.student?.id],
          };
        });

      const streamRanked = [...classRows].filter((r) => r.meanPoints !== null).sort((a, b) => b.meanPoints - a.meanPoints);
      classRows.forEach((r) => {
        r.rank = r.meanPoints === null ? "—" : streamRanked.findIndex((x) => x.student?.id === r.student?.id) + 1;
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
        meta,
        examsInTerm: assessmentsForCardClass,
        assessmentsInTerm: assessmentsForCardClass,
        termLabel,
        className: cardClassName,
        subjects: learningAreas,
        learningAreas,
        rows: classRows,
        bands,
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

  const handleDownloadReportCards = async () => {
    if (!termKey || !cardClassId || assessmentsForCardClass.length === 0) return;
    setGeneratingCards(true);
    try {
      const examIds = assessmentsForCardClass.map((e) => e.id);
      const scoresByExam = await getScoresForAssessments(schoolId, examIds);
      const { avgScores, perExamScores } = buildTermAverageScores(examIds, scoresByExam, learners, learningAreas);

      const cardAnalysis = computeAnalysis({ examScores: avgScores, classes, students: learners, subjects: learningAreas, bands });
      const grade = getGradeForClass(classes.find((c) => c.id === cardClassId));
      const gradeSheet = cardAnalysis.gradeMarkSheets[grade] || [];

      let classRows = cardAnalysis.rows
        .filter((r) => r.classObj?.id === cardClassId)
        .map((r) => {
          const match = gradeSheet.find((g) => g.student?.id === r.student?.id);
          return {
            ...r,
            gradeRank: match?.gradeRank ?? "—",
            gradeTotal: gradeSheet.length,
            perExamScores: perExamScores[r.student?.id],
          };
        });

      const streamRanked = [...classRows].filter((r) => r.meanPoints !== null).sort((a, b) => b.meanPoints - a.meanPoints);
      classRows.forEach((r) => {
        r.rank = r.meanPoints === null ? "—" : streamRanked.findIndex((x) => x.student?.id === r.student?.id) + 1;
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
        meta,
        examsInTerm: assessmentsForCardClass,
        assessmentsInTerm: assessmentsForCardClass,
        termLabel,
        className: cardClassName,
        subjects: learningAreas,
        learningAreas,
        rows: classRows,
        bands,
        classTeacherName: classTeacher?.name || "",
        headTeacherName: headTeacher?.name || "",
        subjectTeachers,
      });
      await generateAndDownloadPdf(html, `${cardClassName}_Report_Cards`);
    } catch (e) {
      Alert.alert("Couldn't download PDF", e?.message || "Something went wrong. Try again.");
    }
    setGeneratingCards(false);
  };

  // ---------- Combined streams ranked list (one assessment, any chosen streams) ----------
  const toggleStream = (id) => {
    setSelectedStreamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleGenerateCombined = async () => {
    if (!assessmentId || selectedStreamIds.length === 0) return;
    setGeneratingCombined(true);
    try {
      const combAnalysis = computeAnalysis({ examScores: data, classes, students: learners, subjects: learningAreas, bands });
      const combined = combAnalysis.rows.filter((r) => selectedStreamIds.includes(r.classObj?.id));
      if (combined.length === 0) {
        Alert.alert("No scores yet", "No scores have been recorded for the selected streams in this assessment.");
        setGeneratingCombined(false);
        return;
      }
      const ranked = [...combined].sort((a, b) => (b.meanPoints ?? -1) - (a.meanPoints ?? -1));
      ranked.forEach((r, i) => { r.combinedRank = i + 1; });

      const label = selectedStreamIds
        .map((id) => classes.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(" & ");

      const html = buildCombinedStreamsHtml({
        meta,
        exam: assessment,
        assessment,
        label,
        subjects: learningAreas,
        learningAreas,
        bands,
        rows: ranked
      });
      await generateAndSharePdf(html, `${label} combined list`);
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGeneratingCombined(false);
  };

  const handleDownloadCombined = async () => {
    if (!assessmentId || selectedStreamIds.length === 0) return;
    setGeneratingCombined(true);
    try {
      const combAnalysis = computeAnalysis({ examScores: data, classes, students: learners, subjects: learningAreas, bands });
      const combined = combAnalysis.rows.filter((r) => selectedStreamIds.includes(r.classObj?.id));
      if (combined.length === 0) {
        Alert.alert("No scores yet", "No scores have been recorded for the selected streams in this assessment.");
        setGeneratingCombined(false);
        return;
      }
      const ranked = [...combined].sort((a, b) => (b.meanPoints ?? -1) - (a.meanPoints ?? -1));
      ranked.forEach((r, i) => { r.combinedRank = i + 1; });

      const label = selectedStreamIds
        .map((id) => classes.find((c) => c.id === id)?.name)
        .filter(Boolean)
        .join(" & ");

      const html = buildCombinedStreamsHtml({
        meta,
        exam: assessment,
        assessment,
        label,
        subjects: learningAreas,
        learningAreas,
        bands,
        rows: ranked
      });
      await generateAndDownloadPdf(html, `${label.replace(/ & /g, "_")}_Combined`);
    } catch (e) {
      Alert.alert("Couldn't download PDF", e?.message || "Something went wrong. Try again.");
    }
    setGeneratingCombined(false);
  };

  const previousAssessmentLabel = compareAssessmentId
    ? assessments.find((a) => a.id === compareAssessmentId)?.name
    : "";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 14 }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={5}
    >
      <Text style={styles.sectionLabel}>Term</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={termKey} onValueChange={setTermKey}>
          <Picker.Item label="Select term" value="" />
          {termOptions.map((t) => <Picker.Item key={t.key} label={`Term ${t.term}, ${t.year}`} value={t.key} />)}
        </Picker>
      </View>

      {!termKey && <Text style={styles.hint}>Choose a term to generate assessment reports.</Text>}

      {termKey && (
        <>
          {/* ---------- Report cards ---------- */}
          <Text style={styles.sectionLabel}>Report cards</Text>
          <Text style={styles.hintSmall}>Includes every assessment recorded this term for the class, plus an average per learning area.</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={cardClassId} onValueChange={setCardClassId}>
              <Picker.Item label="Select class" value="" />
              {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
            </Picker>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
            <TouchableOpacity
              style={[styles.pdfBtn, { flex: 1 }, (!cardClassId || assessmentsForCardClass.length === 0) && styles.pdfBtnDisabled]}
              onPress={handleDownloadReportCards}
              disabled={!cardClassId || assessmentsForCardClass.length === 0 || generatingCards}
            >
              {generatingCards ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>⬇ Download Cards</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pdfBtn, { flex: 1 }, (!cardClassId || assessmentsForCardClass.length === 0) && styles.pdfBtnDisabled]}
              onPress={handleGenerateReportCards}
              disabled={!cardClassId || assessmentsForCardClass.length === 0 || generatingCards}
            >
              {generatingCards ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>📤 Share Cards</Text>}
            </TouchableOpacity>
          </View>
          {cardClassId && assessmentsForCardClass.length === 0 && (
            <Text style={[styles.hintSmall, { marginBottom: 16 }]}>No assessments found for {cardClassGrade} in this term yet — add one in Setup → Assessments.</Text>
          )}
          {(!cardClassId || assessmentsForCardClass.length > 0) && <View style={{ marginBottom: 16 }} />}

          {/* ---------- Assessment picker shared by the sections below ---------- */}
          <Text style={styles.sectionLabel}>Assessment (for the reports below)</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={assessmentId} onValueChange={setAssessmentId}>
              <Picker.Item label="Select assessment" value="" />
              {assessmentsInTerm.map((e) => (
                <Picker.Item
                  key={e.id}
                  label={`${e.name}${e.sequence ? ` (${e.sequence}${getOrdinalSuffix(e.sequence)})` : ""} (${e.grade || "All Grades"})`}
                  value={e.id}
                />
              ))}
            </Picker>
          </View>

          {/* ---------- Compare with previous assessment ---------- */}
          {assessmentId && (
            <>
              <Text style={styles.sectionLabel}>Compare with previous (optional)</Text>
              <Text style={styles.hintSmall}>
                {suggestedPreviousAssessment
                  ? `Auto-selected: ${suggestedPreviousAssessment.name}. Change below or clear to hide deviations.`
                  : "Select a previous assessment to show improvement/decline indicators (green ↑ / red ↓)."}
              </Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={compareAssessmentId} onValueChange={setCompareAssessmentId}>
                  <Picker.Item label="No comparison" value="" />
                  {assessments
                    .filter((a) => a.id !== assessmentId && a.term === currentAssessment?.term && a.year === currentAssessment?.year)
                    .map((e) => (
                      <Picker.Item
                        key={e.id}
                        label={`${e.name}${e.sequence ? ` (${e.sequence}${getOrdinalSuffix(e.sequence)})` : ""}`}
                        value={e.id}
                      />
                    ))}
                </Picker>
              </View>
            </>
          )}

          {/* ---------- Class / stream score sheet ---------- */}
          <Text style={styles.sectionLabel}>Class Assessment Report</Text>
          <View style={styles.pickerWrap}>
            <Picker selectedValue={classId} onValueChange={setClassId}>
              <Picker.Item label="Select class" value="" />
              {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
            </Picker>
          </View>

          {assessmentId && classId && rowsWithGradeRank.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TouchableOpacity
                style={[styles.pdfBtn, { flex: 1 }]}
                onPress={handleDownloadClassReport}
                disabled={!!generating}
              >
                {generating === "classDownload" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>⬇ Download Report</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pdfBtn, { flex: 1 }]}
                onPress={handleGenerateClassReport}
                disabled={!!generating}
              >
                {generating === "class" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>📤 Share Report</Text>}
              </TouchableOpacity>
            </View>
          )}

          {assessmentId && classId && (
            <>
              <View style={styles.legend}>
                {bands.map((b) => (
                  <View key={b.id} style={styles.legendItem}>
                    <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: b.color, marginRight: 4 }} />
                    <Text style={styles.legendText}>{b.short}</Text>
                  </View>
                ))}
              </View>
              {compareAssessmentId && (
                <Text style={styles.hintSmall}>
                  Showing deviations from {previousAssessmentLabel}. Green ↑ = improvement, Red ↓ = decline.
                </Text>
              )}
              <ScrollView horizontal>
                <View>
                  <View style={styles.headerRow}>
                    <Text style={[styles.th, { width: 32 }]}>Rank</Text>
                    <Text style={[styles.th, { width: 130 }]}>Learner</Text>
                    {learningAreas.map((s) => <Text key={s.id} style={[styles.th, { width: CELL, textAlign: "center" }]}>{s.code}</Text>)}
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Total</Text>
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Mean%</Text>
                    <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Mean Pts</Text>
                    <Text style={[styles.th, { width: 52, textAlign: "center" }]}>S.Rank</Text>
                    <Text style={[styles.th, { width: 52, textAlign: "center" }]}>G.Rank</Text>
                  </View>
                  <ScrollView>
                    {rowsWithGradeRank.map((r) => {
                      const dev = deviations[r.student?.id];
                      return (
                        <View key={r.student.id} style={styles.dataRow}>
                          <Text style={[styles.td, { width: 32, textAlign: "center", fontWeight: "700" }]}>{r.rank}</Text>
                          <Text style={[styles.td, { width: 130, fontWeight: "600" }]} numberOfLines={1}>{r.student.name}</Text>
                          {learningAreas.map((s) => {
                            const v = r.subjScores[s.id];
                            const band = getBand(v, bands);
                            const deviation = dev?.learningAreas?.[s.id];
                            return (
                              <View key={s.id} style={{ width: CELL, alignItems: 'center', justifyContent: 'center', backgroundColor: band ? band.color + "33" : undefined }}>
                                <Text style={[styles.td, { textAlign: "center", color: COLORS.ink, fontWeight: band ? "700" : "400", padding: 4 }]}>
                                  {v === undefined || v === null ? "—" : v}
                                </Text>
                                {compareAssessmentId && deviation !== undefined && deviation !== null && (
                                  <DeviationIndicator value={deviation} isRank={false} />
                                )}
                              </View>
                            );
                          })}
                          <View style={{ width: CELL, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={[styles.td, { textAlign: "center", fontWeight: "700", padding: 4 }]}>{r.total || 0}</Text>
                            {compareAssessmentId && <DeviationIndicator value={dev?.totalMarks} isRank={false} />}
                          </View>
                          <View style={{ width: CELL, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={[styles.td, { textAlign: "center", fontWeight: "700", padding: 4 }]}>
                              {r.mean !== null ? r.mean.toFixed(1) : "—"}
                            </Text>
                            {compareAssessmentId && <DeviationIndicator value={dev?.meanPercent} isRank={false} />}
                          </View>
                          <View style={{ width: CELL, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={[styles.td, { textAlign: "center", fontWeight: "700", padding: 4 }]}>
                              {r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"}
                            </Text>
                            {compareAssessmentId && <DeviationIndicator value={dev?.meanPoints} isRank={false} />}
                          </View>
                          <View style={{ width: 52, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={[styles.td, { textAlign: "center", fontWeight: "700", padding: 4 }]}>
                              {r.streamRank || "—"}
                            </Text>
                            {compareAssessmentId && <DeviationIndicator value={dev?.streamRank} isRank={true} />}
                          </View>
                          <View style={{ width: 52, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={[styles.td, { textAlign: "center", fontWeight: "700", padding: 4 }]}>
                              {r.gradeRank || "—"}
                            </Text>
                            {compareAssessmentId && <DeviationIndicator value={dev?.gradeRank} isRank={true} />}
                          </View>
                        </View>
                      );
                    })}
                    {rowsWithGradeRank.length === 0 && <Text style={styles.hint}>No learners in this class.</Text>}
                  </ScrollView>
                </View>
              </ScrollView>
            </>
          )}

          {/* ---------- Combined streams ranked list ---------- */}
          <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Combined streams ranked list</Text>
          <Text style={styles.hintSmall}>Pick one or more streams (e.g. 9 Yellow, or 9 Yellow &amp; 9 Green together) for the assessment selected above.</Text>
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
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[styles.pdfBtn, { flex: 1 }, (!assessmentId || selectedStreamIds.length === 0) && styles.pdfBtnDisabled]}
              onPress={handleDownloadCombined}
              disabled={!assessmentId || selectedStreamIds.length === 0 || generatingCombined}
            >
              {generatingCombined ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>⬇ Download Combined</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pdfBtn, { flex: 1 }, (!assessmentId || selectedStreamIds.length === 0) && styles.pdfBtnDisabled]}
              onPress={handleGenerateCombined}
              disabled={!assessmentId || selectedStreamIds.length === 0 || generatingCombined}
            >
              {generatingCombined ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>📤 Share Combined</Text>}
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
  dataRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff", alignItems: 'center' },
  td: { fontSize: 12, padding: 8, color: COLORS.ink },
  deviationText: { fontSize: 10, padding: 2, textAlign: 'center' },
  streamGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  streamChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "#fff" },
  streamChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  streamChipText: { fontSize: 12.5, color: COLORS.ink, fontWeight: "600" },
  streamChipTextActive: { color: "#fff" },
});
