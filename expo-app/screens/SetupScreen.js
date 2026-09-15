import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, uid } from "../utils/constants";
import {
  addClass, removeClass, addSubject, removeSubject,
  addStudent, removeStudent, bulkAddStudents, addExam, removeExam, saveBands,
} from "../utils/db";

const TABS = ["Classes", "Subjects", "Students", "Exams", "Bands"];

export default function SetupScreen({ classes, subjects, students, exams, bands }) {
  const [tab, setTab] = useState("Classes");
  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {tab === "Classes" && <ClassesTab classes={classes} students={students} />}
      {tab === "Subjects" && <SubjectsTab subjects={subjects} />}
      {tab === "Students" && <StudentsTab classes={classes} students={students} />}
      {tab === "Exams" && <ExamsTab exams={exams} />}
      {tab === "Bands" && <BandsTab bands={bands} />}
    </View>
  );
}

function Row({ left, right, onRemove }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{left}</Text>
      {right}
      {onRemove && (
        <TouchableOpacity onPress={onRemove}><Text style={styles.remove}>Remove</Text></TouchableOpacity>
      )}
    </View>
  );
}

function ClassesTab({ classes, students }) {
  const [name, setName] = useState("");
  return (
    <View style={styles.section}>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="e.g. Grade 7 Green" value={name} onChangeText={setName} />
        <TouchableOpacity style={styles.addBtn} onPress={() => { if (name.trim()) { addClass(name.trim()); setName(""); } }}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={classes}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Row left={`${item.name}  ·  ${students.filter((s) => s.classId === item.id).length} students`} onRemove={() => removeClass(item.id)} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No classes yet.</Text>}
      />
    </View>
  );
}

function SubjectsTab({ subjects }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <View style={styles.section}>
      <View style={styles.inputRow}>
        <TextInput style={[styles.input, { flex: 2 }]} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Code" value={code} onChangeText={setCode} />
        <TouchableOpacity style={styles.addBtn} onPress={() => { if (name.trim()) { addSubject(name.trim(), code.trim() || name.slice(0,3).toUpperCase()); setName(""); setCode(""); } }}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={subjects}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <Row left={`${item.name} (${item.code})`} onRemove={() => removeSubject(item.id)} />}
      />
    </View>
  );
}

function StudentsTab({ classes, students }) {
  const [name, setName] = useState("");
  const [adm, setAdm] = useState("");
  const [classId, setClassId] = useState("");
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkText, setBulkText] = useState("");

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Add a student</Text>
      <View style={styles.inputRow}>
        <TextInput style={[styles.input, { flex: 2 }]} placeholder="Full name" value={name} onChangeText={setName} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Adm no." value={adm} onChangeText={setAdm} />
      </View>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={classId} onValueChange={setClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={() => { if (name.trim() && classId) { addStudent(name.trim(), adm.trim(), classId); setName(""); setAdm(""); } }}>
        <Text style={styles.addBtnText}>Add student</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 20 }]}>Bulk add (one per line: Name, Adm no.)</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={bulkClassId} onValueChange={setBulkClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>
      <TextInput
        style={[styles.input, { height: 90, textAlignVertical: "top" }]}
        placeholder={"Jane Wanjiru, 2201\nBrian Otieno, 2202"}
        multiline
        value={bulkText}
        onChangeText={setBulkText}
      />
      <TouchableOpacity
        style={styles.addBtn}
        onPress={async () => {
          if (!bulkClassId || !bulkText.trim()) return;
          const rows = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
            const [n, a] = line.split(",").map((p) => p && p.trim());
            return { name: n || line, admNo: a || "", classId: bulkClassId };
          });
          await bulkAddStudents(rows);
          setBulkText("");
        }}
      >
        <Text style={styles.addBtnText}>Add all</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 20 }]}>Roster ({students.length})</Text>
      <FlatList
        data={students}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Row left={`${item.name}  ·  ${item.admNo || "—"}  ·  ${classes.find((c) => c.id === item.classId)?.name || "—"}`} onRemove={() => removeStudent(item.id)} />
        )}
      />
    </View>
  );
}

function ExamsTab({ exams }) {
  const [name, setName] = useState("");
  return (
    <View style={styles.section}>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="e.g. Term 2 2026 Mid-Term" value={name} onChangeText={setName} />
        <TouchableOpacity style={styles.addBtn} onPress={() => { if (name.trim()) { addExam(name.trim()); setName(""); } }}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList data={exams} keyExtractor={(i) => i.id} renderItem={({ item }) => <Row left={item.name} onRemove={() => removeExam(item.id)} />} />
    </View>
  );
}

function BandsTab({ bands }) {
  const [local, setLocal] = useState(bands);
  useEffect(() => { setLocal(bands); }, [bands]);
  return (
    <View style={styles.section}>
      <Text style={styles.hintSmall}>Adjust score ranges and points to match your grading framework, then save.</Text>
      {local.map((b, i) => (
        <View key={b.id} style={styles.bandRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: b.color }} />
            <Text style={{ fontWeight: "700" }}>{b.short}</Text>
            <Text style={{ color: COLORS.inkSoft, fontSize: 12 }}>{b.label}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" }}>
            <Text style={styles.miniLabel}>Min</Text>
            <TextInput
              style={[styles.input, { width: 55 }]}
              keyboardType="numeric"
              value={String(b.min)}
              onChangeText={(v) => { const next = [...local]; next[i] = { ...b, min: Number(v) || 0 }; setLocal(next); }}
            />
            <Text style={styles.miniLabel}>Max</Text>
            <TextInput
              style={[styles.input, { width: 55 }]}
              keyboardType="numeric"
              value={String(b.max)}
              onChangeText={(v) => { const next = [...local]; next[i] = { ...b, max: Number(v) || 0 }; setLocal(next); }}
            />
            <Text style={styles.miniLabel}>Points</Text>
            <TextInput
              style={[styles.input, { width: 55 }]}
              keyboardType="numeric"
              value={String(b.points ?? 0)}
              onChangeText={(v) => { const next = [...local]; next[i] = { ...b, points: Number(v) || 0 }; setLocal(next); }}
            />
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={() => saveBands(local)}>
        <Text style={styles.addBtnText}>Save bands</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, borderBottomWidth: 1, borderColor: COLORS.border },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderColor: COLORS.accent },
  tabText: { color: COLORS.inkSoft, fontSize: 13 },
  tabTextActive: { color: COLORS.primary, fontWeight: "700" },
  section: { flex: 1 },
  label: { fontWeight: "700", color: COLORS.primary, marginBottom: 8, fontSize: 13.5 },
  inputRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  input: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 10, backgroundColor: "#fff", fontSize: 13.5 },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 10 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 14, justifyContent: "center", alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderBottomWidth: 1, borderColor: COLORS.border },
  rowText: { fontSize: 13.5, color: COLORS.ink, flex: 1 },
  remove: { color: "#C0392B", fontSize: 12.5, fontWeight: "600" },
  empty: { color: COLORS.inkSoft, fontSize: 13, paddingVertical: 10 },
  hintSmall: { color: COLORS.inkSoft, fontSize: 12.5, marginBottom: 12 },
  bandRow: { borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 10 },
  miniLabel: { fontSize: 11, color: COLORS.inkSoft },
});
