export type RoutingProvider = "google" | "mapbox";
export type TravelMode = "driving" | "walking" | "cycling";

export type RouteCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteEstimateRequest = {
  origin: RouteCoordinate;
  destination: RouteCoordinate;
  mode?: TravelMode;
  trafficAware?: boolean;
};

export type RouteEstimate = {
  provider: RoutingProvider;
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

export type RouteMatrixElement = {
  originIndex: number;
  destinationIndex: number;
  condition: "route-exists" | "route-not-found";
  distanceMeters?: number;
  durationSeconds?: number;
  baselineDurationSeconds?: number;
};

export type RouteMatrix = {
  provider: RoutingProvider;
  mode: TravelMode;
  trafficAware: boolean;
  originCount: number;
  destinationCount: number;
  elements: RouteMatrixElement[];
};

export class RoutingInputError extends Error {}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function provider(): RoutingProvider {
  const value = (process.env.ROUTING_PROVIDER || "google").toLowerCase();
  if (value !== "google" && value !== "mapbox") {
    throw new RoutingInputError("ROUTING_PROVIDER must be google or mapbox");
  }
  return value;
}

function coordinate(value: RouteCoordinate, label: string): RouteCoordinate {
  if (
    !value ||
    !Number.isFinite(value.latitude) ||
    !Number.isFinite(value.longitude) ||
    value.latitude < -90 ||
    value.latitude > 90 ||
    value.longitude < -180 ||
    value.longitude > 180
  ) {
    throw new RoutingInputError(`${label} must contain valid WGS84 latitude and longitude`);
  }
  return value;
}

function mode(value: TravelMode | undefined): TravelMode {
  if (!value) return "driving";
  if (!["driving", "walking", "cycling"].includes(value)) {
    throw new RoutingInputError("mode must be driving, walking, or cycling");
  }
  return value;
}

function seconds(value: string | undefined): number | undefined {
  if (!value?.endsWith("s")) return undefined;
  const parsed = Number(value.slice(0, -1));
  return Number.isFinite(parsed) ? parsed : undefined;
}

async function providerFailure(response: Response, name: string): Promise<never> {
  const payload = await response.json().catch(() => undefined) as
    | { error?: { message?: string }; message?: string }
    | undefined;
  const detail = payload?.error?.message || payload?.message;
  throw new Error(`${name} routing failed (${response.status})${detail ? `: ${detail}` : ""}`);
}

function googleMode(value: TravelMode): "DRIVE" | "WALK" | "BICYCLE" {
  return value === "driving" ? "DRIVE" : value === "walking" ? "WALK" : "BICYCLE";
}

function googleWaypoint(value: RouteCoordinate) {
  return { location: { latLng: value } };
}

async function googleRoute(input: RouteEstimateRequest): Promise<RouteEstimate> {
  const selectedMode = mode(input.mode);
  const trafficAware = selectedMode === "driving" && input.trafficAware !== false;
  const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": required("GOOGLE_ROUTES_API_KEY"),
      "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline,routes.warnings",
    },
    body: JSON.stringify({
      origin: googleWaypoint(coordinate(input.origin, "origin")),
      destination: googleWaypoint(coordinate(input.destination, "destination")),
      travelMode: googleMode(selectedMode),
      ...(selectedMode === "driving"
        ? { routingPreference: trafficAware ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE" }
        : {}),
    }),
  });
  if (!response.ok) await providerFailure(response, "Google Routes");
  const payload = await response.json() as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      staticDuration?: string;
      polyline?: { encodedPolyline?: string };
      warnings?: string[];
    }>;
  };
  const route = payload.routes?.[0];
  const durationSeconds = seconds(route?.duration);
  if (!route || route.distanceMeters === undefined || durationSeconds === undefined) {
    throw new Error("Google Routes returned no usable route");
  }
  return {
    provider: "google",
    mode: selectedMode,
    distanceMeters: route.distanceMeters,
    durationSeconds,
    baselineDurationSeconds: seconds(route.staticDuration),
    trafficAware,
    polyline: route.polyline?.encodedPolyline
      ? { encoded: route.polyline.encodedPolyline, precision: 5 }
      : undefined,
    warnings: route.warnings || [],
  };
}

