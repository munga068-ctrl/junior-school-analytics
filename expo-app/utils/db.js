import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, updateDoc, onSnapshot,
} from "firebase/firestore";
import { createUserWithEmailAndPassword, signOut as secondarySignOut } from "firebase/auth";
import { db, secondaryAuth } from "../firebaseConfig";
import { DEFAULT_SUBJECTS, DEFAULT_BANDS } from "./constants";

// Get the schoolId for the current user
export async function getUserSchoolId(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "schoolUsers", uid));
  return snap.exists() ? snap.data().schoolId : null;
}

// Initialize a new school when admin creates account
export async function initializeSchool(uid, email) {
  const schoolId = uid; // Use admin's uid as schoolId
  await setDoc(doc(db, "schoolUsers", uid), { schoolId, role: "admin", email });
  await setDoc(doc(db, "schools", schoolId, "settings", "meta"), {
    schoolName: "",
    createdAt: new Date().toISOString()
  });
  await setDoc(doc(db, "schools", schoolId, "settings", "admins"), { emails: [email] });
  await setDoc(doc(db, "settings", "setupStatus"), { hasAdmin: true });
  return schoolId;
}

// Realtime list subscriptions. Each returns an unsubscribe function.
export function listenClasses(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(collection(db, "schools", schoolId, "classes"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export function listenLearningAreas(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(collection(db, "schools", schoolId, "learningAreas"), (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(list.length ? list : DEFAULT_SUBJECTS);
  });
}

export function listenLearners(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(collection(db, "schools", schoolId, "learners"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export function listenAssessments(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(collection(db, "schools", schoolId, "assessments"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export function listenBands(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(doc(db, "schools", schoolId, "settings", "bands"), (snap) =>
    cb(snap.exists() ? snap.data().list : DEFAULT_BANDS)
  );
}

export function listenMeta(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(doc(db, "schools", schoolId, "settings", "meta"), (snap) =>
    cb(snap.exists() ? snap.data() : { schoolName: "" })
  );
}

export const saveMeta = (schoolId, data) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return setDoc(doc(db, "schools", schoolId, "settings", "meta"), data);
};

export function listenTeachers(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(collection(db, "schools", schoolId, "teachers"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

export const addTeacher = (schoolId, name, role, classId, subjectId) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return addDoc(collection(db, "schools", schoolId, "teachers"), {
    name, role,
    classId: classId || null,
    subjectId: subjectId || null,
  });
};

export const removeTeacher = (schoolId, id) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return deleteDoc(doc(db, "schools", schoolId, "teachers", id));
};

const slugify = (s) =>
  (s || "teacher").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "") || "teacher";

// Creates (or re-issues) a login for a teacher: a real Firebase Auth account
// under a synthetic email, made on a *secondary* app instance so it never
// disturbs the admin's own signed-in session.
export async function setTeacherPassword(schoolId, teacherId, name, password, allTeachers) {
  if (!schoolId) throw new Error("No schoolId");
  const email = `${slugify(name)}.${Math.random().toString(36).slice(2, 7)}@teachers.local`;
  await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await secondarySignOut(secondaryAuth);
  await updateDoc(doc(db, "schools", schoolId, "teachers", teacherId), { loginEmail: email });

  // Store teacher's schoolId mapping
  const teacherUid = (await createUserWithEmailAndPassword(secondaryAuth, email, password)).user.uid;
  await setDoc(doc(db, "schoolUsers", teacherUid), { schoolId, role: "teacher", email });
  await secondarySignOut(secondaryAuth);

  const list = allTeachers || [];
  const found = list.some((t) => t.id === teacherId);
  const updatedList = found
    ? list.map((t) => (t.id === teacherId ? { ...t, loginEmail: email } : t))
    : [...list, { id: teacherId, name, loginEmail: email }];
  await syncTeacherLoginsDirectory(schoolId, updatedList);
  return email;
}

// Rebuilds the public (unauthenticated-readable) directory of teacher names
// -> login emails, so the login screen can resolve "which account is this"
// before the person is signed in to anything.
export async function syncTeacherLoginsDirectory(schoolId, teachers) {
  if (!schoolId) return;
  const entries = (teachers || [])
    .filter((t) => t.loginEmail)
    .map((t) => ({ teacherId: t.id, name: t.name, loginEmail: t.loginEmail }));
  await setDoc(doc(db, "schools", schoolId, "settings", "teacherLogins"), { entries });
}

// One-time, unauthenticated-safe fetch used by the login screen before any
// sign-in has happened.
export async function getTeacherLoginDirectory(schoolId) {
  if (!schoolId) return [];
  const snap = await getDoc(doc(db, "schools", schoolId, "settings", "teacherLogins"));
  return snap.exists() ? snap.data().entries || [] : [];
}

export async function getPublicSchoolName(schoolId) {
  if (!schoolId) return "";
  const snap = await getDoc(doc(db, "schools", schoolId, "settings", "meta"));
  return snap.exists() ? snap.data().schoolName || "" : "";
}

// Per-person profile (picture, display name), keyed by their Firebase Auth
// uid so it works the same for the admin and for every teacher account.
export function listenProfile(uid, cb) {
  if (!uid) return () => {};
  return onSnapshot(doc(db, "profiles", uid), (snap) => cb(snap.exists() ? snap.data() : {}));
}

export const saveProfile = (uid, data) => setDoc(doc(db, "profiles", uid), data, { merge: true });

// Admins are tracked as a plain list of emails in schools/{schoolId}/settings/admins.
export function listenAdmins(schoolId, cb) {
  if (!schoolId) return () => {};
  return onSnapshot(doc(db, "schools", schoolId, "settings", "admins"), (snap) =>
    cb(snap.exists() ? snap.data().emails || [] : [])
  );
}

export async function ensureAdminBootstrap(schoolId, email) {
  if (!email || !schoolId) return;
  const ref = doc(db, "schools", schoolId, "settings", "admins");
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { emails: [email] });
    await setDoc(doc(db, "settings", "setupStatus"), { hasAdmin: true });
    return;
  }
  // Self-heal: an admins list can already exist from before the public
  // setupStatus flag existed.
  const statusSnap = await getDoc(doc(db, "settings", "setupStatus"));
  if (!statusSnap.exists() || !statusSnap.data()?.hasAdmin) {
    await setDoc(doc(db, "settings", "setupStatus"), { hasAdmin: true });
  }
}

// Unauthenticated-safe check used only to decide whether the login screen
// should still offer first-admin signup.
export async function getSetupStatus() {
  const snap = await getDoc(doc(db, "settings", "setupStatus"));
  return snap.exists() ? snap.data() : { hasAdmin: false };
}

export const addAdminEmail = async (schoolId, currentEmails, email) => {
  if (!schoolId) throw new Error("No schoolId");
  const next = Array.from(new Set([...(currentEmails || []), email]));
  await setDoc(doc(db, "schools", schoolId, "settings", "admins"), { emails: next });
};

export const removeAdminEmail = async (schoolId, currentEmails, email) => {
  if (!schoolId) throw new Error("No schoolId");
  const next = (currentEmails || []).filter((e) => e !== email);
  await setDoc(doc(db, "schools", schoolId, "settings", "admins"), { emails: next });
};

export function listenAssessmentScores(schoolId, assessmentId, cb) {
  if (!schoolId || !assessmentId) return () => {};
  return onSnapshot(doc(db, "schools", schoolId, "scores", assessmentId), (snap) =>
    cb(snap.exists() ? snap.data() : {})
  );
}

// Writes
export const addClass = (schoolId, name, grade) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return addDoc(collection(db, "schools", schoolId, "classes"), { name, grade });
};

export const removeClass = (schoolId, id) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return deleteDoc(doc(db, "schools", schoolId, "classes", id));
};

export const addLearningArea = (schoolId, name, code) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return addDoc(collection(db, "schools", schoolId, "learningAreas"), { name, code });
};

export const removeLearningArea = (schoolId, id) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return deleteDoc(doc(db, "schools", schoolId, "learningAreas", id));
};

export const addLearner = (schoolId, name, assessmentNo, classId, gender) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return addDoc(collection(db, "schools", schoolId, "learners"), {
    name,
    admNo: assessmentNo,
    classId,
    gender: gender || null
  });
};

export const removeLearner = (schoolId, id) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return deleteDoc(doc(db, "schools", schoolId, "learners", id));
};

