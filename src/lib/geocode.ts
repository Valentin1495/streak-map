const REVERSE_GEOCODE_ENDPOINT = 'https://szegjcutxoiwwwegfkfk.functions.supabase.co/reverse-geocode';

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  });

  try {
    const response = await fetch(`${REVERSE_GEOCODE_ENDPOINT}?${params}`);
    if (!response.ok) {
      console.warn('Reverse geocoding failed', {
        status: response.status,
        lat,
        lng,
      });
      return formatCoords(lat, lng);
    }

    type GeoResponse = { placeName?: string };
    const json = (await response.json()) as GeoResponse;
    if (json.placeName != null && json.placeName.trim() !== '') {
      return json.placeName;
    }

    console.warn('Reverse geocoding returned no place name', { lat, lng });
    return formatCoords(lat, lng);
  } catch (e) {
    console.warn('Reverse geocoding request failed', e);
    return formatCoords(lat, lng);
  }
}
