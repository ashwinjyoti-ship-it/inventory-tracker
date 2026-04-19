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
      data.items.forEach(item => {
        const label = document.createElement('label');
        label.className = 'checkbox';

        const statusBadge = item.status === 'checked_out'
          ? '<span class="badge badge-warning" style="margin-left:auto">In Transit</span>'
          : '';

        label.innerHTML = `
          <input type="checkbox" class="checkout-item" value="${item.id}">
          <span>${item.equipment_name} #${item.item_number}</span>
          ${statusBadge}
        `;
        container.appendChild(label);
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

      // If a crew member is selected, filter by who last moved the item
      let items = data.items;
      if (crewMemberId) {
        const movements = await api.getMovements({ crew: crewMemberId, type: 'checkout' });
        const crewItemIds = new Set((movements.movements || []).map(m => m.item_id));
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

  async loadHistory(crewMemberId = null) {
    try {
      const filters = {};
      if (crewMemberId) filters.crew = crewMemberId;

      const data = await api.getMovements(filters);
      const container = document.getElementById('history-list');

      if (!data.movements || data.movements.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">No movement history</p>';
        return;
      }

      container.innerHTML = '';
      data.movements.forEach(m => {
        const item = document.createElement('div');
        item.className = 'list-item';

        const typeConfig = {
          checkout: { label: 'Checked Out', badge: 'badge-warning' },
          move:     { label: 'Moved',        badge: 'badge-info' },
          return:   { label: 'Returned',     badge: 'badge-success' },
        };
        const { label, badge } = typeConfig[m.movement_type] || { label: m.movement_type, badge: 'badge-info' };

        item.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${m.equipment_name} #${m.item_number}</div>
            <div class="list-item-subtitle">${label} by ${m.crew_member_name}</div>
            <div class="text-small text-muted">${m.from_venue_name} &rarr; ${m.to_venue_name}</div>
            <div class="text-small text-muted">${new Date(m.logged_at).toLocaleString()}</div>
          </div>
          <span class="badge ${badge}">${label}</span>
        `;
        container.appendChild(item);
      });
    } catch (error) {
      this.showError('Failed to load history');
    }
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
        const roleText = member.role === 'admin' ? 'Admin' : 'Crew';

        item.innerHTML = `
          <div class="list-item-content">
            <div class="list-item-title">${member.name}</div>
            <div class="list-item-subtitle">${roleText}</div>
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

  async loadQuickStats() {
    try {
      const items = await api.getItems();
      const unreturned = await api.getUnreturnedItems();

      const container = document.getElementById('quick-stats');
      const totalItems = items.count || 0;
      const checkedOut = (items.items || []).filter(i => i.status === 'checked_out').length;
      const alerts = unreturned.unreturned_items?.length || 0;

      container.innerHTML = `
        <div class="flex-between mb-1">
          <span><strong>Total Equipment:</strong> ${totalItems}</span>
          <span><strong>Checked Out:</strong> ${checkedOut}</span>
        </div>
        <div><strong>Unreturned (5+ days):</strong> ${alerts}</div>
      `;
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }
}

const ui = new UI();
