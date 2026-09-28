import {
  collection, collectionGroup, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut as secondarySignOut } from "firebase/auth";
import { db, secondaryAuth } from "../firebaseConfig";
import { DEFAULT_SUBJECTS, DEFAULT_BANDS } from "./constants";

// ---------------------------------------------------------------------------
// Multi-tenancy context
// ---------------------------------------------------------------------------
// Every school's data lives under schools/{schoolId}/... . Once a person
// signs in, App.js resolves which school they belong to (see getMyContext)
// and calls setSchoolContext(schoolId) so every function below reads/writes
// the right school's data without every screen having to pass schoolId
// around. A school's id is simply the uid of the admin who created it.
let currentSchoolId = null;
export function setSchoolContext(schoolId) {
  currentSchoolId = schoolId || null;
}
export function getSchoolContext() {
  return currentSchoolId;
}
function requireSchool() {
  if (!currentSchoolId) throw new Error("No school context set — sign in again.");
  return currentSchoolId;
}
// Collection/doc refs scoped to the current school.
const sc = (name) => collection(db, "schools", requireSchool(), name);
const sd = (name, id) => doc(db, "schools", requireSchool(), name, id);

const normalizeSchoolName = (name) => (name || "").trim().toLowerCase().replace(/\s+/g, " ");

// ---------------------------------------------------------------------------
// Account / school resolution (used by App.js + LoginScreen before and right
// after sign-in). These are the only functions that touch root-level
// collections (users, schoolDirectory) rather than a school subcollection.
// ---------------------------------------------------------------------------

// Looks up which school + role a signed-in user belongs to.
export async function getMyContext(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null; // { schoolId, role, name? }
}

// Live version of getMyContext: keeps listening so that if the users/{uid}
// doc is written a moment after sign-in (as happens while a new school is
// being registered), the app picks it up as soon as it appears.
export function listenMyContext(uid, cb, onError) {
  return onSnapshot(
    doc(db, "users", uid),
    (snap) => cb(snap.exists() ? snap.data() : null),
    (err) => onError && onError(err)
  );
}

// Creates a brand-new school owned by the given (already-created) admin uid.
// The school's id is the admin's own uid. Fails (throws) if a school with
// this name already exists, so two schools can't collide on the same name —
// the same behaviour the app already relied on for the single-school setup.
export async function createSchool(adminUid, schoolName) {
  const key = normalizeSchoolName(schoolName);
  if (!key) throw new Error("Enter your school's name.");
  const dirRef = doc(db, "schoolDirectory", key);
  const existing = await getDoc(dirRef);
  if (existing.exists()) {
    throw new Error("A school with that name is already registered. Choose a more specific name, or sign in instead.");
  }
  await setDoc(dirRef, { schoolId: adminUid, displayName: schoolName.trim() });
  await setDoc(doc(db, "users", adminUid), { schoolId: adminUid, role: "admin" });
  await setDoc(doc(db, "schools", adminUid, "settings", "meta"), { schoolName: schoolName.trim() });
}

// Resolves a school by the name a person typed on the login screen.
export async function findSchoolByName(schoolName) {
  const key = normalizeSchoolName(schoolName);
  if (!key) return null;
  const snap = await getDoc(doc(db, "schoolDirectory", key));
  return snap.exists() ? snap.data() : null; // { schoolId, displayName }
}

