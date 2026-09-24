import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { COLORS, getOrdinalSuffix } from "../utils/constants";
import {
  addClass, removeClass, addLearningArea, removeLearningArea,
  addLearner, removeLearner, bulkAddLearners, addAssessment, removeAssessment, saveBands,
  addTeacher, removeTeacher, applyPromotions, setTeacherPassword, graduateLearner,
} from "../utils/db";
import { buildPromotionPlan, getStreamInitials, getGradeForClass } from "../utils/analysis";

const TABS = ["Classes", "Learning Areas", "Learners", "Assessments", "Performance Levels", "Teachers", "Graduated", "Promotion"];
const GRADES = ["Grade 7", "Grade 8", "Grade 9"];
const TERMS = ["1", "2", "3"];
const TEACHER_ROLES = ["Class Teacher", "Subject Teacher", "Head Teacher"];
const CURRENT_YEAR = new Date().getFullYear();

export default function SetupScreen({ schoolId, classes, learningAreas, learners, assessments, bands, teachers, isAdmin, navigation }) {
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
      {tab === "Classes" && <ClassesTab schoolId={schoolId} classes={classes} learners={learners} navigation={navigation} />}
      {tab === "Learning Areas" && <LearningAreasTab schoolId={schoolId} learningAreas={learningAreas} />}
      {tab === "Learners" && <LearnersTab schoolId={schoolId} classes={classes} learners={learners} navigation={navigation} />}
      {tab === "Assessments" && <AssessmentsTab schoolId={schoolId} assessments={assessments} />}
      {tab === "Performance Levels" && <BandsTab schoolId={schoolId} bands={bands} />}
      {tab === "Teachers" && <TeachersTab schoolId={schoolId} teachers={teachers} classes={classes} learningAreas={learningAreas} isAdmin={isAdmin} />}
      {tab === "Graduated" && <GraduatedTab learners={learners} classes={classes} />}
      {tab === "Promotion" && <PromotionTab schoolId={schoolId} classes={classes} learners={learners} isAdmin={isAdmin} />}
    </View>
  );
}

