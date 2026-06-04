<script setup>
import { ref, computed, watch } from 'vue';
import { Send, RefreshCw, Copy, Check, Trash2, Pencil, Eye, Terminal } from 'lucide-vue-next';
import TargetManager from './TargetManager.vue';

import { airlines } from '../data/airlines.js';
import { airports } from '../data/airports.js';
import { hotels } from '../data/hotels.js';
import { carCompanies, carTypes } from '../data/cars.js';
import { railOperators, railStations } from '../data/rail.js';
import { rideshareProviders, rideshareLocations } from '../data/rideshare.js';
import { tmcSources } from '../data/tmc-sources.js';
import { travelerNames } from '../data/travelers.js';

// --- Targets (localStorage) ---
const STORAGE_KEY = 'webhook-tester-targets';

function loadTargets() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTargetsToStorage(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

const targets = ref(loadTargets());
const activeTargetId = ref(targets.value[0]?.id ?? '');

const activeTarget = computed(() => targets.value.find(t => t.id === activeTargetId.value) || null);

function handleSaveTarget(target) {
  const idx = targets.value.findIndex(t => t.id === target.id);
  if (idx >= 0) {
    targets.value[idx] = target;
  } else {
    targets.value.push(target);
  }
  saveTargetsToStorage(targets.value);
  activeTargetId.value = target.id;
  // Sync overrides
  webhookUrlOverride.value = target.url;
  hmacSecretOverride.value = target.secret;
}

function handleDeleteTarget(id) {
  targets.value = targets.value.filter(t => t.id !== id);
  saveTargetsToStorage(targets.value);
  activeTargetId.value = targets.value[0]?.id ?? '';
  if (activeTarget.value) {
    webhookUrlOverride.value = activeTarget.value.url;
    hmacSecretOverride.value = activeTarget.value.secret;
  } else {
    webhookUrlOverride.value = '';
    hmacSecretOverride.value = '';
  }
}

// --- State ---
const userAddress = ref('matt.griffin@acmecorp.com');
const forceMultiTraveler = ref(false);
const forceTmc = ref(false);
const payloadText = ref('');
const parseError = ref('');
const sendResults = ref([]);
const sending = ref(false);
const copied = ref(false);
const copiedCurl = ref(false);
const editMode = ref(false);

// Editable webhook URL and HMAC secret (initialized from target)
const webhookUrlOverride = ref(activeTarget.value?.url ?? '');
const hmacSecretOverride = ref(activeTarget.value?.secret ?? '');

// Sync overrides when target changes
watch(activeTargetId, () => {
  if (activeTarget.value) {
    webhookUrlOverride.value = activeTarget.value.url;
    hmacSecretOverride.value = activeTarget.value.secret;
  }
});

// --- Helpers ---
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFlightConfNo() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}
function randNumericConfNo() {
  return Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
}
function futureDate(daysAhead) {
  const d = new Date(); d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split('T')[0];
}
function randTime() {
  const h = randInt(6, 22);
  return `${h.toString().padStart(2, '0')}:${pick(['00', '15', '30', '45'])}`;
}
function randRate(min, max) { return (Math.random() * (max - min) + min).toFixed(2); }

// --- Segment generators ---
function generateFlightSegments(confNo, traveler, departDate) {
  const numLegs = Math.random() < 0.3 ? 2 : 1;
  const segments = [];
  const usedPairs = new Set();
  for (let i = 0; i < numLegs; i++) {
    let origin, dest;
    do { origin = pick(airports); dest = pick(airports); }
    while (origin.code === dest.code || usedPairs.has(`${origin.code}-${dest.code}`));
    usedPairs.add(`${origin.code}-${dest.code}`);
    const airline = pick(airlines);
    const flightNo = pick(airline.flights);
    const depDate = futureDate(parseInt(departDate) + i * randInt(2, 5));
    const depTime = randTime();
    const arrTime = randTime();
    segments.push({
      type: 'Air', status: 'Active', source: airline.code,
      airline: airline.name, iata_code: airline.code, flight_number: flightNo,
      first_name: traveler.first, last_name: traveler.last,
      origin: origin.code, origin_name: `${origin.city} Intl`, origin_city_name: origin.city,
      destination: dest.code, destination_name: `${dest.city} Intl`, destination_city_name: dest.city,
      departure_datetime: `${depDate}T${depTime}:00`, departure_time_zone_id: origin.tz,
      arrival_datetime: `${depDate}T${arrTime}:00`, arrival_time_zone_id: dest.tz,
      confirmation_no: confNo,
      travelers: [{ name: `${traveler.first} ${traveler.last}`, first_name: traveler.first, last_name: traveler.last }],
    });
  }
  return { segments, source: segments[0].source };
}

