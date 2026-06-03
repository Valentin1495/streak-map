// @ts-nocheck
const ENDPOINT = 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

type GeoResult = {
  name: string;
  region?: {
    area1?: { name?: string };
    area2?: { name?: string };
    area3?: { name?: string };
  };
  land?: {
    name?: string;
    number1?: string;
  };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const apiKeyId = Deno.env.get('NCP_API_KEY_ID') ?? '';
  const apiKey = Deno.env.get('NCP_API_KEY') ?? '';

  if (!apiKeyId || !apiKey) {
    return json({ error: 'NCP API keys are not configured' }, 500);
  }

  const url = new URL(request.url);
  const lat = Number(url.searchParams.get('lat'));
  const lng = Number(url.searchParams.get('lng'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return json({ error: 'Invalid coordinates' }, 400);
  }

  const params = new URLSearchParams({
    coords: `${lng},${lat}`,
    sourcecrs: 'EPSG:4326',
    targetcrs: 'EPSG:4326',
    orders: 'roadaddr,addr,admcode,legalcode',
    output: 'json',
  });

  try {
    const response = await fetch(`${ENDPOINT}?${params}`, {
      headers: {
        'x-ncp-apigw-api-key-id': apiKeyId,
        'x-ncp-apigw-api-key': apiKey,
      },
    });

    if (!response.ok) {
      return json({ error: 'Reverse geocoding failed' }, response.status);
    }

    const payload = await response.json();
    const results = (payload.results ?? []) as GeoResult[];
    const placeName = formatPlaceName(results);

    return json({ placeName, results });
  } catch {
    return json({ error: 'Reverse geocoding failed' }, 500);
  }
});

function formatPlaceName(results: GeoResult[]): string {
  const roadaddr = results.find((result) => result.name === 'roadaddr');
  if (roadaddr?.land?.name && roadaddr.land.number1) {
    const area = [roadaddr.region?.area1?.name, roadaddr.region?.area2?.name].filter(Boolean).join(' ');
    return `${area} ${roadaddr.land.name} ${roadaddr.land.number1}`.trim();
  }

  const addr = results.find((result) => result.name === 'addr');
  if (addr?.land?.number1) {
    const area = [addr.region?.area1?.name, addr.region?.area2?.name, addr.region?.area3?.name]
      .filter(Boolean)
      .join(' ');
    return `${area} ${addr.land.number1}`.trim();
  }

  const admcode = results.find((result) => result.name === 'admcode');
  const admArea = formatRegion(admcode);
  if (admArea) {
    return admArea;
  }

  const legalcode = results.find((result) => result.name === 'legalcode');
  return formatRegion(legalcode);
}

function formatRegion(result: GeoResult | undefined): string {
  return [result?.region?.area1?.name, result?.region?.area2?.name, result?.region?.area3?.name]
    .filter(Boolean)
    .join(' ');
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
