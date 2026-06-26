import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Branch } from '../../types';
import { resolveBranchCoords } from '../../lib/branchMapCoords';

type BranchLocationsMapProps = {
  branches: Branch[];
  selectedId: number | null;
  onSelect: (branchId: number) => void;
};

const MAP_TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

function mapPadding() {
  if (typeof window === 'undefined') return [56, 56] as L.PointExpression;
  const w = window.innerWidth;
  if (w < 640) return [36, 28] as L.PointExpression;
  if (w < 1024) return [44, 40] as L.PointExpression;
  return [56, 56] as L.PointExpression;
}

function mapMaxZoom() {
  if (typeof window === 'undefined') return 11;
  return window.innerWidth < 640 ? 10 : 11;
}
function pinIcon(active: boolean) {
  const size = typeof window !== 'undefined' && window.innerWidth < 640 ? 30 : 36;
  const height = typeof window !== 'undefined' && window.innerWidth < 640 ? 38 : 46;
  const fill = active ? '#f97316' : '#334155';
  const ring = active ? '#fb923c' : '#64748b';

  return L.divIcon({
    className: 'branch-map-marker',
    html: `
      <div class="branch-map-pin ${active ? 'branch-map-pin--active' : ''}" aria-hidden="true">
        <svg width="${size}" height="${height}" viewBox="0 0 36 46" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="18" cy="44" rx="8" ry="2.5" fill="rgb(0 0 0 / 18%)"/>
          <path d="M18 0C9.716 0 3 6.716 3 15c0 10.5 15 29 15 29s15-18.5 15-29C33 6.716 26.284 0 18 0z" fill="${fill}" stroke="${ring}" stroke-width="1.5"/>
          <circle cx="18" cy="15" r="6.5" fill="white"/>
          <circle cx="18" cy="15" r="3.5" fill="${fill}"/>
        </svg>
      </div>
    `,
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height + 6],
  });
}

export function BranchLocationsMap({ branches, selectedId, onSelect }: BranchLocationsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const [mapReady, setMapReady] = useState(false);

  onSelectRef.current = onSelect;

  const mappable = useMemo(
    () =>
      branches
        .map((branch) => ({ branch, coords: resolveBranchCoords(branch) }))
        .filter((entry): entry is { branch: Branch; coords: [number, number] } => entry.coords !== null),
    [branches],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
      tap: true,
      zoomControl: false,
      attributionControl: false,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer(MAP_TILES, {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => {
      map.invalidateSize();
      setMapReady(true);
    });

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          map.invalidateSize();
        })
      : null;
    ro?.observe(containerRef.current);

    return () => {
      ro?.disconnect();
      setMapReady(false);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  const syncMarkers = useCallback(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (mappable.length === 0) return;

    const bounds = L.latLngBounds([]);

    mappable.forEach(({ branch, coords }) => {
      const active = selectedId === branch.id;
      const marker = L.marker(coords, {
        icon: pinIcon(active),
        title: branch.name,
        zIndexOffset: active ? 1000 : 0,
      })
        .bindPopup(`<strong>${branch.name}</strong><br>${branch.location}`)
        .on('click', () => onSelectRef.current(branch.id));

      layer.addLayer(marker);
      bounds.extend(coords);
    });

    requestAnimationFrame(() => {
      map.invalidateSize();
      if (mappable.length === 1) {
        map.setView(mappable[0].coords, window.innerWidth < 640 ? 12 : 13);
      } else {
        map.fitBounds(bounds, { padding: mapPadding(), maxZoom: mapMaxZoom() });
      }
    });
  }, [mappable, selectedId]);

  useEffect(() => {
    if (!mapReady) return;
    syncMarkers();
  }, [mapReady, syncMarkers]);

  useEffect(() => {
    if (!mapReady) return;
    const layer = layerRef.current;
    if (!layer) return;

    let index = 0;
    layer.eachLayer((markerLayer) => {
      const entry = mappable[index];
      if (!entry || !(markerLayer instanceof L.Marker)) return;
      const active = selectedId === entry.branch.id;
      markerLayer.setIcon(pinIcon(active));
      markerLayer.setZIndexOffset(active ? 1000 : 0);
      if (active) markerLayer.openPopup();
      else markerLayer.closePopup();
      index += 1;
    });
  }, [selectedId, mappable, mapReady]);

  if (mappable.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border-light bg-elevated px-6 text-center text-sm text-ink-muted lg:h-[420px]">
        Map coordinates are not set for these branches yet.
      </div>
    );
  }

  return (
    <div className="branch-map-shell overflow-hidden rounded-[var(--radius-card)] border border-border-light shadow-[var(--shadow-elevated)]">
      <div
        ref={containerRef}
        className="branch-map-canvas z-0 h-[min(62vw,360px)] min-h-[240px] w-full sm:min-h-[300px] sm:h-[340px] lg:h-[420px]"
        aria-label="Branch locations map"
      />
      <p className="sr-only">Map data © OpenStreetMap contributors · © CARTO</p>
    </div>
  );
}
