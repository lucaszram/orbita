import type { ReactNode } from "react";
import { Redirect } from "expo-router";
import { useQuery } from "convex/react";
import { OnboardingFlow } from "@/onboarding/OnboardingFlow";
import { HOME_ROUTE } from "@/domain/appRoutes";
import { useLiveApp } from "@/hooks/useLiveApp";
import { appApi } from "@/services/appRefs";
import { MinimalLoading } from "@/components/orbita/states";

/**
 * Puerta del onboarding, compartida por `/empezar` (web) y `/onboarding` (nativo).
 *
 * Una cuenta que YA tiene datos natales no vuelve al alta: el onboarding es
 * create-only del lado del backend (`ONBOARDING_BIRTH_DATA_CONFLICT`), así que
 * recorrerlo de nuevo sólo puede terminar en un conflicto o —como pasó— en una
 * sobrescritura con los valores por defecto del flujo. Los cambios
 * intencionales viven exclusivamente en `/editar-datos`.
 *
 * Vive en un solo lugar a propósito: si cada plataforma tuviera su gate,
 * volverían a divergir.
 */
export function OnboardingGate({ fallback }: { fallback?: ReactNode } = {}) {
  const { isLive, isAuthLoading } = useLiveApp();
  const birthData = useQuery(appApi.birthData.getCurrent, isLive ? {} : "skip");

  // Mientras la sesión o el dato resuelven no se afirma nada: mostrar el alta y
  // después redirigir sería un salto delante del usuario.
  if (isAuthLoading) return <>{fallback ?? <MinimalLoading />}</>;
  if (isLive && birthData === undefined) return <>{fallback ?? <MinimalLoading />}</>;
  if (isLive && birthData) return <Redirect href={HOME_ROUTE as never} />;

  return <OnboardingFlow />;
}
