import { useMemo, useState } from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { SectionHeader } from "@/components/SectionHeader";
import { ShareCardPreview } from "@/components/ShareCardPreview";
import { Tag } from "@/components/Tag";
import { TransitCard } from "@/components/TransitCard";
import { topicLabels } from "@/components/TopicSelector";
import { WeeklyEnergyCard } from "@/components/WeeklyEnergyCard";
import { contentTemplates, tarotCards } from "@/content/catalog";
import { ShareCard } from "@/domain/types";
import { Topic, zodiacSigns } from "@/domain/types";
import { pickStable } from "@/domain/random";
import { formatSign } from "@/domain/zodiac";
import { useAppState } from "@/hooks/useAppState";
import { useRequireProfile } from "@/hooks/useRequireProfile";
import { textStyles } from "@/theme/text";
import { theme } from "@/theme/theme";

const exploreTopics: Topic[] = ["amor", "trabajo", "dinero", "energia", "familia", "decisiones", "proteccion", "luna"];

export default function ExploreScreen() {
  const { isReady, profile } = useRequireProfile();
  const { todayReading, weeklyEnergy, weeklyReading, transitEvent } = useAppState();
  const [selectedTopic, setSelectedTopic] = useState<Topic>("amor");

  const topicRecommendation = useMemo(() => {
    return contentTemplates.find((template) => template.kind === "recommendation" && template.topic === selectedTopic);
  }, [selectedTopic]);

  const feed = contentTemplates.filter((template) => template.kind === "micro-feed");
  const card = pickStable(tarotCards, `${todayReading.date}:explore:${selectedTopic}`);
  const weeklyColorShare: ShareCard = {
    id: `${weeklyEnergy.id}-share`,
    type: "weekly-color",
    title: "Mi calendario energético de la semana",
    subtitle: `${formatSign(weeklyEnergy.sign)} - semana del ${weeklyEnergy.weekStart}`,
    body: weeklyEnergy.days.map((day) => `${day.dayName}: ${day.color}`).join(" / "),
    accent: weeklyReading.color,
    meta: `Número ${weeklyReading.luckyNumber} - Carta ${weeklyReading.tarotCard.name}`
  };

  async function shareWeeklyCard() {
    await Share.share({
      title: weeklyColorShare.title,
      message: `${weeklyColorShare.title}\n${weeklyColorShare.subtitle}\n\n${weeklyColorShare.body}\n${weeklyColorShare.meta}`
    });
  }

  if (!isReady || !profile) {
    return <Screen />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={textStyles.eyebrow}>Señales</Text>
        <Text style={textStyles.title}>Colores, tránsitos y lectura semanal para tu signo.</Text>
      </View>

      <WeeklyEnergyCard weeklyEnergy={weeklyEnergy} />

      <Card tone="plum">
        <Text style={styles.plumEyebrow}>Lectura semanal</Text>
        <Text style={styles.plumTitle}>{formatSign(weeklyReading.sign)}: energía de la semana</Text>
        <Text style={styles.plumBody}>{weeklyReading.energy}</Text>
        <View style={styles.weeklyGrid}>
          <View style={styles.weeklyBox}>
            <Text style={styles.weeklyLabel}>Amor</Text>
            <Text style={styles.weeklyText}>{weeklyReading.love}</Text>
          </View>
          <View style={styles.weeklyBox}>
            <Text style={styles.weeklyLabel}>Dinero / trabajo</Text>
            <Text style={styles.weeklyText}>{weeklyReading.workMoney}</Text>
          </View>
          <View style={styles.weeklyBox}>
            <Text style={styles.weeklyLabel}>Consejo</Text>
            <Text style={styles.weeklyText}>{weeklyReading.advice}</Text>
          </View>
        </View>
        <Text style={styles.plumBody}>
          Color: {weeklyReading.color} - Número: {weeklyReading.luckyNumber} - Carta: {weeklyReading.tarotCard.name}
        </Text>
      </Card>

      <TransitCard transit={transitEvent} />

      <ShareCardPreview card={weeklyColorShare} icon="calendar" onPress={shareWeeklyCard} />

      <Card tone="warm">
        <SectionHeader eyebrow="Temas" title="Elegí una puerta de entrada" />
        <View style={styles.tags}>
          {exploreTopics.map((topic) => (
            <Tag
              key={topic}
              label={topicLabels[topic]}
              onPress={() => setSelectedTopic(topic)}
              selected={selectedTopic === topic}
            />
          ))}
        </View>
      </Card>

      {topicRecommendation ? (
        <Card>
          <SectionHeader eyebrow={topicLabels[selectedTopic]} title={topicRecommendation.title} />
          <Text style={textStyles.body}>{topicRecommendation.body}</Text>
          <Text style={styles.action}>{topicRecommendation.action}</Text>
        </Card>
      ) : null}

      <Card tone="plum">
        <Text style={styles.plumEyebrow}>Carta para este tema</Text>
        <Text style={styles.plumTitle}>{card.name}</Text>
        <Text style={styles.plumBody}>{card.meaning}</Text>
        <View style={styles.keywordWrap}>
          {card.keywords.map((keyword) => (
            <Text key={keyword} style={styles.keyword}>
              {keyword}
            </Text>
          ))}
        </View>
      </Card>

      <SectionHeader eyebrow="Horóscopos" title="Todos los signos" body="Mensajes base para mirar otras energías del día." />
      <View style={styles.signGrid}>
        {zodiacSigns.map((sign) => {
          const message = contentTemplates.find((template) => template.kind === "daily-message" && template.zodiacSign === sign);

          return (
            <Card key={sign} style={styles.signCard}>
              <Text style={textStyles.cardTitle}>{formatSign(sign)}</Text>
              <Text style={textStyles.muted}>{message?.body}</Text>
            </Card>
          );
        })}
      </View>

      <SectionHeader eyebrow="Feed" title="Mensajes para guardar en la cabeza" />
      {feed.map((item) => (
        <Card key={item.id}>
          <SectionHeader eyebrow={item.topic ? topicLabels[item.topic] : "Guía"} title={item.title} />
          <Text style={textStyles.body}>{item.body}</Text>
          <Text style={styles.action}>{item.action}</Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  action: {
    color: theme.colors.plum,
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 22
  },
  plumEyebrow: {
    color: "#f2c27e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  plumTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 0
  },
  plumBody: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 16,
    lineHeight: 24
  },
  keywordWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  keyword: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: theme.radius.full,
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    overflow: "hidden",
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  signGrid: {
    gap: theme.spacing.md
  },
  signCard: {
    shadowOpacity: 0.08
  },
  weeklyGrid: {
    gap: theme.spacing.sm
  },
  weeklyBox: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: theme.radius.sm,
    gap: theme.spacing.xs,
    padding: theme.spacing.md
  },
  weeklyLabel: {
    color: "#f2c27e",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    textTransform: "uppercase"
  },
  weeklyText: {
    color: "#fff",
    fontSize: 15,
    lineHeight: 22
  }
});
