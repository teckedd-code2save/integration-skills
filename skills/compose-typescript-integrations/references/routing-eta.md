# Provider-neutral routing and ETA recipe

Use this recipe for point-to-point travel distance and time, traffic-aware ETA, or origin×destination matrices. It normalizes Google Routes and Mapbox Navigation behind one application-owned TypeScript contract. It does not attempt fleet dispatch, learned ETA correction, or route-sequence optimization unless the product explicitly requires those separate capabilities.

## Completion contract for agents

1. Inspect the existing map/search provider, coordinate model, route/ETA code, caching, quotas, and the product decision that consumes the estimate. Reuse a sound boundary instead of creating competing paths.
2. Choose one routing provider. Prefer Google Routes when the application uses Google Maps/Places and Mapbox Navigation when it uses Mapbox, unless migration or coverage evidence supports a deliberate split.
3. Keep the routing credential server-side. Mount authenticated and rate-limited route/matrix endpoints; validate WGS84 latitude and longitude before making a billable call.
4. Connect distance, expected duration, baseline duration, traffic status, geometry, warnings, and unreachable pairs to the real product flow. Label ETA as an estimate rather than a guarantee.
5. Test known Ghana routes, invalid coordinates, unreachable pairs, provider errors and quotas, origin/destination indexing, traffic-aware behavior, and repository checks. Run the live doctor after configuration.

Routing is complete only when the real product path uses a live result from the intended provider and its displayed values have been spot-checked against the provider UI or a known journey. Generated files, environment names, a mocked route, or an HTTP 200 alone are not completion.

Authoritative sources:

- Google Routes API: https://developers.google.com/maps/documentation/routes
- Google traffic-aware routing: https://developers.google.com/maps/documentation/routes/config_trade_offs
- Google Compute Route Matrix: https://developers.google.com/maps/documentation/routes/compute_route_matrix
- Google Routes billing and limits: https://developers.google.com/maps/documentation/routes/usage-and-billing
- Mapbox Directions API: https://docs.mapbox.com/api/navigation/directions/
- Mapbox Matrix API: https://docs.mapbox.com/api/navigation/matrix/

## Compose the routing boundary

For a Next.js App Router or Express server:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose routing-eta --target . --install
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs setup routing-eta --target .
```

The default provider is Google. Configure one of:

```dotenv
ROUTING_PROVIDER=google
GOOGLE_ROUTES_API_KEY=
```

```dotenv
ROUTING_PROVIDER=mapbox
MAPBOX_ACCESS_TOKEN=
```

Do not reuse a browser-restricted Google Maps key for server routing. Restrict the Google routing key to Routes API and the server's deployment controls. Use a minimally scoped Mapbox token appropriate for Navigation APIs. Never expose either credential through `NEXT_PUBLIC_` or `VITE_` variables.

The server API provides:

- `estimateRoute`: one route with meters, seconds, baseline seconds when supplied, traffic status, and encoded geometry.
- `estimateRouteMatrix`: normalized row-major origin/destination elements for comparison, assignment, or nearest-destination selection.
- Next.js and Express route factories that require application authentication.
- Browser helpers that call the application endpoints with cookies, never the provider directly.

Use precise WGS84 coordinates as the canonical input. Mapbox URL coordinates are longitude then latitude; the public contract remains `{ latitude, longitude }` so provider syntax does not leak into the application.

Google's traffic-aware `duration` includes current traffic while `staticDuration` excludes current traffic. Mapbox's `driving-traffic` `duration` is traffic-aware and `duration_typical` represents typical conditions. Both normalize to `durationSeconds` and `baselineDurationSeconds`, but preserve `provider` because baseline semantics are not identical.

Matrices are billable by origin×destination elements. Reject oversized requests before calling the provider, rate-limit by user or tenant, cache only where freshness requirements permit, and do not silently replace unreachable routes with straight-line estimates.

## Verify with a live Ghana route

After the credential is configured securely:

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs doctor routing-eta --target . --live
```

The probe requests one driving route between two Accra coordinates and reports only provider, rounded distance, and rounded duration. Then test the application's own route and matrix flows with known locations. Compare a small sample to the provider UI and document material discrepancies rather than calibrating arbitrary correction factors from a single trip.
