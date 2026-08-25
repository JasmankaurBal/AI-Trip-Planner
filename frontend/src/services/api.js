import { api } from "../api/client";

// ---- Auth ----
export const authApi = {
  register: (d) => api.post("/auth/register", d).then((r) => r.data),
  login: (d) => api.post("/auth/login", d).then((r) => r.data),
  me: () => api.get("/auth/me").then((r) => r.data),
  logout: () => api.post("/auth/logout").then((r) => r.data),
  forgot: (email) => api.post("/auth/forgot-password", { email }).then((r) => r.data),
  reset: (token, password) => api.post("/auth/reset-password", { token, password }).then((r) => r.data),
};

// ---- Trips ----
export const tripsApi = {
  list: (params) => api.get("/trips", { params }).then((r) => r.data),
  get: (id) => api.get(`/trips/${id}`).then((r) => r.data),
  create: (d) => api.post("/trips", d).then((r) => r.data),
  update: (id, d) => api.put(`/trips/${id}`, d).then((r) => r.data),
  remove: (id) => api.delete(`/trips/${id}`).then((r) => r.data),
  generate: (id) => api.post(`/trips/${id}/generate`).then((r) => r.data),
  optimize: (id) => api.post(`/trips/${id}/optimize`).then((r) => r.data),
  budget: (id) => api.get(`/trips/${id}/budget`).then((r) => r.data),
  updateBudget: (id, d) => api.put(`/trips/${id}/budget`, d).then((r) => r.data),
  memories: (id) => api.get(`/trips/${id}/memories`).then((r) => r.data),
  addMemory: (id, d) => api.post(`/trips/${id}/memories`, d).then((r) => r.data),
  // AI-power
  aiEdit: (id, instruction) => api.post(`/trips/${id}/ai-edit`, { instruction }).then((r) => r.data),
  daySummary: (id, index) => api.get(`/trips/${id}/day/${index}/summary`).then((r) => r.data),
  hotels: (id, style = "any") => api.get(`/trips/${id}/hotels`, { params: { style } }).then((r) => r.data),
  selectHotel: (id, hotel) => api.post(`/trips/${id}/hotel`, hotel).then((r) => r.data),
  optimizeRoute: (id, dayIndex) => api.post(`/trips/${id}/optimize-route`, null, { params: { day_index: dayIndex } }).then((r) => r.data),
  flights: (id, origin) => api.get(`/trips/${id}/flights`, { params: { origin } }).then((r) => r.data),
  share: (id) => api.post(`/trips/${id}/share`).then((r) => r.data),
};

// ---- Public (share links, no auth) ----
export const publicApi = {
  trip: (token) => api.get(`/public/trips/${token}`).then((r) => r.data),
};

// ---- Explore (public / guest) ----
export const exploreApi = {
  suggest: (q) => api.get("/explore/suggest", { params: { q } }).then((r) => r.data),
  destinations: (category) => api.get("/explore/destinations", { params: { category } }).then((r) => r.data),
  hotels: (params) => api.get("/explore/hotels", { params }).then((r) => r.data),
  thingsToDo: (destination, category) => api.get("/explore/things-to-do", { params: { destination, category } }).then((r) => r.data),
  flights: (params) => api.get("/explore/flights", { params }).then((r) => r.data),
  generate: (d) => api.post("/explore/generate", d).then((r) => r.data),
};

// ---- Activities ----
export const activitiesApi = {
  list: (tripId) => api.get(`/trips/${tripId}/activities`).then((r) => r.data),
  create: (tripId, d) => api.post(`/trips/${tripId}/activities`, d).then((r) => r.data),
  update: (tripId, id, d) => api.put(`/trips/${tripId}/activities/${id}`, d).then((r) => r.data),
  remove: (tripId, id) => api.delete(`/trips/${tripId}/activities/${id}`).then((r) => r.data),
  reorder: (tripId, d) => api.post(`/trips/${tripId}/activities/reorder`, d).then((r) => r.data),
};

