export type RouteCoordinate = { latitude: number; longitude: number };
export type TravelMode = "driving" | "walking" | "cycling";

export type RouteEstimateRequest = {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  mode?: TravelMode;
  trafficAware?: boolean;
};

export type RouteEstimate = {
  provider: "google" | "mapbox";
  mode: TravelMode;
  distanceMeters: number;
  durationSeconds: number;
  baselineDurationSeconds?: number;
  trafficAware: boolean;
  polyline?: { encoded: string; precision: 5 | 6 };
  warnings: string[];
};

export type RouteMatrixRequest = {
  origins: RouteCoordinate[];
  destinations: RouteCoordinate[];
  mode?: TravelMode;
  trafficAware?: boolean;
};

export type RouteMatrix = {
  provider: "google" | "mapbox";
  mode: TravelMode;
  trafficAware: boolean;
  originCount: number;
  destinationCount: number;
  elements: Array<{
    originIndex: number;
    destinationIndex: number;
    condition: "route-exists" | "route-not-found";
    distanceMeters?: number;
    durationSeconds?: number;
    baselineDurationSeconds?: number;
  }>;
};

async function post<T>(endpoint: string, body: unknown): Promise<T> {
  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => undefined) as { error?: string } | T | undefined;
  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null && "error" in payload
      ? payload.error
      : undefined;
    throw new Error(typeof error === "string" && error ? error : `Routing request failed (${response.status})`);
  }
  return payload as T;
}

export function requestRouteEstimate(
  input: RouteEstimateRequest,
  endpoint = "/api/routing/estimate",
): Promise<RouteEstimate> {
  return post<RouteEstimate>(endpoint, input);
}

export function requestRouteMatrix(
  input: RouteMatrixRequest,
  endpoint = "/api/routing/matrix",
): Promise<RouteMatrix> {
  return post<RouteMatrix>(endpoint, input);
}
