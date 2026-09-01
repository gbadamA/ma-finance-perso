/**
 * Ajout rapide d'une dépense — §6.1 du cahier des charges.
 *
 * C'est l'écran le plus utilisé de l'application : il doit se remplir en
 * quelques secondes, debout, dans une file d'attente. D'où le montant en
 * premier avec le clavier déjà ouvert, la catégorie en grille tactile, et la
 * date par défaut à aujourd'hui.
 */

import { useState } from "react";
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { Camera, Check, ImagePlus, Trash2, X } from "lucide-react-native";
import { colorForKey, expenseColors } from "@mfp/design-tokens";
import { toMonthKey } from "@mfp/core";
import { useData } from "../../lib/data";
import { useTheme } from "../../lib/theme";
import { addExpense } from "../../lib/mutations";
import { captureReceipt, pickReceipt, uploadReceipt, type PickedReceipt } from "../../lib/receipts";
import { Card, Dot, Overline, Touchable, Txt } from "../../components/primitives";
import { AmountInput, Field } from "../../components/amount-input";

/** Date locale au format ISO court — `toISOString()` bascule d'un jour en UTC-. */
function today(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function SaisieDepense() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, refresh } = useData();

  const [amount, setAmount] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(
    data.expenseCategories[0]?.id ?? null,
  );
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PickedReceipt | null>(null);

  const valid = amount !== null && amount > 0 && categoryId !== null;

  /** `null` couvre le refus de permission ET l'annulation : dans les deux cas
   *  l'utilisateur n'a pas de reçu à joindre, il n'y a rien à lui dire. */
  const attach = async (source: "camera" | "galerie") => {
    setError(null);
    const picked = source === "camera" ? await captureReceipt() : await pickReceipt();
    if (picked) setReceipt(picked);
  };

  const submit = async () => {
    if (!valid) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Format de date attendu : AAAA-MM-JJ.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);

    // Le reçu part AVANT la dépense : si l'envoi échoue, on enregistre quand
    // même la dépense (l'essentiel) et on le dit — plutôt que de perdre la
    // saisie parce qu'une photo n'est pas passée.
    let receiptPath: string | undefined;
    let receiptFailure: string | null = null;
    if (receipt) {
      const upload = await uploadReceipt(receipt, toMonthKey(date));
      if (upload.path) receiptPath = upload.path;
      else receiptFailure = upload.error;
    }

    const result = await addExpense({
      categoryId: categoryId!,
      spentOn: date,
      amount: amount!,
      note,
      receiptPath,
    });
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    await refresh();

    if (receiptFailure) {
      // On reste sur l'écran : sans cela l'utilisateur croit son reçu archivé.
      setNotice(`Dépense enregistrée, mais le reçu n'est pas parti (${receiptFailure}).`);
      setReceipt(null);
      return;
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingBottom: Math.max(insets.bottom, theme.spacing.lg) + 100,
          gap: theme.spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
          <View style={{ flex: 1 }}>
            <Overline>Nouvelle dépense</Overline>
            <Txt variant="h2">Ajouter</Txt>
          </View>
          <Touchable
            onPress={() => router.back()}
            haptic
            accessibilityLabel="Annuler"
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceAlt,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X color={theme.colors.text} size={20} />
          </Touchable>
        </View>

        <Card>
          <AmountInput
            value={amount}
            onChange={setAmount}
            currency={data.settings.currency}
            autoFocus
          />
        </Card>

        <Card style={{ gap: theme.spacing.md }}>
          <Overline>Catégorie</Overline>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm }}>
            {data.expenseCategories.map((category) => {
              const active = category.id === categoryId;
              const color = colorForKey(category.key, expenseColors);
              return (
                <Touchable key={category.id} onPress={() => setCategoryId(category.id)} haptic>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 7,
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.md,
                      borderRadius: theme.radius.pill,
                      backgroundColor: active ? color : theme.colors.surfaceAlt,
                      borderWidth: 1,
                      borderColor: active ? color : theme.colors.border,
                    }}
                  >
                    {!active ? <Dot color={color} size={8} /> : null}
                    <Txt
                      variant="caption"
                      color={active ? "#FFFFFF" : theme.colors.text}
                      style={{ fontWeight: active ? "700" : "500" }}
                    >
                      {category.label}
                    </Txt>
                  </View>
                </Touchable>
              );
            })}
          </View>
        </Card>

        <Card style={{ gap: theme.spacing.md }}>
          <Overline>Reçu (facultatif)</Overline>
          {receipt ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: theme.spacing.md }}>
              <Image
                source={{ uri: receipt.uri }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: theme.radius.sm,
                  backgroundColor: theme.colors.surfaceSunken,
                }}
              />
              <Txt variant="caption" muted style={{ flex: 1 }} numberOfLines={2}>
                {receipt.fileName}
              </Txt>
              <Touchable
                onPress={() => setReceipt(null)}
                haptic
                accessibilityLabel="Retirer le reçu"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: theme.radius.pill,
                  backgroundColor: theme.colors.surfaceAlt,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Trash2 color={theme.money.loss} size={17} />
              </Touchable>
            </View>
          ) : (
            <View style={{ flexDirection: "row", gap: theme.spacing.sm }}>
              <ReceiptButton
                icon={<Camera color={theme.brand.primary} size={17} />}
                label="Photo"
                onPress={() => void attach("camera")}
              />
              <ReceiptButton
                icon={<ImagePlus color={theme.brand.primary} size={17} />}
                label="Galerie"
                onPress={() => void attach("galerie")}
              />
            </View>
          )}
        </Card>

        <Card style={{ gap: theme.spacing.lg }}>
          <Field
            label="Date"
            value={date}
            onChangeText={setDate}
            placeholder="AAAA-MM-JJ"
            keyboardType="numbers-and-punctuation"
          />
          <Field
            label="Note (facultatif)"
            value={note}
            onChangeText={setNote}
            placeholder="Restaurant, carburant…"
            multiline
          />
        </Card>

        {error ? (
          <Animated.View entering={FadeIn.duration(theme.motion.duration.quick)}>
            <Txt variant="caption" color={theme.money.loss}>
              {error}
            </Txt>
          </Animated.View>
        ) : null}
        {notice ? (
          <Animated.View entering={FadeIn.duration(theme.motion.duration.quick)}>
            <Txt variant="caption" color={theme.money.warning}>
              {notice}
            </Txt>
          </Animated.View>
        ) : null}
      </ScrollView>

      {/* Le bouton reste accessible au pouce, au-dessus des gestes système. */}
      <View
        style={{
          position: "absolute",
          left: theme.spacing.lg,
          right: theme.spacing.lg,
          bottom: Math.max(insets.bottom, theme.spacing.md),
        }}
      >
        <Touchable
          onPress={submit}
          haptic
          disabled={!valid || busy}
          accessibilityRole="button"
          style={[
            {
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: theme.spacing.sm,
              backgroundColor: valid ? theme.brand.primary : theme.colors.surfaceAlt,
              borderRadius: theme.radius.md,
              paddingVertical: theme.spacing.lg,
            },
            theme.elevation("floating"),
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Check color={valid ? "#FFFFFF" : theme.colors.textMuted} size={18} />
              <Txt variant="h3" color={valid ? "#FFFFFF" : theme.colors.textMuted}>
                Enregistrer
              </Txt>
            </>
          )}
        </Touchable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ------------------------------------------------------------------ */

function ReceiptButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Touchable
      onPress={onPress}
      haptic
      accessibilityRole="button"
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.md,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      {icon}
      <Txt variant="caption" style={{ fontWeight: "600" }}>
        {label}
      </Txt>
    </Touchable>
  );
}
