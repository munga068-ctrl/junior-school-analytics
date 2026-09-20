import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS } from "../utils/constants";
import { listenProfile, saveProfile, setTeacherPassword } from "../utils/db";
import { getInitials } from "../utils/analysis";

function describeRecord(r, classes, subjects) {
  if (r.role === "Class Teacher") return `Class Teacher — ${classes.find((c) => c.id === r.classId)?.name || "—"}`;
  if (r.role === "Head Teacher") return "Head Teacher";
  if (r.role === "Subject Teacher") {
    const subj = subjects.find((s) => s.id === r.subjectId);
    const cls = classes.find((c) => c.id === r.classId);
    return `${subj?.name || "Subject"} — ${cls?.name || "—"}`;
  }
  return r.role;
}

function groupTeachersByPerson(teachers) {
  const map = new Map();
  teachers.forEach((t) => {
    const key = t.name.trim().toLowerCase();
    if (!map.has(key)) map.set(key, { name: t.name, records: [], loginEmail: null, representativeId: t.id });
    const g = map.get(key);
    g.records.push(t);
    if (t.loginEmail) { g.loginEmail = t.loginEmail; g.representativeId = t.id; }
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function Avatar({ url, label }) {
  return url ? (
    <Image source={{ uri: url }} style={styles.avatar} />
  ) : (
    <View style={[styles.avatar, styles.avatarPlaceholder]}>
      <Text style={styles.avatarPlaceholderText}>{getInitials(label) || "?"}</Text>
    </View>
  );
}

export default function ProfileScreen({ user, teachers, classes, subjects, isAdmin }) {
  const [profile, setProfile] = useState({});
  const [photoUrl, setPhotoUrl] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = listenProfile(user.uid, (p) => {
      setProfile(p || {});
      setPhotoUrl(p?.photoUrl || "");
      setDisplayName(p?.displayName || "");
    });
    return unsub;
  }, [user?.uid]);

  const myLoginRecord = teachers.find((t) => t.loginEmail === user?.email);
  const myRecords = myLoginRecord
    ? teachers.filter((t) => t.name.trim().toLowerCase() === myLoginRecord.name.trim().toLowerCase())
    : [];

  const savePicture = () => saveProfile(user.uid, { ...profile, photoUrl, displayName });

  const headline = isAdmin ? (displayName || "Admin") : (displayName || myLoginRecord?.name || "Teacher");

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 18 }}>
      <View style={styles.headerRow}>
        <Avatar url={photoUrl} label={headline} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <Text style={styles.name}>{headline}</Text>
          <Text style={styles.roleBadge}>{isAdmin ? "Admin" : (myLoginRecord ? myLoginRecord.role : "Teacher")}</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Profile picture</Text>
      <Text style={styles.hintSmall}>Paste a link to an already-hosted image (no file upload yet).</Text>
      <TextInput style={[styles.input, { flex: 0 }]} placeholder="Image URL" value={photoUrl} onChangeText={setPhotoUrl} />
      <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Display name</Text>
      <TextInput style={[styles.input, { flex: 0 }]} placeholder="How your name should appear" value={displayName} onChangeText={setDisplayName} />
      <TouchableOpacity style={styles.saveBtn} onPress={savePicture}>
        <Text style={styles.saveBtnText}>Save profile</Text>
      </TouchableOpacity>

      {!isAdmin && (
        <>
          <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Your teaching areas</Text>
          {myRecords.length === 0 ? (
            <Text style={styles.hintSmall}>No role assignments found for your account yet — ask your admin.</Text>
          ) : (
            <View style={styles.card}>
              {myRecords.map((r) => (
                <Text key={r.id} style={styles.cardLine}>• {describeRecord(r, classes, subjects)}</Text>
              ))}
            </View>
          )}
        </>
      )}

      {isAdmin && (
        <AdminTeacherAccess teachers={teachers} classes={classes} subjects={subjects} />
      )}

      <TouchableOpacity style={styles.signOut} onPress={() => signOut(auth)}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function AdminTeacherAccess({ teachers, classes, subjects }) {
  const [openFor, setOpenFor] = useState("");
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  const groups = groupTeachersByPerson(teachers);

  const submit = async (group) => {
    if (!pw.trim()) return;
    setSaving(true);
    try {
      await setTeacherPassword(group.representativeId, group.name, pw.trim(), teachers);
      setOpenFor("");
      setPw("");
      Alert.alert("Done", `${group.name}'s password has been set.`);
    } catch (e) {
      Alert.alert("Couldn't set password", e?.message || "Something went wrong. Try again.");
    }
    setSaving(false);
  };

  return (
    <>
      <Text style={[styles.sectionLabel, { marginTop: 22 }]}>Teachers & access</Text>
      <Text style={styles.hintSmall}>Set or reset a teacher's app login password. They'll sign in by selecting their name.</Text>
      {groups.length === 0 && <Text style={styles.hintSmall}>No teachers added yet — add them in Setup.</Text>}
      {groups.map((g) => (
        <View key={g.name} style={styles.card}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{g.name}</Text>
              {g.records.map((r) => (
                <Text key={r.id} style={styles.cardLine}>• {describeRecord(r, classes, subjects)}</Text>
              ))}
              <Text style={[styles.hintSmall, { marginTop: 4, marginBottom: 0 }]}>{g.loginEmail ? "Has app login" : "No app login yet"}</Text>
            </View>
          </View>
          {openFor === g.name ? (
            <View style={{ marginTop: 10 }}>
              <TextInput style={[styles.input, { flex: 0 }]} placeholder="New password" secureTextEntry value={pw} onChangeText={setPw} />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity style={[styles.smallBtn, { flex: 1 }]} onPress={() => submit(g)} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.smallBtnText}>Save password</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.smallBtn, styles.smallBtnOutline, { flex: 1 }]} onPress={() => { setOpenFor(""); setPw(""); }}>
                  <Text style={[styles.smallBtnText, { color: COLORS.ink }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={[styles.smallBtn, { marginTop: 10, alignSelf: "flex-start" }]} onPress={() => { setOpenFor(g.name); setPw(""); }}>
              <Text style={styles.smallBtnText}>{g.loginEmail ? "Reset password" : "Set password"}</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.border },
  avatarPlaceholder: { alignItems: "center", justifyContent: "center" },
  avatarPlaceholderText: { color: COLORS.primary, fontWeight: "700", fontSize: 20 },
  name: { fontSize: 18, fontWeight: "700", color: COLORS.ink },
  roleBadge: { fontSize: 12.5, color: COLORS.primary, fontWeight: "600", marginTop: 2 },
  sectionLabel: { fontSize: 14, fontWeight: "700", color: COLORS.primary, marginBottom: 4 },
  hintSmall: { fontSize: 11.5, color: COLORS.inkSoft, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10, backgroundColor: "#fff", fontSize: 13.5, marginBottom: 4 },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 11, alignItems: "center", marginTop: 10 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 12, marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.ink, marginBottom: 4 },
  cardLine: { fontSize: 12.5, color: COLORS.ink, marginBottom: 2 },
  smallBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14, alignItems: "center" },
  smallBtnOutline: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  signOut: { marginTop: 24, marginBottom: 10, alignSelf: "flex-start", borderWidth: 1, borderColor: "#E8C4BE", borderRadius: 6, paddingVertical: 8, paddingHorizontal: 14 },
  signOutText: { color: "#C0392B", fontSize: 13, fontWeight: "600" },
});
