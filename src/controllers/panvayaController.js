/**
 * Panvaya Logistics Ocean Tracking & Maritime Intelligence Controller
 * Standardized DCSA Track & Trace, Vessel AIS, Schedules, and Port Congestion
 */

const PANVAYA_BASE_URL = 'https://api.panvaya.com/api/v1';

function getApiKey(req) {
  return req.headers['x-api-key'] || process.env.PANVAYA_API_KEY || 'pv_live_0AXCMLfCcPCHAsJMx4uPVmPZEPTH4oS4';
}

async function panvayaFetch(endpoint, options = {}, req) {
  const apiKey = getApiKey(req);
  const url = `${PANVAYA_BASE_URL}${endpoint}`;
  
  const headers = {
    'X-API-Key': apiKey,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    return { status: response.status, ok: response.ok, data };
  } else {
    const text = await response.text();
    return { status: response.status, ok: response.ok, data: text };
  }
}

// 1. Sea Tracking (POST /track/ocean)
exports.trackOcean = async (req, res) => {
  try {
    const result = await panvayaFetch('/track/ocean', {
      method: 'POST',
      body: JSON.stringify(req.body)
    }, req);

    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya trackOcean] Error:', err);
    return res.status(500).json({ error: 'Internal tracking proxy error', detail: err.message });
  }
};

// 2. Ocean Carriers (GET /carriers)
exports.getCarriers = async (req, res) => {
  try {
    const result = await panvayaFetch('/carriers', { method: 'GET' }, req);
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya getCarriers] Error:', err);
    return res.status(500).json({ error: 'Carriers proxy error', detail: err.message });
  }
};

// 3. Sailing Schedules (POST /schedules/search)
exports.getSchedules = async (req, res) => {
  try {
    const result = await panvayaFetch('/schedules/search', {
      method: 'POST',
      body: JSON.stringify(req.body)
    }, req);

    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya getSchedules] Error:', err);
    return res.status(500).json({ error: 'Schedules proxy error', detail: err.message });
  }
};

// 4. Vessel Details (GET /vessels)
exports.getVesselDetails = async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const result = await panvayaFetch(`/vessels?${query}`, { method: 'GET' }, req);
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya getVesselDetails] Error:', err);
    return res.status(500).json({ error: 'Vessel details proxy error', detail: err.message });
  }
};

// 5. Vessel Live AIS Position (GET /vessels/position)
exports.getVesselPosition = async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const result = await panvayaFetch(`/vessels/position?${query}`, { method: 'GET' }, req);
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya getVesselPosition] Error:', err);
    return res.status(500).json({ error: 'Vessel AIS proxy error', detail: err.message });
  }
};

// 6. Port Congestion (GET /port-congestion)
exports.getPortCongestion = async (req, res) => {
  try {
    const query = new URLSearchParams(req.query).toString();
    const result = await panvayaFetch(`/port-congestion?${query}`, { method: 'GET' }, req);
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya getPortCongestion] Error:', err);
    return res.status(500).json({ error: 'Port congestion proxy error', detail: err.message });
  }
};

// 7. Carbon Calculator (POST /carbon/calculate)
exports.calculateCarbon = async (req, res) => {
  try {
    const result = await panvayaFetch('/carbon/calculate', {
      method: 'POST',
      body: JSON.stringify(req.body)
    }, req);

    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya calculateCarbon] Error:', err);
    return res.status(500).json({ error: 'Carbon calculator proxy error', detail: err.message });
  }
};

// 8. Distance & Time (POST /distance-time/calculate)
exports.calculateDistanceTime = async (req, res) => {
  try {
    const result = await panvayaFetch('/distance-time/calculate', {
      method: 'POST',
      body: JSON.stringify(req.body)
    }, req);

    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya calculateDistanceTime] Error:', err);
    return res.status(500).json({ error: 'Distance & Time proxy error', detail: err.message });
  }
};

// 9. API Credit Usage (GET /usage)
exports.getUsage = async (req, res) => {
  try {
    const result = await panvayaFetch('/usage', { method: 'GET' }, req);
    return res.status(result.status).json(result.data);
  } catch (err) {
    console.error('[Panvaya getUsage] Error:', err);
    return res.status(500).json({ error: 'API usage proxy error', detail: err.message });
  }
};
