import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut as secondarySignOut } from "firebase/auth";
import { db, secondaryAuth } from "../firebaseConfig";
import { DEFAULT_SUBJECTS, DEFAULT_BANDS } from "./constants";

// Realtime list subscriptions. Each returns an unsubscribe function.
export function listenClasses(cb) {
  return onSnapshot(collection(db, "classes"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export function listenSubjects(cb) {
  return onSnapshot(collection(db, "subjects"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(list.length ? list : DEFAULT_SUBJECTS);
  });
}
export function listenStudents(cb) {
  return onSnapshot(collection(db, "students"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export function listenExams(cb) {
  return onSnapshot(collection(db, "exams"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export function listenBands(cb) {
  return onSnapshot(doc(db, "settings", "bands"), (snap) =>
    cb(snap.exists() ? snap.data().list : DEFAULT_BANDS)
  );
}
export function listenMeta(cb) {
  return onSnapshot(doc(db, "settings", "meta"), (snap) =>
    cb(snap.exists() ? snap.data() : { schoolName: "" })
  );
}
export const saveMeta = (data) => setDoc(doc(db, "settings", "meta"), data);

export function listenTeachers(cb) {
  return onSnapshot(collection(db, "teachers"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}
export const addTeacher = (name, role, classId, subjectId) =>
  addDoc(collection(db, "teachers"), {
    name, role,
    classId: classId || null,
    subjectId: subjectId || null,
  });
export const removeTeacher = (id) => deleteDoc(doc(db, "teachers", id));

const slugify = (s) =>
  (s || "teacher").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "teacher";

// Creates (or re-issues) a login for a teacher: a real Firebase Auth account
// under a synthetic email, made on a *secondary* app instance so it never
// disturbs the admin's own signed-in session. Updates the teacher's record
// with the new login email and refreshes the public login directory that
// the login screen reads before anyone is signed in.
export async function setTeacherPassword(teacherId, name, password, allTeachers) {
  const email = `${slugify(name)}.${Math.random().toString(36).slice(2, 7)}@teachers.local`;
  await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await secondarySignOut(secondaryAuth);
  await updateDoc(doc(db, "teachers", teacherId), { loginEmail: email });
  const list = allTeachers || [];
  const found = list.some((t) => t.id === teacherId);
  const updatedList = found
    ? list.map((t) => (t.id === teacherId ? { ...t, loginEmail: email } : t))
    : [...list, { id: teacherId, name, loginEmail: email }];
  await syncTeacherLoginsDirectory(updatedList);
  return email;
}

// Rebuilds the public (unauthenticated-readable) directory of teacher names
// -> login emails, so the login screen can resolve "which account is this"
// before the person is signed in to anything.
export async function syncTeacherLoginsDirectory(teachers) {
  const entries = (teachers || [])
    .filter((t) => t.loginEmail)
    .map((t) => ({ teacherId: t.id, name: t.name, loginEmail: t.loginEmail }));
  await setDoc(doc(db, "settings", "teacherLogins"), { entries });
}

// One-time, unauthenticated-safe fetch used by the login screen before any
// sign-in has happened.
export async function getTeacherLoginDirectory() {
  const snap = await getDoc(doc(db, "settings", "teacherLogins"));
  return snap.exists() ? snap.data().entries || [] : [];
}
export async function getPublicSchoolName() {
  const snap = await getDoc(doc(db, "settings", "meta"));
  return snap.exists() ? snap.data().schoolName || "" : "";
}

// Per-person profile (picture, display name), keyed by their Firebase Auth
// uid so it works the same for the admin and for every teacher account.
export function listenProfile(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(doc(db, "profiles", uid), (snap) => cb(snap.exists() ? snap.data() : {}));
}
export const saveProfile = (uid, data) => setDoc(doc(db, "profiles", uid), data, { merge: true });

// Admins are tracked as a plain list of emails in settings/admins.
// The very first person to sign in (when this doc doesn't exist yet)
// automatically becomes the first admin.
export function listenAdmins(cb) {
  return onSnapshot(doc(db, "settings", "admins"), (snap) =>
    cb(snap.exists() ? snap.data().emails || [] : [])
  );
}
export async function ensureAdminBootstrap(email) {
  if (!email) return;
  const ref = doc(db, "settings", "admins");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { emails: [email] });
  }
}
export const addAdminEmail = async (currentEmails, email) => {
  const next = Array.from(new Set([...(currentEmails || []), email]));
  await setDoc(doc(db, "settings", "admins"), { emails: next });
};
export const removeAdminEmail = async (currentEmails, email) => {
  const next = (currentEmails || []).filter((e) => e !== email);
  await setDoc(doc(db, "settings", "admins"), { emails: next });
};
export function listenExamScores(examId, cb) {
  if (!examId) return () => {};
  return onSnapshot(doc(db, "scores", examId), (snap) =>
    cb(snap.exists() ? snap.data() : {})
  );
}

// Writes
export const addClass = (name, grade) => addDoc(collection(db, "classes"), { name, grade });
export const removeClass = (id) => deleteDoc(doc(db, "classes", id));

export const addSubject = (name, code) => addDoc(collection(db, "subjects"), { name, code });
export const removeSubject = (id) => deleteDoc(doc(db, "subjects", id));

export const addStudent = (name, assessmentNo, classId, gender) =>
  addDoc(collection(db, "students"), { name, admNo: assessmentNo, classId, gender: gender || null });
export const removeStudent = (id) => deleteDoc(doc(db, "students", id));
export const bulkAddStudents = async (rows) => {
  await Promise.all(rows.map((r) => addDoc(collection(db, "students"), r)));
};

export const addExam = (name, term, year, grade) =>
  addDoc(collection(db, "exams"), { name, term, year, grade: grade || null });
export const removeExam = (id) => deleteDoc(doc(db, "exams", id));

export const saveBands = (list) => setDoc(doc(db, "settings", "bands"), { list });

export const saveExamScores = (examId, data) => setDoc(doc(db, "scores", examId), data);

// One-time fetch of several exams' scores at once — used to build a whole
// term's worth of assessments (report cards, term averages) without keeping
// N live listeners open.
export async function getScoresForExams(examIds) {
  const entries = await Promise.all(
    examIds.map(async (id) => {
      const snap = await getDoc(doc(db, "scores", id));
      return [id, snap.exists() ? snap.data() : {}];
    })
  );
  return Object.fromEntries(entries);
}

// Applies a year-end promotion plan: moves each student to their next-grade
// class, and flags Grade 9 students as graduated. Scores and report history
// are untouched — only each student's current classId/graduated status changes.
export async function applyPromotions(moves, graduates) {
  await Promise.all([
    ...moves.map((m) => updateDoc(doc(db, "students", m.student.id), { classId: m.toClass.id })),
    ...graduates.map((g) => updateDoc(doc(db, "students", g.student.id), { graduated: true })),
  ]);
}