// ---- Packing ----
export const packingApi = {
  list: (tripId) => api.get(`/trips/${tripId}/packing`).then((r) => r.data),
  add: (tripId, d) => api.post(`/trips/${tripId}/packing`, d).then((r) => r.data),
  update: (tripId, id, d) => api.put(`/trips/${tripId}/packing/${id}`, d).then((r) => r.data),
  remove: (tripId, id) => api.delete(`/trips/${tripId}/packing/${id}`).then((r) => r.data),
  generate: (tripId) => api.post(`/trips/${tripId}/packing/generate`).then((r) => r.data),
};

// ---- Expenses ----
export const expensesApi = {
  list: (tripId) => api.get(`/trips/${tripId}/expenses`).then((r) => r.data),
  add: (tripId, d) => api.post(`/trips/${tripId}/expenses`, d).then((r) => r.data),
  update: (tripId, id, d) => api.put(`/trips/${tripId}/expenses/${id}`, d).then((r) => r.data),
  remove: (tripId, id) => api.delete(`/trips/${tripId}/expenses/${id}`).then((r) => r.data),
  settlements: (tripId) => api.get(`/trips/${tripId}/settlements`).then((r) => r.data),
};

// ---- Collaboration ----
export const collabApi = {
  members: (tripId) => api.get(`/trips/${tripId}/members`).then((r) => r.data),
  invite: (tripId, email) => api.post(`/trips/${tripId}/invite`, { email }).then((r) => r.data),
  removeMember: (tripId, mid) => api.delete(`/trips/${tripId}/members/${mid}`).then((r) => r.data),
  suggestions: (tripId) => api.get(`/trips/${tripId}/suggestions`).then((r) => r.data),
  addSuggestion: (tripId, text) => api.post(`/trips/${tripId}/suggestions`, { text }).then((r) => r.data),
  vote: (tripId, sid) => api.post(`/trips/${tripId}/suggestions/${sid}/vote`).then((r) => r.data),
};

// ---- Data / services ----
export const dataApi = {
  weather: (params) => api.get("/weather", { params }).then((r) => r.data),
  geocode: (q) => api.get("/geocode", { params: { q } }).then((r) => r.data),
  places: (params) => api.get("/places/search", { params }).then((r) => r.data),
  discovery: (category) => api.get("/discovery", { params: { category } }).then((r) => r.data),
  emergency: (params) => api.get("/emergency", { params }).then((r) => r.data),
  whatNow: (d) => api.post("/what-now", d).then((r) => r.data),
  convert: (amount, from, to) => api.get("/currency/convert", { params: { amount, from, to } }).then((r) => r.data),
  savedPlaces: () => api.get("/saved-places").then((r) => r.data),
  savePlace: (d) => api.post("/saved-places", d).then((r) => r.data),
  removeSavedPlace: (id) => api.delete(`/saved-places/${id}`).then((r) => r.data),
};

// ---- Documents ----
export const documentsApi = {
  list: (tripId) => api.get("/documents", { params: tripId ? { trip_id: tripId } : {} }).then((r) => r.data),
  create: (d) => api.post("/documents", d).then((r) => r.data),
  remove: (id) => api.delete(`/documents/${id}`).then((r) => r.data),
};

// ---- Chat ----
export const chatApi = {
  list: (tripId) => api.get("/chat", { params: tripId ? { trip_id: tripId } : {} }).then((r) => r.data),
  get: (id) => api.get(`/chat/${id}`).then((r) => r.data),
  remove: (id) => api.delete(`/chat/${id}`).then((r) => r.data),
};

// ---- Notifications ----
export const notifApi = {
  list: () => api.get("/notifications").then((r) => r.data),
  read: (id) => api.post(`/notifications/${id}/read`).then((r) => r.data),
  readAll: () => api.post("/notifications/read-all").then((r) => r.data),
};
