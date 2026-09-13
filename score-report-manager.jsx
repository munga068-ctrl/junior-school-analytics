import React, { useState, useEffect, useCallback, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_SUBJECTS = [
  { id: "mat", name: "Mathematics", code: "MAT" },
  { id: "eng", name: "English", code: "ENG" },
  { id: "kis", name: "Kiswahili", code: "KIS" },
  { id: "int", name: "Integrated Science", code: "INT" },
  { id: "pre", name: "Pre-Technical Studies", code: "PRE" },
  { id: "sst", name: "Social Studies", code: "SST" },
  { id: "ca", name: "Creative Arts", code: "CA" },
  { id: "cre", name: "CRE", code: "CRE" },
  { id: "agr", name: "Agriculture", code: "AGR" },
];

const DEFAULT_BANDS = [
  { id: "ee", short: "EE", label: "Exceeding Expectation", min: 80, max: 100, color: "#1F6F4A" },
  { id: "me", short: "ME", label: "Meeting Expectation", min: 50, max: 79, color: "#6B8E23" },
  { id: "ae", short: "AE", label: "Approaching Expectation", min: 30, max: 49, color: "#E08E2B" },
  { id: "be", short: "BE", label: "Below Expectation", min: 0, max: 29, color: "#C0392B" },
];

const COLORS = {
  bg: "#F5F6F2",
  surface: "#FFFFFF",
  ink: "#1C2B27",
  inkSoft: "#5B6A64",
  primary: "#1F4B43",
  primaryLight: "#2E6B5E",
  accent: "#D9A441",
  border: "#DBE1DA",
  headerText: "#F5F6F2",
};

function getBand(score, bands) {
  if (score === null || score === undefined || score === "") return null;
  const n = Number(score);
  for (const b of bands) {
    if (n >= b.min && n <= b.max) return b;
  }
  return bands[bands.length - 1];
}

async function safeGet(key, fallback) {
  try {
    const r = await window.storage.get(key, true);
    return r ? JSON.parse(r.value) : fallback;
  } catch {
    return fallback;
  }
}
async function safeSet(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), true);
    return true;
  } catch (e) {
    console.error("storage set failed", key, e);
    return false;
  }
}

const inputStyle = {
  padding: "8px 10px",
  border: `1px solid ${COLORS.border}`,
  borderRadius: 4,
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
  color: COLORS.ink,
};

const btnBase = {
  padding: "8px 14px",
  borderRadius: 4,
  fontSize: 14,
  fontFamily: "inherit",
  cursor: "pointer",
  border: `1px solid ${COLORS.border}`,
  background: "#fff",
  color: COLORS.ink,
};
const btnPrimary = { ...btnBase, background: COLORS.primary, color: "#fff", border: `1px solid ${COLORS.primary}` };
const btnDanger = { ...btnBase, color: "#C0392B", border: "1px solid #E8C4BE" };

function Section({ title, children, right }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12, borderBottom: `2px solid ${COLORS.primary}`, paddingBottom: 8 }}>
        <h2 style={{ fontFamily: "Georgia, 'Iowan Old Style', serif", fontSize: 19, fontWeight: 700, color: COLORS.primary, margin: 0 }}>{title}</h2>
        {right}
      </div>
      {children}
    </div>
  );
}