export const updateLearner = (schoolId, id, data) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return updateDoc(doc(db, "schools", schoolId, "learners", id), data);
};

export const bulkAddLearners = async (schoolId, rows) => {
  if (!schoolId) throw new Error("No schoolId");
  await Promise.all(rows.map((r) => addDoc(collection(db, "schools", schoolId, "learners"), r)));
};

export const addAssessment = (schoolId, name, term, year, grade, sequence) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return addDoc(collection(db, "schools", schoolId, "assessments"), {
    name,
    term,
    year,
    grade: grade || null,
    sequence: sequence || 1
  });
};

export const removeAssessment = (schoolId, id) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return deleteDoc(doc(db, "schools", schoolId, "assessments", id));
};

export const saveBands = (schoolId, list) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return setDoc(doc(db, "schools", schoolId, "settings", "bands"), { list });
};

export const saveAssessmentScores = (schoolId, assessmentId, data) => {
  if (!schoolId) return Promise.reject(new Error("No schoolId"));
  return setDoc(doc(db, "schools", schoolId, "scores", assessmentId), data);
};

// One-time fetch of several assessments' scores at once
export async function getScoresForAssessments(schoolId, assessmentIds) {
  if (!schoolId) return {};
  const entries = await Promise.all(
    assessmentIds.map(async (id) => {
      const snap = await getDoc(doc(db, "schools", schoolId, "scores", id));
      return [id, snap.exists() ? snap.data() : {}];
    })
  );
  return Object.fromEntries(entries);
}

// Graduate a learner (Grade 9 completion)
export const graduateLearner = async (schoolId, learnerId) => {
  if (!schoolId) throw new Error("No schoolId");
  await updateDoc(doc(db, "schools", schoolId, "learners", learnerId), {
    graduated: true,
    graduationYear: new Date().getFullYear()
  });
};

// Applies a year-end promotion plan
export async function applyPromotions(schoolId, moves, graduates) {
  if (!schoolId) throw new Error("No schoolId");
  await Promise.all([
    ...moves.map((m) => updateDoc(doc(db, "schools", schoolId, "learners", m.student.id), { classId: m.toClass.id })),
    ...graduates.map((g) => updateDoc(doc(db, "schools", schoolId, "learners", g.student.id), { graduated: true, graduationYear: new Date().getFullYear() })),
  ]);
}
