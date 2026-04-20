// API client for backend communication

class API {
  constructor(baseUrl = '/api') {
    this.baseUrl = baseUrl;
  }

  async request(method, endpoint, body = null, token = null) {
    const url = this.baseUrl + endpoint;
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  // Items
  getItems(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.venue) params.append('venue', filters.venue);
    if (filters.equipment) params.append('equipment', filters.equipment);

    const query = params.toString();
    return this.request('GET', `/items${query ? '?' + query : ''}`);
  }

  getItem(id) {
    return this.request('GET', `/items/${id}`);
  }

  getItemHistory(id) {
    return this.request('GET', `/items/${id}/history`);
  }

  // Movements
  checkout(itemIds, crewMemberId, fromVenueId, toVenueId, notes = '') {
    return this.request('POST', '/movements/checkout', {
      item_ids: itemIds,
      crew_member_id: crewMemberId,
      from_venue_id: fromVenueId,
      to_venue_id: toVenueId,
      notes,
    });
  }

  // Return items to their home venues
  returnItems(itemIds, crewMemberId, notes = '') {
    return this.request('POST', '/movements/return', {
      item_ids: itemIds,
      crew_member_id: crewMemberId,
      notes,
    });
  }

  // Move items to a different venue (not their home base)
  moveItems(itemIds, crewMemberId, toVenueId, notes = '') {
    return this.request('POST', '/movements/move', {
      item_ids: itemIds,
      crew_member_id: crewMemberId,
      to_venue_id: toVenueId,
      notes,
    });
  }

  getMovements(filters = {}) {
    const params = new URLSearchParams();
    if (filters.crew)      params.append('crew_member_id', filters.crew);
    if (filters.item)      params.append('item_id', filters.item);
    if (filters.type)      params.append('type', filters.type);
    if (filters.from_date) params.append('from_date', filters.from_date);
    if (filters.to_date)   params.append('to_date', filters.to_date);

    const query = params.toString();
    return this.request('GET', `/movements${query ? '?' + query : ''}`);
  }

  // Alerts
  getUnreturnedItems(days = 5) {
    return this.request('GET', `/alerts/unreturned?days=${days}`);
  }

  // Admin password
  changeAdminPassword(newPassword, token) {
    return this.request('PUT', '/config/password', { new_password: newPassword }, token);
  }

  // Config - Venues
  getVenues() {
    return this.request('GET', '/config/venues');
  }

  createVenue(name, description = '', token) {
    return this.request('POST', '/config/venues', { name, description }, token);
  }

  updateVenue(id, updates, token) {
    return this.request('PUT', `/config/venues/${id}`, updates, token);
  }

  deleteVenue(id, token) {
    return this.request('DELETE', `/config/venues/${id}`, null, token);
  }

  // Config - Crew
  getCrewMembers() {
    return this.request('GET', '/config/crew');
  }

  createCrewMember(name, role = 'crew', token) {
    return this.request('POST', '/config/crew', { name, role }, token);
  }

  updateCrewMember(id, updates, token) {
    return this.request('PUT', `/config/crew/${id}`, updates, token);
  }

  deleteCrewMember(id, token) {
    return this.request('DELETE', `/config/crew/${id}`, null, token);
  }

  clearAllHistory(token) {
    return this.request('DELETE', '/config/history', null, token);
  }
}

const api = new API();
