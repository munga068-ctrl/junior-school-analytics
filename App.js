import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth } from "./firebaseConfig";
import { listenClasses, listenSubjects, listenStudents, listenExams, listenBands, listenMeta, listenTeachers, listenMyContext, setSchoolContext } from "./utils/db";
import { DEFAULT_BANDS, COLORS } from "./utils/constants";

import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import SetupStackNavigator from "./screens/SetupStackNavigator";
import ScoreEntryScreen from "./screens/ScoreEntryScreen";
import ReportsScreen from "./screens/ReportsScreen";
import AnalysisScreen from "./screens/AnalysisScreen";
import ProfileScreen from "./screens/ProfileScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [exams, setExams] = useState([]);
  const [bands, setBands] = useState(DEFAULT_BANDS);
  const [meta, setMeta] = useState({ schoolName: "" });
  const [teachers, setTeachers] = useState([]);
  const [role, setRole] = useState(null); // "admin" | "teacher" | null
  const [contextError, setContextError] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setSchoolContext(null);
      setRole(null);
      setContextError("");
      return;
    }
    // A brand-new account's school link is written a moment after sign-in,
    // so keep listening and only give up if it never shows up.
    const timer = setTimeout(() => {
      setContextError("This account isn't linked to a school. Sign out and register a new school, or ask your admin to set your login up again.");
    }, 10000);
    const unsub = listenMyContext(
      user.uid,
      (ctx) => {
        if (ctx?.schoolId) {
          clearTimeout(timer);
          setContextError("");
          setSchoolContext(ctx.schoolId);
          setRole(ctx.role);
        }
      },
      () => {
        clearTimeout(timer);
        setContextError("Couldn't load your account. Check your connection and that the Firestore rules are published, then try again.");
      }
    );
    return () => { clearTimeout(timer); unsub(); };
  }, [user]);

  useEffect(() => {
    if (!user || !role) return;
    const unsubs = [
      listenClasses(setClasses),
      listenSubjects(setSubjects),
      listenStudents(setStudents),
      listenExams(setExams),
      listenBands(setBands),
      listenMeta(setMeta),
      listenTeachers(setTeachers),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [user, role]);

  const isAdmin = role === "admin";

  if (contextError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg, padding: 28 }}>
        <Text style={{ color: COLORS.ink, textAlign: "center", marginBottom: 16 }}>{contextError}</Text>
        <TouchableOpacity onPress={() => signOut(auth)}>
          <Text style={{ color: COLORS.ink, fontWeight: "700" }}>Sign out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!authChecked) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <>
        <StatusBar style="dark" />
        <LoginScreen />
      </>
    );
  }

  if (!role) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: "#fff",
          tabBarStyle: { backgroundColor: COLORS.primary },
          tabBarActiveTintColor: "#fff",
          tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        }}
      >
        <Tab.Screen
          name="Dashboard"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <DashboardScreen classes={classes} subjects={subjects} students={students} exams={exams} teachers={teachers} meta={meta} isAdmin={isAdmin} currentEmail={user?.email} />}
        </Tab.Screen>
        <Tab.Screen
          name="Setup"
          options={{
            headerShown: false,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "settings" : "settings-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <SetupStackNavigator classes={classes} subjects={subjects} students={students} exams={exams} bands={bands} teachers={teachers} isAdmin={isAdmin} meta={meta} />}
        </Tab.Screen>
        <Tab.Screen
          name="Score entry"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "create" : "create-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <ScoreEntryScreen classes={classes} subjects={subjects} students={students} exams={exams} />}
        </Tab.Screen>
        <Tab.Screen
          name="Assessment Report"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <ReportsScreen classes={classes} subjects={subjects} students={students} exams={exams} bands={bands} meta={meta} teachers={teachers} />}
        </Tab.Screen>
        <Tab.Screen
          name="Analysis"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "analytics" : "analytics-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <AnalysisScreen classes={classes} subjects={subjects} students={students} exams={exams} bands={bands} meta={meta} />}
        </Tab.Screen>
        <Tab.Screen
          name="Profile"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <ProfileScreen user={user} teachers={teachers} classes={classes} subjects={subjects} isAdmin={isAdmin} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
