import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getBand, maxPointsOf } from "../utils/constants";
import { listenExamScores } from "../utils/db";
import { computeAnalysis, getGradeForClass } from "../utils/analysis";
import { generateAndSharePdf, buildClassReportHtml, buildStudentReportCardsHtml } from "../utils/pdf";

export default function ReportsScreen({ classes, subjects, students, exams, bands, meta, teachers }) {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [data, setData] = useState({});
  const [generating, setGenerating] = useState("");

  useEffect(() => {
    if (!examId) return;
    const unsub = listenExamScores(examId, setData);
    return unsub;
  }, [examId]);

  const classStudents = students.filter((s) => s.classId === classId);
  const exam = exams.find((e) => e.id === examId);
  const examName = exam?.name || "";
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

  const handleGenerate = async (kind) => {
    if (rows.length === 0) return;
    setGenerating(kind);
    try {
      let finalRows = rows;
      if (kind === "cards") {
        // Grade-wide rank (across all streams in the grade), not just this class.
        const analysis = computeAnalysis({ examScores: data, classes, students, subjects, bands });
        const grade = getGradeForClass(classes.find((c) => c.id === classId));
        const gradeSheet = analysis.gradeMarkSheets[grade] || [];
        finalRows = rows.map((r) => {
          const match = gradeSheet.find((g) => g.student.id === r.student.id);
          return { ...r, gradeRank: match?.gradeRank ?? "—", gradeTotal: gradeSheet.length };
        });
      }

      const classTeacher = teachers?.find((t) => t.role === "Class Teacher" && t.classId === classId);
      const headTeacher = teachers?.find((t) => t.role === "Head Teacher");

      const args = {
        meta, exam, className, subjects, rows: finalRows, bands,
        classTeacherName: classTeacher?.name || "",
        headTeacherName: headTeacher?.name || "",
      };
      const html = kind === "class" ? buildClassReportHtml(args) : buildStudentReportCardsHtml(args);
      await generateAndSharePdf(html, kind === "class" ? "Class report" : "Report cards");
    } catch (e) {
      Alert.alert("Couldn't generate PDF", e?.message || "Something went wrong. Try again.");
    }
    setGenerating("");
  };

  return (
    <View style={styles.container}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={examId} onValueChange={setExamId}>
          <Picker.Item label="Select exam" value="" />
          {exams.map((e) => <Picker.Item key={e.id} label={`${e.name}${e.term ? ` — Term ${e.term}` : ""}${e.year ? ` ${e.year}` : ""}`} value={e.id} />)}
        </Picker>
      </View>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={classId} onValueChange={setClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>

      {(!examId || !classId) && <Text style={styles.hint}>Choose an exam and class to view the report.</Text>}

      {examId && classId && (
        <>
          {rows.length > 0 && (
            <View style={styles.pdfRow}>
              <TouchableOpacity style={styles.pdfBtn} onPress={() => handleGenerate("class")} disabled={!!generating}>
                {generating === "class" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Class report (PDF)</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.pdfBtn} onPress={() => handleGenerate("cards")} disabled={!!generating}>
                {generating === "cards" ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.pdfBtnText}>Report cards (PDF)</Text>}
              </TouchableOpacity>
            </View>
          )}

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 10 },
  hint: { color: COLORS.inkSoft, fontSize: 13.5, marginTop: 10 },
  pdfRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  pdfBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 11, alignItems: "center", justifyContent: "center" },
  pdfBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  legend: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10, rowGap: 8, columnGap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  legendText: { fontSize: 11, color: COLORS.inkSoft },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.primary },
  th: { color: "#fff", fontSize: 11, fontWeight: "700", padding: 8 },
  dataRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff" },
  td: { fontSize: 12, padding: 8, color: COLORS.ink },
});
