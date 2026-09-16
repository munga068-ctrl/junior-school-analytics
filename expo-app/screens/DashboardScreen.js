import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS } from "../utils/constants";
import { saveMeta } from "../utils/db";

const FIELDS = [
  { key: "schoolName", label: "School name", placeholder: "e.g. Riverside Primary School" },
  { key: "address", label: "School address", placeholder: "e.g. P.O. Box 1234, Nairobi" },
  { key: "tel", label: "Telephone", placeholder: "e.g. 0712 345 678" },
  { key: "email", label: "Email", placeholder: "e.g. info@school.ac.ke" },
  { key: "logoUrl", label: "School logo (image URL)", placeholder: "https://... (a hosted image link)" },
  { key: "termEndDate", label: "Term ends", placeholder: "e.g. 29-11-2026" },
  { key: "nextTermBeginsDate", label: "Next term begins", placeholder: "e.g. 05-01-2027" },
];

export default function DashboardScreen({ classes, subjects, students, exams, teachers, meta, isAdmin }) {
  const [form, setForm] = useState(meta || {});

  useEffect(() => { setForm(meta || {}); }, [meta]);

  const uniqueTeacherCount = new Set((teachers || []).map((t) => t.name.trim().toLowerCase())).size;

  const stats = [
    ["Classes", classes.length],
    ["Subjects", subjects.length],
    ["Students", students.length],
    ["Teachers", uniqueTeacherCount],
    ["Exams", exams.length],
  ];

  const save = () => saveMeta({ ...(meta || {}), ...form });

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
      <Text style={styles.heading}>Overview</Text>
      <View style={styles.grid}>
        {stats.map(([label, val]) => (
          <View key={label} style={styles.card}>
            <Text style={styles.cardLabel}>{label}</Text>
            <Text style={styles.cardValue}>{val}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.heading, { marginTop: 24 }]}>School details</Text>
      <Text style={styles.hint}>Shown on the header of every generated PDF report.</Text>
      {!isAdmin && (
        <Text style={[styles.hint, { fontStyle: "italic" }]}>Only an admin can edit these — ask your admin to make changes.</Text>
      )}

      {FIELDS.map((f) => (
        <View key={f.key} style={{ marginBottom: 12 }}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          {isAdmin ? (
            <TextInput
              style={[styles.input, { flex: 0 }]}
              placeholder={f.placeholder}
              value={form[f.key] || ""}
              onChangeText={(v) => setForm({ ...form, [f.key]: v })}
            />
          ) : (
            <Text style={styles.readonlyValue}>{meta?.[f.key] || "—"}</Text>
          )}
        </View>
      ))}

      {isAdmin && (
        <TouchableOpacity style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveBtnText}>Save school details</Text>
        </TouchableOpacity>
      )}

      {classes.length === 0 && (
        <Text style={[styles.hint, { marginTop: 20 }]}>
          Go to Setup to add your classes, subjects, and students. Then use Score entry and Reports.
        </Text>
      )}
      <TouchableOpacity style={styles.signOut} onPress={() => signOut(auth)}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  heading: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 14, minWidth: "45%" },
  cardLabel: { fontSize: 12, color: COLORS.inkSoft },
  cardValue: { fontSize: 24, fontWeight: "700", color: COLORS.primary, marginTop: 4 },
  hint: { color: COLORS.inkSoft, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: COLORS.ink, marginBottom: 4 },
  readonlyValue: { fontSize: 13.5, color: COLORS.inkSoft, paddingVertical: 6 },
  input: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10, backgroundColor: "#fff" },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  signOut: { marginTop: 30, alignSelf: "flex-start", borderWidth: 1, borderColor: "#E8C4BE", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  signOutText: { color: "#C0392B", fontSize: 13, fontWeight: "600" },
});
