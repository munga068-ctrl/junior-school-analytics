import React from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from "react-native";
import { COLORS } from "../utils/constants";
import { generateAndSharePdf, generateAndDownloadPdf, buildClassListPdf } from "../utils/pdf";

export default function ClassListScreen({ route, navigation, classes, learners, meta }) {
  const { classId } = route.params || {};
  const currentClass = classes.find((c) => c.id === classId);
  const classLearners = learners
    .filter((l) => l.classId === classId && !l.graduated)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

  const handleShare = async () => {
    if (classLearners.length === 0) {
      Alert.alert("No learners", "This class has no learners yet.");
      return;
    }
    try {
      const html = buildClassListPdf({
        meta,
        className: currentClass?.name || "Class",
        learners: classLearners,
      });
      await generateAndSharePdf(html, `${currentClass?.name || "Class"} List`);
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not generate PDF");
    }
  };

  const handleDownload = async () => {
    if (classLearners.length === 0) {
      Alert.alert("No learners", "This class has no learners yet.");
      return;
    }
    try {
      const html = buildClassListPdf({
        meta,
        className: currentClass?.name || "Class",
        learners: classLearners,
      });
      await generateAndDownloadPdf(html, `${currentClass?.name || "Class"}_List`);
    } catch (e) {
      Alert.alert("Error", e?.message || "Could not download PDF");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{currentClass?.name || "Class List"}</Text>
        <Text style={styles.subtitle}>{classLearners.length} active learner{classLearners.length === 1 ? "" : "s"}</Text>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.actionBtn, styles.downloadBtn]} onPress={handleDownload}>
          <Text style={styles.actionBtnText}>⬇ Download PDF</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.shareBtn]} onPress={handleShare}>
          <Text style={styles.actionBtnText}>📤 Share PDF</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tableWrap}>
        <View style={styles.tableHeader}>
          <Text style={[styles.th, { width: 40 }]}>#</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "left" }]}>NAME</Text>
          <Text style={[styles.th, { width: 100, textAlign: "center" }]}>ASS NO.</Text>
        </View>
        <FlatList
          data={classLearners}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={styles.tableRow}>
              <Text style={[styles.td, { width: 40, textAlign: "center", color: COLORS.inkSoft }]}>{index + 1}</Text>
              <Text style={[styles.td, { flex: 1, fontWeight: "600" }]}>{item.name}</Text>
              <Text style={[styles.td, { width: 100, textAlign: "center" }]}>{item.admNo || "—"}</Text>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No learners assigned to this class yet.</Text>
          }
        />
      </View>

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backBtnText}>← Back to Setup</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  header: { marginBottom: 14 },
  title: { fontSize: 20, fontWeight: "700", color: COLORS.primary },
  subtitle: { fontSize: 13, color: COLORS.inkSoft, marginTop: 2 },
  btnRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 6, alignItems: "center" },
  downloadBtn: { backgroundColor: COLORS.accent },
  shareBtn: { backgroundColor: COLORS.primary },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tableWrap: { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, overflow: "hidden" },
  tableHeader: { flexDirection: "row", backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 12 },
  th: { color: "#fff", fontSize: 11, fontWeight: "700" },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 12, paddingHorizontal: 12, alignItems: "center" },
  td: { fontSize: 13, color: COLORS.ink },
  empty: { color: COLORS.inkSoft, textAlign: "center", padding: 20 },
  backBtn: { marginTop: 14, paddingVertical: 10, alignItems: "center" },
  backBtnText: { color: COLORS.primary, fontWeight: "600", fontSize: 13.5 },
});
