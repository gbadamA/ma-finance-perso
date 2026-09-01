/**
 * Onglets principaux.
 *
 * La `Tabs` d'Expo Router est utilisée pour le routage, mais **sa barre native
 * est masquée** au profit de `FloatingTabBar` : c'est la seule façon de
 * garantir la contrainte du §3.6 (ne jamais recouvrir la barre gestuelle),
 * la barre native se collant au bord inférieur de l'écran.
 */

import { Tabs, useRouter, useSegments, type Href } from "expo-router";
import { LayoutDashboard, PieChart, Receipt, Compass } from "lucide-react-native";
import { FloatingTabBar, type TabItem } from "../../components/layout";
import { QuickAdd } from "../../components/quick-add";
import { useTheme } from "../../lib/theme";

/**
 * Destination de chaque onglet.
 * Table explicite plutôt qu'un template string : `typedRoutes` refuse
 * `/(tabs)/${key}` puisqu'il ne peut pas vérifier la route à la compilation —
 * et c'est justement ce qu'on veut qu'il vérifie.
 */
const TAB_ROUTES: Record<string, Href> = {
  index: "/(tabs)",
  patrimoine: "/(tabs)/patrimoine",
  depenses: "/(tabs)/depenses",
  pilotage: "/(tabs)/pilotage",
};

const TABS: TabItem[] = [
  {
    key: "index",
    label: "Synthèse",
    icon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
  },
  {
    key: "patrimoine",
    label: "Patrimoine",
    icon: ({ color, size }) => <PieChart color={color} size={size} />,
  },
  {
    key: "depenses",
    label: "Dépenses",
    icon: ({ color, size }) => <Receipt color={color} size={size} />,
  },
  {
    key: "pilotage",
    label: "Pilotage",
    icon: ({ color, size }) => <Compass color={color} size={size} />,
  },
];

export default function TabsLayout() {
  const theme = useTheme();
  const router = useRouter();
  // segments = ["(tabs)", "<route>"] ; l'onglet d'accueil n'a pas de second segment.
  const segments = useSegments() as string[];
  const active = segments[1] ?? "index";

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: theme.colors.bg },
          // La barre native est remplacée par FloatingTabBar (cf. en-tête).
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="patrimoine" />
        <Tabs.Screen name="depenses" />
        <Tabs.Screen name="pilotage" />
      </Tabs>

      {/* Rendu APRES la tab bar : le voile du menu ouvert doit la recouvrir. */}
      <FloatingTabBar
        items={TABS}
        activeKey={active}
        onSelect={(key) => {
          const route = TAB_ROUTES[key];
          if (route) router.navigate(route);
        }}
      />
      <QuickAdd />
    </>
  );
}
