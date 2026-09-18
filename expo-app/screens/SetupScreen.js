import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS } from "../utils/constants";
import {
  addClass, removeClass, addSubject, removeSubject,
  addStudent, removeStudent, bulkAddStudents, addExam, removeExam, saveBands,
  addTeacher, removeTeacher,
} from "../utils/db";

const TABS = ["Classes", "Subjects", "Students", "Exams", "Performance Levels", "Teachers"];
const GRADES = ["Grade 7", "Grade 8", "Grade 9"];
const TERMS = ["1", "2", "3"];
const TEACHER_ROLES = ["Class Teacher", "Subject Teacher", "Head Teacher"];
const CURRENT_YEAR = new Date().getFullYear();

export default function SetupScreen({ classes, subjects, students, exams, bands, teachers, isAdmin }) {
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
      {tab === "Performance Levels" && <BandsTab bands={bands} />}
      {tab === "Teachers" && <TeachersTab teachers={teachers} classes={classes} subjects={subjects} isAdmin={isAdmin} />}
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
  const [grade, setGrade] = useState(GRADES[0]);
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Add a class / stream</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={grade} onValueChange={setGrade}>
          {GRADES.map((g) => <Picker.Item key={g} label={g} value={g} />)}
        </Picker>
      </View>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} placeholder="Stream name, e.g. Green" value={name} onChangeText={setName} />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { if (name.trim()) { addClass(`${grade} ${name.trim()}`, grade); setName(""); } }}
        >
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
  const [assessmentNo, setAssessmentNo] = useState("");
  const [classId, setClassId] = useState("");
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkText, setBulkText] = useState("");

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Add a student</Text>
      <View style={styles.inputRow}>
        <TextInput style={[styles.input, { flex: 2 }]} placeholder="Full name" value={name} onChangeText={setName} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Assessment No." value={assessmentNo} onChangeText={setAssessmentNo} />
      </View>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={classId} onValueChange={setClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={() => { if (name.trim() && classId) { addStudent(name.trim(), assessmentNo.trim(), classId); setName(""); setAssessmentNo(""); } }}>
        <Text style={styles.addBtnText}>Add student</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 20 }]}>Bulk add (one per line: Name, Assessment No.)</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={bulkClassId} onValueChange={setBulkClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>
      <TextInput
        style={[styles.input, { flex: 0, height: 90, textAlignVertical: "top" }]}
        placeholder={"Jane Wanjiru, 7210\nBrian Otieno, 7211"}
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
  const [term, setTerm] = useState(TERMS[0]);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [grade, setGrade] = useState("All Grades");
  return (
    <View style={styles.section}>
      <Text style={styles.label}>Add an exam</Text>
      <TextInput
        style={[styles.input, { flex: 0, marginBottom: 10 }]}
        placeholder="Exam name, e.g. Mid-Term Assessment"
        value={name}
        onChangeText={setName}
      />
      <View style={styles.inputRow}>
        <View style={[styles.pickerWrap, { flex: 1 }]}>
          <Picker selectedValue={term} onValueChange={setTerm}>
            {TERMS.map((t) => <Picker.Item key={t} label={`Term ${t}`} value={t} />)}
          </Picker>
        </View>
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Year" keyboardType="numeric" value={year} onChangeText={setYear} />
      </View>
      <Text style={styles.miniLabel}>Which grade is this exam for?</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={grade} onValueChange={setGrade}>
          <Picker.Item label="All Grades" value="All Grades" />
          {GRADES.map((g) => <Picker.Item key={g} label={g} value={g} />)}
        </Picker>
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => { if (name.trim()) { addExam(name.trim(), term, Number(year) || CURRENT_YEAR, grade); setName(""); } }}
      >
        <Text style={styles.addBtnText}>Add exam</Text>
      </TouchableOpacity>
      <FlatList
        data={exams}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Row
            left={`${item.name}${item.term ? `  ·  Term ${item.term}` : ""}${item.year ? `  ·  ${item.year}` : ""}  ·  ${item.grade || "All Grades"}`}
            onRemove={() => removeExam(item.id)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No exams yet.</Text>}
      />
    </View>
  );
}

