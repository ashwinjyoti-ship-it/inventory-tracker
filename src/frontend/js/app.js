// Main application logic

class App {
  constructor() {
    this.currentPage = 'home';
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.setupUser();
    this.showPage('home');
  }

  setupEventListeners() {
    document.addEventListener('change', (e) => {
      if (e.target.id === 'checkout-from') {
        const venueId = e.target.value;
        if (venueId) ui.loadCheckoutItems(venueId);
        else document.getElementById('checkout-items').innerHTML = '';
      }

      if (e.target.id === 'return-crew') {
        const crewId = e.target.value;
        ui.loadReturnItems(crewId || null);
      }

      if (e.target.id === 'history-filter') {
        const crewId = e.target.value;
        ui.loadHistory(crewId || null);
      }
    });

    document.getElementById('checkout-confirm')?.addEventListener('click', () => this.handleCheckout());
    document.getElementById('return-confirm')?.addEventListener('click', () => this.handleReturn());
    document.getElementById('admin-login')?.addEventListener('click', () => this.handleAdminLogin());
    document.getElementById('admin-logout')?.addEventListener('click', () => this.handleAdminLogout());
    document.getElementById('venue-add')?.addEventListener('click', () => this.handleVenueAdd());
    document.getElementById('crew-add')?.addEventListener('click', () => this.handleCrewAdd());

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        e.target.closest('.nav-item').classList.add('active');
      });
    });
  }

  async setupUser() {
    try {
      const data = await api.getCrewMembers();
      const userInfo = document.getElementById('user-info');

      const user = storage.getUser();
      if (user.id && user.name) {
        userInfo.textContent = `User: ${user.name}`;
        return;
      }

      if (data.crew && data.crew.length > 0) {
        const select = document.createElement('select');
        select.innerHTML = '<option value="">-- Select Your Name --</option>';

        data.crew.forEach(member => {
          const option = document.createElement('option');
          option.value = member.id;
          option.textContent = member.name;
          select.appendChild(option);
        });

        select.addEventListener('change', (e) => {
          if (e.target.value) {
            const selected = data.crew.find(c => c.id == e.target.value);
            storage.setUser(selected.id, selected.name);
            userInfo.textContent = `User: ${selected.name}`;
          }
        });

        userInfo.innerHTML = '';
        userInfo.appendChild(select);
      }
    } catch (error) {
      console.error('Failed to setup user:', error);
    }
  }

  showPage(pageName) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));

    const page = document.getElementById(pageName + '-page');
    if (page) {
      page.classList.remove('hidden');
      this.currentPage = pageName;
      this.loadPageData(pageName);
    }
  }

  async loadPageData(pageName) {
    switch (pageName) {
      case 'checkout':
        ui.loadCrewMembers('checkout-crew');
        ui.loadVenues('checkout-from');
        ui.loadVenues('checkout-to');
        document.getElementById('checkout-items').innerHTML = '';
        break;

      case 'return':
        ui.loadCrewMembers('return-crew');
        ui.loadVenues('return-to');
        ui.loadReturnItems(null);
        break;

      case 'history':
        ui.loadCrewMembers('history-filter');
        ui.loadHistory();
        break;

      case 'alerts':
        ui.loadUnreturnedItems();
        break;

      case 'home':
        ui.loadQuickStats();
        break;

      case 'admin': {
        const token = storage.getAdminToken();
        if (token) {
          document.getElementById('admin-auth').classList.add('hidden');
          document.getElementById('admin-content').classList.remove('hidden');
          ui.loadVenuesList(token);
          ui.loadCrewList(token);
        }
        break;
      }
    }
  }

  async handleCheckout() {
    const crewId = document.getElementById('checkout-crew').value;
    const fromVenueId = document.getElementById('checkout-from').value;
    const toVenueId = document.getElementById('checkout-to').value;
    const notes = document.getElementById('checkout-notes').value;

    if (!crewId || !fromVenueId || !toVenueId) {
      ui.showError('Please fill in all required fields');
      return;
    }

    if (fromVenueId === toVenueId) {
      ui.showError('"From" and "To" venue cannot be the same');
      return;
    }

    const itemIds = Array.from(document.querySelectorAll('.checkout-item:checked'))
      .map(c => parseInt(c.value));

    if (itemIds.length === 0) {
      ui.showError('Please select at least one item');
      return;
    }

    try {
      await api.checkout(itemIds, parseInt(crewId), parseInt(fromVenueId), parseInt(toVenueId), notes);
      ui.showSuccess(`${itemIds.length} item(s) checked out successfully!`);
      storage.clearCache('items');

      // Reset form to a clean state for a new entry
      this.resetCheckoutForm();

      setTimeout(() => this.showPage('home'), 1000);
    } catch (error) {
      ui.showError('Checkout failed: ' + error.message);
    }
  }

  resetCheckoutForm() {
    document.getElementById('checkout-crew').value = '';
    document.getElementById('checkout-from').value = '';
    document.getElementById('checkout-to').value = '';
    document.getElementById('checkout-notes').value = '';
    document.getElementById('checkout-items').innerHTML = '';
  }

  async handleReturn() {
    const crewId = document.getElementById('return-crew').value;
    const toVenueId = document.getElementById('return-to').value;
    const notes = document.getElementById('return-notes').value;

    if (!crewId || !toVenueId) {
      ui.showError('Please fill in all required fields');
      return;
    }

    const itemIds = Array.from(document.querySelectorAll('.return-item:checked'))
      .map(c => parseInt(c.value));

    if (itemIds.length === 0) {
      ui.showError('Please select at least one item to return');
      return;
    }

    try {
      await api.returnItems(itemIds, parseInt(crewId), parseInt(toVenueId), notes);
      ui.showSuccess(`${itemIds.length} item(s) returned successfully!`);
      storage.clearCache('items');

      // Reset form to a clean state for a new entry
      this.resetReturnForm();

      setTimeout(() => this.showPage('home'), 1000);
    } catch (error) {
      ui.showError('Return failed: ' + error.message);
    }
  }

  resetReturnForm() {
    document.getElementById('return-crew').value = '';
    document.getElementById('return-to').value = '';
    document.getElementById('return-notes').value = '';
    document.getElementById('return-items').innerHTML = '';
  }

  handleAdminLogin() {
    const password = document.getElementById('admin-password').value;

    if (!password) {
      ui.showError('Please enter password');
      return;
    }

    storage.setAdminToken(password);
    document.getElementById('admin-auth').classList.add('hidden');
    document.getElementById('admin-content').classList.remove('hidden');

    ui.loadVenuesList(password);
    ui.loadCrewList(password);
  }

  handleAdminLogout() {
    storage.clearAdminToken();
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-auth').classList.remove('hidden');
    document.getElementById('admin-content').classList.add('hidden');
    ui.showSuccess('Logged out from admin panel');
  }

  async handleVenueAdd() {
    const name = document.getElementById('venue-name').value.trim();
    const description = document.getElementById('venue-desc').value.trim();
    const token = storage.getAdminToken();

    if (!name) {
      ui.showError('Please enter venue name');
      return;
    }

    try {
      await api.createVenue(name, description, token);
      ui.showSuccess('Venue added successfully!');
      storage.clearCache('venues');

      document.getElementById('venue-name').value = '';
      document.getElementById('venue-desc').value = '';

      ui.loadVenuesList(token);
    } catch (error) {
      ui.showError('Failed to add venue: ' + error.message);
    }
  }

  async handleCrewAdd() {
    const name = document.getElementById('crew-name').value.trim();
    const token = storage.getAdminToken();

    if (!name) {
      ui.showError('Please enter crew member name');
      return;
    }

    try {
      await api.createCrewMember(name, 'crew', token);
      ui.showSuccess('Crew member added successfully!');

      document.getElementById('crew-name').value = '';
      ui.loadCrewList(token);
    } catch (error) {
      ui.showError('Failed to add crew member: ' + error.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