function Th({ children, style }) {
  return (
    <th style={{ background: COLORS.primary, color: COLORS.headerText, padding: "9px 10px", fontSize: 12.5, textAlign: "left", fontWeight: 600, letterSpacing: 0.2, borderRight: "1px solid rgba(255,255,255,0.12)", ...style }}>
      {children}
    </th>
  );
}
function Td({ children, style }) {
  return (
    <td style={{ padding: "8px 10px", fontSize: 13.5, borderBottom: `1px solid ${COLORS.border}`, color: COLORS.ink, ...style }}>
      {children}
    </td>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [meta, setMeta] = useState({ schoolName: "" });
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [bands, setBands] = useState(DEFAULT_BANDS);
  const [scoresCache, setScoresCache] = useState({}); // examId -> {studentId:{subjectId:score}}
  const [saveFlash, setSaveFlash] = useState("");

  useEffect(() => {
    (async () => {
      const [m, c, s, st, e, b] = await Promise.all([
        safeGet("meta", { schoolName: "" }),
        safeGet("classes", []),
        safeGet("subjects", DEFAULT_SUBJECTS),
        safeGet("students", []),
        safeGet("exams", []),
        safeGet("bands", DEFAULT_BANDS),
      ]);
      setMeta(m);
      setClasses(c);
      setSubjects(s);
      setStudents(st);
      setExams(e);
      setBands(b);
      setLoading(false);
    })();
  }, []);

  const flash = (msg) => {
    setSaveFlash(msg);
    setTimeout(() => setSaveFlash(""), 1800);
  };

  const persistClasses = async (next) => { setClasses(next); await safeSet("classes", next); };
  const persistSubjects = async (next) => { setSubjects(next); await safeSet("subjects", next); };
  const persistStudents = async (next) => { setStudents(next); await safeSet("students", next); };
  const persistExams = async (next) => { setExams(next); await safeSet("exams", next); };
  const persistBands = async (next) => { setBands(next); await safeSet("bands", next); };
  const persistMeta = async (next) => { setMeta(next); await safeSet("meta", next); };

  const getExamScores = useCallback(async (examId) => {
    if (scoresCache[examId]) return scoresCache[examId];
    const data = await safeGet(`scores:${examId}`, {});
    setScoresCache((prev) => ({ ...prev, [examId]: data }));
    return data;
  }, [scoresCache]);

  const saveExamScores = async (examId, data) => {
    setScoresCache((prev) => ({ ...prev, [examId]: data }));
    await safeSet(`scores:${examId}`, data);
  };

  if (loading) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui, sans-serif", color: COLORS.ink }}>
        Loading…
      </div>
    );
  }

  const NAV = [
    { id: "dashboard", label: "Dashboard", icon: "\u25A4" },
    { id: "setup", label: "Setup", icon: "\u2699" },
    { id: "entry", label: "Score entry", icon: "\u270E" },
    { id: "reports", label: "Reports", icon: "\u25A6" },
  ];

  return (
    <div style={{ display: "flex", minHeight: 640, background: COLORS.bg, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", color: COLORS.ink }}>
      <div style={{ width: 190, background: COLORS.primary, color: "#fff", padding: "20px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 18px 18px", borderBottom: "1px solid rgba(255,255,255,0.15)", marginBottom: 10 }}>
          <div style={{ fontFamily: "Georgia, serif", fontWeight: 700, fontSize: 16, lineHeight: 1.3 }}>
            {meta.schoolName || "Results Manager"}
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 3 }}>Score entry & reports</div>
        </div>
        {NAV.map((n) => (
          <div
            key={n.id}
            onClick={() => setTab(n.id)}
            style={{
              padding: "11px 18px",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              gap: 10,
              alignItems: "center",
              background: tab === n.id ? "rgba(255,255,255,0.12)" : "transparent",
              borderLeft: tab === n.id ? `3px solid ${COLORS.accent}` : "3px solid transparent",
              fontWeight: tab === n.id ? 700 : 400,
            }}
          >
            <span style={{ opacity: 0.85 }}>{n.icon}</span> {n.label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: "26px 32px", position: "relative", overflowX: "auto" }}>
        {saveFlash && (
          <div style={{ position: "absolute", top: 18, right: 32, background: COLORS.primary, color: "#fff", padding: "7px 14px", borderRadius: 4, fontSize: 13 }}>
            {saveFlash}
          </div>
        )}
        {tab === "dashboard" && (
          <Dashboard classes={classes} subjects={subjects} students={students} exams={exams} meta={meta} onSaveMeta={persistMeta} />
        )}
        {tab === "setup" && (
          <SetupView
            classes={classes} setClasses={persistClasses}
            subjects={subjects} setSubjects={persistSubjects}
            students={students} setStudents={persistStudents}
            exams={exams} setExams={persistExams}
            bands={bands} setBands={persistBands}
            flash={flash}
          />
        )}
        {tab === "entry" && (
          <ScoreEntryView
            classes={classes} subjects={subjects} students={students} exams={exams}
            getExamScores={getExamScores} saveExamScores={saveExamScores} flash={flash}
          />
        )}
        {tab === "reports" && (
          <ReportsView
            classes={classes} subjects={subjects} students={students} exams={exams} bands={bands}
            getExamScores={getExamScores}
          />
        )}
      </div>
    </div>
  );
}

function Dashboard({ classes, subjects, students, exams, meta, onSaveMeta }) {
  const [name, setName] = useState(meta.schoolName || "");
  return (
    <div>
      <Section title="Overview">
        <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            ["Classes", classes.length],
            ["Subjects", subjects.length],
            ["Students", students.length],
            ["Exams recorded", exams.length],
          ].map(([label, val]) => (
            <div key={label} style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: "16px 22px", minWidth: 130 }}>
              <div style={{ fontSize: 12, color: COLORS.inkSoft }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: COLORS.primary, fontFamily: "Georgia, serif" }}>{val}</div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="School name">
        <div style={{ display: "flex", gap: 10 }}>
          <input style={{ ...inputStyle, width: 280 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riverside Primary School" />
          <button style={btnPrimary} onClick={() => onSaveMeta({ ...meta, schoolName: name })}>Save</button>
        </div>
      </Section>
      {classes.length === 0 && (
        <p style={{ color: COLORS.inkSoft, fontSize: 14 }}>Start in <b>Setup</b> — add your classes, confirm your learning areas, and add students. Then use <b>Score entry</b> to record marks and <b>Reports</b> to view colour-coded results.</p>
      )}
    </div>
  );
}

function SetupView({ classes, setClasses, subjects, setSubjects, students, setStudents, exams, setExams, bands, setBands, flash }) {
  const [subTab, setSubTab] = useState("classes");
  const [newClassName, setNewClassName] = useState("");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newSubjectCode, setNewSubjectCode] = useState("");
  const [newExamName, setNewExamName] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentAdm, setNewStudentAdm] = useState("");
  const [newStudentClass, setNewStudentClass] = useState("");
  const [bulkClass, setBulkClass] = useState("");
  const [bulkText, setBulkText] = useState("");

  const addClass = async () => {
    if (!newClassName.trim()) return;
    await setClasses([...classes, { id: uid(), name: newClassName.trim() }]);
    setNewClassName("");
    flash("Class added");
  };
  const removeClass = async (id) => {
    await setClasses(classes.filter((c) => c.id !== id));
    flash("Class removed");
  };
  const addSubject = async () => {
    if (!newSubjectName.trim()) return;
    await setSubjects([...subjects, { id: uid(), name: newSubjectName.trim(), code: newSubjectCode.trim() || newSubjectName.slice(0, 3).toUpperCase() }]);
    setNewSubjectName(""); setNewSubjectCode("");
    flash("Learning area added");
  };
  const removeSubject = async (id) => {
    await setSubjects(subjects.filter((s) => s.id !== id));
    flash("Removed");
  };
  const addExam = async () => {
    if (!newExamName.trim()) return;
    await setExams([...exams, { id: uid(), name: newExamName.trim() }]);
    setNewExamName("");
    flash("Exam added");
  };
  const removeExam = async (id) => {
    await setExams(exams.filter((e) => e.id !== id));
    flash("Exam removed");
  };
  const addStudent = async () => {
    if (!newStudentName.trim() || !newStudentClass) return;
    await setStudents([...students, { id: uid(), name: newStudentName.trim(), admNo: newStudentAdm.trim(), classId: newStudentClass }]);
    setNewStudentName(""); setNewStudentAdm("");
    flash("Student added");
  };
  const removeStudent = async (id) => {
    await setStudents(students.filter((s) => s.id !== id));
    flash("Student removed");
  };
  const bulkAdd = async () => {
    if (!bulkClass || !bulkText.trim()) return;
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const newOnes = lines.map((line) => {
      const [name, adm] = line.split(",").map((p) => p && p.trim());
      return { id: uid(), name: name || line, admNo: adm || "", classId: bulkClass };
    });
    await setStudents([...students, ...newOnes]);
    setBulkText("");
    flash(`${newOnes.length} students added`);
  };
  const updateBand = async (id, field, val) => {
    await setBands(bands.map((b) => (b.id === id ? { ...b, [field]: field === "min" || field === "max" ? Number(val) : val } : b)));
  };

  const subTabs = [
    ["classes", "Classes"],
    ["subjects", "Learning areas"],
    ["students", "Students"],
    ["exams", "Exams"],
    ["bands", "Performance bands"],
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: `1px solid ${COLORS.border}` }}>
        {subTabs.map(([id, label]) => (
          <div key={id} onClick={() => setSubTab(id)} style={{
            padding: "8px 14px", cursor: "pointer", fontSize: 13.5,
            borderBottom: subTab === id ? `2px solid ${COLORS.accent}` : "2px solid transparent",
            fontWeight: subTab === id ? 700 : 400, color: subTab === id ? COLORS.primary : COLORS.inkSoft,
          }}>{label}</div>
        ))}
      </div>

      {subTab === "classes" && (
        <Section title="Classes">
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input style={inputStyle} placeholder="e.g. Grade 7 Green" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} />
            <button style={btnPrimary} onClick={addClass}>Add class</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: COLORS.surface }}>
            <thead><tr><Th>Class</Th><Th>Students</Th><Th style={{ width: 90 }}>Action</Th></tr></thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <Td>{c.name}</Td>
                  <Td>{students.filter((s) => s.classId === c.id).length}</Td>
                  <Td><button style={btnDanger} onClick={() => removeClass(c.id)}>Remove</button></Td>
                </tr>
              ))}
              {classes.length === 0 && <tr><Td style={{ color: COLORS.inkSoft }} colSpan={3}>No classes yet.</Td></tr>}
            </tbody>
          </table>
        </Section>
      )}

      {subTab === "subjects" && (
        <Section title="Learning areas / subjects">
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input style={inputStyle} placeholder="Name, e.g. Mathematics" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} />
            <input style={{ ...inputStyle, width: 90 }} placeholder="Code" value={newSubjectCode} onChange={(e) => setNewSubjectCode(e.target.value)} />
            <button style={btnPrimary} onClick={addSubject}>Add</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: COLORS.surface }}>
            <thead><tr><Th>Name</Th><Th style={{ width: 90 }}>Code</Th><Th style={{ width: 90 }}>Action</Th></tr></thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <Td>{s.name}</Td><Td>{s.code}</Td>
                  <Td><button style={btnDanger} onClick={() => removeSubject(s.id)}>Remove</button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {subTab === "students" && (
        <>
          <Section title="Add a student">
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <input style={inputStyle} placeholder="Full name" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} />
              <input style={{ ...inputStyle, width: 130 }} placeholder="Admission no." value={newStudentAdm} onChange={(e) => setNewStudentAdm(e.target.value)} />
              <select style={inputStyle} value={newStudentClass} onChange={(e) => setNewStudentClass(e.target.value)}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button style={btnPrimary} onClick={addStudent}>Add student</button>
            </div>
          </Section>
          <Section title="Bulk add (paste list)">
            <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: -6 }}>One student per line: <code>Name, Admission No.</code></p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <select style={inputStyle} value={bulkClass} onChange={(e) => setBulkClass(e.target.value)}>
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <textarea style={{ ...inputStyle, width: "100%", minHeight: 90, marginBottom: 10, fontFamily: "monospace" }} placeholder={"Jane Wanjiru, 2201\nBrian Otieno, 2202"} value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
            <button style={btnPrimary} onClick={bulkAdd}>Add all</button>
          </Section>
          <Section title={`Roster (${students.length})`}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: COLORS.surface }}>
              <thead><tr><Th>Name</Th><Th>Adm. no.</Th><Th>Class</Th><Th style={{ width: 90 }}>Action</Th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <Td>{s.name}</Td><Td>{s.admNo}</Td>
                    <Td>{classes.find((c) => c.id === s.classId)?.name || "—"}</Td>
                    <Td><button style={btnDanger} onClick={() => removeStudent(s.id)}>Remove</button></Td>
                  </tr>
                ))}
                {students.length === 0 && <tr><Td style={{ color: COLORS.inkSoft }} colSpan={4}>No students yet.</Td></tr>}
              </tbody>
            </table>
          </Section>
        </>
      )}

      {subTab === "exams" && (
        <Section title="Exams">
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input style={inputStyle} placeholder="e.g. Term 2 2026 Mid-Term" value={newExamName} onChange={(e) => setNewExamName(e.target.value)} />
            <button style={btnPrimary} onClick={addExam}>Add exam</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", background: COLORS.surface }}>
            <thead><tr><Th>Name</Th><Th style={{ width: 90 }}>Action</Th></tr></thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id}><Td>{e.name}</Td><Td><button style={btnDanger} onClick={() => removeExam(e.id)}>Remove</button></Td></tr>
              ))}
              {exams.length === 0 && <tr><Td style={{ color: COLORS.inkSoft }} colSpan={2}>No exams yet.</Td></tr>}
            </tbody>
          </table>
        </Section>
      )}

      {subTab === "bands" && (
        <Section title="Performance level bands">
          <p style={{ fontSize: 12.5, color: COLORS.inkSoft, marginTop: -6 }}>Adjust the score ranges to match your school's grading framework.</p>
          <table style={{ width: "100%", borderCollapse: "collapse", background: COLORS.surface }}>
            <thead><tr><Th>Level</Th><Th>Min %</Th><Th>Max %</Th><Th>Colour</Th></tr></thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.id}>
                  <Td><span style={{ fontWeight: 700, color: b.color }}>{b.short}</span> — {b.label}</Td>
                  <Td><input type="number" style={{ ...inputStyle, width: 70 }} value={b.min} onChange={(e) => updateBand(b.id, "min", e.target.value)} /></Td>
                  <Td><input type="number" style={{ ...inputStyle, width: 70 }} value={b.max} onChange={(e) => updateBand(b.id, "max", e.target.value)} /></Td>
                  <Td><div style={{ width: 22, height: 22, borderRadius: 3, background: b.color }} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </div>
  );
}

