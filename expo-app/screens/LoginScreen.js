import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS } from "../utils/constants";
import { getPublicSchoolName, getTeacherLoginDirectory, getSetupStatus } from "../utils/db";

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
};

export default function LoginScreen() {
  const [step, setStep] = useState("school"); // school -> role -> admin | teacher
  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [realSchoolName, setRealSchoolName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [directory, setDirectory] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");

  const [hasAdmin, setHasAdmin] = useState(true); // default true = hide signup until we know otherwise
  const [signupMode, setSignupMode] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  const checkSchoolName = async () => {
    if (!schoolNameInput.trim()) {
      setError("Enter your school's name");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const name = await getPublicSchoolName();
      setRealSchoolName(name);
      if (!name) {
        setError("This app hasn't had its school name set up yet — ask your admin.");
      } else if (name.trim().toLowerCase() !== schoolNameInput.trim().toLowerCase()) {
        setError("That doesn't match this app's school name. Check the spelling and try again.");
      } else {
        const [list, status] = await Promise.all([getTeacherLoginDirectory(), getSetupStatus()]);
        setDirectory(list);
        setHasAdmin(!!status.hasAdmin);
        setStep("role");
      }
    } catch (e) {
      setError("Couldn't verify the school name. Check your connection and try again.");
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

  const handleAdminSignup = async () => {
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
      // Re-check right before creating the account — closes the gap where
      // two people might both load this screen before either finishes.
      const status = await getSetupStatus();
      if (status.hasAdmin) {
        setHasAdmin(true);
        setSignupMode(false);
        setError("An admin account already exists now — please sign in instead.");
        setLoading(false);
        return;
      }
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // App.js's ensureAdminBootstrap runs automatically once signed in and
      // makes this account the admin, since none exists yet.
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Junior School Analytics</Text>

      {step === "school" && (
        <>
          <Text style={styles.subtitle}>Enter your school's name to continue</Text>
          <TextInput
            style={styles.input}
            placeholder="School name, exactly as set up by your admin"
            value={schoolNameInput}
            onChangeText={setSchoolNameInput}
            autoCapitalize="words"
          />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={checkSchoolName} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === "role" && (
        <>
          <Text style={styles.subtitle}>{realSchoolName}</Text>
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
          <Text style={styles.subtitle}>{signupMode ? "Create the admin account" : "Admin sign in"}</Text>
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
          {signupMode && (
            <TextInput style={styles.input} placeholder="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
          )}
          {!!error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.button} onPress={signupMode ? handleAdminSignup : handleAdminLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{signupMode ? "Create account" : "Sign in"}</Text>}
          </TouchableOpacity>
          {!hasAdmin && (
            <TouchableOpacity onPress={() => { setSignupMode(!signupMode); setError(""); setConfirmPassword(""); }}>
              <Text style={styles.backLink}>
                {signupMode ? "Already have an admin account? Sign in instead" : "First time? Create the admin account"}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => { setStep("role"); setError(""); setSignupMode(false); }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 28, backgroundColor: COLORS.bg },
  title: { fontSize: 22, fontWeight: "700", color: COLORS.primary, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.inkSoft, marginBottom: 24, textAlign: "center" },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 12, marginBottom: 12, backgroundColor: "#fff" },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 6, padding: 14, alignItems: "center", marginTop: 6 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: "#C0392B", marginBottom: 10, fontSize: 13 },
  roleCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 16, marginBottom: 12, backgroundColor: "#fff" },
  roleCardTitle: { fontSize: 16, fontWeight: "700", color: COLORS.primary, marginBottom: 3 },
  roleCardHint: { fontSize: 12.5, color: COLORS.inkSoft },
  backLink: { color: COLORS.primary, textAlign: "center", marginTop: 16, fontSize: 13.5, fontWeight: "600" },
});
