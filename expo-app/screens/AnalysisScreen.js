import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getBand, maxPointsOf } from "../utils/constants";
import { listenExamScores } from "../utils/db";
import { computeAnalysis } from "../utils/analysis";
import { generateAndSharePdf, buildAnalysisReportHtml } from "../utils/pdf";

const BAR_COLORS = ["#1F4B43", "#D9A441", "#6B8E23", "#C0392B", "#2E6B5E", "#8E5FB0"];

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.max(3, (value / max) * 100) : 0;
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <Text style={{ fontSize: 12.5, color: COLORS.ink, fontWeight: "700" }}>{label}</Text>
        <Text style={{ fontSize: 12.5, color: COLORS.inkSoft, fontWeight: "600" }}>{value.toFixed(2)} pts</Text>
      </View>
      <View style={{ height: 12, backgroundColor: COLORS.border, borderRadius: 6, overflow: "hidden" }}>
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 6 }} />
      </View>
    </View>
  );
}

export default function AnalysisScreen({ classes, subjects, students, exams, bands, meta }) {
  const [examId, setExamId] = useState("");
  const [data, setData] = useState({});
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!examId) return;
    const unsub = listenExamScores(examId, setData);
    return unsub;
  }, [examId]);

  const exam = exams.find((e) => e.id === examId);
  const maxPoints = maxPointsOf(bands);

  const analysis = useMemo(() => {
    if (!examId) return null;
    return computeAnalysis({ examScores: data, classes, students, subjects, bands });
  }, [examId, data, classes, students, subjects, bands]);

  const handleDownload = async () => {
    if (!analysis) return;
    setGenerating(true);
    try {
      const html = buildAnalysisReportHtml({ meta, exam, analysis, bands });
      await generateAndSharePdf(html, "Performance analysis");
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 14 }}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={examId} onValueChange={setExamId}>
          <Picker.Item label="Select exam" value="" />
          {exams.map((e) => (
            <Picker.Item
              key={e.id}
              label={`${e.name}${e.term ? ` — Term ${e.term}` : ""}${e.year ? ` ${e.year}` : ""}`}
              value={e.id}
            />
          ))}
        </Picker>
      </View>

      {!examId && <Text style={styles.hint}>Choose an exam to see rankings and comparisons across Grade 7, 8, and 9.</Text>}

      {examId && analysis && (
        <>
          {analysis.rows.length === 0 ? (
            <Text style={styles.hint}>No scores recorded yet for this exam.</Text>
          ) : (
            <>
              <TouchableOpacity style={styles.pdfBtn} onPress={handleDownload} disabled={generating}>
                {generating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Download analysis (PDF)</Text>}
              </TouchableOpacity>

              <Text style={styles.section}>Grade ranking</Text>
              {analysis.gradeStats.map((g, i) => (
                <BarRow key={g.grade} label={`#${g.rank}  ${g.grade}`} value={g.meanPoints} max={maxPoints} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}

              <Text style={styles.section}>Stream performance</Text>
              {analysis.streamStats.map((s, i) => (
                <BarRow key={s.classId} label={`#${s.rank}  ${s.className}`} value={s.meanPoints} max={maxPoints} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}

              <Text style={styles.section}>Subject performance across grades</Text>
              <View style={styles.tableWrap}>
                <View style={styles.headerRow}>
                  <Text style={[styles.th, { flex: 1.4, textAlign: "left" }]}>Subject</Text>
                  {analysis.gradesPresent.map((g) => (
                    <Text key={g} style={[styles.th, { flex: 1, textAlign: "center" }]}>{g.replace("Grade ", "G")}</Text>
                  ))}
                </View>
                {analysis.subjectByGrade.map((row) => (
                  <View key={row.subject.id} style={styles.dataRow}>
                    <Text style={[styles.td, { flex: 1.4 }]} numberOfLines={1}>{row.subject.name}</Text>
                    {analysis.gradesPresent.map((g) => {
                      const v = row.perGrade[g];
                      const band = v !== null ? getBand(v, bands) : null;
                      return (
                        <Text
                          key={g}
                          style={[styles.td, { flex: 1, textAlign: "center", backgroundColor: band ? band.color + "33" : undefined, fontWeight: band ? "700" : "400" }]}
                        >
                          {v !== null ? v.toFixed(1) : "—"}
                        </Text>
                      );
                    })}
                  </View>
                ))}
              </View>

              {analysis.gradesPresent.map((g) => (
                <View key={g}>
                  <Text style={styles.section}>{g} — general mark sheet</Text>
                  <Text style={styles.hintSmall}>All streams combined, ranked 1st to last.</Text>
                  <View style={styles.tableWrap}>
                    <View style={styles.headerRow}>
                      <Text style={[styles.th, { width: 34 }]}>Rank</Text>
                      <Text style={[styles.th, { flex: 1.6, textAlign: "left" }]}>Student</Text>
                      <Text style={[styles.th, { flex: 1, textAlign: "left" }]}>Stream</Text>
                      <Text style={[styles.th, { width: 62, textAlign: "center" }]}>Mean Pts</Text>
                    </View>
                    {analysis.gradeMarkSheets[g].map((r) => (
                      <View key={r.student.id} style={styles.dataRow}>
                        <Text style={[styles.td, { width: 34, textAlign: "center", fontWeight: "700" }]}>{r.gradeRank}</Text>
                        <Text style={[styles.td, { flex: 1.6, fontWeight: "600" }]} numberOfLines={1}>{r.student.name}</Text>
                        <Text style={[styles.td, { flex: 1 }]} numberOfLines={1}>{r.classObj?.name || "—"}</Text>
                        <Text style={[styles.td, { width: 62, textAlign: "center", fontWeight: "700" }]}>{r.meanPoints !== null ? r.meanPoints.toFixed(2) : "—"}</Text>
                      </View>
                    ))}
                    {analysis.gradeMarkSheets[g].length === 0 && <Text style={[styles.hint, { padding: 10 }]}>No students with scores in this grade.</Text>}
                  </View>
                </View>
              ))}
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
  hintSmall: { color: COLORS.inkSoft, fontSize: 11.5, marginBottom: 8, marginTop: -6 },
  pdfBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 12, alignItems: "center", marginBottom: 18 },
  pdfBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  section: { fontSize: 15, fontWeight: "700", color: COLORS.primary, marginTop: 10, marginBottom: 10 },
  tableWrap: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, overflow: "hidden", marginBottom: 10 },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.primary },
  th: { color: "#fff", fontSize: 10.5, fontWeight: "700", padding: 7 },
  dataRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border },
  td: { fontSize: 11.5, padding: 7, color: COLORS.ink },
});