function ScoreEntryView({ classes, subjects, students, exams, getExamScores, saveExamScores, flash }) {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [localScores, setLocalScores] = useState({});
  const [loadedKey, setLoadedKey] = useState("");

  const classStudents = students.filter((s) => s.classId === classId);

  useEffect(() => {
    if (!examId) return;
    (async () => {
      const data = await getExamScores(examId);
      const key = `${examId}`;
      const map = {};
      classStudents.forEach((s) => { map[s.id] = data?.[s.id]?.[subjectId] ?? ""; });
      setLocalScores(map);
      setLoadedKey(`${examId}:${classId}:${subjectId}`);
    })();
    // eslint-disable-next-line
  }, [examId, classId, subjectId]);

  const save = async () => {
    if (!examId || !subjectId) return;
    const full = await getExamScores(examId);
    const next = { ...full };
    classStudents.forEach((s) => {
      const v = localScores[s.id];
      next[s.id] = { ...(next[s.id] || {}), [subjectId]: v === "" ? undefined : Number(v) };
    });
    await saveExamScores(examId, next);
    flash("Scores saved");
  };

  return (
    <div>
      <Section title="Score entry">
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <select style={inputStyle} value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select style={inputStyle} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={inputStyle} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">Select learning area</option>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {(!examId || !classId || !subjectId) && (
          <p style={{ color: COLORS.inkSoft, fontSize: 14 }}>Choose an exam, class, and learning area to begin entering scores.</p>
        )}

        {examId && classId && subjectId && (
          <>
            <table style={{ width: "100%", borderCollapse: "collapse", background: COLORS.surface, marginBottom: 14 }}>
              <thead><tr><Th style={{ width: 50 }}>#</Th><Th>Student</Th><Th style={{ width: 100 }}>Adm. no.</Th><Th style={{ width: 130 }}>Score (%)</Th></tr></thead>
              <tbody>
                {classStudents.map((s, i) => (
                  <tr key={s.id}>
                    <Td>{i + 1}</Td>
                    <Td>{s.name}</Td>
                    <Td>{s.admNo}</Td>
                    <Td>
                      <input
                        type="number" min="0" max="100"
                        style={{ ...inputStyle, width: 90 }}
                        value={localScores[s.id] ?? ""}
                        onChange={(e) => setLocalScores({ ...localScores, [s.id]: e.target.value })}
                      />
                    </Td>
                  </tr>
                ))}
                {classStudents.length === 0 && <tr><Td colSpan={4} style={{ color: COLORS.inkSoft }}>No students in this class yet — add them in Setup.</Td></tr>}
              </tbody>
            </table>
            {classStudents.length > 0 && <button style={btnPrimary} onClick={save}>Save scores</button>}
          </>
        )}
      </Section>
    </div>
  );
}

