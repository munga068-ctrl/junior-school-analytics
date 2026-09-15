import React, { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { onAuthStateChanged } from "firebase/auth";

import { auth } from "./firebaseConfig";
import { listenClasses, listenSubjects, listenStudents, listenExams, listenBands, listenMeta } from "./utils/db";
import { DEFAULT_BANDS, COLORS } from "./utils/constants";

import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import SetupScreen from "./screens/SetupScreen";
import ScoreEntryScreen from "./screens/ScoreEntryScreen";
import ReportsScreen from "./screens/ReportsScreen";

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

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubs = [
      listenClasses(setClasses),
      listenSubjects(setSubjects),
      listenStudents(setStudents),
      listenExams(setExams),
      listenBands(setBands),
      listenMeta(setMeta),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [user]);

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
        <Tab.Screen name="Dashboard">
          {() => <DashboardScreen classes={classes} subjects={subjects} students={students} exams={exams} meta={meta} />}
        </Tab.Screen>
        <Tab.Screen name="Setup">
          {() => <SetupScreen classes={classes} subjects={subjects} students={students} exams={exams} bands={bands} />}
        </Tab.Screen>
        <Tab.Screen name="Score entry">
          {() => <ScoreEntryScreen classes={classes} subjects={subjects} students={students} exams={exams} />}
        </Tab.Screen>
        <Tab.Screen name="Reports">
          {() => <ReportsScreen classes={classes} subjects={subjects} students={students} exams={exams} bands={bands} schoolName={meta?.schoolName} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
