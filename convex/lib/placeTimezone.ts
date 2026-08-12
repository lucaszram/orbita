"use node";

import { find } from "geo-tz";

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Zona IANA autoritativa a partir de las coordenadas elegidas en Photon.
 *
 * `geo-tz` empaqueta los límites geográficos: no hace requests, no consume una
 * API paga y no depende de la zona del dispositivo. En puntos de frontera puede
 * devolver más de una zona; Photon entrega el centro del poblado, por lo que la
 * primera coincidencia es la zona principal de ese punto.
 */
export function timezoneAtCoordinates(latitude: number, longitude: number): string {
  if (!finite(latitude) || !finite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error("TIMEZONE_COORDINATES_INVALID");
  }

  const timezone = find(latitude, longitude)[0]?.trim();
  if (!timezone) throw new Error("TIMEZONE_NOT_FOUND");
  return timezone;
}
