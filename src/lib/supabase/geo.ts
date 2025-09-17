// src/lib/supabase/geo.ts
import { supabase } from './client';
import * as Location from 'expo-location';

type Coords = { lat: number; lng: number; ts: number };
let last: Coords | null = null;

/** Tek sefer alıp kısa süre cache'ler. */
export async function getCoordsFresh(maxAgeMs = 30_000): Promise<{ lat: number; lng: number }> {
  if (last && Date.now() - last.ts < maxAgeMs) return { lat: last.lat, lng: last.lng };
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') throw new Error('location_permission_denied');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  last = { lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() };
  return { lat: last.lat, lng: last.lng };
}

/** PostGIS RPC ile metre cinsinden uzaklık. */
export async function distanceToVenueMeters(venueId: string, coords?: { lat: number; lng: number }) {
  const c = coords ?? (await getCoordsFresh());
  const { data, error } = await supabase.rpc('distance_to_venue', {
    p_venue_id: venueId,
    p_lat: c.lat,
    p_lng: c.lng,
  });
  if (error) throw error;
  return typeof data === 'number' ? data : null;
}