import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS } from "../utils/constants";
import { updateLearner, removeLearner } from "../utils/db";

export default function EditLearnerScreen({ route, navigation, schoolId, classes, learners }) {
  const { learnerId } = route.params || {};
  const learner = learners.find((l) => l.id === learnerId);

  const [name, setName] = useState(learner?.name || "");
  const [admNo, setAdmNo] = useState(learner?.admNo || "");
  const [classId, setClassId] = useState(learner?.classId || "");
  const [gender, setGender] = useState(learner?.gender || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (learner) {
      setName(learner.name || "");
      setAdmNo(learner.admNo || "");
      setClassId(learner.classId || "");
      setGender(learner.gender || "");
    }
  }, [learner]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Validation Error", "Please enter the learner's name");
      return;
    }
    if (!classId) {
      Alert.alert("Validation Error", "Please select a class");
      return;
    }

    setSaving(true);
    try {
      await updateLearner(schoolId, learnerId, {
        name: name.trim(),
        admNo: admNo.trim(),
        classId,
        gender: gender || null,
      });
      Alert.alert("Success", "Learner details updated successfully", [
        { text: "OK", onPress: () => navigation.goBack() }
      ]);
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not save changes. Please try again.");
    }
    setSaving(false);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Learner",
      `Are you sure you want to delete ${learner?.name || "this learner"}? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeLearner(schoolId, learnerId);
              Alert.alert("Deleted", "Learner has been removed", [
                { text: "OK", onPress: () => navigation.goBack() }
              ]);
            } catch (e) {
              Alert.alert("Error", e?.message || "Could not delete learner");
            }
          }
        }
      ]
    );
  };

  if (!learner) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={styles.errorText}>Learner not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Edit Learner</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. Jane Wanjiru"
        value={name}
        onChangeText={setName}
      />

      <Text style={styles.label}>Assessment Number</Text>
      <TextInput
        style={styles.input}
        placeholder="e.g. 7210"
        value={admNo}
        onChangeText={setAdmNo}
      />

      <Text style={styles.label}>Class</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={classId} onValueChange={setClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => (
            <Picker.Item key={c.id} label={c.name} value={c.id} />
          ))}
        </Picker>
      </View>

      <Text style={styles.label}>Gender (Optional)</Text>
      <View style={styles.genderRow}>
        {[["M", "Male"], ["F", "Female"]].map(([val, label]) => (
          <TouchableOpacity
            key={val}
            style={[styles.genderChip, gender === val && styles.genderChipActive]}
            onPress={() => setGender(gender === val ? "" : val)}
          >
            <Text style={[styles.genderChipText, gender === val && styles.genderChipTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveBtn, saving && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
        <Text style={styles.deleteBtnText}>Delete Learner</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Cancel</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.primary, marginBottom: 20 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.ink, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 12,
    backgroundColor: "#fff",
    fontSize: 14,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  genderRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  genderChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#fff",
  },
  genderChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderChipText: { fontSize: 13, fontWeight: "600", color: COLORS.ink },
  genderChipTextActive: { color: "#fff" },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  deleteBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#C0392B",
    borderRadius: 6,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  deleteBtnText: { color: "#C0392B", fontWeight: "700", fontSize: 14 },
  backBtn: { marginTop: 16, paddingVertical: 10, alignItems: "center" },
  backBtnText: { color: COLORS.primary, fontWeight: "600", fontSize: 13.5 },
  errorText: { color: COLORS.inkSoft, fontSize: 15, marginBottom: 20 },
});
