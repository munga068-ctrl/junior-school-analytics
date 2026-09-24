import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getBand, maxPointsOf, getOrdinalSuffix } from "../utils/constants";
import { listenAssessmentScores, getScoresForAssessments } from "../utils/db";
import {
  computeAnalysis, getGradeForClass, getTermKey, getTermOptions, buildTermAverageScores,
} from "../utils/analysis";
import { generateAndSharePdf, generateAndDownloadPdf, buildAnalysisReportHtml } from "../utils/pdf";

const BAR_COLORS = ["#1F4B43", "#D9A441", "#6B8E23", "#C0392B", "#2E6B5E", "#8E5FB0"];

function BarRow({ label, value, max, color, sublabel }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 12.5, color: COLORS.ink, fontWeight: "700" }}>{label}</Text>
        <Text style={{ fontSize: 12.5, color: COLORS.inkSoft, fontWeight: "600" }}>
          {value.toFixed(2)} pts{sublabel ? `  ·  ${sublabel}` : ""}
        </Text>
      </View>
      <View style={{ height: 12, backgroundColor: COLORS.border, borderRadius: 6, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 6 }} />
      </View>
    </View>
  );
}

export default function AnalysisScreen({ schoolId, classes, learningAreas, learners, assessments, bands, meta }) {
  const [termKey, setTermKey] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [selectedGrades, setSelectedGrades] = useState([]); // empty = all grades
  const [data, setData] = useState({});
  const [baseline, setBaseline] = useState(null);
  const [generating, setGenerating] = useState("");

  const termOptions = useMemo(() => getTermOptions(assessments), [assessments]);
  const assessmentsInTerm = useMemo(() => assessments.filter((e) => getTermKey(e) === termKey), [assessments, termKey]);

  useEffect(() => { setAssessmentId(""); }, [termKey]);

  useEffect(() => {
    if (!assessmentId) { setData({}); return; }
    const unsub = listenAssessmentScores(schoolId, assessmentId, setData);
    return unsub;
  }, [schoolId, assessmentId]);

  const assessment = assessments.find((e) => e.id === assessmentId);
  const maxPoints = maxPointsOf(bands);

  const gradesAvailable = useMemo(
    () => [...new Set(classes.map((c) => getGradeForClass(c)))].sort(),
    [classes]
  );
  const effectiveGrades = selectedGrades.length ? selectedGrades : gradesAvailable;
  const filteredClasses = useMemo(
    () => classes.filter((c) => effectiveGrades.includes(getGradeForClass(c))),
    [classes, effectiveGrades]
  );
  const filteredLearners = useMemo(
    () => learners.filter((s) => filteredClasses.some((c) => c.id === s.classId)),
    [learners, filteredClasses]
  );

  const toggleGrade = (g) => {
    setSelectedGrades((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const analysis = useMemo(() => {
    if (!assessmentId) return null;
    return computeAnalysis({ examScores: data, classes: filteredClasses, students: filteredLearners, subjects: learningAreas, bands });
  }, [assessmentId, data, filteredClasses, filteredLearners, learningAreas, bands]);

  // Baseline for the Deviation column: average of other assessments in the term
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!assessmentId || assessmentsInTerm.length <= 1) { setBaseline(null); return; }
      const otherAssessmentIds = assessmentsInTerm.filter((e) => e.id !== assessmentId).map((e) => e.id);
      if (otherAssessmentIds.length === 0) { setBaseline(null); return; }
      try {
        const scoresByAssessment = await getScoresForAssessments(schoolId, otherAssessmentIds);
        const { avgScores } = buildTermAverageScores(otherAssessmentIds, scoresByAssessment, filteredLearners, learningAreas);
        const baselineAnalysis = computeAnalysis({ examScores: avgScores, classes: filteredClasses, students: filteredLearners, subjects: learningAreas, bands });
        if (!cancelled) setBaseline(baselineAnalysis);
      } catch {
        if (!cancelled) setBaseline(null);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [schoolId, assessmentId, assessmentsInTerm, filteredClasses, filteredLearners, learningAreas, bands]);

  const handleShare = async () => {
    if (!analysis) return;
    setGenerating("share");
    try {
      const html = buildAnalysisReportHtml({ meta, exam: assessment, assessment, analysis, baseline, bands, learningAreas });
      await generateAndSharePdf(html, "Performance Analysis");
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating("");
  };

  const handleDownload = async () => {
    if (!analysis) return;
    setGenerating("download");
    try {
      const html = buildAnalysisReportHtml({ meta, exam: assessment, assessment, analysis, baseline, bands, learningAreas });
      await generateAndDownloadPdf(html, `${assessment?.name || "Performance"}_Analysis`);
    } catch (e) {
      Alert.alert("Couldn't download PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating("");
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 14 }}
      removeClippedSubviews={true}
      maxToRenderPerBatch={5}
      windowSize={5}
    >
      <View style={styles.pickerWrap}>
        <Picker selectedValue={termKey} onValueChange={setTermKey}>
          <Picker.Item label="Select term" value="" />
          {termOptions.map((t) => <Picker.Item key={t.key} label={`Term ${t.term}, ${t.year}`} value={t.key} />)}
        </Picker>
      </View>

      {termKey && (
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
      )}

      {termKey && (
        <>
          <Text style={styles.sectionSmall}>Grades to include</Text>
          <Text style={styles.hintSmall}>Leave all unselected for every grade, or pick specific ones to compare.</Text>
          <View style={styles.chipRow}>
            {gradesAvailable.map((g) => {
              const checked = selectedGrades.includes(g);
              return (
                <TouchableOpacity key={g} style={[styles.chip, checked && styles.chipActive]} onPress={() => toggleGrade(g)}>
                  <Text style={[styles.chipText, checked && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {!termKey && <Text style={styles.hint}>Choose a term, then an assessment, to see rankings and comparisons.</Text>}
      {termKey && !assessmentId && <Text style={styles.hint}>Choose an assessment to see rankings and comparisons.</Text>}

      {assessmentId && analysis && (
        <>
          {analysis.rows.length === 0 ? (
            <Text style={styles.hint}>No scores recorded yet for this assessment.</Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
                <TouchableOpacity
                  style={[styles.pdfBtn, { flex: 1 }]}
                  onPress={handleDownload}
                  disabled={!!generating}
                >
                  {generating === "download" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>⬇ Download PDF</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pdfBtn, { flex: 1 }]}
                  onPress={handleShare}
                  disabled={!!generating}
                >
                  {generating === "share" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>📤 Share PDF</Text>}
                </TouchableOpacity>
              </View>

              <Text style={styles.section}>Grade ranking &amp; comparison</Text>
              <Text style={styles.hintSmall}>Performance compared across grade levels with learner counts.</Text>
              {analysis.gradeStats.map((g, i) => (
                <BarRow
                  key={g.grade}
                  label={`${g.rank}.  ${g.grade}`}
                  value={g.meanPoints}
                  max={maxPoints}
                  color={BAR_COLORS[i % BAR_COLORS.length]}
                  sublabel={`${g.learnerCount} learner${g.learnerCount === 1 ? "" : "s"}`}
                />
              ))}

              <Text style={styles.section}>Stream performance</Text>
              {analysis.streamStats.map((s, i) => (
                <BarRow
                  key={s.classId}
                  label={`${s.rank}.  ${s.className}`}
                  value={s.meanPoints}
                  max={maxPoints}
                  color={BAR_COLORS[i % BAR_COLORS.length]}
                  sublabel={`${s.learnerCount} learners`}
                />
              ))}

              <Text style={styles.section}>Learning area performance across grades</Text>
              <Text style={styles.hintSmall}>Grades ordered best to last. Deviation compares this assessment to other assessments this term.</Text>
              <ScrollView horizontal>
                <View style={styles.tableWrap}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.th, { width: 120, textAlign: "left" }]}>Learning Area</Text>
                    {analysis.gradesPresentRanked.map((g) => (
                      <Text key={g} style={[styles.th, { width: 56, textAlign: "center" }]}>{g.replace("Grade ", "G")}</Text>
                    ))}
                    <Text style={[styles.th, { width: 62, textAlign: "center" }]}>Dev.</Text>
                    {bands.map((b) => (
                      <Text key={b.id} style={[styles.th, { width: 40, textAlign: "center" }]}>{b.short}</Text>
                    ))}
                  </View>
                  {analysis.subjectByGrade.map((row) => {
                    const overall = analysis.subjectOverallMean[row.subject.id];
                    const base = baseline?.subjectOverallMean?.[row.subject.id];
                    const dev = overall != null && base != null ? overall - base : null;
                    const levelCounts = analysis.subjectLevelCounts.find((c) => c.subject.id === row.subject.id)?.counts || {};
                    return (
                      <View key={row.subject.id} style={styles.dataRow}>
                        <Text style={[styles.td, { width: 120 }]} numberOfLines={1}>{row.subject.name}</Text>
                        {analysis.gradesPresentRanked.map((g) => {
                          const v = row.perGrade[g];
                          const band = v !== null ? getBand(v, bands) : null;
                          return (
                            <Text
                              key={g}
                              style={[styles.td, { width: 56, textAlign: "center", backgroundColor: band ? band.color + "33" : undefined, fontWeight: band ? "700" : "400" }]}
                            >
                              {v !== null ? v.toFixed(1) : "—"}
                            </Text>
                          );
                        })}
                        <Text style={[styles.td, { width: 62, textAlign: "center", fontWeight: "700", color: dev === null ? COLORS.inkSoft : dev >= 0 ? "#1a9850" : "#d73027" }]}>
                          {dev === null ? "—" : `${dev >= 0 ? "+" : ""}${dev.toFixed(1)}`}
                        </Text>
                        {bands.map((b) => (
                          <Text key={b.id} style={[styles.td, { width: 40, textAlign: "center" }]}>{levelCounts[b.short] || 0}</Text>
                        ))}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              <Text style={styles.section}>Performance levels by stream</Text>
              <Text style={styles.hintSmall}>Streams ordered best to last. Counts are number of learners at each level.</Text>
              <ScrollView horizontal>
                <View style={styles.tableWrap}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.th, { width: 60, textAlign: "left" }]}>Level</Text>
                    {analysis.streamLevelCounts.map((s) => (
                      <Text key={s.classId} style={[styles.th, { width: 70, textAlign: "center" }]} numberOfLines={1}>{s.initials || s.className}</Text>
                    ))}
                  </View>
                  {bands.map((b) => (
                    <View key={b.id} style={styles.dataRow}>
                      <Text style={[styles.td, { width: 60, fontWeight: "700" }]}>{b.short}</Text>
                      {analysis.streamLevelCounts.map((s) => (
                        <Text key={s.classId} style={[styles.td, { width: 70, textAlign: "center" }]}>{s.counts[b.short] || 0}</Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>

              <Text style={styles.section}>Gender performance — Boys vs Girls</Text>
              {analysis.genderStats.map((g, i) => (
                g.meanPoints !== null ? (
                  <BarRow key={g.gender} label={`${g.label} (${g.learnerCount})`} value={g.meanPoints} max={maxPoints} color={i === 0 ? "#1F4B43" : "#D9A441"} />
                ) : (
                  <Text key={g.gender} style={styles.hintSmall}>No {g.label.toLowerCase()} with scores yet.</Text>
                )
              ))}

              <Text style={[styles.sectionSmall, { marginTop: 10 }]}>By learning area</Text>
              <View style={styles.tableWrap}>
                <View style={styles.headerRow}>
                  <Text style={[styles.th, { flex: 1.4, textAlign: "left" }]}>Learning Area</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Boys</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Girls</Text>
                </View>
                {analysis.subjectByGender.map((row) => (
                  <View key={row.subject.id} style={styles.dataRow}>
                    <Text style={[styles.td, { flex: 1.4 }]} numberOfLines={1}>{row.subject.name}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>{row.perGender.M !== null ? row.perGender.M.toFixed(1) : "—"}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>{row.perGender.F !== null ? row.perGender.F.toFixed(1) : "—"}</Text>
                  </View>
                ))}
              </View>

              <Text style={[styles.sectionSmall, { marginTop: 10 }]}>By performance level</Text>
              <View style={styles.tableWrap}>
                <View style={styles.headerRow}>
                  <Text style={[styles.th, { flex: 1, textAlign: "left" }]}>Level</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Boys</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Girls</Text>
                </View>
                {bands.map((b) => (
                  <View key={b.id} style={styles.dataRow}>
                    <Text style={[styles.td, { flex: 1, fontWeight: "700" }]}>{b.short}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>{analysis.genderLevelCounts.find((g) => g.gender === "M")?.counts[b.short] || 0}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>{analysis.genderLevelCounts.find((g) => g.gender === "F")?.counts[b.short] || 0}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 14 },
  hint: { color: COLORS.inkSoft, fontSize: 13.5 },
  hintSmall: { color: COLORS.inkSoft, fontSize: 11.5, marginBottom: 8, marginTop: -4 },
  sectionSmall: { fontSize: 13, fontWeight: "700", color: COLORS.primary, marginBottom: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#fff" },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, color: COLORS.ink, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  pdfBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 12, alignItems: "center" },
  pdfBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  section: { fontSize: 15, fontWeight: "700", color: COLORS.primary, marginTop: 10, marginBottom: 2 },
  tableWrap: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, overflow: "hidden", marginBottom: 10 },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.primary },
  th: { color: "#fff", fontSize: 10, fontWeight: "700", padding: 6 },
  dataRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border },
  td: { fontSize: 11, padding: 6, color: COLORS.ink },
});
