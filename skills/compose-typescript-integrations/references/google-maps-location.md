# Google Maps and Places location recipe

Use this recipe for a Google map with modern Places autocomplete and an explicit place/coordinate selection contract. Compose the separate `routing-eta` recipe when the product also needs directions, travel-time estimates, dispatch inputs, or ranking by ETA.

## Completion contract for agents

1. Inspect the existing provider, stored location shape, product UI, geography, privacy needs, and any migration impact.
2. Enable only Maps JavaScript API and Places API (New) for the included picker. Create a browser key restricted to exact HTTP referrers and those APIs.
3. Connect the generated picker to the real UI and persistence path. Preserve place ID plus longitude and latitude and confirm coordinate order.
4. Test live autocomplete, keyboard interaction, selection, map/marker synchronization, loading, failure, empty results, unauthorized origin, and project checks.

The integration is complete only when the live product path works on an allowed origin with a restricted key. A generated component, key placeholder, or blank map is not completion.

Authoritative sources:

- Maps JavaScript API loader: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
- Place autocomplete element: https://developers.google.com/maps/documentation/javascript/examples/rgm-autocomplete
- API key security: https://developers.google.com/maps/api-security-best-practices
- Routes API: https://developers.google.com/maps/documentation/routes
- Route Matrix: https://developers.google.com/maps/documentation/routes/compute_route_matrix

## Compose the picker

```bash
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs compose google-maps --target . --install
node .agents/skills/compose-typescript-integrations/scripts/scaffold.mjs setup google-maps --target .
```

The component loads Google Maps through the official loader, uses the current Places autocomplete element and an advanced marker, and returns `{ placeId, name, address, longitude, latitude }`. It defaults to Ghana-biased UI settings, which the host app may override.

For Uber-style ETA, keep place selection separate from routing. Send origin, destination, travel mode, and departure time to Routes API or a route matrix from a trusted application boundary. Display the provider duration as an estimate, preserve traffic-aware uncertainty, and never promise an arrival time as exact.
