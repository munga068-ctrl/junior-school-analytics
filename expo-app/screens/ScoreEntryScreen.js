import React, { useState, useEffect, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS } from "../utils/constants";
import { listenAssessmentScores, saveAssessmentScores } from "../utils/db";
import { getGradeForClass, examAppliesToGrade } from "../utils/analysis";

export default function ScoreEntryScreen({ schoolId, classes, learningAreas, learners, assessments }) {
  const [assessmentId, setAssessmentId] = useState("");
  const [classId, setClassId] = useState("");
  const [learningAreaId, setLearningAreaId] = useState("");
  const [assessmentScores, setAssessmentScores] = useState({});
  const [local, setLocal] = useState({});
  const [saved, setSaved] = useState(false);

  const classLearners = learners.filter((s) => s.classId === classId && !s.graduated);
  const selectedClass = classes.find((c) => c.id === classId);
  const classGrade = selectedClass ? getGradeForClass(selectedClass) : "";

  // Only assessments that actually apply to this class's grade (or apply to
  // every grade) make sense to pick here.
  const assessmentsForClass = useMemo(
    () => (classId ? assessments.filter((e) => examAppliesToGrade(e, classGrade)) : assessments),
    [assessments, classId, classGrade]
  );

  // If the class changes and the previously chosen assessment no longer applies
  // to it, clear the assessment selection rather than silently keeping a mismatch.
  useEffect(() => {
    if (assessmentId && classId && !assessmentsForClass.some((e) => e.id === assessmentId)) {
      setAssessmentId("");
    }
  }, [classId, assessmentId, assessmentsForClass]);

  useEffect(() => {
    if (!assessmentId || !schoolId) return;
    const unsub = listenAssessmentScores(schoolId, assessmentId, (data) => setAssessmentScores(data));
    return unsub;
  }, [schoolId, assessmentId]);

  useEffect(() => {
    const map = {};
    classLearners.forEach((s) => { map[s.id] = assessmentScores?.[s.id]?.[learningAreaId] ?? ""; });
    setLocal(map);
  }, [assessmentScores, classId, learningAreaId, classLearners]);

  const save = async () => {
    const next = { ...assessmentScores };
    classLearners.forEach((s) => {
      const v = local[s.id];
      next[s.id] = { ...(next[s.id] || {}), [learningAreaId]: v === "" ? null : Number(v) };
    });
    await saveAssessmentScores(schoolId, assessmentId, next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <View style={styles.container}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={classId} onValueChange={setClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={assessmentId} onValueChange={setAssessmentId}>
          <Picker.Item label="Select assessment" value="" />
          {assessmentsForClass.map((e) => (
            <Picker.Item
              key={e.id}
              label={`${e.name}${e.sequence ? ` (${e.sequence})` : ""}${e.term ? ` — Term ${e.term}` : ""}${e.year ? ` ${e.year}` : ""}`}
              value={e.id}
            />
          ))}
        </Picker>
      </View>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={learningAreaId} onValueChange={setLearningAreaId}>
          <Picker.Item label="Select learning area" value="" />
          {learningAreas.map((s) => <Picker.Item key={s.id} label={s.name} value={s.id} />)}
        </Picker>
      </View>

      {(!assessmentId || !classId || !learningAreaId) && (
        <Text style={styles.hint}>Choose an assessment, class, and learning area to begin.</Text>
      )}

      {assessmentId && classId && learningAreaId && (
        <>
          <FlatList
            data={classLearners}
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
            ListEmptyComponent={<Text style={styles.hint}>No learners in this class.</Text>}
          />
          {classLearners.length > 0 && (
            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveBtnText}>{saved ? "Saved" : "Save marks"}</Text>
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
