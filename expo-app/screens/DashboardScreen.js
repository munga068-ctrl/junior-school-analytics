import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS } from "../utils/constants";

export default function DashboardScreen({ classes, subjects, students, exams }) {
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
  heading: { fontSize: 18, fontWeight: "700", color: COLORS.primary, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 14, minWidth: "45%" },
  cardLabel: { fontSize: 12, color: COLORS.inkSoft },
  cardValue: { fontSize: 24, fontWeight: "700", color: COLORS.primary, marginTop: 4 },
  hint: { marginTop: 20, color: COLORS.inkSoft, fontSize: 13, lineHeight: 19 },
  signOut: { marginTop: 30, alignSelf: "flex-start", borderWidth: 1, borderColor: "#E8C4BE", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  signOutText: { color: "#C0392B", fontSize: 13, fontWeight: "600" },
});