function generateHotelSegment(confNo, traveler, checkinDaysAhead) {
  const hotel = pick(hotels);
  const nights = randInt(1, 5);
  const rate = randRate(120, 450);
  return {
    segments: [{
      type: 'Hotel', status: 'Active', source: hotel.source,
      first_name: traveler.first, last_name: traveler.last,
      hotel_name: hotel.name, city_name: hotel.city, admin_code: hotel.state, country: 'US',
      checkin_date: futureDate(checkinDaysAhead), checkout_date: futureDate(checkinDaysAhead + nights),
      rate, rate_type: 'nightly', price: (parseFloat(rate) * nights * 1.15).toFixed(2),
      currency: 'USD', number_of_rooms: 1, confirmation_no: confNo,
      travelers: [{ name: `${traveler.first} ${traveler.last}`, first_name: traveler.first, last_name: traveler.last }],
    }],
    source: hotel.source,
  };
}

function generateCarSegment(confNo, traveler, pickupDaysAhead) {
  const company = pick(carCompanies);
  const days = randInt(1, 7);
  const pickupCity = pick(airports);
  const pickupDate = futureDate(pickupDaysAhead);
  const dropoffDate = futureDate(pickupDaysAhead + days);
  return {
    segments: [{
      type: 'Car', status: 'Active', source: company.source,
      car_company: company.name, car_type: pick(carTypes),
      first_name: traveler.first, last_name: traveler.last,
      pickup_datetime: `${pickupDate}T12:00:00`, pickup_time_zone_id: pickupCity.tz,
      pickup_city_name: pickupCity.city, pickup_address1: `${pickupCity.city} Airport`,
      dropoff_datetime: `${dropoffDate}T12:00:00`, dropoff_time_zone_id: pickupCity.tz,
      dropoff_city_name: pickupCity.city, dropoff_address1: `${pickupCity.city} Airport`,
      confirmation_no: confNo,
      travelers: [{ name: `${traveler.first} ${traveler.last}`, first_name: traveler.first, last_name: traveler.last }],
    }],
    source: company.source,
  };
}

function generateActivitySegment(traveler, daysAhead) {
  const provider = pick(rideshareProviders);
  const location = pick(rideshareLocations);
  const pickup = pick(location.pickups);
  const dropoff = pick(location.dropoffs);
  const hour = randInt(6, 22);
  const minute = randInt(0, 59);
  const durationMinutes = randInt(8, 45);
  const price = randRate(12, 65);
  const startDate = futureDate(daysAhead);
  const startPad = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;
  const endHour = hour + Math.floor((minute + durationMinutes) / 60);
  const endMinute = (minute + durationMinutes) % 60;
  const endPad = `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}:00`;

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const d = new Date(startDate);
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dayName = dayNames[d.getDay()];

  return {
    segments: [{
      type: 'Activity',
      status: 'Active',
      source: provider.source,
      first_name: null,
      last_name: null,
      activity_type: 'Transportation',
      activity_name: provider.name,
      start_name: null,
      start_address1: pickup,
      start_address2: null,
      start_city_name: location.city,
      start_admin_code: location.state,
      start_country: 'US',
      start_postal_code: null,
      end_name: null,
      end_address1: dropoff,
      end_address2: null,
      end_city_name: location.city,
      end_admin_code: location.state,
      end_country: 'US',
      end_postal_code: null,
      start_datetime: `${startDate}T${startPad}`,
      start_time_zone_id: 'America/Chicago',
      end_datetime: `${startDate}T${endPad}`,
      end_time_zone_id: 'America/Chicago',
      price: price,
      currency: 'USD',
      confirmation_no: null,
      travelers: [{ name: `${traveler.first}`, first_name: null, last_name: null }],
      price_details: [{ type: 'total', name: 'Total', value: price, units: 'USD' }],
    }],
    source: provider.source,
    subject: `[Business] Your ${dayName} ${timeOfDay} trip with ${provider.name}`,
  };
}

