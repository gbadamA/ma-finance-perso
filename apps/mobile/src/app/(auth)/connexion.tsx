/**
 * Connexion / inscription (§8 phase 1 point 1).
 *
 * Un seul écran qui bascule entre les deux modes : à ce stade du parcours,
 * envoyer l'utilisateur sur une seconde page pour changer trois mots est une
 * friction gratuite.
 */

import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShieldCheck } from "lucide-react-native";
import { useAuth } from "../../lib/auth";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useTheme } from "../../lib/theme";
import { Card, Touchable, Txt } from "../../components/primitives";

type Mode = "connexion" | "inscription";

export default function Connexion() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, resetPassword, enterDemo } = useAuth();

  const [mode, setMode] = useState<Mode>("connexion");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError("Renseignez votre e-mail et votre mot de passe.");
      return;
    }
    setBusy(true);
    const result =
      mode === "connexion"
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setBusy(false);
    if (result.error) setError(result.error);
    else if (mode === "inscription") {
      setNotice("Compte créé. Confirmez votre e-mail puis connectez-vous.");
      setMode("connexion");
    }
  };

  const forgotten = async () => {
    if (!email.trim()) {
      setError("Saisissez votre e-mail pour recevoir le lien de réinitialisation.");
      return;
    }
    setBusy(true);
    const result = await resetPassword(email.trim());
    setBusy(false);
    setError(result.error);
    if (!result.error) setNotice("Lien de réinitialisation envoyé.");
  };

  const inputStyle = {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <LinearGradient
        colors={theme.gradient.hero as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: insets.top + theme.spacing.xxl,
          paddingBottom: theme.spacing.xxl,
          paddingHorizontal: theme.spacing.xl,
          borderBottomLeftRadius: theme.radius.xl,
          borderBottomRightRadius: theme.radius.xl,
        }}
      >
        <Animated.View entering={FadeIn.duration(theme.motion.duration.slow)}>
          {/* Fond blanc : le logo ITEKT est dessine pour du clair, le poser
              directement sur le marine ferait disparaitre le bleu marine du
              logotype. */}
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: theme.radius.md,
              backgroundColor: "#FFFFFF",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: theme.spacing.lg,
              overflow: "hidden",
            }}
          >
            <Image
              source={require("../../../assets/images/logo-itekt.png")}
              style={{ width: 58, height: 58 }}
              resizeMode="contain"
            />
          </View>
          <Txt variant="display" color="#FFFFFF">
            Ma Finance Perso
          </Txt>
          <Txt variant="body" color={theme.brand.accentSoft} style={{ marginTop: theme.spacing.xs }}>
            Vos 5 classeurs Excel, dans une seule application.
          </Txt>
        </Animated.View>
      </LinearGradient>

      <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.lg }}>
        <Animated.View entering={FadeInDown.duration(theme.motion.duration.normal).delay(80)}>
          <Card style={{ gap: theme.spacing.md }}>
            <Txt variant="h2">{mode === "connexion" ? "Connexion" : "Créer un compte"}</Txt>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-mail"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              inputMode="email"
              style={inputStyle}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Mot de passe"
              placeholderTextColor={theme.colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete={mode === "connexion" ? "current-password" : "new-password"}
              style={inputStyle}
            />

            {error ? (
              <Animated.View entering={FadeIn.duration(theme.motion.duration.quick)}>
                <Txt variant="caption" color={theme.money.loss}>
                  {error}
                </Txt>
              </Animated.View>
            ) : null}
            {notice ? (
              <Txt variant="caption" color={theme.money.gain}>
                {notice}
              </Txt>
            ) : null}

            <Touchable
              onPress={submit}
              haptic
              disabled={busy}
              accessibilityRole="button"
              style={{
                backgroundColor: theme.brand.primary,
                borderRadius: theme.radius.sm,
                paddingVertical: theme.spacing.lg,
                alignItems: "center",
                opacity: busy ? 0.7 : 1,
              }}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Txt variant="h3" color="#FFFFFF">
                  {mode === "connexion" ? "Se connecter" : "Créer mon compte"}
                </Txt>
              )}
            </Touchable>

            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Touchable
                noScale
                onPress={() => setMode(mode === "connexion" ? "inscription" : "connexion")}
              >
                <Txt variant="caption" color={theme.brand.accent}>
                  {mode === "connexion" ? "Créer un compte" : "J'ai déjà un compte"}
                </Txt>
              </Touchable>
              {mode === "connexion" ? (
                <Touchable noScale onPress={forgotten}>
                  <Txt variant="caption" muted>
                    Mot de passe oublié ?
                  </Txt>
                </Touchable>
              ) : null}
            </View>
          </Card>
        </Animated.View>

        {/* Sans projet Supabase configure, la connexion ne peut pas aboutir :
            on propose explicitement la demonstration plutot que de laisser
            l'utilisateur buter sur une erreur reseau incomprehensible. */}
        {!isSupabaseConfigured ? (
          <Animated.View entering={FadeInDown.duration(theme.motion.duration.normal).delay(160)}>
            <Card alt style={{ gap: theme.spacing.md }}>
              <Txt variant="h3">Mode démonstration</Txt>
              <Txt variant="caption" muted>
                Aucun projet Supabase n'est configuré (apps/mobile/.env). Vous pouvez
                explorer l'application avec un jeu de données local sur 24 mois.
              </Txt>
              <Touchable
                onPress={enterDemo}
                haptic
                style={{
                  borderWidth: 1,
                  borderColor: theme.brand.accent,
                  borderRadius: theme.radius.sm,
                  paddingVertical: theme.spacing.md,
                  alignItems: "center",
                }}
              >
                <Txt variant="h3" color={theme.brand.accent}>
                  Entrer en démonstration
                </Txt>
              </Touchable>
            </Card>
          </Animated.View>
        ) : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.sm }}>
          <ShieldCheck color={theme.colors.textMuted} size={14} />
          <Txt variant="caption" muted style={{ flex: 1 }}>
            Vos données sont cloisonnées par compte au niveau de la base (RLS).
          </Txt>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
