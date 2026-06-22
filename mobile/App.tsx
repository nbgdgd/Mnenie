import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { COLORS } from './src/theme';
import DetailScreen from './src/screens/DetailScreen';
import FeedScreen from './src/screens/FeedScreen';
import RankingsScreen from './src/screens/RankingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.bg,
    card: COLORS.bg,
    text: COLORS.text,
    border: COLORS.border,
    primary: COLORS.accent,
  },
};

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.bg },
  headerTintColor: COLORS.text,
  headerTitleStyle: { fontWeight: '700' as const },
};

function FeedStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Feed" component={FeedScreen} options={{ title: '⚖ Mnenie' }} />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={({ route }: any) => ({ title: route.params?.title ?? 'Новость', headerBackTitle: 'Лента' })}
      />
    </Stack.Navigator>
  );
}

function RankingsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="RankingsHome" component={RankingsScreen} options={{ title: 'Рейтинги' }} />
      <Stack.Screen
        name="Detail"
        component={DetailScreen}
        options={({ route }: any) => ({ title: route.params?.title ?? 'Новость' })}
      />
    </Stack.Navigator>
  );
}

function tabIcon(label: string) {
  return ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{label}</Text>;
}

export default function App() {
  return (
    <NavigationContainer theme={navTheme}>
      <StatusBar style="light" />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: { backgroundColor: COLORS.panel, borderTopColor: COLORS.border },
          tabBarActiveTintColor: COLORS.accent,
          tabBarInactiveTintColor: COLORS.muted,
        }}
      >
        <Tab.Screen name="Лента" component={FeedStack} options={{ tabBarIcon: tabIcon('📰') }} />
        <Tab.Screen name="Рейтинги" component={RankingsStack} options={{ tabBarIcon: tabIcon('🔥') }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
