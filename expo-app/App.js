import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./firebaseConfig";
import { listenClasses, listenSubjects, listenStudents, listenExams, listenBands, listenMeta, listenTeachers, listenAdmins, ensureAdminBootstrap } from "./utils/db";
import { DEFAULT_BANDS, COLORS } from "./utils/constants";

import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import SetupScreen from "./screens/SetupScreen";
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
  const [adminEmails, setAdminEmails] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    ensureAdminBootstrap(user.email);
    const unsubs = [
      listenClasses(setClasses),
      listenSubjects(setSubjects),
      listenStudents(setStudents),
      listenExams(setExams),
      listenBands(setBands),
      listenMeta(setMeta),
      listenTeachers(setTeachers),
      listenAdmins(setAdminEmails),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [user]);

  const isAdmin = !!user && adminEmails.includes(user.email);

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

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.primary }, headerTintColor: "#fff", tabBarActiveTintColor: COLORS.primary }}>
        <Tab.Screen
          name="Dashboard"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <DashboardScreen classes={classes} subjects={subjects} students={students} exams={exams} teachers={teachers} meta={meta} isAdmin={isAdmin} adminEmails={adminEmails} currentEmail={user?.email} />}
        </Tab.Screen>
        <Tab.Screen
          name="Setup"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "settings" : "settings-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <SetupScreen classes={classes} subjects={subjects} students={students} exams={exams} bands={bands} teachers={teachers} isAdmin={isAdmin} />}
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
          name="Reports"
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
