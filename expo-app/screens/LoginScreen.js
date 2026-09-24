import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Linking } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebaseConfig";
import { COLORS } from "../utils/constants";
import { initializeSchool, getTeacherLoginDirectory, getPublicSchoolName } from "../utils/db";

const AUTH_ERROR_MESSAGES = {
  "auth/invalid-api-key": "Firebase config error: invalid API key.",
  "auth/api-key-not-valid": "Firebase config error: invalid API key.",
  "auth/invalid-credential": "Wrong password, or this account doesn't exist.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Wrong password. Please try again.",
  "auth/too-many-requests": "Too many failed attempts. Please wait a moment and try again.",
  "auth/network-request-failed": "Network error — please check your internet connection.",
  "auth/operation-not-allowed": "Email/Password sign-in isn't enabled for this project.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/email-already-in-use": "An account with that email already exists. Please sign in instead.",
  "auth/weak-password": "Password is too weak. Please use at least 6 characters.",
};

export default function LoginScreen() {
  // mode: "choice" -> "signin" | "signup" | "teacher"
  const [mode, setMode] = useState("choice");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Sign up fields
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");

  // Admin Sign in fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Teacher Sign in fields
  const [teacherSchoolId, setTeacherSchoolId] = useState("");
  const [directory, setDirectory] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [schoolLoaded, setSchoolLoaded] = useState(false);

  const openWhatsApp = () => {
    Linking.openURL("https://wa.me/254112877840").catch(() => {
      setError("Could not open WhatsApp. Please contact +254 112 877 840");
    });
  };

  const handleAdminSignup = async () => {
    if (!signupEmail.trim() || !signupPassword) {
      setError("Please enter your email and password");
      return;
    }
    if (signupPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    if (signupPassword !== signupConfirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, signupEmail.trim(), signupPassword);
      // Initialize the school with the new admin's UID as the schoolId
      await initializeSchool(userCredential.user.uid, signupEmail.trim());
    } catch (e) {
      setError(AUTH_ERROR_MESSAGES[e?.code] || `Couldn't create account: ${e?.message || e?.code || "unknown error"}`);
    }
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      setError("Please enter your email and password");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPassword);
    } catch (e) {
      setError(AUTH_ERROR_MESSAGES[e?.code] || `Couldn't sign in: ${e?.message || e?.code || "unknown error"}`);
    }
    setLoading(false);
  };

  const loadTeacherDirectory = async () => {
    if (!teacherSchoolId.trim()) {
      setError("Please enter the School ID provided by your admin");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const schoolName = await getPublicSchoolName(teacherSchoolId.trim());
      const list = await getTeacherLoginDirectory(teacherSchoolId.trim());
      setDirectory(list);
      setSchoolLoaded(true);
      if (!schoolName && list.length === 0) {
        setError("School not found. Please verify the School ID with your administrator.");
      }
    } catch (e) {
      setError("Could not find school. Check your connection or verify the School ID.");
    }
    setLoading(false);
  };

  const handleTeacherLogin = async () => {
    if (!teacherId || !teacherPassword) {
      setError("Please select your name and enter your password");
      return;
    }
    const entry = directory.find((t) => t.teacherId === teacherId);
    if (!entry) {
      setError("Account not found. Please ask your administrator to verify your login.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, entry.loginEmail, teacherPassword);
    } catch (e) {
      setError(AUTH_ERROR_MESSAGES[e?.code] || `Couldn't sign in: ${e?.message || e?.code || "unknown error"}`);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Junior School Analytics</Text>

      {mode === "choice" && (
        <>
          <Text style={styles.subtitle}>Welcome! Choose an option to continue</Text>

          <TouchableOpacity style={styles.roleCard} onPress={() => { setError(""); setMode("signin"); }}>
            <Text style={styles.roleCardTitle}>Sign In as Admin</Text>
            <Text style={styles.roleCardHint}>Sign in to manage your school's data and teachers</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.roleCard} onPress={() => { setError(""); setMode("signup"); }}>
            <Text style={styles.roleCardTitle}>Create New School Account</Text>
            <Text style={styles.roleCardHint}>Set up a new isolated school workspace</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.roleCard} onPress={() => { setError(""); setMode("teacher"); setSchoolLoaded(false); }}>
            <Text style={styles.roleCardTitle}>Teacher Sign In</Text>
            <Text style={styles.roleCardHint}>Sign in with the password given by your school admin</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsApp}>
            <Text style={styles.whatsappBtnText}>💬 Need Help? Contact WhatsApp Support</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "signup" && (
        <>
          <Text style={styles.subtitle}>Create Admin Account</Text>
          <Text style={styles.hintText}>This creates a completely isolated space for your school.</Text>

          <TextInput
            style={styles.input}
            placeholder="Admin Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={signupEmail}
            onChangeText={setSignupEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password (min 6 chars)"
            secureTextEntry
            value={signupPassword}
            onChangeText={setSignupPassword}
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry
            value={signupConfirmPassword}
            onChangeText={setSignupConfirmPassword}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleAdminSignup} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Create School Account</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode("choice"); setError(""); }}>
            <Text style={styles.backLink}>Back to Options</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "signin" && (
        <>
          <Text style={styles.subtitle}>Admin Sign In</Text>

          <TextInput
            style={styles.input}
            placeholder="Admin Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={loginEmail}
            onChangeText={setLoginEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry
            value={loginPassword}
            onChangeText={setLoginPassword}
          />

          {!!error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity style={styles.button} onPress={handleAdminLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => { setMode("choice"); setError(""); }}>
            <Text style={styles.backLink}>Back to Options</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.whatsappBtn, { marginTop: 24 }]} onPress={openWhatsApp}>
            <Text style={styles.whatsappBtnText}>💬 WhatsApp Support: +254 112 877 840</Text>
          </TouchableOpacity>
        </>
      )}

      {mode === "teacher" && (
        <>
          <Text style={styles.subtitle}>Teacher Sign In</Text>

          {!schoolLoaded ? (
            <>
              <Text style={styles.hintText}>Enter the School ID provided by your administrator:</Text>
              <TextInput
                style={styles.input}
                placeholder="School ID"
                autoCapitalize="none"
                value={teacherSchoolId}
                onChangeText={setTeacherSchoolId}
              />
              {!!error && <Text style={styles.error}>{error}</Text>}
              <TouchableOpacity style={styles.button} onPress={loadTeacherDirectory} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {directory.length === 0 ? (
                <Text style={styles.error}>No teacher accounts found for this school. Please ask your administrator to create your login.</Text>
              ) : (
                <View style={styles.pickerWrap}>
                  <Picker selectedValue={teacherId} onValueChange={setTeacherId}>
                    <Picker.Item label="Select your name" value="" />
                    {directory.map((t) => (
                      <Picker.Item key={t.teacherId} label={t.name} value={t.teacherId} />
                    ))}
                  </Picker>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry
                value={teacherPassword}
                onChangeText={setTeacherPassword}
              />

              {!!error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={styles.button}
                onPress={handleTeacherLogin}
                disabled={loading || directory.length === 0}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setSchoolLoaded(false)}>
                <Text style={[styles.backLink, { color: COLORS.inkSoft }]}>Change School ID</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity onPress={() => { setMode("choice"); setError(""); }}>
            <Text style={styles.backLink}>Back to Options</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: COLORS.bg },
  title: { fontSize: 22, fontWeight: "700", color: COLORS.primary, marginBottom: 6, textAlign: "center" },
  subtitle: { fontSize: 14, color: COLORS.inkSoft, marginBottom: 20, textAlign: "center" },
  hintText: { fontSize: 12, color: COLORS.inkSoft, marginBottom: 12, textAlign: "center" },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, padding: 12, marginBottom: 12, backgroundColor: "#fff", fontSize: 14 },
  pickerWrap: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 6, backgroundColor: "#fff", marginBottom: 12 },
  button: { backgroundColor: COLORS.primary, borderRadius: 6, padding: 14, alignItems: "center", marginTop: 4 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  error: { color: "#C0392B", marginBottom: 10, fontSize: 13, textAlign: "center" },
  roleCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 16, marginBottom: 12, backgroundColor: "#fff" },
  roleCardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.primary, marginBottom: 3 },
  roleCardHint: { fontSize: 12, color: COLORS.inkSoft },
  backLink: { color: COLORS.primary, textAlign: "center", marginTop: 16, fontSize: 13.5, fontWeight: "600" },
  whatsappBtn: { marginTop: 16, backgroundColor: "#25D366", borderRadius: 6, padding: 12, alignItems: "center" },
  whatsappBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
