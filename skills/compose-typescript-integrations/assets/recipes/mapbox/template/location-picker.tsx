"use client";

import { SearchBox } from "@mapbox/search-js-react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef, useState, type ComponentProps } from "react";

type RetrieveResponse = Parameters<
  NonNullable<ComponentProps<typeof SearchBox>["onRetrieve"]>
>[0];

export type MapboxLocation = {
  mapboxId: string | undefined;
  name: string;
  address: string | undefined;
  longitude: number;
  latitude: number;
};

export function MapboxLocationPicker({
  onSelect,
  country = "gh",
  initialCenter = [-0.187, 5.6037],
  initialZoom = 11,
  className,
}: {
  onSelect(location: MapboxLocation): void;
  country?: string;
  initialCenter?: [longitude: number, latitude: number];
  initialZoom?: number;
  className?: string;
}) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [value, setValue] = useState("");
  const [initialLongitude, initialLatitude] = initialCenter;

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      accessToken: token,
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [initialLongitude, initialLatitude],
      zoom: initialZoom,
    });
    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    mapRef.current = map;
    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [initialLatitude, initialLongitude, initialZoom, token]);

  if (!token) {
    return <p role="alert">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is not configured.</p>;
  }

  const handleRetrieve = (response: RetrieveResponse) => {
    const feature = response.features[0];
    if (!feature || feature.geometry.type !== "Point") return;
    const [longitude, latitude] = feature.geometry.coordinates;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;
    const { name, full_address: fullAddress, mapbox_id: mapboxId } = feature.properties;
    markerRef.current?.remove();
    markerRef.current = new mapboxgl.Marker()
      .setLngLat([longitude, latitude])
      .addTo(mapRef.current!);
    mapRef.current?.flyTo({ center: [longitude, latitude], zoom: 15 });
    onSelect({
      mapboxId: mapboxId || undefined,
      name: name || fullAddress || "Selected place",
      address: fullAddress || undefined,
      longitude,
      latitude,
    });
  };

  return (
    <section className={className} aria-label="Choose a location">
      <SearchBox
        accessToken={token}
        value={value}
        onChange={setValue}
        onRetrieve={handleRetrieve}
        options={{ country, language: "en", proximity: [initialLongitude, initialLatitude] }}
        placeholder="Search for a place"
      />
      <div ref={containerRef} style={{ minHeight: 360, width: "100%" }} />
    </section>
  );
}
