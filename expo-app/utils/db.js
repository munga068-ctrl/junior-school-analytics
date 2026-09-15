import {
  collection, doc, getDocs, getDoc, setDoc, addDoc, deleteDoc, onSnapshot,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
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
export function listenExamScores(examId, cb) {
  if (!examId) return () => {};
  return onSnapshot(doc(db, "scores", examId), (snap) =>
    cb(snap.exists() ? snap.data() : {})
  );
}

// Writes
export const addClass = (name) => addDoc(collection(db, "classes"), { name });
export const removeClass = (id) => deleteDoc(doc(db, "classes", id));

export const addSubject = (name, code) => addDoc(collection(db, "subjects"), { name, code });
export const removeSubject = (id) => deleteDoc(doc(db, "subjects", id));

export const addStudent = (name, admNo, classId) =>
  addDoc(collection(db, "students"), { name, admNo, classId });
export const removeStudent = (id) => deleteDoc(doc(db, "students", id));
export const bulkAddStudents = async (rows) => {
  await Promise.all(rows.map((r) => addDoc(collection(db, "students"), r)));
};

export const addExam = (name) => addDoc(collection(db, "exams"), { name });
export const removeExam = (id) => deleteDoc(doc(db, "exams", id));

export const saveBands = (list) => setDoc(doc(db, "settings", "bands"), { list });

export const saveExamScores = (examId, data) => setDoc(doc(db, "scores", examId), data);