function Row({ left, right, onRemove, onPress }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <Text style={styles.rowText}>{left}</Text>
      {right}
      {onRemove && (
        <TouchableOpacity onPress={onRemove}><Text style={styles.remove}>Remove</Text></TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const MemoizedRow = React.memo(Row);

function ClassesTab({ schoolId, classes, learners, navigation }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(GRADES[0]);

  const handleViewList = (classId) => {
    navigation.navigate("ClassList", { classId });
  };

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
          onPress={() => { if (name.trim()) { addClass(schoolId, `${grade} ${name.trim()}`, grade); setName(""); } }}
        >
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={classes}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowText}>{item.name}  ·  {learners.filter((s) => s.classId === item.id && !s.graduated).length} learners</Text>
            </View>
            <TouchableOpacity style={styles.viewListBtn} onPress={() => handleViewList(item.id)}>
              <Text style={styles.viewListBtnText}>View List</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeClass(schoolId, item.id)}>
              <Text style={styles.remove}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No classes yet.</Text>}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

function LearningAreasTab({ schoolId, learningAreas }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <View style={styles.section}>
      <View style={styles.inputRow}>
        <TextInput style={[styles.input, { flex: 2 }]} placeholder="Name" value={name} onChangeText={setName} />
        <TextInput style={[styles.input, { flex: 1 }]} placeholder="Code" value={code} onChangeText={setCode} />
        <TouchableOpacity style={styles.addBtn} onPress={() => { if (name.trim()) { addLearningArea(schoolId, name.trim(), code.trim() || name.slice(0,3).toUpperCase()); setName(""); setCode(""); } }}>
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={learningAreas}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <MemoizedRow left={`${item.name} (${item.code})`} onRemove={() => removeLearningArea(schoolId, item.id)} />}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

function LearnersTab({ schoolId, classes, learners, navigation }) {
  const [name, setName] = useState("");
  const [assessmentNo, setAssessmentNo] = useState("");
  const [classId, setClassId] = useState("");
  const [gender, setGender] = useState("");
  const [bulkClassId, setBulkClassId] = useState("");
  const [bulkText, setBulkText] = useState("");

  const activeLearners = learners.filter((l) => !l.graduated);

  const handleEditLearner = (learnerId) => {
    navigation.navigate("EditLearner", { learnerId });
  };

  const handleGraduate = (learner) => {
    const learnerClass = classes.find((c) => c.id === learner.classId);
    const grade = getGradeForClass(learnerClass);

    if (grade !== "Grade 9") {
      Alert.alert("Not Grade 9", "Only Grade 9 learners can be graduated.");
      return;
    }

    Alert.alert(
      "Graduate Learner",
      `Mark ${learner.name} as graduated? They will be moved to the Graduated archive.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Graduate",
          onPress: async () => {
            try {
              await graduateLearner(schoolId, learner.id);
              Alert.alert("Success", `${learner.name} has been graduated`);
            } catch (e) {
              Alert.alert("Error", e?.message || "Could not graduate learner");
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Add a learner</Text>
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
      <View style={styles.genderRow}>
        {[["M", "Male"], ["F", "Female"]].map(([val, label]) => (
          <TouchableOpacity
            key={val}
            style={[styles.genderChip, gender === val && styles.genderChipActive]}
            onPress={() => setGender(gender === val ? "" : val)}
          >
            <Text style={[styles.genderChipText, gender === val && styles.genderChipTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          if (name.trim() && classId) {
            addLearner(schoolId, name.trim(), assessmentNo.trim(), classId, gender);
            setName(""); setAssessmentNo(""); setGender("");
          }
        }}
      >
        <Text style={styles.addBtnText}>Add learner</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 20 }]}>Bulk add (one per line: Name, Assessment No., Gender M/F)</Text>
      <Text style={styles.hintSmall}>Gender is optional — leave it off a line if you don't have it yet.</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={bulkClassId} onValueChange={setBulkClassId}>
          <Picker.Item label="Select class" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>
      <TextInput
        style={[styles.input, { flex: 0, height: 90, textAlignVertical: "top" }]}
        placeholder={"Jane Wanjiru, 7210, F\nBrian Otieno, 7211, M"}
        multiline
        value={bulkText}
        onChangeText={setBulkText}
      />
      <TouchableOpacity
        style={styles.addBtn}
        onPress={async () => {
          if (!bulkClassId || !bulkText.trim()) return;
          const rows = bulkText.split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
            const [n, a, g] = line.split(",").map((p) => p && p.trim());
            const genderVal = g && /^[mf]$/i.test(g) ? g.toUpperCase() : null;
            return { name: n || line, admNo: a || "", classId: bulkClassId, gender: genderVal };
          });
          await bulkAddLearners(schoolId, rows);
          setBulkText("");
        }}
      >
        <Text style={styles.addBtnText}>Add all</Text>
      </TouchableOpacity>

      <Text style={[styles.label, { marginTop: 20 }]}>Active Learners ({activeLearners.length})</Text>
      <Text style={styles.hintSmall}>Tap a learner to edit their details</Text>
      <FlatList
        data={activeLearners}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => {
          const itemClass = classes.find((c) => c.id === item.classId);
          const grade = getGradeForClass(itemClass);
          const isGrade9 = grade === "Grade 9";

          return (
            <View style={styles.row}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => handleEditLearner(item.id)}>
                <Text style={styles.rowText}>
                  {item.name}  ·  {item.admNo || "—"}  ·  {itemClass?.name || "—"}{item.gender ? `  ·  ${item.gender}` : ""}
                </Text>
              </TouchableOpacity>
              {isGrade9 && (
                <TouchableOpacity style={styles.graduateBtn} onPress={() => handleGraduate(item)}>
                  <Text style={styles.graduateBtnText}>Graduate</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

function AssessmentsTab({ schoolId, assessments }) {
  const [name, setName] = useState("");
  const [term, setTerm] = useState(TERMS[0]);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [grade, setGrade] = useState("All Grades");
  const [sequence, setSequence] = useState("1");

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Add an assessment</Text>
      <TextInput
        style={[styles.input, { flex: 0, marginBottom: 10 }]}
        placeholder="Assessment name, e.g. Mid-Term Assessment"
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
      <Text style={styles.miniLabel}>Sequence (1st, 2nd, 3rd...)</Text>
      <TextInput
        style={[styles.input, { flex: 0, marginBottom: 10 }]}
        placeholder="1"
        keyboardType="numeric"
        value={sequence}
        onChangeText={setSequence}
      />
      <Text style={styles.miniLabel}>Which grade is this assessment for?</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={grade} onValueChange={setGrade}>
          <Picker.Item label="All Grades" value="All Grades" />
          {GRADES.map((g) => <Picker.Item key={g} label={g} value={g} />)}
        </Picker>
      </View>
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => {
          if (name.trim()) {
            addAssessment(schoolId, name.trim(), term, Number(year) || CURRENT_YEAR, grade, Number(sequence) || 1);
            setName("");
            setSequence("1");
          }
        }}
      >
        <Text style={styles.addBtnText}>Add assessment</Text>
      </TouchableOpacity>
      <FlatList
        data={assessments}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <MemoizedRow
            left={`${item.name}${item.sequence ? ` (${item.sequence}${getOrdinalSuffix(item.sequence)})` : ""}${item.term ? `  ·  Term ${item.term}` : ""}${item.year ? `  ·  ${item.year}` : ""}  ·  ${item.grade || "All Grades"}`}
            onRemove={() => removeAssessment(schoolId, item.id)}
          />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No assessments yet.</Text>}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

function BandsTab({ schoolId, bands }) {
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
      <TouchableOpacity style={styles.addBtn} onPress={() => saveBands(schoolId, local)}>
        <Text style={styles.addBtnText}>Save performance levels</Text>
      </TouchableOpacity>
    </View>
  );
}

function TeachersTab({ schoolId, teachers, classes, learningAreas, isAdmin }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState(TEACHER_ROLES[0]);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const roleOrder = { "Class Teacher": 0, "Head Teacher": 1, "Subject Teacher": 2 };
  const nonSubjectTeachers = [...teachers]
    .filter((t) => t.role !== "Subject Teacher")
    .sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || (a.name || "").localeCompare(b.name || ""));

  const subjectGroups = [];
  teachers
    .filter((t) => t.role === "Subject Teacher")
    .forEach((t) => {
      const key = `${t.name.trim().toLowerCase()}|${t.subjectId}`;
      let group = subjectGroups.find((g) => g.key === key);
      if (!group) {
        group = { key, name: t.name, subjectId: t.subjectId, classIds: [] };
        subjectGroups.push(group);
      }
      if (t.classId) group.classIds.push(t.classId);
    });
  subjectGroups.sort((a, b) => a.name.localeCompare(b.name) || (a.subjectId || "").localeCompare(b.subjectId || ""));

  const resetForm = () => { setName(""); setClassId(""); setSubjectId(""); setPassword(""); };

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ref = await addTeacher(
        schoolId,
        name.trim(),
        role,
        role === "Class Teacher" || role === "Subject Teacher" ? classId : null,
        role === "Subject Teacher" ? subjectId : null
      );
      if (password.trim()) {
        await setTeacherPassword(schoolId, ref.id, name.trim(), password.trim(), teachers);
      }
      resetForm();
    } catch (e) {
      Alert.alert("Couldn't add teacher", e?.message || "Something went wrong. Try again.");
    }
    setSaving(false);
  };

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
                  {learningAreas.map((s) => <Picker.Item key={s.id} label={s.name} value={s.id} />)}
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
          <Text style={styles.miniLabel}>App login password (optional)</Text>
          <Text style={styles.hintSmall}>Leave blank if this teacher doesn't need to sign into the app yet. You can add it later from Profile.</Text>
          <TextInput
            style={[styles.input, { flex: 0, marginBottom: 10 }]}
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAdd} disabled={saving}>
            <Text style={styles.addBtnText}>{saving ? "Adding…" : "Add teacher"}</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={[styles.label, { marginTop: 22 }]}>
        Teachers ({new Set(teachers.map((t) => t.name.trim().toLowerCase())).size} people)
      </Text>

      {nonSubjectTeachers.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          {nonSubjectTeachers.map((item) => (
            <Row
              key={item.id}
              left={`${item.name}  ·  ${item.role}${item.classId ? `  ·  ${classes.find((c) => c.id === item.classId)?.name || ""}` : ""}${item.loginEmail ? "  ·  Has login" : ""}`}
              onRemove={isAdmin ? () => removeTeacher(schoolId, item.id) : undefined}
            />
          ))}
        </View>
      )}

      <View style={styles.tableWrap}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableTh, { flex: 1.4 }]}>TEACHER</Text>
          <Text style={[styles.tableTh, { flex: 0.8, textAlign: "center" }]}>LEARNING AREA</Text>
          <Text style={[styles.tableTh, { flex: 1, textAlign: "center" }]}>GRADE</Text>
        </View>
        {subjectGroups.map((g) => {
          const subject = learningAreas.find((s) => s.id === g.subjectId);
          const gradeLabel = g.classIds
            .map((cid) => getStreamInitials(classes.find((c) => c.id === cid)))
            .filter(Boolean)
            .join(", ");
          return (
            <View key={g.key} style={styles.tableRow}>
              <Text style={[styles.tableTd, { flex: 1.4 }]} numberOfLines={1}>{g.name}</Text>
              <Text style={[styles.tableTd, { flex: 0.8, textAlign: "center" }]}>{subject?.code || "—"}</Text>
              <Text style={[styles.tableTd, { flex: 1, textAlign: "center" }]}>{gradeLabel || "—"}</Text>
            </View>
          );
        })}
        {subjectGroups.length === 0 && <Text style={[styles.empty, { padding: 10 }]}>No subject teachers added yet.</Text>}
      </View>
    </View>
  );
}

function GraduatedTab({ learners, classes }) {
  const [filterYear, setFilterYear] = useState("");
  const [filterClassId, setFilterClassId] = useState("");

  const graduatedLearners = learners.filter((l) => l.graduated);
  const years = [...new Set(graduatedLearners.map((l) => l.graduationYear).filter(Boolean))].sort((a, b) => b - a);

  let filtered = graduatedLearners;
  if (filterYear) {
    filtered = filtered.filter((l) => String(l.graduationYear) === filterYear);
  }
  if (filterClassId) {
    filtered = filtered.filter((l) => l.classId === filterClassId);
  }

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Graduated Learners Archive ({graduatedLearners.length})</Text>
      <Text style={styles.hintSmall}>Learners who completed Grade 9. This is read-only historical data.</Text>

      <Text style={styles.miniLabel}>Filter by graduation year</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={filterYear} onValueChange={setFilterYear}>
          <Picker.Item label="All Years" value="" />
          {years.map((y) => <Picker.Item key={y} label={String(y)} value={String(y)} />)}
        </Picker>
      </View>

      <Text style={styles.miniLabel}>Filter by class</Text>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={filterClassId} onValueChange={setFilterClassId}>
          <Picker.Item label="All Classes" value="" />
          {classes.map((c) => <Picker.Item key={c.id} label={c.name} value={c.id} />)}
        </Picker>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rowText}>
              {item.name}  ·  {item.admNo || "—"}  ·  {classes.find((c) => c.id === item.classId)?.name || "—"}  ·  Graduated {item.graduationYear || "Unknown Year"}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No graduated learners found.</Text>}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

function PromotionTab({ schoolId, classes, learners, isAdmin }) {
  const [plan, setPlan] = useState(null);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState(false);

  const activeCount = learners.filter((s) => !s.graduated).length;

  const preview = () => {
    setPlan(buildPromotionPlan(classes, learners));
    setDone(false);
  };

  const confirm = async () => {
    if (!plan) return;
    setApplying(true);
    try {
      await applyPromotions(schoolId, plan.moves, plan.graduates);
      setPlan(null);
      setDone(true);
    } catch (e) {
      Alert.alert("Couldn't promote learners", e?.message || "Something went wrong. Try again.");
    }
    setApplying(false);
  };

  return (
    <View style={styles.section}>
      <Text style={styles.label}>Year-end promotion</Text>
      <Text style={styles.hintSmall}>
        Moves every active Grade 7 learner to the matching Grade 8 stream, Grade 8 to Grade 9, and
        marks Grade 9 learners as graduated — removed from active rosters, but kept in history so
        past reports still work. Currently {activeCount} active learner{activeCount === 1 ? "" : "s"}.
      </Text>

      {!isAdmin && <Text style={styles.hintSmall}>Only an admin can run this.</Text>}

      {isAdmin && !plan && !done && (
        <TouchableOpacity style={styles.addBtn} onPress={preview}>
          <Text style={styles.addBtnText}>Preview promotion</Text>
        </TouchableOpacity>
      )}

      {isAdmin && plan && (
        <View>
          <Text style={styles.rowText}>{plan.moves.length} learner(s) will move up a grade.</Text>
          <Text style={styles.rowText}>{plan.graduates.length} Grade 9 learner(s) will graduate.</Text>

          {plan.unresolved.length > 0 && (
            <>
              <Text style={[styles.rowText, { color: "#C0392B", fontWeight: "700", marginTop: 10 }]}>
                {plan.unresolved.length} learner(s) can't be moved yet — no matching class exists:
              </Text>
              {plan.unresolved.slice(0, 12).map((u) => (
                <Text key={u.student.id} style={styles.hintSmall}>
                  {u.student.name} ({u.fromClass?.name || "—"}) needs a {u.targetGrade} class in the same stream
                </Text>
              ))}
              <Text style={styles.hintSmall}>Create the missing class(es) in the Classes tab, then preview again.</Text>
            </>
          )}

          {plan.moves.length === 0 && plan.graduates.length === 0 && (
            <Text style={styles.hintSmall}>Nothing to promote right now.</Text>
          )}

          <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
            <TouchableOpacity
              style={[styles.addBtn, { flex: 1 }, (plan.moves.length === 0 && plan.graduates.length === 0) && { opacity: 0.5 }]}
              onPress={confirm}
              disabled={applying || (plan.moves.length === 0 && plan.graduates.length === 0)}
            >
              <Text style={styles.addBtnText}>{applying ? "Promoting…" : "Confirm & promote"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, { flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border }]}
              onPress={() => setPlan(null)}
              disabled={applying}
            >
              <Text style={[styles.addBtnText, { color: COLORS.ink }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {done && <Text style={[styles.rowText, { color: COLORS.primary, fontWeight: "700" }]}>Promotion complete.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  tabRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 0, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff", paddingHorizontal: 8 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 8 },
  tabBtnActive: { borderBottomWidth: 2, borderColor: COLORS.accent },
  tabText: { color: COLORS.inkSoft, fontSize: 11.5 },
  tabTextActive: { color: COLORS.primary, fontWeight: "700" },
  section: { flex: 1, padding: 12 },
  label: { fontWeight: "700", color: COLORS.primary, marginBottom: 6, fontSize: 12 },
  inputRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 8, backgroundColor: "#fff", fontSize: 12.5 },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 8 },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderColor: COLORS.border },
  rowText: { fontSize: 12.5, color: COLORS.ink, flex: 1 },
  remove: { color: "#C0392B", fontSize: 11.5, fontWeight: "600" },
  empty: { color: COLORS.inkSoft, fontSize: 12, paddingVertical: 8 },
  hintSmall: { color: COLORS.inkSoft, fontSize: 11, marginBottom: 8 },
  bandRow: { borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 10 },
  miniLabel: { fontSize: 10.5, color: COLORS.inkSoft, marginBottom: 3 },
  genderRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  genderChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: "#fff" },
  genderChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderChipText: { fontSize: 11.5, color: COLORS.ink, fontWeight: "600" },
  genderChipTextActive: { color: "#fff" },
  tableWrap: { backgroundColor: "#fff", borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, overflow: "hidden" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.primary },
  tableTh: { color: "#fff", fontSize: 9.5, fontWeight: "700", padding: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: COLORS.border, alignItems: "center" },
  tableTd: { fontSize: 11, padding: 6, color: COLORS.ink },
  viewListBtn: { backgroundColor: COLORS.accent, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginRight: 6 },
  viewListBtnText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  graduateBtn: { backgroundColor: "#27AE60", paddingVertical: 5, paddingHorizontal: 8, borderRadius: 4, marginLeft: 6 },
  graduateBtnText: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