function ReportsView({ classes, subjects, students, exams, bands, getExamScores }) {
  const [examId, setExamId] = useState("");
  const [classId, setClassId] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!examId) return;
    (async () => { setData(await getExamScores(examId)); })();
  }, [examId, getExamScores]);

  const classStudents = students.filter((s) => s.classId === classId);

  const rows = useMemo(() => {
    if (!data) return [];
    const r = classStudents.map((s) => {
      const subjScores = {};
      let total = 0, count = 0;
      subjects.forEach((sub) => {
        const v = data?.[s.id]?.[sub.id];
        subjScores[sub.id] = v;
        if (v !== undefined && v !== null) { total += Number(v); count++; }
      });
      const mean = count ? total / count : null;
      return { student: s, subjScores, total, mean, count };
    });
    const ranked = [...r].filter((x) => x.mean !== null).sort((a, b) => b.mean - a.mean);
    r.forEach((x) => {
      x.rank = x.mean === null ? "—" : ranked.findIndex((y) => y.student.id === x.student.id) + 1;
    });
    return r;
  }, [data, classStudents, subjects]);

  const subjectMeans = useMemo(() => {
    return subjects.map((sub) => {
      const vals = rows.map((r) => r.subjScores[sub.id]).filter((v) => v !== undefined && v !== null);
      const mean = vals.length ? vals.reduce((a, b) => a + Number(b), 0) / vals.length : null;
      return { name: sub.code, fullName: sub.name, mean: mean === null ? 0 : Math.round(mean * 10) / 10, hasData: mean !== null };
    });
  }, [rows, subjects]);

  return (
    <div>
      <Section title="Reports">
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <select style={inputStyle} value={examId} onChange={(e) => setExamId(e.target.value)}>
            <option value="">Select exam</option>
            {exams.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select style={inputStyle} value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {(!examId || !classId) && <p style={{ color: COLORS.inkSoft, fontSize: 14 }}>Choose an exam and class to view the report.</p>}

        {examId && classId && (
          <>
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              {bands.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 2, background: b.color, display: "inline-block" }} />
                  {b.short} ({b.min}–{b.max}%)
                </div>
              ))}
            </div>

            <div style={{ overflowX: "auto", marginBottom: 26 }}>
              <table style={{ borderCollapse: "collapse", background: COLORS.surface, minWidth: 700 }}>
                <thead>
                  <tr>
                    <Th style={{ position: "sticky", left: 0 }}>#</Th>
                    <Th style={{ position: "sticky", left: 0 }}>Student</Th>
                    {subjects.map((s) => <Th key={s.id} style={{ textAlign: "center" }}>{s.code}</Th>)}
                    <Th style={{ textAlign: "center" }}>Total</Th>
                    <Th style={{ textAlign: "center" }}>Mean</Th>
                    <Th style={{ textAlign: "center" }}>Rank</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.student.id}>
                      <Td>{i + 1}</Td>
                      <Td>{r.student.name}</Td>
                      {subjects.map((s) => {
                        const v = r.subjScores[s.id];
                        const band = getBand(v, bands);
                        return (
                          <Td key={s.id} style={{ textAlign: "center", background: band ? band.color + "26" : undefined, color: band ? band.color : COLORS.inkSoft, fontWeight: band ? 700 : 400 }}>
                            {v === undefined || v === null ? "—" : v}
                          </Td>
                        );
                      })}
                      <Td style={{ textAlign: "center", fontWeight: 700 }}>{r.total || "—"}</Td>
                      <Td style={{ textAlign: "center", fontWeight: 700 }}>{r.mean !== null ? r.mean.toFixed(1) : "—"}</Td>
                      <Td style={{ textAlign: "center", fontWeight: 700 }}>{r.rank}</Td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><Td colSpan={subjects.length + 4} style={{ color: COLORS.inkSoft }}>No students in this class.</Td></tr>}
                </tbody>
              </table>
            </div>

            {rows.length > 0 && (
              <Section title="Subject performance (class mean %)">
                <div style={{ width: "100%", height: 260, background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 4, padding: 12 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={subjectMeans} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: COLORS.inkSoft }} />
                      <Tooltip formatter={(v, n, p) => [`${v}%`, p.payload.fullName]} />
                      <Bar dataKey="mean" radius={[3, 3, 0, 0]}>
                        {subjectMeans.map((entry, i) => {
                          const band = entry.hasData ? getBand(entry.mean, bands) : null;
                          return <Cell key={i} fill={band ? band.color : COLORS.border} />;
                        })}
                        <LabelList dataKey="mean" position="top" style={{ fontSize: 11, fill: COLORS.ink }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Section>
            )}
          </>
        )}
      </Section>
    </div>
  );
}
