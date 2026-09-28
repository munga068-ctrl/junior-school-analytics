import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, ScrollView } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS, WHATSAPP_SUPPORT_URL } from "../utils/constants";
import { findSchoolByName, createSchool, getTeacherLoginDirectory } from "../utils/db";

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-api-key": "Firebase config error: invalid API key. Check firebaseConfig.js.",
  "auth/api-key-not-valid": "Firebase config error: invalid API key. Check firebaseConfig.js.",
  "auth/invalid-credential": "Wrong password, or this account doesn't exist.",
  "auth/user-not-found": "No account found.",
  "auth/wrong-password": "Wrong password.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network error — check your internet connection.",
  "auth/operation-not-allowed": "Email/Password sign-in isn't enabled for this Firebase project.",
  "auth/invalid-email": "That doesn't look like a valid email address.",
  "auth/email-already-in-use": "An account with that email already exists.",
};

export default function LoginScreen() {
  // start -> signup (register a brand-new school + its admin account)
  // start -> school (find an existing school by name) -> role -> admin | teacher
  const [step, setStep] = useState("start");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [newSchoolName, setNewSchoolName] = useState("");
  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [resolvedSchool, setResolvedSchool] = useState(null); // { schoolId, displayName }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [directory, setDirectory] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  const findSchool = async () => {
    if (!schoolNameInput.trim()) {
      setError("Enter your school's name");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const found = await findSchoolByName(schoolNameInput);
      if (!found) {
        setError("No school registered under that name. Check the spelling, or create a new school if this is your first time.");
      } else {
        setResolvedSchool(found);
        const list = await getTeacherLoginDirectory(found.schoolId);
        setDirectory(list);
        setStep("role");
      }
    } catch (e) {
      setError("Couldn't look up that school. Check your connection and try again.");
    }
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(AUTH_ERROR_MESSAGES[e?.code] || `Couldn't sign in (${e?.code || "unknown error"}).`);
    }
    setLoading(false);
  };

  const handleCreateSchool = async () => {
    if (!newSchoolName.trim()) {
      setError("Enter your school's name");
      return;
    }
    if (!email.trim() || !password) {
      setError("Enter an email and password");
      return;
    }
    if (password.length < 6) {
      setError("Password should be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const existing = await findSchoolByName(newSchoolName);
      if (existing) {
        setError("A school with that name is already registered. Try a more specific name (e.g. add your town), or sign in instead.");
        setLoading(false);
        return;
      }
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      try {
        await createSchool(cred.user.uid, newSchoolName);
        // App.js picks up the new users/{uid} doc automatically once signed in.
      } catch (schoolErr) {
        // Someone else registered the same name in the split second between
        // our check and now — undo the just-created account so it isn't
        // left orphaned with no school attached.
        await cred.user.delete().catch(() => {});
        setError(schoolErr?.message || "Couldn't register your school. Try again.");
      }
    } catch (e) {
      setError(AUTH_ERROR_MESSAGES[e?.code] || `Couldn't create the account (${e?.code || "unknown error"}).`);
    }
    setLoading(false);
  };

  const handleTeacherLogin = async () => {
    if (!teacherId || !teacherPassword) {
      setError("Select your name and enter your password");
      return;
    }
    const entry = directory.find((t) => t.teacherId === teacherId);
    if (!entry) {
      setError("Couldn't find that account. Ask your admin to set up your login.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, entry.loginEmail, teacherPassword);
    } catch (e) {
      setError(AUTH_ERROR_MESSAGES[e?.code] || `Couldn't sign in (${e?.code || "unknown error"}).`);
    }
    setLoading(false);
  };

  const resetToStart = () => {
    setStep("start");
    setError("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setNewSchoolName("");
    setSchoolNameInput("");
    setResolvedSchool(null);
  };

  return (
    <ScrollView style={{ backgroundColor: COLORS.bg }} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Junior School Analytics</Text>


      {step === "start" && (
        <>
          <Text style={styles.subtitle}>Welcome — is this your school's first time here, or do you already have an account?</Text>
          <TouchableOpacity style={styles.roleCard} onPress={() => { setError(""); setStep("signup"); }}>
            <Text style={styles.roleCardTitle}>Register a new school</Text>
            <Text style={styles.roleCardHint}>Sets up your own private workspace — your data is never shared with any other school.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleCard} onPress={() => { setError(""); setStep("school"); }}>
            <Text style={styles.roleCardTitle}>Sign in</Text>
            <Text style={styles.roleCardHint}>Already have an account? Sign in here.</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "signup" && (
        <>
          <Text style={styles.subtitle}>Register your school</Text>
          <TextInput
            style={styles.input}
            placeholder="School name (e.g. Riverside Junior School, Nairobi)"
            autoCapitalize="words"
            value={newSchoolName}
            onChangeText={setNewSchoolName}
          />
          <Text style={styles.hint}>This creates a brand-new, private workspace just for your school — its own admin account, and its own classes, learners and reports.</Text>
          <TextInput
            style={styles.input}
            placeholder="Admin email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          <TextInput style={styles.input} placeholder="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={handleCreateSchool} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create school & admin account</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={resetToStart}>
            <Text style={styles.backLink}>Back</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "school" && (
        <>
          <Text style={styles.subtitle}>Enter your school's name to continue</Text>
          <TextInput
            style={styles.input}
            placeholder="School name, exactly as registered"
            value={schoolNameInput}
            onChangeText={setSchoolNameInput}
            autoCapitalize="words"
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={findSchool} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={resetToStart}>
            <Text style={styles.backLink}>Back</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "role" && (
        <>
          <Text style={styles.subtitle}>{resolvedSchool?.displayName}</Text>
          <Text style={[styles.subtitle, { marginTop: -14 }]}>Who's signing in?</Text>
          <TouchableOpacity style={styles.roleCard} onPress={() => { setError(""); setStep("admin"); }}>
            <Text style={styles.roleCardTitle}>Admin</Text>
            <Text style={styles.roleCardHint}>Sign in with your email and password</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.roleCard} onPress={() => { setError(""); setStep("teacher"); }}>
            <Text style={styles.roleCardTitle}>Teacher</Text>
            <Text style={styles.roleCardHint}>Sign in with the name and password your admin gave you</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep("school"); setError(""); }}>
            <Text style={styles.backLink}>Back</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "admin" && (
        <>
          <Text style={styles.subtitle}>Admin sign in</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={handleAdminLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep("role"); setError(""); }}>
            <Text style={styles.backLink}>Back</Text>
          </TouchableOpacity>
        </>
      )}

      {step === "teacher" && (
        <>
          <Text style={styles.subtitle}>Teacher sign in</Text>
          {directory.length === 0 ? (
            <Text style={styles.error}>No teacher logins have been set up yet — ask your admin.</Text>
          ) : (
            <View style={styles.pickerWrap}>
              <Picker selectedValue={teacherId} onValueChange={setTeacherId}>
                <Picker.Item label="Select your name" value="" />
                {directory.map((t) => <Picker.Item key={t.teacherId} label={t.name} value={t.teacherId} />)}
              </Picker>
            </View>
          )}
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={teacherPassword} onChangeText={setTeacherPassword} />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={handleTeacherLogin} disabled={loading || directory.length === 0}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setStep("role"); setError(""); }}>
            <Text style={styles.backLink}>Back</Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={styles.whatsappBtn}
        onPress={() => Linking.openURL(WHATSAPP_SUPPORT_URL).catch(() => {})}
      >
        <Text style={styles.whatsappBtnText}>Need help? Chat with support on WhatsApp</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 28 },
  title: { fontSize: 22, fontWeight: "700", color: COLORS.ink, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.inkSoft, marginBottom: 24, textAlign: "center" },
  hint: { fontSize: 12, color: COLORS.inkSoft, marginTop: -8, marginBottom: 14, lineHeight: 17 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 12, marginBottom: 12, backgroundColor: "#fff" },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 6, padding: 14, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: "#C0392B", marginBottom: 10, fontSize: 13 },
  roleCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 16, marginBottom: 12, backgroundColor: "#fff" },
  roleCardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.ink, marginBottom: 3 },
  roleCardHint: { fontSize: 12.5, color: COLORS.inkSoft },
  backLink: { color: COLORS.ink, textAlign: "center", marginTop: 16, fontSize: 13.5, fontWeight: "600" },
  whatsappBtn: { marginTop: 22, alignSelf: "center", flexDirection: "row", alignItems: "center", backgroundColor: "#E7F5EE", borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16 },
  whatsappBtnText: { color: "#128C7E", fontSize: 12.5, fontWeight: "700" },
});