function mapboxProfile(selectedMode: TravelMode, trafficAware: boolean): string {
  if (selectedMode === "walking") return "mapbox/walking";
  if (selectedMode === "cycling") return "mapbox/cycling";
  return trafficAware ? "mapbox/driving-traffic" : "mapbox/driving";
}

function mapboxPair(value: RouteCoordinate): string {
  const checked = coordinate(value, "coordinate");
  return `${checked.longitude},${checked.latitude}`;
}

async function mapboxRoute(input: RouteEstimateRequest): Promise<RouteEstimate> {
  const selectedMode = mode(input.mode);
  const trafficAware = selectedMode === "driving" && input.trafficAware !== false;
  const coordinates = [mapboxPair(input.origin), mapboxPair(input.destination)].join(";");
  const url = new URL(`https://api.mapbox.com/directions/v5/${mapboxProfile(selectedMode, trafficAware)}/${coordinates}`);
  url.search = new URLSearchParams({
    access_token: required("MAPBOX_ACCESS_TOKEN"),
    alternatives: "false",
    overview: "simplified",
    geometries: "polyline6",
  }).toString();
  const response = await fetch(url);
  if (!response.ok) await providerFailure(response, "Mapbox Directions");
  const payload = await response.json() as {
    code?: string;
    message?: string;
    routes?: Array<{
      distance?: number;
      duration?: number;
      duration_typical?: number;
      geometry?: string;
    }>;
  };
  const route = payload.routes?.[0];
  if (payload.code !== "Ok" || !route || route.distance === undefined || route.duration === undefined) {
    throw new Error(`Mapbox Directions returned no usable route${payload.message ? `: ${payload.message}` : ""}`);
  }
  return {
    provider: "mapbox",
    mode: selectedMode,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    baselineDurationSeconds: route.duration_typical,
    trafficAware,
    polyline: route.geometry ? { encoded: route.geometry, precision: 6 } : undefined,
    warnings: [],
  };
}

function validateMatrix(input: RouteMatrixRequest): {
  origins: RouteCoordinate[];
  destinations: RouteCoordinate[];
  mode: TravelMode;
  trafficAware: boolean;
} {
  if (!Array.isArray(input.origins) || input.origins.length === 0) {
    throw new RoutingInputError("origins must contain at least one coordinate");
  }
  if (!Array.isArray(input.destinations) || input.destinations.length === 0) {
    throw new RoutingInputError("destinations must contain at least one coordinate");
  }
  const selectedMode = mode(input.mode);
  return {
    origins: input.origins.map((value, index) => coordinate(value, `origins[${index}]`)),
    destinations: input.destinations.map((value, index) => coordinate(value, `destinations[${index}]`)),
    mode: selectedMode,
    trafficAware: selectedMode === "driving" && input.trafficAware !== false,
  };
}

async function googleMatrix(input: RouteMatrixRequest): Promise<RouteMatrix> {
  const checked = validateMatrix(input);
  const elements = checked.origins.length * checked.destinations.length;
  const limit = checked.trafficAware ? 100 : 625;
  if (elements > limit) throw new RoutingInputError(`Google route matrix is limited to ${limit} elements for this request`);
  const response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": required("GOOGLE_ROUTES_API_KEY"),
      "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration,staticDuration",
    },
    body: JSON.stringify({
      origins: checked.origins.map((value) => ({ waypoint: googleWaypoint(value) })),
      destinations: checked.destinations.map((value) => ({ waypoint: googleWaypoint(value) })),
      travelMode: googleMode(checked.mode),
      ...(checked.mode === "driving"
        ? { routingPreference: checked.trafficAware ? "TRAFFIC_AWARE" : "TRAFFIC_UNAWARE" }
        : {}),
    }),
  });
  if (!response.ok) await providerFailure(response, "Google Route Matrix");
  const payload = await response.json() as Array<{
    originIndex: number;
    destinationIndex: number;
    condition?: string;
    distanceMeters?: number;
    duration?: string;
    staticDuration?: string;
  }>;
  return {
    provider: "google",
    mode: checked.mode,
    trafficAware: checked.trafficAware,
    originCount: checked.origins.length,
    destinationCount: checked.destinations.length,
    elements: payload.map((element) => ({
      originIndex: element.originIndex,
      destinationIndex: element.destinationIndex,
      condition: element.condition === "ROUTE_EXISTS" ? "route-exists" : "route-not-found",
      distanceMeters: element.distanceMeters,
      durationSeconds: seconds(element.duration),
      baselineDurationSeconds: seconds(element.staticDuration),
    })),
  };
}

