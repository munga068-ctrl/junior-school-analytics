import React, { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getBand } from "../utils/constants";
import { listenExamScores } from "../utils/db";

export default function ReportsScreen({ classes, subjects, students, exams, bands }) {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [data, setData] = useState({});

  useEffect(() => {
    if (!examId) return;
    const unsub = listenExamScores(examId, setData);
    return unsub;
  }, [examId]);

  const classStudents = students.filter((s) => s.classId === classId);

  const rows = useMemo(() => {
    const r = classStudents.map((s) => {
      const subjScores = {};
      let total = 0, count = 0;
      subjects.forEach((sub) => {
        const v = data?.[s.id]?.[sub.id];
        subjScores[sub.id] = v;
        if (v !== undefined && v !== null) { total += Number(v); count++; }
      });
      const mean = count ? total / count : null;
      return { student: s, subjScores, total, mean };
    });
    const ranked = [...r].filter((x) => x.mean !== null).sort((a, b) => b.mean - a.mean);
    r.forEach((x) => { x.rank = x.mean === null ? "—" : ranked.findIndex((y) => y.student.id === x.student.id) + 1; });
    return r;
  }, [data, classStudents, subjects]);

  const CELL = 62;

  return (
    <View style={styles.container}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={examId} onValueChange={setExamId}>
          <Picker.Item label="Select exam" value="" />
          {exams.map((e) => <Picker.Item key={e.id} label={e.name} value={e.id} />)}
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
                <Text style={[styles.th, { width: 140 }]}>Student</Text>
                {subjects.map((s) => <Text key={s.id} style={[styles.th, { width: CELL, textAlign: "center" }]}>{s.code}</Text>)}
                <Text style={[styles.th, { width: CELL, textAlign: "center" }]}>Mean</Text>
                <Text style={[styles.th, { width: 50, textAlign: "center" }]}>Rank</Text>
              </View>
              <ScrollView>
                {rows.map((r) => (
                  <View key={r.student.id} style={styles.dataRow}>
                    <Text style={[styles.td, { width: 140, fontWeight: "600" }]} numberOfLines={1}>{r.student.name}</Text>
                    {subjects.map((s) => {
                      const v = r.subjScores[s.id];
                      const band = getBand(v, bands);
                      return (
                        <Text
                          key={s.id}
                          style={[styles.td, { width: CELL, textAlign: "center", backgroundColor: band ? band.color + "26" : undefined, color: band ? band.color : COLORS.inkSoft, fontWeight: band ? "700" : "400" }]}
                        >
                          {v === undefined || v === null ? "—" : v}
                        </Text>
                      );
                    })}
                    <Text style={[styles.td, { width: CELL, textAlign: "center", fontWeight: "700" }]}>{r.mean !== null ? r.mean.toFixed(1) : "—"}</Text>
                    <Text style={[styles.td, { width: 50, textAlign: "center", fontWeight: "700" }]}>{r.rank}</Text>
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
  legend: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10, gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendText: { fontSize: 11.5, color: COLORS.inkSoft },
  headerRow: { flexDirection: "row", backgroundColor: COLORS.primary },
  th: { color: "#fff", fontSize: 11.5, fontWeight: "700", padding: 8 },
  dataRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff" },
  td: { fontSize: 12.5, padding: 8, color: COLORS.ink },
});
