# Mapbox location and search recipe

Use this recipe when adding a map, address/place search, reverse geocoding, directions, or related location functionality to a TypeScript web application. Compose Mapbox's official skills and tools rather than duplicating their framework patterns.

Authoritative sources:

- Mapbox agent skills: https://docs.mapbox.com/api/guides/mapbox-agent-skills/
- Agent skills repository: https://github.com/mapbox/mapbox-agent-skills
- Mapbox GL JS: https://docs.mapbox.com/mapbox-gl-js/guides/get-started/
- Search APIs: https://docs.mapbox.com/api/search/
- Search Box React component: https://docs.mapbox.com/mapbox-search-js/api/react/search/
- Geocoding API: https://docs.mapbox.com/api/search/geocoding/
- Directions API: https://docs.mapbox.com/api/navigation/directions/
- Access tokens: https://docs.mapbox.com/help/dive-deeper/access-tokens/
- Mapbox MCP server: https://github.com/mapbox/mcp-server
- Mapbox DevKit MCP server: https://github.com/mapbox/mcp-devkit-server
- Mapbox Docs MCP server: https://github.com/mapbox/mcp-docs-server

## Inspect and select only the needed capability

Determine:

- Framework and rendering model, including whether a Next.js component must be client-only.
- Whether the product needs a visible map, interactive place search, address-only geocoding, reverse geocoding, directions, or merely coordinates.
- Target geography and whether results should be restricted or only biased.
- Whether user location is optional, essential, or inappropriate for the feature.
- Expected request volume, mobile behavior, accessibility requirements, and the application's existing design system.

Do not add a map when an address-search field is sufficient. Do not add routing when the user only needs to select and save a place.

## Install Mapbox's maintained knowledge

List available official skills before selecting them:

```bash
npx skills add mapbox/mapbox-agent-skills --list
```

For an ordinary TypeScript web integration, install only the relevant skills, commonly:

```bash
npx skills add mapbox/mapbox-agent-skills --skill mapbox-web-integration-patterns
npx skills add mapbox/mapbox-agent-skills --skill mapbox-search-integration
```

Add navigation, store-locator, performance, security, or accessibility skills only when the request needs them. Use their current instructions for framework lifecycle, package choices, Search Box session handling, map cleanup, rendering performance, and API parameters.

The Mapbox Docs MCP server can provide current documentation without an access token. The hosted Mapbox MCP server can test geocoding, search, routes, and matrices. The DevKit MCP server can manage tokens and styles. Connect one only when it advances the current integration; do not require MCP for the application at runtime unless the product itself needs agent-accessible geospatial tools.

## Lead account and token setup

If the user has no Mapbox account, guide them through https://account.mapbox.com/ and let them complete login, MFA, billing acknowledgement, and other account decisions.

For browser maps and client-side Search JS, use a public token with only the required public scopes and restrict it to the application's development and production URLs. A public Mapbox token is designed to appear in browser requests; URL restrictions and minimal scopes are the protection. Do not use a secret-scope token in client code.

Follow the repository's environment naming convention. Typical names are:

```dotenv
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=
VITE_MAPBOX_ACCESS_TOKEN=
```

Choose the one matching the framework, not both. For server-only API calls, keep the token in an unprefixed server variable such as `MAPBOX_ACCESS_TOKEN`. Never ask the user to paste any secret-scope token into chat.

When the DevKit connector is available and authorized, use it to create or inspect a correctly scoped token. Otherwise guide the user to the token page and have them place the value directly into the project's secret field or deployment environment.

## Compose the product experience

Use `mapbox-gl` only when the interface needs a rendered map. Use Mapbox Search JS or the relevant search API for places and addresses. Preserve Mapbox attribution when required.

For interactive search:

- Debounce input and cancel stale requests.
- Use Mapbox's suggestion/retrieve flow and session-token rules from the official search skill.
- Save the selected feature's stable identifier when useful, display label, longitude, latitude, and any address fields the product actually needs.
- Keep coordinate order as `[longitude, latitude]` in Mapbox and GeoJSON code. Convert explicitly at boundaries that expect latitude first.
- Bias results with proximity when the user has granted location access; provide manual search when they decline.
- Restrict results by country only when the product requires it. For a Ghana-focused product, `country=gh` is appropriate for a Ghana-only inventory or delivery area; otherwise use Ghana/user proximity as a bias so legitimate cross-border searches remain possible.
- Treat search results as candidates. Let the user confirm the chosen place when accuracy matters for deliveries, travel, property, or payments.

For user geolocation, request browser permission in response to a clear user action, explain the benefit in the UI, handle denial without breaking the page, and avoid retaining precise coordinates longer than the product needs.

For routing, select the profile that matches the requested mode: `mapbox/driving`, `mapbox/driving-traffic`, `mapbox/walking`, or `mapbox/cycling`. The Directions API accepts longitude/latitude waypoint pairs and supports up to 25 coordinates for these profiles. Do not promise traffic-aware accuracy where coverage has not been verified for the target area.

## Integrate cleanly

- In React, initialize the map once, retain it in a ref, and remove it during cleanup. Follow the official framework skill rather than recreating lifecycle code here.
- In Next.js, prevent server-side execution of browser-only Mapbox GL code.
- Load Mapbox CSS once at the correct application level.
- Adapt controls, empty states, loading states, errors, typography, and colors to the existing product instead of shipping an unrelated Mapbox demo.
- Use layers rather than large numbers of DOM markers when the dataset grows; install the performance skill when scale is material.
- Do not log access tokens, precise user coordinates, or full sensitive addresses unnecessarily.
- Keep provider responses behind a small application location interface when the domain should not depend directly on Mapbox response shapes.

## Verify

Run the project's typecheck, lint, tests, and build. Then verify the requested behavior, not merely that a map renders:

1. The map or search component loads with the restricted public token on the intended local origin.
2. A known Ghana query returns plausible results and preserves longitude/latitude order.
3. Selecting a suggestion stores and displays the same place.
4. Keyboard navigation, focus, loading, empty, and error states work.
5. Location denial falls back to manual search.
6. A restricted token fails from an unauthorized origin but works on intended development and production origins.
7. If routing was requested, a known route returns the expected profile, distance, duration, and geometry.
8. Network calls are not duplicated on every render and stale searches do not overwrite newer results.

Report which calls were exercised against live Mapbox APIs and which remain mocked. Note any remaining production-domain token restriction, billing, or usage-alert configuration without claiming it is complete.
