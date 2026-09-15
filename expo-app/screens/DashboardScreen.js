import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS } from "../utils/constants";
import { saveMeta } from "../utils/db";

export default function DashboardScreen({ classes, subjects, students, exams, meta }) {
  const [name, setName] = useState(meta?.schoolName || "");

  useEffect(() => { setName(meta?.schoolName || ""); }, [meta?.schoolName]);

  const stats = [
    ["Classes", classes.length],
    ["Subjects", subjects.length],
    ["Students", students.length],
    ["Exams", exams.length],
  ];
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

      <Text style={[styles.heading, { marginTop: 24 }]}>School name</Text>
      <Text style={styles.hint}>Used as the header on generated PDF reports.</Text>
      <View style={styles.nameRow}>
        <TextInput
          style={styles.input}
          placeholder="e.g. Riverside Primary School"
          value={name}
          onChangeText={setName}
        />
        <TouchableOpacity style={styles.saveBtn} onPress={() => saveMeta({ ...(meta || {}), schoolName: name })}>
          <Text style={styles.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      {classes.length === 0 && (
        <Text style={styles.hint}>
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
  nameRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10, backgroundColor: "#fff" },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingHorizontal: 16, justifyContent: "center" },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  signOut: { marginTop: 30, alignSelf: "flex-start", borderWidth: 1, borderColor: "#E8C4BE", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  signOutText: { color: "#C0392B", fontSize: 13, fontWeight: "600" },
});
