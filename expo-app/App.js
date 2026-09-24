import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, Text, Alert } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { onAuthStateChanged } from "firebase/auth";
import * as Updates from "expo-updates";

import { auth } from "./firebaseConfig";
import { getUserSchoolId, listenClasses, listenLearningAreas, listenLearners, listenAssessments, listenBands, listenMeta, listenTeachers, listenAdmins, ensureAdminBootstrap } from "./utils/db";
import { DEFAULT_BANDS, COLORS } from "./utils/constants";

import LoginScreen from "./screens/LoginScreen";
import DashboardScreen from "./screens/DashboardScreen";
import SetupScreen from "./screens/SetupScreen";
import ScoreEntryScreen from "./screens/ScoreEntryScreen";
import ReportsScreen from "./screens/ReportsScreen";
import AnalysisScreen from "./screens/AnalysisScreen";
import ProfileScreen from "./screens/ProfileScreen";
import ClassListScreen from "./screens/ClassListScreen";
import EditLearnerScreen from "./screens/EditLearnerScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function SetupStack({ schoolId, classes, learningAreas, learners, assessments, bands, teachers, isAdmin, meta }) {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SetupMain"
        options={{ headerShown: false }}
      >
        {(props) => (
          <SetupScreen
            {...props}
            schoolId={schoolId}
            classes={classes}
            learningAreas={learningAreas}
            learners={learners}
            assessments={assessments}
            bands={bands}
            teachers={teachers}
            isAdmin={isAdmin}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="ClassList"
        options={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: "#fff",
          title: "Class List"
        }}
      >
        {(props) => (
          <ClassListScreen
            {...props}
            classes={classes}
            learners={learners}
            meta={meta}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="EditLearner"
        options={{
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: "#fff",
          title: "Edit Learner"
        }}
      >
        {(props) => (
          <EditLearnerScreen
            {...props}
            schoolId={schoolId}
            classes={classes}
            learners={learners}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);
  const [schoolId, setSchoolId] = useState(null);
  const [updateStatus, setUpdateStatus] = useState("");

  const [classes, setClasses] = useState([]);
  const [learningAreas, setLearningAreas] = useState([]);
  const [learners, setLearners] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [bands, setBands] = useState(DEFAULT_BANDS);
  const [meta, setMeta] = useState({ schoolName: "" });
  const [teachers, setTeachers] = useState([]);
  const [adminEmails, setAdminEmails] = useState([]);

  // Check for OTA updates on app launch
  useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) {
        // Skip update checks in development
        return;
      }

      try {
        setUpdateStatus("Checking for updates...");
        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
          setUpdateStatus("Downloading update...");
          await Updates.fetchUpdateAsync();

          Alert.alert(
            "Update Available",
            "A new version has been downloaded. The app will reload to apply the update.",
            [
              {
                text: "Restart Now",
                onPress: async () => {
                  await Updates.reloadAsync();
                },
              },
            ]
          );
        } else {
          setUpdateStatus("");
        }
      } catch (e) {
        console.error("Error checking for updates:", e);
        setUpdateStatus("");
      }
    }

    checkForUpdates();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
      setSchoolId(null);
      return;
    }

    (async () => {
      try {
        const sid = await getUserSchoolId(user.uid);
        setSchoolId(sid);
        if (sid) {
          await ensureAdminBootstrap(sid, user.email);
        }
      } catch (e) {
        console.error("Error fetching schoolId:", e);
      }
    })();
  }, [user]);

  useEffect(() => {
    if (!schoolId) return;

    const unsubs = [
      listenClasses(schoolId, setClasses),
      listenLearningAreas(schoolId, setLearningAreas),
      listenLearners(schoolId, setLearners),
      listenAssessments(schoolId, setAssessments),
      listenBands(schoolId, setBands),
      listenMeta(schoolId, setMeta),
      listenTeachers(schoolId, setTeachers),
      listenAdmins(schoolId, setAdminEmails),
    ];
    return () => unsubs.forEach((u) => u && u());
  }, [schoolId]);

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

  if (!schoolId) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
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
          {() => <DashboardScreen schoolId={schoolId} classes={classes} learningAreas={learningAreas} learners={learners} assessments={assessments} teachers={teachers} meta={meta} isAdmin={isAdmin} adminEmails={adminEmails} currentEmail={user?.email} />}
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
          {() => <SetupStack schoolId={schoolId} classes={classes} learningAreas={learningAreas} learners={learners} assessments={assessments} bands={bands} teachers={teachers} isAdmin={isAdmin} meta={meta} />}
        </Tab.Screen>
        <Tab.Screen
          name="Score Entry"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "create" : "create-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <ScoreEntryScreen schoolId={schoolId} classes={classes} learningAreas={learningAreas} learners={learners} assessments={assessments} />}
        </Tab.Screen>
        <Tab.Screen
          name="Assessment Report"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <ReportsScreen schoolId={schoolId} classes={classes} learningAreas={learningAreas} learners={learners} assessments={assessments} bands={bands} meta={meta} teachers={teachers} />}
        </Tab.Screen>
        <Tab.Screen
          name="Analysis"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "analytics" : "analytics-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <AnalysisScreen schoolId={schoolId} classes={classes} learningAreas={learningAreas} learners={learners} assessments={assessments} bands={bands} meta={meta} />}
        </Tab.Screen>
        <Tab.Screen
          name="Profile"
          options={{
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={size} color={color} />
            ),
          }}
        >
          {() => <ProfileScreen user={user} teachers={teachers} classes={classes} learningAreas={learningAreas} isAdmin={isAdmin} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