// ---------------------------------------------------------------------------
// Realtime list subscriptions — all scoped to the current school.
// ---------------------------------------------------------------------------
export function listenClasses(cb) {
  return onSnapshot(sc("classes"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export function listenSubjects(cb) {
  return onSnapshot(sc("subjects"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(list.length ? list : DEFAULT_SUBJECTS);
  });
}
export function listenStudents(cb) {
  return onSnapshot(sc("students"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export function listenExams(cb) {
  return onSnapshot(sc("exams"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export function listenBands(cb) {
  return onSnapshot(sd("settings", "bands"), (snap) =>
    cb(snap.exists() ? snap.data().list : DEFAULT_BANDS)
  );
}
export function listenMeta(cb) {
  return onSnapshot(sd("settings", "meta"), (snap) =>
    cb(snap.exists() ? snap.data() : { schoolName: "" })
  );
}
export const saveMeta = (data) => setDoc(sd("settings", "meta"), data);

export function listenTeachers(cb) {
  return onSnapshot(sc("teachers"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export const addTeacher = (name, role, classId, subjectId) =>
  addDoc(sc("teachers"), {
    name, role,
    classId: classId || null,
    subjectId: subjectId || null,
  });
export const removeTeacher = (id) => deleteDoc(sd("teachers", id));

const slugify = (s) =>
  (s || "teacher").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "teacher";

// Creates (or re-issues) a login for a teacher: a real Firebase Auth account
// under a synthetic email, made on a *secondary* app instance so it never
// disturbs the admin's own signed-in session. Also writes a users/{uid} doc
// so the teacher's own sign-in resolves to this same school, and updates the
// teacher's record plus the public login directory the login screen reads
// before anyone is signed in.
export async function setTeacherPassword(teacherId, name, password, allTeachers) {
  const schoolId = requireSchool();
  const email = `${slugify(name)}.${Math.random().toString(36).slice(2, 7)}@teachers.local`;
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await secondarySignOut(secondaryAuth);
  await setDoc(doc(db, "users", cred.user.uid), { schoolId, role: "teacher", name });
  await updateDoc(sd("teachers", teacherId), { loginEmail: email });
  const list = allTeachers || [];
  const found = list.some((t) => t.id === teacherId);
  const updatedList = found
    ? list.map((t) => (t.id === teacherId ? { ...t, loginEmail: email } : t))
    : [...list, { id: teacherId, name, loginEmail: email }];
  await syncTeacherLoginsDirectory(updatedList);
  return email;
}

// Rebuilds the public (unauthenticated-readable) directory of teacher names
// -> login emails for the current school, so the login screen can resolve
// "which account is this" before the person is signed in to anything.
export async function syncTeacherLoginsDirectory(teachers) {
  const entries = (teachers || [])
    .filter((t) => t.loginEmail)
    .map((t) => ({ teacherId: t.id, name: t.name, loginEmail: t.loginEmail }));
  await setDoc(sd("settings", "teacherLogins"), { entries });
}

// One-time, unauthenticated-safe fetch used by the login screen before any
// sign-in has happened. Both take an explicit schoolId since there is no
// session yet to infer it from.
export async function getTeacherLoginDirectory(schoolId) {
  const snap = await getDoc(doc(db, "schools", schoolId, "settings", "teacherLogins"));
  return snap.exists() ? snap.data().entries || [] : [];
}
export async function getPublicSchoolName(schoolId) {
  const snap = await getDoc(doc(db, "schools", schoolId, "settings", "meta"));
  return snap.exists() ? snap.data().schoolName || "" : "";
}

// Per-person profile (picture, display name), keyed by their Firebase Auth
// uid, scoped to the school so it works the same for the admin and every
// teacher account.
export function listenProfile(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(sd("profiles", uid), (snap) => cb(snap.exists() ? snap.data() : {}));
}
export const saveProfile = (uid, data) => setDoc(sd("profiles", uid), data, { merge: true });

export function listenExamScores(examId, cb) {
  if (!examId) return () => {};
  return onSnapshot(sd("scores", examId), (snap) =>
    cb(snap.exists() ? snap.data() : {})
  );
}

// Writes
export const addClass = (name, grade) => addDoc(sc("classes"), { name, grade });
export const removeClass = (id) => deleteDoc(sd("classes", id));

export const addSubject = (name, code) => addDoc(sc("subjects"), { name, code });
export const removeSubject = (id) => deleteDoc(sd("subjects", id));

export const addStudent = (name, assessmentNo, classId, gender) =>
  addDoc(sc("students"), { name, admNo: assessmentNo, classId, gender: gender || null });
export const updateStudent = (id, data) => updateDoc(sd("students", id), data);
export const removeStudent = (id) => deleteDoc(sd("students", id));
export const bulkAddStudents = async (rows) => {
  await Promise.all(rows.map((r) => addDoc(sc("students"), r)));
};

export const addExam = (name, term, year, grade, sequence) =>
  addDoc(sc("exams"), { name, term, year, grade: grade || null, sequence: sequence || null });
export const removeExam = (id) => deleteDoc(sd("exams", id));

export const saveBands = (list) => setDoc(sd("settings", "bands"), { list });

export const saveExamScores = (examId, data) => setDoc(sd("scores", examId), data);

// One-time fetch of several exams' scores at once — used to build a whole
// term's worth of assessments (report cards, term averages) without keeping
// N live listeners open.
export async function getScoresForExams(examIds) {
  const entries = await Promise.all(
    examIds.map(async (id) => {
      const snap = await getDoc(sd("scores", id));
      return [id, snap.exists() ? snap.data() : {}];
    })
  );
  return Object.fromEntries(entries);
}

// Applies a year-end promotion plan: moves each student to their next-grade
// class, and flags Grade 9 students as graduated. Scores and report history
// are untouched — only each student's current classId/graduated status changes.
export async function applyPromotions(moves, graduates) {
  const graduationYear = new Date().getFullYear();
  await Promise.all([
    ...moves.map((m) => updateDoc(sd("students", m.student.id), { classId: m.toClass.id })),
    ...graduates.map((g) => updateDoc(sd("students", g.student.id), { graduated: true, graduatedYear: graduationYear })),
  ]);
}
