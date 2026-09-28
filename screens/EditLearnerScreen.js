import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS } from "../utils/constants";
import { updateStudent, removeStudent } from "../utils/db";

export default function EditLearnerScreen({ navigation, student, classes }) {
  const [name, setName] = useState(student?.name || "");
  const [assessmentNo, setAssessmentNo] = useState(student?.admNo || "");
  const [classId, setClassId] = useState(student?.classId || "");
  const [gender, setGender] = useState(student?.gender || "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!student) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>This learner couldn't be found — they may have just been removed.</Text>
      </View>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Enter the learner's full name.");
      return;
    }
    if (!classId) {
      Alert.alert("Class required", "Choose which class this learner belongs to.");
      return;
    }
    setSaving(true);
    try {
      await updateStudent(student.id, {
        name: name.trim(),
        admNo: assessmentNo.trim(),
        classId,
        gender: gender || null,
      });
      navigation.goBack();
    } catch (e) {
      Alert.alert("Couldn't save changes", e?.message || "Something went wrong. Try again.");
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete learner",
      `Remove ${student.name} permanently? This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await removeStudent(student.id);
              navigation.goBack();
            } catch (e) {
              Alert.alert("Couldn't delete", e?.message || "Something went wrong. Try again.");
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ backgroundColor: COLORS.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.label}>Full name</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" />

      <Text style={styles.label}>Assessment No.</Text>
      <TextInput style={styles.input} value={assessmentNo} onChangeText={setAssessmentNo} placeholder="Assessment No." />

      <Text style={styles.label}>Class</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={classId} onValueChange={setClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>

      <Text style={styles.label}>Gender</Text>
      <View style={styles.genderRow}>
        {[["M", "Male"], ["F", "Female"]].map(([val, label]) => (
          <TouchableOpacity
            key={val}
            style={[styles.genderChip, gender === val && styles.genderChipActive]}
            onPress={() => setGender(gender === val ? "" : val)}
          >
            <Text style={[styles.genderChipText, gender === val && styles.genderChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {student.graduated && <Text style={styles.hint}>This learner has graduated. Editing their details won't move them back onto an active roster.</Text>}

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving || deleting}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving || deleting}>
        {deleting ? <ActivityIndicator color="#C0392B" /> : <Text style={styles.deleteBtnText}>Delete Learner</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: COLORS.bg, padding: 18 },
  label: { fontWeight: "700", color: COLORS.ink, marginBottom: 6, marginTop: 14, fontSize: 13.5 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 12, backgroundColor: "#fff", fontSize: 14 },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff" },
  genderRow: { flexDirection: "row", gap: 8 },
  genderChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 18, backgroundColor: "#fff" },
  genderChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderChipText: { fontSize: 13, color: COLORS.ink, fontWeight: "600" },
  genderChipTextActive: { color: "#fff" },
  hint: { color: COLORS.inkSoft, fontSize: 12.5, marginTop: 16, lineHeight: 17 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 14, alignItems: "center", marginTop: 26 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 14.5 },
  deleteBtn: { borderRadius: 6, paddingVertical: 14, alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: "#C0392B" },
  deleteBtnText: { color: "#C0392B", fontWeight: "700", fontSize: 14.5 },
});