function generateRailSegment(confNo, traveler, departDaysAhead) {
  const operator = pick(railOperators);
  let origin, dest;
  do { origin = pick(railStations); dest = pick(railStations); } while (origin.code === dest.code);
  const depDate = futureDate(departDaysAhead);
  const depTime = randTime();
  const arrTime = randTime();
  return {
    segments: [{
      type: 'Rail', status: 'Active', source: operator.source,
      rail_line: operator.name, train_number: pick(operator.services),
      first_name: traveler.first, last_name: traveler.last,
      origin: origin.code, origin_city_name: origin.city,
      destination: dest.code, destination_city_name: dest.city,
      departure_datetime: `${depDate}T${depTime}:00`, departure_time_zone_id: 'America/Chicago',
      arrival_datetime: `${depDate}T${arrTime}:00`, arrival_time_zone_id: 'America/New_York',
      confirmation_no: confNo,
      travelers: [{ name: `${traveler.first} ${traveler.last}`, first_name: traveler.first, last_name: traveler.last }],
    }],
    source: operator.source,
  };
}

// --- Payload generation ---
function generatePayload() {
  const emailId = `test-${Date.now()}-${randInt(1000, 9999)}`;
  const traveler = pick(travelerNames);
  const daysAhead = randInt(7, 90);
  const compositions = [
    ['flight'], ['hotel'], ['car'], ['rail'], ['activity'],
    ['flight', 'hotel'], ['flight', 'hotel', 'car'], ['flight', 'car'],
    ['rail', 'hotel'],
  ];
  const composition = pick(compositions);
  let allSegments = [], primarySource = '', subject = '';
  const useTmc = forceTmc.value || (!forceTmc.value && Math.random() < 0.15);
  const overrideSource = useTmc && tmcSources.length ? pick(tmcSources) : null;

  for (const type of composition) {
    let result;
    if (type === 'activity') {
      result = generateActivitySegment(traveler, daysAhead);
      if (!subject) subject = result.subject;
    } else {
      const confNo = (type === 'flight' || type === 'rail') ? randFlightConfNo() : randNumericConfNo();
      if (type === 'flight') {
        result = generateFlightSegments(confNo, traveler, daysAhead);
        if (!subject) { const s = result.segments[0]; subject = `Your trip confirmation (${s.origin} - ${s.destination})`; }
      } else if (type === 'hotel') {
        result = generateHotelSegment(confNo, traveler, daysAhead);
        if (!subject) subject = `Reservation Confirmation #${confNo} for ${result.segments[0].hotel_name}`;
      } else if (type === 'rail') {
        result = generateRailSegment(confNo, traveler, daysAhead);
        if (!subject) subject = `${result.segments[0].rail_line} Train Confirmation - ${confNo}`;
      } else {
        result = generateCarSegment(confNo, traveler, daysAhead);
        if (!subject) subject = `${result.segments[0].car_company} Car Rental Confirmation - ${confNo}`;
      }
    }
    allSegments.push(...result.segments);
    if (!primarySource) primarySource = result.source;
  }

  // Add a second traveler to each segment if multi-traveler is checked
  if (forceMultiTraveler.value) {
    let secondTraveler;
    do { secondTraveler = pick(travelerNames); } while (secondTraveler.first === traveler.first && secondTraveler.last === traveler.last);
    for (const seg of allSegments) {
      if (seg.travelers && Array.isArray(seg.travelers)) {
        seg.travelers.push({
          name: `${secondTraveler.first} ${secondTraveler.last}`,
          first_name: secondTraveler.first,
          last_name: secondTraveler.last,
        });
      }
    }
  }

  const payload = {
    id: emailId, type: 'email.updated', resource_id: emailId, created: new Date().toISOString(),
    data: { object: {
      id: emailId, mailbox_id: '977639910700152835', mailbox_type: 'Developer', status: 'Processed',
      source: overrideSource || primarySource, class: '1',
      user_address: userAddress.value, from_address: userAddress.value,
      subject, created: new Date().toISOString(), modified: new Date().toISOString(), metadata: null,
      segments: allSegments,
    }},
  };

  payloadText.value = JSON.stringify(payload, null, 2);
  parseError.value = '';
  editMode.value = false;
}

function getParsedPayload() {
  try {
    const parsed = JSON.parse(payloadText.value);
    parseError.value = '';
    return parsed;
  } catch (e) {
    parseError.value = `Invalid JSON: ${e.message}`;
    return null;
  }
}

