import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { COLORS } from "../utils/constants";
import SetupScreen from "./SetupScreen";
import ClassListScreen from "./ClassListScreen";
import EditLearnerScreen from "./EditLearnerScreen";

const Stack = createNativeStackNavigator();

// SetupScreen itself has no navigation of its own — this wraps it in a
// small stack so its Classes and Learners tabs can push into a class's
// roster (Class List) or a single learner's details (Edit Learner) and
// come back with the normal header back button.
export default function SetupStackNavigator(props) {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
      }}
    >
      <Stack.Screen name="SetupHome" options={{ title: "Setup" }}>
        {({ navigation }) => <SetupScreen {...props} navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="ClassList" options={{ title: "Class List" }}>
        {({ route }) => (
          <ClassListScreen
            classItem={props.classes.find((c) => c.id === route.params?.classId)}
            students={props.students.filter((s) => s.classId === route.params?.classId && !s.graduated)}
            meta={props.meta}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="EditLearner" options={{ title: "Edit Learner" }}>
        {({ navigation, route }) => (
          <EditLearnerScreen
            navigation={navigation}
            student={props.students.find((s) => s.id === route.params?.studentId)}
            classes={props.classes}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
