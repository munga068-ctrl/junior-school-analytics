import React, { useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { COLORS } from "../utils/constants";
import { generateAndSharePdf, downloadPdf, buildClassListHtml } from "../utils/pdf";

export default function ClassListScreen({ classItem, students, meta }) {
  const [busy, setBusy] = useState(""); // "share" | "download" | ""

  const roster = [...students].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const fileLabel = `${classItem?.name || "Class"} List`;

  const handleShare = async () => {
    setBusy("share");
    try {
      await generateAndSharePdf(buildClassListHtml({ meta, classItem, students: roster }), fileLabel);
    } catch (e) {
      Alert.alert("Couldn't share the class list", e?.message || "Something went wrong. Try again.");
    }
    setBusy("");
  };

  const handleDownload = async () => {
    setBusy("download");
    try {
      const result = await downloadPdf(buildClassListHtml({ meta, classItem, students: roster }), fileLabel);
      if (result.downloaded) {
        Alert.alert("Saved", "The class list was saved to the folder you chose.");
      }
    } catch (e) {
      Alert.alert("Couldn't download the class list", e?.message || "Something went wrong. Try again.");
    }
    setBusy("");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{classItem?.name || "Class"}</Text>
      <Text style={styles.subtitle}>{roster.length} learner{roster.length === 1 ? "" : "s"} · alphabetical order</Text>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleShare} disabled={!!busy}>
          {busy === "share" ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionBtnText}>Share PDF</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnAlt]} onPress={handleDownload} disabled={!!busy}>
          {busy === "download" ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.actionBtnTextAlt}>Download PDF</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.tableHeaderRow}>
        <Text style={[styles.th, { width: 36 }]}>No.</Text>
        <Text style={[styles.th, { flex: 1, textAlign: "left" }]}>Name</Text>
        <Text style={[styles.th, { width: 90 }]}>Assessment No.</Text>
      </View>
      <FlatList
        data={roster}
        keyExtractor={(i) => i.id}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <Text style={[styles.td, { width: 36 }]}>{index + 1}</Text>
            <Text style={[styles.td, { flex: 1, textAlign: "left" }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.td, { width: 90 }]}>{item.admNo || "—"}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No learners in this class.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  title: { fontSize: 18, fontWeight: "700", color: COLORS.ink },
  subtitle: { fontSize: 12.5, color: COLORS.inkSoft, marginTop: 2, marginBottom: 14 },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 12, alignItems: "center" },
  actionBtnAlt: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.primary },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13.5 },
  actionBtnTextAlt: { color: COLORS.ink, fontWeight: "700", fontSize: 13.5 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.primary, borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingVertical: 8, paddingHorizontal: 8 },
  th: { color: "#fff", fontSize: 11, fontWeight: "700", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 9, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff" },
  td: { fontSize: 13, color: COLORS.ink, textAlign: "center" },
  empty: { color: COLORS.inkSoft, fontSize: 13, paddingVertical: 16, textAlign: "center", backgroundColor: "#fff" },
});
