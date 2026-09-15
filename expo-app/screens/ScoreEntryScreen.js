import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS } from "../utils/constants";
import { listenExamScores, saveExamScores } from "../utils/db";

export default function ScoreEntryScreen({ classes, subjects, students, exams }) {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [examScores, setExamScores] = useState({});
  const [local, setLocal] = useState({});
  const [saved, setSaved] = useState(false);

  const classStudents = students.filter((s) => s.classId === classId);

  useEffect(() => {
    if (!examId) return;
    const unsub = listenExamScores(examId, (data) => setExamScores(data));
    return unsub;
  }, [examId]);

  useEffect(() => {
    const map = {};
    classStudents.forEach((s) => { map[s.id] = examScores?.[s.id]?.[subjectId] ?? ""; });
    setLocal(map);
    // eslint-disable-next-line
  }, [examScores, classId, subjectId]);

  const save = async () => {
    const next = { ...examScores };
    classStudents.forEach((s) => {
      const v = local[s.id];
      next[s.id] = { ...(next[s.id] || {}), [subjectId]: v === "" ? null : Number(v) };
    });
    await saveExamScores(examId, next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
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
      <View style={styles.pickerWrap}>
        <Picker selectedValue={subjectId} onValueChange={setSubjectId}>
          <Picker.Item label="Select learning area" value="" />
          {subjects.map((s) => <Picker.Item key={s.id} label={s.name} value={s.id} />)}
        </Picker>
      </View>

      {(!examId || !classId || !subjectId) && (
        <Text style={styles.hint}>Choose an exam, class, and learning area to begin.</Text>
      )}

      {examId && classId && subjectId && (
        <>
          <FlatList
            data={classStudents}
            keyExtractor={(i) => i.id}
            renderItem={({ item, index }) => (
              <View style={styles.row}>
                <Text style={styles.idx}>{index + 1}</Text>
                <Text style={styles.name}>{item.name}</Text>
                <TextInput
                  style={styles.scoreInput}
                  keyboardType="numeric"
                  value={String(local[item.id] ?? "")}
                  onChangeText={(v) => setLocal({ ...local, [item.id]: v })}
                />
              </View>
            )}
            ListEmptyComponent={<Text style={styles.hint}>No students in this class.</Text>}
          />
          {classStudents.length > 0 && (
            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save scores"}</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 10 },
  hint: { color: COLORS.inkSoft, fontSize: 13.5, marginTop: 10 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.border, gap: 8 },
  idx: { width: 22, fontSize: 12.5, color: COLORS.inkSoft },
  name: { flex: 1, fontSize: 13.5, color: COLORS.ink },
  scoreInput: { width: 64, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 8, textAlign: "center", backgroundColor: "#fff" },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 6, padding: 13, alignItems: "center", marginTop: 12 },
  saveBtnText: { color: "#fff", fontWeight: "700" },
});
