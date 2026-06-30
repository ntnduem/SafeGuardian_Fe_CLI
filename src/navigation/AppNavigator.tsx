import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { UserStore } from '../store/userStore';
import { Colors } from '../config/theme';

import OnboardingScreen from '../screens/OnboardingScreen';
import DashboardScreen  from '../screens/DashboardScreen';
import MapScreen        from '../screens/MapScreen';
import ContactsScreen   from '../screens/ContactsScreen';
import MedicalScreen    from '../screens/MedicalScreen';
import ProfileScreen    from '../screens/ProfileScreen';

export type RootStackParamList = {
  Main: undefined;
  Onboarding: undefined;
  Map: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Contacts:  undefined;
  Medical:   undefined;
  Profile:   undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab   = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surfaceStrong,
          borderTopColor: Colors.cardBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor:   Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            Dashboard: 'home',
            Contacts:  'people',
            Medical:   'medkit',
            Profile:   'person',
          };
          return <Ionicons name={icons[route.name]} size={size} color={color} />;
        },
        tabBarLabel: ({ color }) => {
          const labels: Record<string, string> = {
            Dashboard: 'Trang chủ',
            Contacts:  'Liên hệ',
            Medical:   'Y tế',
            Profile:   'Cá nhân',
          };
          return (
            <View>
              {/* label được render bởi tabBarLabel text */}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen}
        options={{ tabBarLabel: 'Trang chủ' }} />
      <Tab.Screen name="Contacts"  component={ContactsScreen}
        options={{ tabBarLabel: 'Liên hệ' }} />
      <Tab.Screen name="Medical"   component={MedicalScreen}
        options={{ tabBarLabel: 'Y tế' }} />
      <Tab.Screen name="Profile"   component={ProfileScreen}
        options={{ tabBarLabel: 'Cá nhân' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [loading, setLoading]       = useState(true);
  const [hasUser, setHasUser]       = useState(false);

  useEffect(() => {
    UserStore.getUserId().then(id => {
      setHasUser(!!id);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false }}
      initialRouteName={hasUser ? 'Main' : 'Onboarding'}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Main"       component={TabNavigator} />
      <Stack.Screen name="Map"        component={MapScreen}
        options={{ presentation: 'card' }} />
    </Stack.Navigator>
  );
}
