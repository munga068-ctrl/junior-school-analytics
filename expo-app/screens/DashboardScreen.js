import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS } from "../utils/constants";
import { saveMeta } from "../utils/db";
import { pickAndUploadImage } from "../utils/imageUpload";

const FIELDS = [
  { key: "schoolName", label: "School name", placeholder: "e.g. Riverside Primary School" },
  { key: "address", label: "School address", placeholder: "e.g. P.O. Box 1234, Nairobi" },
  { key: "tel", label: "Telephone", placeholder: "e.g. 0712 345 678" },
  { key: "email", label: "Email", placeholder: "e.g. info@school.ac.ke" },
  { key: "termEndDate", label: "Term ends", placeholder: "e.g. 29-11-2026" },
  { key: "nextTermBeginsDate", label: "Next term begins", placeholder: "e.g. 05-01-2027" },
];

export default function DashboardScreen({ schoolId, classes, learningAreas, learners, assessments, teachers, meta, isAdmin }) {
  const [form, setForm] = useState(meta || {});
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => { setForm(meta || {}); }, [meta]);

  const uniqueTeacherCount = new Set((teachers || []).map((t) => t.name.trim().toLowerCase())).size;

  const stats = [
    ["Classes", classes.length],
    ["Learning Areas", learningAreas.length],
    ["Learners", learners.filter((s) => !s.graduated).length],
    ["Teachers", uniqueTeacherCount],
    ["Assessments", assessments.length],
  ];

  const save = () => saveMeta(schoolId, { ...(meta || {}), ...form });

  const handleLogoUpload = async () => {
    setUploadingLogo(true);
    try {
      const url = await pickAndUploadImage("logos", `school_logo_${Date.now()}.jpg`);
      if (url) {
        const updatedForm = { ...form, logoUrl: url };
        setForm(updatedForm);
        await saveMeta(schoolId, { ...(meta || {}), ...updatedForm });
        Alert.alert("Success", "School logo uploaded successfully!");
      }
    } catch (error) {
      Alert.alert("Upload failed", error.message || "Could not upload logo. Please try again.");
    }
    setUploadingLogo(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={styles.heading}>Overview</Text>
        <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: "700" }}>v1.0.0 • OTA Ready</Text>
      </View>
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

      <Text style={styles.fieldLabel}>School logo</Text>
      {form.logoUrl && (
        <Image
          source={{ uri: form.logoUrl }}
          style={styles.logoPreview}
          resizeMode="contain"
        />
      )}
      {isAdmin ? (
        <>
          <TouchableOpacity
            style={[styles.uploadBtn, uploadingLogo && { opacity: 0.6 }]}
            onPress={handleLogoUpload}
            disabled={uploadingLogo}
          >
            {uploadingLogo ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.uploadBtnText}>📷 {form.logoUrl ? "Change logo" : "Upload logo"}</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.hint, { fontSize: 11, marginBottom: 12 }]}>Or paste a link to an already-hosted image:</Text>
          <TextInput
            style={[styles.input, { flex: 0, marginBottom: 16 }]}
            placeholder="https://... (optional)"
            value={form.logoUrl || ""}
            onChangeText={(v) => setForm({ ...form, logoUrl: v })}
          />
        </>
      ) : (
        !form.logoUrl && <Text style={styles.readonlyValue}>—</Text>
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
          Go to Setup to add your classes, learning areas, and learners. Then use Score entry and Assessment Report.
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
  logoPreview: { width: 120, height: 120, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff" },
  uploadBtn: { backgroundColor: COLORS.accent, borderRadius: 6, paddingVertical: 11, alignItems: "center", marginBottom: 8 },
  uploadBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 12, alignItems: "center", marginTop: 6 },
  saveBtnText: { color: "#fff", fontWeight: "700" },
  signOut: { marginTop: 30, alignSelf: "flex-start", borderWidth: 1, borderColor: "#E8C4BE", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  signOutText: { color: "#C0392B", fontSize: 13, fontWeight: "600" },
});