async function sendPayload() {
  const payload = getParsedPayload();
  if (!payload || !webhookUrlOverride.value) return;
  sending.value = true;

  const body = JSON.stringify(payload);
  const targetUrl = webhookUrlOverride.value;
  const secret = hmacSecretOverride.value;
  const targetName = activeTarget.value?.name ?? 'Custom';

  try {
    const headers = { 'Content-Type': 'application/json' };

    if (secret) {
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
      headers['x-traxo-signature'] = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    headers['x-target-url'] = targetUrl;
    const res = await fetch('/api/proxy', { method: 'POST', headers, body });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    sendResults.value.unshift({
      time: new Date().toLocaleTimeString(),
      status: res.status,
      response: data,
      instance: targetName,
      target: targetUrl,
      source: payload.data?.object?.source ?? '-',
      segmentTypes: (payload.data?.object?.segments ?? []).map(s => s.type).join(', ') || '-',
      subject: payload.data?.object?.subject ?? '-',
      userAddress: payload.data?.object?.user_address ?? '-',
    });
  } catch (e) {
    sendResults.value.unshift({
      time: new Date().toLocaleTimeString(),
      status: 'error',
      response: { error: e.message },
      instance: targetName,
      target: targetUrl,
      source: '-', segmentTypes: '-', subject: '-',
      userAddress: payload.data?.object?.user_address ?? userAddress.value,
    });
  } finally {
    sending.value = false;
  }
}

async function generateAndSend() {
  generatePayload();
  await sendPayload();
}

async function copyPayload() {
  if (!payloadText.value) return;
  await navigator.clipboard.writeText(payloadText.value);
  copied.value = true;
  setTimeout(() => copied.value = false, 2000);
}

async function copyCurl() {
  if (!payloadText.value || !webhookUrlOverride.value) return;

  const body = payloadText.value;
  const url = webhookUrlOverride.value;
  const secret = hmacSecretOverride.value;

  let hmacHeader = '';
  if (secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hexSig = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    hmacHeader = ` \\\n  -H "x-traxo-signature: ${hexSig}"`;
  }

  const escapedBody = body.replace(/'/g, "'\\''");
  const curl = `curl -s -X POST '${url}' \\\n  -H "Content-Type: application/json"${hmacHeader} \\\n  -d '${escapedBody}'`;

  await navigator.clipboard.writeText(curl);
  copiedCurl.value = true;
  setTimeout(() => copiedCurl.value = false, 2000);
}

const segmentSummary = computed(() => {
  try {
    const parsed = JSON.parse(payloadText.value);
    const segs = parsed?.data?.object?.segments ?? [];
    if (!segs.length) return '';
    const types = {};
    segs.forEach(s => { types[s.type] = (types[s.type] || 0) + 1; });
    return Object.entries(types).map(([t, c]) => `${c} ${t}`).join(', ');
  } catch { return ''; }
});

function handleTab(e) {
  const el = e.target;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  payloadText.value = payloadText.value.substring(0, start) + '  ' + payloadText.value.substring(end);
  e.preventDefault();
  requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
}
</script>

<template>
  <div class="min-h-screen bg-gray-950 text-gray-100">
    <div class="mx-auto max-w-6xl px-4 py-8">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold">Webhook Tester</h1>
        <p class="mt-1 text-sm text-gray-400">Generate, edit, and send test webhook payloads</p>
      </div>

      <!-- Controls -->
      <div class="mt-6 rounded-lg border border-gray-800 bg-gray-900 p-4">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-end">
          <!-- Target picker -->
          <TargetManager
            v-model="activeTargetId"
            :targets="targets"
            @save="handleSaveTarget"
            @delete="handleDeleteTarget"
          />

          <!-- Email -->
          <div class="flex-1">
            <label class="block text-xs font-medium text-gray-400 mb-1">User Address (traveler email)</label>
            <input
              v-model="userAddress"
              type="email"
              class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="matt.griffin@acmecorp.com"
            />
          </div>

          <!-- Options -->
          <div class="flex items-end gap-4 pb-1">
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input v-model="forceMultiTraveler" type="checkbox" class="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
              Multi-traveler
            </label>
            <label class="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
              <input v-model="forceTmc" type="checkbox" class="rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0" />
              TMC source
            </label>
          </div>

          <!-- Buttons -->
          <div class="flex gap-2">
            <button
              @click="generatePayload"
              class="inline-flex items-center gap-2 rounded-md border border-gray-700 bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-700 transition-colors"
            >
              <RefreshCw class="h-4 w-4" />
              Generate
            </button>
            <button
              @click="generateAndSend"
              :disabled="sending || !webhookUrlOverride"
              class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Send class="h-4 w-4" />
              {{ sending ? 'Sending...' : 'Generate & Send' }}
            </button>
          </div>
        </div>

        <!-- Webhook URL and HMAC -->
        <div class="mt-4 flex flex-col gap-3 sm:flex-row">
          <div class="flex-1">
            <label class="block text-xs font-medium text-gray-400 mb-1">Webhook URL</label>
            <input
              v-model="webhookUrlOverride"
              type="url"
              class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              placeholder="http://localhost:8000/webhook/..."
            />
          </div>
          <div class="sm:w-72">
            <label class="block text-xs font-medium text-gray-400 mb-1">HMAC Secret <span class="text-gray-600">(leave blank to skip signing)</span></label>
            <input
              v-model="hmacSecretOverride"
              type="text"
              class="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              placeholder="webhook secret"
            />
          </div>
        </div>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <!-- Payload editor -->
        <div class="rounded-lg border border-gray-800 bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <div class="flex items-center gap-3">
              <h2 class="text-sm font-semibold text-gray-300">Payload</h2>
              <span v-if="segmentSummary" class="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs text-gray-400">{{ segmentSummary }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="payloadText"
                @click="editMode = !editMode"
                :class="editMode ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'"
                :title="editMode ? 'Preview' : 'Edit'"
              >
                <Pencil v-if="!editMode" class="h-4 w-4" />
                <Eye v-else class="h-4 w-4" />
              </button>
              <button v-if="payloadText" @click="copyPayload" class="text-gray-500 hover:text-gray-300" title="Copy JSON">
                <Check v-if="copied" class="h-4 w-4 text-green-400" />
                <Copy v-else class="h-4 w-4" />
              </button>
              <button v-if="payloadText" @click="copyCurl" class="text-gray-500 hover:text-gray-300" title="Copy as curl">
                <Check v-if="copiedCurl" class="h-4 w-4 text-green-400" />
                <Terminal v-else class="h-4 w-4" />
              </button>
              <button
                v-if="payloadText"
                @click="sendPayload"
                :disabled="sending || !webhookUrlOverride"
                class="inline-flex items-center gap-1.5 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send class="h-3 w-3" />
                Send
              </button>
            </div>
          </div>

          <!-- Parse error -->
          <div v-if="parseError" class="border-b border-red-900 bg-red-950 px-4 py-2 text-xs text-red-400">
            {{ parseError }}
          </div>

          <div class="relative" style="min-height: 400px;">
            <!-- Edit mode: textarea -->
            <textarea
              v-if="editMode && payloadText"
              v-model="payloadText"
              @keydown.tab="handleTab"
              spellcheck="false"
              class="absolute inset-0 w-full h-full resize-none bg-transparent p-4 font-mono text-xs text-gray-300 leading-relaxed focus:outline-none border-0"
              style="min-height: 400px; tab-size: 2;"
            />
            <!-- Preview mode: formatted -->
            <div v-else class="max-h-[600px] overflow-auto p-4">
              <pre v-if="payloadText" class="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{{ payloadText }}</pre>
              <p v-else class="text-sm text-gray-500 italic">Click Generate to create a payload</p>
            </div>
          </div>
        </div>

        <!-- Send history -->
        <div class="rounded-lg border border-gray-800 bg-gray-900">
          <div class="flex items-center justify-between border-b border-gray-800 px-4 py-3">
            <h2 class="text-sm font-semibold text-gray-300">Send History</h2>
            <button v-if="sendResults.length" @click="sendResults = []" class="text-gray-500 hover:text-gray-300">
              <Trash2 class="h-4 w-4" />
            </button>
          </div>
          <div class="max-h-[600px] overflow-auto">
            <div v-if="sendResults.length === 0" class="p-4">
              <p class="text-sm text-gray-500 italic">No requests sent yet</p>
            </div>
            <div v-for="(result, i) in sendResults" :key="i" class="border-b border-gray-800 p-3 last:border-b-0">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span :class="result.status === 200 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'" class="rounded px-1.5 py-0.5 text-xs font-mono font-bold">
                    {{ result.status }}
                  </span>
                  <span class="text-xs text-gray-500">{{ result.time }}</span>
                  <span class="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-400">{{ result.instance }}</span>
                </div>
                <span class="rounded bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{{ result.segmentTypes }}</span>
              </div>
              <div class="mt-1.5 text-xs text-gray-400 truncate">{{ result.subject }}</div>
              <div v-if="result.target" class="mt-1 text-xs text-gray-600 truncate font-mono">{{ result.target }}</div>
              <div class="mt-1 flex items-center gap-3 text-xs text-gray-500">
                <span>{{ result.userAddress }}</span>
                <span>{{ result.source }}</span>
              </div>
              <div class="mt-1">
                <code class="text-xs text-gray-500">{{ JSON.stringify(result.response) }}</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
