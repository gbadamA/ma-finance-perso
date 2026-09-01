import { useEffect } from "react";
import { ActivityIndicator, AppState, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "../lib/auth";
import { DataProvider, useData } from "../lib/data";
import { LockProvider, useLock } from "../lib/lock";
import { flushPending } from "../lib/mutations";
import { ThemeProvider, useTheme } from "../lib/theme";
import { LockScreen } from "../components/lock-screen";

function RootNavigator() {
  const { isSignedIn, loading } = useAuth();
  const { refresh } = useData();
  const { locked } = useLock();
  const theme = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === "(auth)";
    if (!isSignedIn && !inAuth) router.replace("/(auth)/connexion");
    else if (isSignedIn && inAuth) router.replace("/(tabs)");
  }, [isSignedIn, loading, segments, router]);

  /**
   * Rejeu des saisies faites hors-ligne au retour au premier plan.
   * C'est le moment où le réseau est le plus probablement revenu, et c'est
   * gratuit : la file est vide dans le cas courant.
   */
  useEffect(() => {
    if (!isSignedIn) return;
    const flush = async () => {
      const outcome = await flushPending();
      if (outcome.sent > 0) await refresh();
    };
    void flush();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void flush();
    });
    return () => subscription.remove();
  }, [isSignedIn, refresh]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator color={theme.brand.accent} />
      </View>
    );
  }

  // Le verrou est rendu à la place de la navigation, pas par-dessus : le
  // contenu ne doit pas exister dans l'arbre pendant qu'on est verrouillé,
  // sinon il apparaît dans l'aperçu du sélecteur d'applications.
  if (locked && isSignedIn) return <LockScreen />;

  return (
    <>
      {/* La barre d'etat suit le theme : la figer en clair la rend invisible
          sur fond clair, ce qui est exactement le bug qu'on ne voit qu'en prod. */}
      <StatusBar style={theme.isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="revenus" />
        <Stack.Screen name="portefeuille" />
        <Stack.Screen name="assets" />
        <Stack.Screen name="fire" />
        <Stack.Screen name="heritage" />
        <Stack.Screen name="optimisateur" />
        <Stack.Screen name="objectifs" />
        <Stack.Screen
          name="reglages"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        {/* Ecrans de saisie : presentes en feuille modale, ils ne remplacent pas
            l'ecran courant mais se posent dessus — on revient d'ou l'on vient. */}
        <Stack.Screen
          name="saisie/depense"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="saisie/revenu"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="saisie/soldes"
          options={{ presentation: "modal", animation: "slide_from_bottom" }}
        />
      </Stack>
    </>
  );
}

/** Branche le verrou sur la préférence chargée depuis la base. */
function LockGate({ children }: { children: React.ReactNode }) {
  const { data } = useData();
  return <LockProvider enabled={data.biometricLock}>{children}</LockProvider>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <DataProvider>
              <LockGate>
                <RootNavigator />
              </LockGate>
            </DataProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