function BandsTab({ bands }) {
  const [local, setLocal] = useState(bands);
  useEffect(() => { setLocal(bands); }, [bands]);
  return (
    <View style={styles.section}>
      <Text style={styles.hintSmall}>Adjust the raw marks range and points for each performance level, then save.</Text>
      {local.map((b, i) => (
        <View key={b.id} style={styles.bandRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <View style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: b.color }} />
            <Text style={{ fontWeight: "700" }}>{b.short}</Text>
            <Text style={{ color: COLORS.inkSoft, fontSize: 12 }}>{b.label}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
            <View>
              <Text style={styles.miniLabel}>Raw Marks</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <TextInput
                  style={[styles.input, { flex: 0, width: 54 }]}
                  keyboardType="numeric"
                  value={String(b.min)}
                  onChangeText={(v) => { const next = [...local]; next[i] = { ...b, min: Number(v) || 0 }; setLocal(next); }}
                />
                <Text style={{ color: COLORS.inkSoft }}>-</Text>
                <TextInput
                  style={[styles.input, { flex: 0, width: 54 }]}
                  keyboardType="numeric"
                  value={String(b.max)}
                  onChangeText={(v) => { const next = [...local]; next[i] = { ...b, max: Number(v) || 0 }; setLocal(next); }}
                />
              </View>
            </View>
            <View>
              <Text style={styles.miniLabel}>Points</Text>
              <TextInput
                style={[styles.input, { flex: 0, width: 64 }]}
                keyboardType="numeric"
                value={String(b.points ?? 0)}
                onChangeText={(v) => { const next = [...local]; next[i] = { ...b, points: Number(v) || 0 }; setLocal(next); }}
              />
            </View>
          </View>
        </View>
      ))}
      <TouchableOpacity style={styles.addBtn} onPress={() => saveBands(local)}>
        <Text style={styles.addBtnText}>Save performance levels</Text>
      </TouchableOpacity>
    </View>
  );
}

function TeachersTab({ teachers, classes, subjects, isAdmin }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(TEACHER_ROLES[0]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");

  return (
    <View style={styles.section}>
      {!isAdmin && (
        <Text style={styles.hintSmall}>Only an admin can add or remove teachers. You can still view the list below.</Text>
      )}
      {isAdmin && (
        <>
          <Text style={styles.label}>Add a teacher</Text>
          <TextInput style={[styles.input, { flex: 0, marginBottom: 10 }]} placeholder="Full name" value={name} onChangeText={setName} />
          <View style={styles.pickerWrap}>
            <Picker selectedValue={role} onValueChange={(v) => { setRole(v); setClassId(""); setSubjectId(""); }}>
              {TEACHER_ROLES.map((r) => <Picker.Item key={r} label={r} value={r} />)}
            </Picker>
          </View>
          {role === "Class Teacher" && (
            <View style={styles.pickerWrap}>
              <Picker selectedValue={classId} onValueChange={setClassId}>
                <Picker.Item label="Select class" value="" />
                {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
              </Picker>
            </View>
          )}
          {role === "Subject Teacher" && (
            <>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={subjectId} onValueChange={setSubjectId}>
                  <Picker.Item label="Select learning area" value="" />
                  {subjects.map((s) => <Picker.Item key={s.id} label={s.name} value={s.id} />)}
                </Picker>
              </View>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={classId} onValueChange={setClassId}>
                  <Picker.Item label="Select class / stream they teach it in" value="" />
                  {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
                </Picker>
              </View>
            </>
          )}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => {
              if (!name.trim()) return;
              addTeacher(
                name.trim(),
                role,
                role === "Class Teacher" || role === "Subject Teacher" ? classId : null,
                role === "Subject Teacher" ? subjectId : null
              );
              setName(""); setClassId(""); setSubjectId("");
            }}
          >
            <Text style={styles.addBtnText}>Add teacher</Text>
          </TouchableOpacity>
        </>
      )}
      <Text style={[styles.label, { marginTop: 20 }]}>
        Teachers ({new Set(teachers.map((t) => t.name.trim().toLowerCase())).size} people, {teachers.length} role{teachers.length === 1 ? "" : "s"})
      </Text>
      <FlatList
        data={teachers}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <Row
            left={`${item.name}  ·  ${item.role}${
              item.subjectId ? `  ·  ${subjects.find((s) => s.id === item.subjectId)?.name || ""}` : ""
            }${
              item.classId ? `  ·  ${classes.find((c) => c.id === item.classId)?.name || ""}` : ""
            }`}
            onRemove={isAdmin ? () => removeTeacher(item.id) : undefined}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No teachers added yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, padding: 14 },
  tabRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12, borderBottomWidth: 1, borderColor: COLORS.border },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  tabBtnActive: { borderBottomWidth: 2, borderColor: COLORS.accent },
  tabText: { color: COLORS.inkSoft, fontSize: 12 },
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
  bandRow: { borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 12 },
  miniLabel: { fontSize: 11, color: COLORS.inkSoft, marginBottom: 3 },
});
