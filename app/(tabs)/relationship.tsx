import { useEffect, useMemo, useState } from "react";
import { Alert, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { AppButton } from "@/components/AppButton";
import { Card } from "@/components/Card";
import { RelationshipCard } from "@/components/RelationshipCard";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { ShareCardPreview } from "@/components/ShareCardPreview";
import { Tag } from "@/components/Tag";
import { ShareCard, ZodiacSign, zodiacSigns } from "@/domain/types";
import { formatSign, getZodiacSign } from "@/domain/zodiac";
import { useAppState } from "@/hooks/useAppState";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

export default function RelationshipScreen() {
  const { isReady, profile } = useRequireProfile();
  const { relationshipReading, updateProfile } = useAppState();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [zodiacSign, setZodiacSign] = useState<ZodiacSign | null>(null);

  useEffect(() => {
    if (!profile?.relationshipTarget) {
      return;
    }

    setName(profile.relationshipTarget.name);
    setBirthDate(profile.relationshipTarget.birthDate ?? "");
    setZodiacSign(profile.relationshipTarget.zodiacSign ?? null);
  }, [profile]);

  const resolvedSign = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      return getZodiacSign(birthDate);
    }

    return zodiacSign;
  }, [birthDate, zodiacSign]);

  if (!isReady || !profile) {
    return <Screen />;
  }

  const shareCard: ShareCard = {
    id: `${relationshipReading.id}-share`,
    type: "relationship",
    title: "La energia de este vinculo",
    subtitle: relationshipReading.shareLine,
    body: relationshipReading.sharedEnergy,
    accent: "Rosa cuarzo",
    meta: `Consejo: ${relationshipReading.advice}`
  };

  async function saveTarget() {
    await updateProfile({
      relationshipTarget: name.trim()
        ? {
            name: name.trim(),
            birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? birthDate : undefined,
            zodiacSign: resolvedSign ?? undefined
          }
        : undefined
    });
    Alert.alert("Vinculo actualizado", "La proxima lectura va a mirar esta conexion.");
  }

  async function shareRelationship() {
    await Share.share({
      title: shareCard.title,
      message: `${shareCard.title}\n${shareCard.subtitle}\n\n${shareCard.body}\n${shareCard.meta}`
    });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={textStyles.eyebrow}>Amor y compatibilidad</Text>
        <Text style={textStyles.title}>Que energia hay entre vos y esa persona.</Text>
      </View>

      <Card>
        <SectionHeader
          eyebrow="Conexion"
          title="Guardar persona"
          body="Si no sabes su fecha, elegi signo. Si tampoco sabes signo, la app usa una lectura simbolica."
        />
        <View style={styles.field}>
          <Text style={styles.label}>Nombre o apodo</Text>
          <TextInput
            autoCapitalize="words"
            onChangeText={setName}
            placeholder="Ej: esa persona"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            value={name}
          />
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>Fecha si la sabes</Text>
          <TextInput
            inputMode="numeric"
            onChangeText={setBirthDate}
            placeholder="AAAA-MM-DD"
            placeholderTextColor={theme.colors.muted}
            style={styles.input}
            value={birthDate}
          />
          {resolvedSign ? <Text style={styles.detected}>Signo de la conexion: {formatSign(resolvedSign)}</Text> : null}
        </View>
        <View style={styles.signWrap}>
          {zodiacSigns.map((sign) => (
            <Tag key={sign} label={formatSign(sign)} onPress={() => setZodiacSign(sign)} selected={resolvedSign === sign} />
          ))}
        </View>
        <AppButton icon="heart" label="Guardar vinculo" onPress={saveTarget} variant="secondary" />
      </Card>

      <RelationshipCard reading={relationshipReading} />

      <ShareCardPreview card={shareCard} icon="heart" onPress={shareRelationship} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md
  },
  field: {
    gap: theme.spacing.sm
  },
  label: {
    color: theme.colors.ink,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.82)",
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    color: theme.colors.ink,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: theme.spacing.md
  },
  detected: {
    color: theme.colors.plum,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0
  },
  signWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  }
});