async function mapboxMatrix(input: RouteMatrixRequest): Promise<RouteMatrix> {
  const checked = validateMatrix(input);
  if (checked.origins.length * checked.destinations.length === 1) {
    const route = await mapboxRoute({
      origin: checked.origins[0],
      destination: checked.destinations[0],
      mode: checked.mode,
      trafficAware: checked.trafficAware,
    });
    return {
      provider: "mapbox",
      mode: checked.mode,
      trafficAware: checked.trafficAware,
      originCount: 1,
      destinationCount: 1,
      elements: [{
        originIndex: 0,
        destinationIndex: 0,
        condition: "route-exists",
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        baselineDurationSeconds: route.baselineDurationSeconds,
      }],
    };
  }
  const coordinates = [...checked.origins, ...checked.destinations];
  const limit = checked.trafficAware ? 10 : 25;
  if (coordinates.length > limit) {
    throw new RoutingInputError(`Mapbox route matrix is limited to ${limit} combined coordinates for this request`);
  }
  const sourceIndexes = checked.origins.map((_, index) => index);
  const destinationIndexes = checked.destinations.map((_, index) => checked.origins.length + index);
  const url = new URL(
    `https://api.mapbox.com/directions-matrix/v1/${mapboxProfile(checked.mode, checked.trafficAware)}/${coordinates.map(mapboxPair).join(";")}`,
  );
  url.search = new URLSearchParams({
    access_token: required("MAPBOX_ACCESS_TOKEN"),
    annotations: "distance,duration",
    sources: sourceIndexes.join(";"),
    destinations: destinationIndexes.join(";"),
  }).toString();
  const response = await fetch(url);
  if (!response.ok) await providerFailure(response, "Mapbox Matrix");
  const payload = await response.json() as {
    code?: string;
    message?: string;
    durations?: Array<Array<number | null>>;
    distances?: Array<Array<number | null>>;
  };
  if (payload.code !== "Ok" || !payload.durations || !payload.distances) {
    throw new Error(`Mapbox Matrix returned no usable matrix${payload.message ? `: ${payload.message}` : ""}`);
  }
  const elements: RouteMatrixElement[] = [];
  payload.durations.forEach((row, originIndex) => {
    row.forEach((durationSeconds, destinationIndex) => {
      const distanceMeters = payload.distances?.[originIndex]?.[destinationIndex] ?? null;
      elements.push({
        originIndex,
        destinationIndex,
        condition: durationSeconds === null || distanceMeters === null ? "route-not-found" : "route-exists",
        durationSeconds: durationSeconds ?? undefined,
        distanceMeters: distanceMeters ?? undefined,
      });
    });
  });
  return {
    provider: "mapbox",
    mode: checked.mode,
    trafficAware: checked.trafficAware,
    originCount: checked.origins.length,
    destinationCount: checked.destinations.length,
    elements,
  };
}

export async function estimateRoute(input: RouteEstimateRequest): Promise<RouteEstimate> {
  return provider() === "google" ? googleRoute(input) : mapboxRoute(input);
}

export async function estimateRouteMatrix(input: RouteMatrixRequest): Promise<RouteMatrix> {
  return provider() === "google" ? googleMatrix(input) : mapboxMatrix(input);
}
