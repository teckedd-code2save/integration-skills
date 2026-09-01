"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

let configuredApiKey: string | undefined;

function configureGoogleMaps(apiKey: string) {
  if (!configuredApiKey) {
    setOptions({ key: apiKey, v: "weekly", language: "en", region: "GH" });
    configuredApiKey = apiKey;
  } else if (configuredApiKey !== apiKey) {
    throw new Error("Google Maps was already configured with a different API key");
  }
}

export type GoogleMapsLocation = {
  placeId: string;
  name: string;
  address: string | undefined;
  longitude: number;
  latitude: number;
};

export function GoogleMapsLocationPicker({
  onSelect,
  country = "gh",
  initialCenter = { longitude: -0.187, latitude: 5.6037 },
  initialZoom = 11,
  className,
}: {
  onSelect(location: GoogleMapsLocation): void;
  country?: string;
  initialCenter?: { longitude: number; latitude: number };
  initialZoom?: number;
  className?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!apiKey || !mapContainerRef.current || !searchContainerRef.current) return;

    let disposed = false;
    let autocomplete: google.maps.places.PlaceAutocompleteElement | undefined;
    let selectHandler: ((event: Event) => void) | undefined;
    const searchContainer = searchContainerRef.current;

    void (async () => {
      try {
        configureGoogleMaps(apiKey);
        const [maps, marker, places] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
          importLibrary("places"),
        ]);
        if (disposed || !mapContainerRef.current) return;

        const center = { lat: initialCenter.latitude, lng: initialCenter.longitude };
        const map = new maps.Map(mapContainerRef.current, {
          center,
          zoom: initialZoom,
          mapId,
          mapTypeControl: false,
        });
        const selectedMarker = new marker.AdvancedMarkerElement({ map, position: center });
        autocomplete = new places.PlaceAutocompleteElement();
        if (country) autocomplete.includedRegionCodes = [country.toUpperCase()];
        searchContainer.replaceChildren(autocomplete);

        selectHandler = (event: Event) => {
          void (async () => {
            const predictionEvent = event as google.maps.places.PlacePredictionSelectEvent;
            const place = predictionEvent.placePrediction.toPlace();
            await place.fetchFields({ fields: ["id", "displayName", "formattedAddress", "location"] });
            if (!place.location || disposed) return;
            const latitude = place.location.lat();
            const longitude = place.location.lng();
            selectedMarker.position = place.location;
            map.panTo(place.location);
            map.setZoom(16);
            onSelect({
              placeId: place.id,
              name: place.displayName || place.formattedAddress || "Selected place",
              address: place.formattedAddress || undefined,
              longitude,
              latitude,
            });
          })().catch((cause: unknown) => {
            if (!disposed) setError(cause instanceof Error ? cause.message : "Place selection failed");
          });
        };
        autocomplete.addEventListener("gmp-select", selectHandler);
      } catch (cause) {
        if (!disposed) setError(cause instanceof Error ? cause.message : "Google Maps failed to load");
      }
    })();

    return () => {
      disposed = true;
      if (autocomplete && selectHandler) autocomplete.removeEventListener("gmp-select", selectHandler);
      searchContainer.replaceChildren();
    };
  }, [apiKey, country, initialCenter.latitude, initialCenter.longitude, initialZoom, mapId, onSelect]);

  if (!apiKey) return <p role="alert">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.</p>;

  return (
    <section className={className} aria-label="Choose a location">
      <div ref={searchContainerRef} />
      {error ? <p role="alert">{error}</p> : null}
      <div ref={mapContainerRef} style={{ minHeight: 360, width: "100%" }} />
    </section>
  );
}
