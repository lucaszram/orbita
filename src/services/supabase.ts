import Constants from "expo-constants";
import { createClient } from "@supabase/supabase-js";
import { contentTemplates, tarotCards } from "@/content/catalog";
import { ContentTemplate, TarotCard } from "@/domain/types";

const extra = Constants.expoConfig?.extra as Record<string, string | undefined> | undefined;
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra?.supabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra?.supabaseAnonKey;

export const supabase =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export async function fetchContentTemplates(): Promise<ContentTemplate[]> {
  if (!supabase) {
    return contentTemplates;
  }

  const { data, error } = await supabase.from("content_templates").select("*");

  if (error || !data || data.length === 0) {
    return contentTemplates;
  }

  return data as ContentTemplate[];
}

export async function fetchTarotCards(): Promise<TarotCard[]> {
  if (!supabase) {
    return tarotCards;
  }

  const { data, error } = await supabase.from("tarot_cards").select("*");

  if (error || !data || data.length === 0) {
    return tarotCards;
  }

  return data as TarotCard[];
}
