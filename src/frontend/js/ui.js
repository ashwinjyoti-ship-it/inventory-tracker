// UI rendering and interactions

class UI {
  showMessage(message, type = 'info') {
    const container = document.querySelector('.container');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.insertBefore(alert, container.firstChild);
    setTimeout(() => alert.remove(), 3000);
  }

  showError(message) { this.showMessage(message, 'error'); }
  showSuccess(message) { this.showMessage(message, 'success'); }

  async loadCrewMembers(selectId) {
    try {
      const data = await api.getCrewMembers();
      const select = document.getElementById(selectId);
      select.innerHTML = '<option value="">-- Select Crew Member --</option>';

      (data.crew || []).forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        select.appendChild(option);
      });
    } catch (error) {
      this.showError('Failed to load crew members');
    }
  }

  async loadVenues(selectId) {
    try {
      const cached = storage.getCache('venues');
      const data = cached || await api.getVenues();

      if (!cached) storage.setCache('venues', data);

      const select = document.getElementById(selectId);
      select.innerHTML = '<option value="">-- Select Venue --</option>';

      (data.venues || []).forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.id;
        option.textContent = venue.name;
        select.appendChild(option);
      });
    } catch (error) {
      this.showError('Failed to load venues');
    }
  }

  // Show all items at the selected venue (available + checked_out) to support multi-hop moves
  async loadCheckoutItems(fromVenueId) {
    try {
      const data = await api.getItems({ venue: fromVenueId });
      const container = document.getElementById('checkout-items');

      if (!data.items || data.items.length === 0) {
        container.innerHTML = '<p class="text-muted">No items at this venue</p>';
        return;
      }

      container.innerHTML = '';

      // Search input
      const searchInput = document.createElement('input');
      searchInput.type = 'search';
      searchInput.placeholder = `Search ${data.items.length} items…`;
      searchInput.autocomplete = 'off';
      searchInput.style.cssText = 'margin-bottom:0.75rem';
      container.appendChild(searchInput);

      // Item list
      const list = document.createElement('div');
      container.appendChild(list);

      const labels = data.items.map(item => {
        const label = document.createElement('label');
        label.className = 'checkbox';
        label.dataset.search = item.equipment_name.toLowerCase();

        const statusBadge = item.status === 'checked_out'
          ? '<span class="badge badge-warning" style="margin-left:auto">In Transit</span>'
          : '';

        label.innerHTML = `
          <input type="checkbox" class="checkout-item" value="${item.id}">
          <span>${item.equipment_name} #${item.item_number}</span>
          ${statusBadge}
        `;
        list.appendChild(label);
        return label;
      });

      searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        labels.forEach(label => {
          const matches = !q || label.dataset.search.includes(q);
          const checked = label.querySelector('input').checked;
          label.style.display = (matches || checked) ? '' : 'none';
        });
      });
    } catch (error) {
      this.showError('Failed to load items');
    }
  }

  // Show all currently checked-out items (filtered by crew member if selected)
  async loadReturnItems(crewMemberId, containerId = 'return-items') {
    try {
      const container = document.getElementById(containerId);

      // Get all checked-out items
      const data = await api.getItems({ status: 'checked_out' });

      if (!data.items || data.items.length === 0) {
        container.innerHTML = '<p class="text-muted">No items currently checked out</p>';
        return;
      }

      // If a crew member is selected, find all items they touched (checkout or move)
      let items = data.items;
      if (crewMemberId) {
        const [checkouts, moves] = await Promise.all([
          api.getMovements({ crew: crewMemberId, type: 'checkout' }),
          api.getMovements({ crew: crewMemberId, type: 'move' }),
        ]);
        const crewItemIds = new Set([
          ...(checkouts.movements || []).map(m => m.item_id),
          ...(moves.movements || []).map(m => m.item_id),
        ]);
        items = items.filter(i => crewItemIds.has(i.id));
      }

      if (items.length === 0) {
        container.innerHTML = '<p class="text-muted">No items checked out by this crew member</p>';
        return;
      }

      container.innerHTML = '';
      items.forEach(item => {
        const label = document.createElement('label');
        label.className = 'checkbox';
        label.innerHTML = `
          <input type="checkbox" class="return-item" value="${item.id}">
          <span>${item.equipment_name} #${item.item_number}
            <span class="text-small text-muted"> — currently at ${item.current_venue_name}</span>
          </span>
        `;
        container.appendChild(label);
      });
    } catch (error) {
      this.showError('Failed to load checked out items');
    }
  }

  async loadHistory(crewMemberId = null, fromDate = null, toDate = null) {
    const container = document.getElementById('history-list');
    container.innerHTML = '<p class="text-muted text-center">Loading...</p>';

    try {
      const filters = {};
      if (crewMemberId) filters.crew = crewMemberId;
      if (fromDate)     filters.from_date = fromDate;
      if (toDate)       filters.to_date = toDate;

      const data = await api.getMovements(filters);
      this._allMovements = data.movements || [];
      this.renderHistory();
    } catch (error) {
      this.showError('Failed to load history');
    }
  }

  renderHistory() {
    const container = document.getElementById('history-list');
    const searchTerm = (document.getElementById('history-search')?.value || '').toLowerCase().trim();

    const typeConfig = {
      checkout: { label: 'Checked Out', badge: 'badge-warning' },
      move:     { label: 'Moved',       badge: 'badge-info' },
      return:   { label: 'Returned',    badge: 'badge-success' },
    };

    // Client-side text search across equipment, crew, and venues
    let movements = this._allMovements || [];
    if (searchTerm) {
      movements = movements.filter(m =>
        (m.equipment_name || '').toLowerCase().includes(searchTerm) ||
        (m.item_number    || '').toLowerCase().includes(searchTerm) ||
        (m.crew_member_name || '').toLowerCase().includes(searchTerm) ||
        (m.from_venue_name || '').toLowerCase().includes(searchTerm) ||
        (m.to_venue_name   || '').toLowerCase().includes(searchTerm)
      );
    }

    if (movements.length === 0) {
      container.innerHTML = '<p class="text-muted text-center">No movements found</p>';
      return;
    }

    // Group by calendar date
    const groups = new Map();
    movements.forEach(m => {
      const d = new Date(m.logged_at);
      const key = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(m);
    });

    container.innerHTML = '';
    groups.forEach((items, dateLabel) => {
      // Date header
      const header = document.createElement('div');
      header.className = 'history-date-header';
      header.textContent = dateLabel;
      container.appendChild(header);

      // Entries for that date
      const card = document.createElement('div');
      card.className = 'card mb-2';

      items.forEach(m => {
        const { label, badge } = typeConfig[m.movement_type] || { label: m.movement_type, badge: 'badge-info' };
        const time = new Date(m.logged_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

        const row = document.createElement('div');
        row.className = 'list-item';
        row.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${m.equipment_name} #${m.item_number}
              <span class="badge ${badge}" style="margin-left:0.4rem;font-size:0.65rem">${label}</span>
            </div>
            <div class="list-item-subtitle">${m.crew_member_name} &bull; ${time}</div>
            <div class="text-small text-muted">${m.from_venue_name} &rarr; ${m.to_venue_name}</div>
          </div>
        `;
        card.appendChild(row);
      });

      container.appendChild(card);
    });

    const total = document.createElement('p');
    total.className = 'text-small text-muted text-center mt-1';
    total.textContent = `${movements.length} movement${movements.length !== 1 ? 's' : ''}`;
    container.appendChild(total);
  }

  async loadUnreturnedItems() {
    try {
      const data = await api.getUnreturnedItems();
      const container = document.getElementById('alerts-list');

      if (!data.unreturned_items || data.unreturned_items.length === 0) {
        container.innerHTML = '<p class="text-center text-muted">All items returned!</p>';
        return;
      }

      container.innerHTML = '';
      data.unreturned_items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-item';

        div.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${item.equipment_name} #${item.item_number}</div>
            <div class="list-item-subtitle">Checked out by ${item.crew_member_name}</div>
            <div class="text-small text-muted">At: ${item.current_venue_name}</div>
            <div class="text-small"><span class="badge badge-warning">${item.days_out} days out</span></div>
          </div>
        `;
        container.appendChild(div);
      });
    } catch (error) {
      this.showError('Failed to load unreturned items');
    }
  }

  async loadVenuesList(token) {
    try {
      const data = await api.getVenues();
      const container = document.getElementById('venues-list');

      if (!data.venues || data.venues.length === 0) {
        container.innerHTML = '<p class="text-muted mt-1">No venues configured yet.</p>';
        return;
      }

      container.innerHTML = '<h4 class="mt-2 mb-1">Current Venues</h4>';
      data.venues.forEach(venue => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${venue.name}</div>
            <div class="list-item-subtitle">${venue.description || 'No description'}</div>
          </div>
          <button class="btn btn-small btn-danger" onclick="ui.deleteVenue(${venue.id}, '${token}')">Delete</button>
        `;
        container.appendChild(item);
      });
    } catch (error) {
      this.showError('Failed to load venues');
    }
  }

  async loadCrewList(token) {
    try {
      const data = await api.getCrewMembers();
      const container = document.getElementById('crew-list');

      if (!data.crew || data.crew.length === 0) {
        container.innerHTML = '<p class="text-muted mt-1">No crew members added yet.</p>';
        return;
      }

      container.innerHTML = '<h4 class="mt-2 mb-1">Current Crew Members</h4>';
      data.crew.forEach(member => {
        const item = document.createElement('div');
        item.className = 'list-item';

        item.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${member.name}</div>
          </div>
          <button class="btn btn-small btn-danger" onclick="ui.deleteCrewMember(${member.id}, '${token}')">Delete</button>
        `;
        container.appendChild(item);
      });
    } catch (error) {
      this.showError('Failed to load crew members');
    }
  }

  async deleteVenue(id, token) {
    if (!confirm('Delete this venue?')) return;

    try {
      await api.deleteVenue(id, token);
      storage.clearCache('venues');
      this.showSuccess('Venue deleted');
      this.loadVenuesList(token);
    } catch (error) {
      this.showError('Failed to delete venue: ' + error.message);
    }
  }

  async deleteCrewMember(id, token) {
    if (!confirm('Delete this crew member?')) return;

    try {
      await api.deleteCrewMember(id, token);
      this.showSuccess('Crew member deleted');
      this.loadCrewList(token);
    } catch (error) {
      this.showError('Failed to delete crew member: ' + error.message);
    }
  }

  async loadEquipmentDropdowns() {
    try {
      const data = await api.getEquipment();
      const equipment = data.equipment || [];
      ['item-equipment', 'retire-equipment', 'send-repair-filter'].forEach((id, i) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = i === 0
          ? '<option value="">-- Select Equipment Type --</option>'
          : '<option value="">-- All Equipment --</option>';
        equipment.forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id;
          opt.textContent = `${e.category} — ${e.name}`;
          sel.appendChild(opt);
        });
      });
    } catch (error) {
      this.showError('Failed to load equipment types');
    }
  }

  async loadRetireItemsList(token, equipmentId = null) {
    const container = document.getElementById('retire-items-list');
    if (!container) return;
    container.innerHTML = '<p class="text-muted text-small">Loading…</p>';
    try {
      const filters = equipmentId ? { equipment: equipmentId } : {};
      const data = await api.getItems(filters);
      const items = data.items || [];
      if (items.length === 0) {
        container.innerHTML = '<p class="text-muted text-small">No active items found.</p>';
        return;
      }
      container.innerHTML = '';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-item';
        const badge = item.status === 'checked_out'
          ? '<span class="badge badge-warning" style="margin-left:0.4rem">Checked Out</span>' : '';
        div.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${item.equipment_name} #${item.item_number}${badge}</div>
            <div class="list-item-subtitle">${item.home_venue_name}</div>
          </div>
          <button class="btn btn-small btn-danger" onclick="ui.retireItem(${item.id}, '${token}')">Retire</button>
        `;
        container.appendChild(div);
      });
    } catch (error) {
      this.showError('Failed to load items');
    }
  }

  async retireItem(id, token) {
    if (!confirm('Retire this item? It will be removed from all active views. Movement history is preserved.')) return;
    try {
      const result = await api.retireItem(id, token);
      const msg = result.was_checked_out
        ? 'Item retired. It was checked out — history preserved.'
        : 'Item retired successfully.';
      this.showSuccess(msg);
      const equipmentId = document.getElementById('retire-equipment')?.value || null;
      this.loadRetireItemsList(token, equipmentId);
    } catch (error) {
      this.showError('Failed to retire item: ' + error.message);
    }
  }

  async loadSendRepairList(token, equipmentId = null) {
    const container = document.getElementById('send-repair-list');
    if (!container) return;
    container.innerHTML = '<p class="text-muted text-small">Loading…</p>';
    try {
      const filters = { status: 'available' };
      if (equipmentId) filters.equipment = equipmentId;
      const data = await api.getItems(filters);
      const items = data.items || [];
      if (items.length === 0) {
        container.innerHTML = '<p class="text-muted text-small">No available items found.</p>';
        return;
      }
      container.innerHTML = '';
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${item.equipment_name} #${item.item_number}</div>
            <div class="list-item-subtitle">${item.home_venue_name}</div>
          </div>
          <button class="btn btn-small btn-warning" onclick="ui.sendToRepair(${item.id}, '${token}')">Send to Repair</button>
        `;
        container.appendChild(div);
      });
    } catch (error) {
      this.showError('Failed to load items');
    }
  }

  async sendToRepair(itemId, token) {
    const notes = document.getElementById('send-repair-notes')?.value?.trim() || '';
    if (!confirm('Send this item for repair? It will be hidden from normal views until returned.')) return;
    try {
      await api.sendToRepair(itemId, notes, token);
      this.showSuccess('Item sent for repair.');
      if (document.getElementById('send-repair-notes')) document.getElementById('send-repair-notes').value = '';
      const equipmentId = document.getElementById('send-repair-filter')?.value || null;
      this.loadSendRepairList(token, equipmentId);
      this.loadRepairItems(token);
    } catch (error) {
      this.showError('Failed to send item for repair: ' + error.message);
    }
  }

  async loadRepairItems(token) {
    const container = document.getElementById('repair-items-list');
    if (!container) return;
    container.innerHTML = '<p class="text-muted text-small">Loading…</p>';
    try {
      const data = await api.getRepairItems(token);
      const repairs = data.repairs || [];
      if (repairs.length === 0) {
        container.innerHTML = '<p class="text-muted text-small">No items currently under repair.</p>';
        return;
      }
      container.innerHTML = '';
      repairs.forEach(item => {
        const div = document.createElement('div');
        div.className = 'list-item';
        const sentDate = new Date(item.sent_for_repair_at).toLocaleDateString();
        div.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${item.equipment_name} #${item.item_number}</div>
            <div class="list-item-subtitle">${item.home_venue_name} · Sent ${sentDate}${item.repair_notes ? ' · ' + item.repair_notes : ''}</div>
          </div>
          <button class="btn btn-small btn-primary" onclick="ui.returnFromRepair(${item.repair_id}, '${token}')">Return from Repair</button>
        `;
        container.appendChild(div);
      });
    } catch (error) {
      this.showError('Failed to load repair items');
    }
  }

  async returnFromRepair(repairId, token) {
    if (!confirm('Mark this item as returned from repair? It will be set to available at its home venue.')) return;
    try {
      await api.returnFromRepair(repairId, '', token);
      this.showSuccess('Item returned from repair.');
      this.loadRepairItems(token);
      const equipmentId = document.getElementById('send-repair-filter')?.value || null;
      this.loadSendRepairList(token, equipmentId);
    } catch (error) {
      this.showError('Failed to return item from repair: ' + error.message);
    }
  }

  async loadRepairHistory(token) {
    const container = document.getElementById('repair-history-list');
    if (!container) return;
    container.innerHTML = '<p class="text-muted text-small">Loading…</p>';
    try {
      const data = await api.getRepairHistory(token);
      const history = data.history || [];
      if (history.length === 0) {
        container.innerHTML = '<p class="text-muted text-small">No repair history yet.</p>';
        return;
      }
      container.innerHTML = '';
      history.forEach(r => {
        const div = document.createElement('div');
        div.className = 'list-item';
        const sentDate = new Date(r.sent_for_repair_at).toLocaleDateString();
        const returnDate = new Date(r.returned_from_repair_at).toLocaleDateString();
        div.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${r.equipment_name} #${r.item_number}</div>
            <div class="list-item-subtitle">Sent ${sentDate} · Returned ${returnDate}${r.notes ? ' · ' + r.notes : ''}</div>
          </div>
        `;
        container.appendChild(div);
      });
    } catch (error) {
      this.showError('Failed to load repair history');
    }
  }

  async loadQuickStats() {
    try {
      const items = await api.getItems();

      const container = document.getElementById('quick-stats');
      const totalItems = items.count || 0;
      const checkedOut = (items.items || []).filter(i => i.status === 'checked_out').length;

      container.innerHTML = `
        <div class="flex-between">
          <span><strong>Total Equipment:</strong> ${totalItems}</span>
          <span><strong>Checked Out:</strong> ${checkedOut}</span>
        </div>
      `;
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async loadHomeAlerts() {
    const container = document.getElementById('home-alerts');
    if (!container) return;
    try {
      const data = await api.getUnreturnedItems(5);
      const items = data.unreturned_items || [];
      container.innerHTML = '';
      if (items.length === 0) return;

      const header = document.createElement('p');
      header.className = 'text-small text-muted mb-1';
      header.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} not returned in 5+ days`;
      container.appendChild(header);

      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'alert alert-warning';
        div.innerHTML = `
          <strong>${item.equipment_name} #${item.item_number}</strong>
          <div class="text-small mt-1">
            Holder: ${item.crew_member_name}<br>
            Location: ${item.current_venue_name}<br>
            Base: ${item.home_venue_name}<br>
            ${item.days_out} day${item.days_out !== 1 ? 's' : ''} out
          </div>
        `;
        container.appendChild(div);
      });
    } catch (error) {
      console.error('Failed to load home alerts:', error);
    }
  }
}

const ui = new UI();
