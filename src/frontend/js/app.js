// Main application logic

class App {
  constructor() {
    this.currentPage = 'home';
    this.activeReturnTab = 'return'; // 'return' | 'move'
    this.historyDateRange = 'month';  // 'today' | 'week' | 'month' | 'all'
    this.init();
  }

  async init() {
    this.setupEventListeners();
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
        const crewId = e.target.value || null;
        const containerId = this.activeReturnTab === 'return' ? 'return-items' : 'move-items';
        ui.loadReturnItems(crewId, containerId);
      }

      if (e.target.id === 'history-filter') {
        this.reloadHistory();
      }

      if (e.target.id === 'retire-equipment') {
        const token = storage.getAdminToken();
        ui.loadRetireItemsList(token, e.target.value || null);
      }

      if (e.target.id === 'send-repair-filter') {
        const token = storage.getAdminToken();
        ui.loadSendRepairList(token, e.target.value || null);
      }
    });

    // Real-time search filters already-loaded results without a server call
    document.getElementById('history-search')?.addEventListener('input', () => {
      ui.renderHistory();
    });

    document.getElementById('checkout-confirm')?.addEventListener('click', () => this.handleCheckout());
    document.getElementById('return-confirm')?.addEventListener('click', () => this.handleReturn());
    document.getElementById('move-confirm')?.addEventListener('click', () => this.handleMove());
    document.getElementById('admin-login')?.addEventListener('click', () => this.handleAdminLogin());
    document.getElementById('admin-logout')?.addEventListener('click', () => this.handleAdminLogout());
    document.getElementById('venue-add')?.addEventListener('click', () => this.handleVenueAdd());
    document.getElementById('crew-add')?.addEventListener('click', () => this.handleCrewAdd());
    document.getElementById('pw-change')?.addEventListener('click', () => this.handlePasswordChange());
    document.getElementById('history-clear')?.addEventListener('click', () => this.handleClearHistory());
    document.getElementById('equip-add')?.addEventListener('click', () => this.handleEquipmentAdd());
    document.getElementById('items-add')?.addEventListener('click', () => this.handleItemsAdd());

    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        e.target.closest('.nav-item').classList.add('active');
      });
    });
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
        this.activeReturnTab = 'return';
        this.applyReturnTab();
        ui.loadCrewMembers('return-crew');
        ui.loadVenues('move-to');
        ui.loadReturnItems(null, 'return-items');
        break;

      case 'history':
        this.historyDateRange = 'month';
        this.applyHistoryDateButtons();
        ui.loadCrewMembers('history-filter');
        this.reloadHistory();
        break;

      case 'alerts':
        ui.loadUnreturnedItems();
        break;

      case 'home':
        ui.loadQuickStats();
        ui.loadHomeAlerts();
        break;

      case 'admin': {
        const token = storage.getAdminToken();
        if (token) {
          document.getElementById('admin-auth').classList.add('hidden');
          document.getElementById('admin-content').classList.remove('hidden');
          ui.loadVenuesList(token);
          ui.loadCrewList(token);
          ui.loadEquipmentDropdowns();
          ui.loadVenues('item-venue');
        }
        break;
      }
    }
  }

  setHistoryDate(range) {
    this.historyDateRange = range;
    this.applyHistoryDateButtons();
    this.reloadHistory();
  }

  applyHistoryDateButtons() {
    ['today', 'week', 'month', 'all'].forEach(r => {
      document.getElementById(`hdate-${r}`)?.classList.toggle('active', r === this.historyDateRange);
    });
  }

  reloadHistory() {
    const crewId = document.getElementById('history-filter')?.value || null;
    const { fromDate, toDate } = this.getHistoryDateRange();
    ui.loadHistory(crewId, fromDate, toDate);
  }

  getHistoryDateRange() {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (this.historyDateRange === 'today') {
      const today = fmt(now);
      return { fromDate: today + ' 00:00:00', toDate: today + ' 23:59:59' };
    }
    if (this.historyDateRange === 'week') {
      const week = new Date(now); week.setDate(now.getDate() - 6);
      return { fromDate: fmt(week) + ' 00:00:00', toDate: null };
    }
    if (this.historyDateRange === 'month') {
      const month = new Date(now); month.setDate(now.getDate() - 29);
      return { fromDate: fmt(month) + ' 00:00:00', toDate: null };
    }
    return { fromDate: null, toDate: null }; // 'all'
  }

  switchTab(tab) {
    this.activeReturnTab = tab;
    this.applyReturnTab();

    // Reload items for the newly active tab
    const crewId = document.getElementById('return-crew').value || null;
    if (tab === 'return') {
      ui.loadReturnItems(crewId, 'return-items');
    } else {
      ui.loadReturnItems(crewId, 'move-items');
    }
  }

  applyReturnTab() {
    const isReturn = this.activeReturnTab === 'return';
    document.getElementById('tab-return').classList.toggle('active', isReturn);
    document.getElementById('tab-move').classList.toggle('active', !isReturn);
    document.getElementById('section-return').classList.toggle('hidden', !isReturn);
    document.getElementById('section-move').classList.toggle('hidden', isReturn);
  }

  toggleAdminSection(name) {
    const card = document.getElementById(`admin-${name}-card`);
    if (!card) return;
    const collapsed = card.classList.toggle('collapsed');
    const header = card.querySelector('.collapsible-header');
    header?.setAttribute('aria-expanded', String(!collapsed));

    if (!collapsed && name === 'repairs') {
      const token = storage.getAdminToken();
      ui.loadRepairItems(token);
      ui.loadRepairHistory(token);
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
      this.resetCheckoutForm();
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
    const notes = document.getElementById('return-notes').value;

    if (!crewId) {
      ui.showError('Please select a crew member');
      return;
    }

    const itemIds = Array.from(document.querySelectorAll('#return-items .return-item:checked'))
      .map(c => parseInt(c.value));

    if (itemIds.length === 0) {
      ui.showError('Please select at least one item to return');
      return;
    }

    try {
      await api.returnItems(itemIds, parseInt(crewId), notes);
      ui.showSuccess(`${itemIds.length} item(s) returned to base!`);
      storage.clearCache('items');
      this.resetReturnForm();
      setTimeout(() => this.showPage('home'), 1000);
    } catch (error) {
      ui.showError('Return failed: ' + error.message);
    }
  }

  async handleMove() {
    const crewId = document.getElementById('return-crew').value;
    const toVenueId = document.getElementById('move-to').value;
    const notes = document.getElementById('move-notes').value;

    if (!crewId || !toVenueId) {
      ui.showError('Please select a crew member and destination venue');
      return;
    }

    const itemIds = Array.from(document.querySelectorAll('#move-items .return-item:checked'))
      .map(c => parseInt(c.value));

    if (itemIds.length === 0) {
      ui.showError('Please select at least one item to move');
      return;
    }

    try {
      await api.moveItems(itemIds, parseInt(crewId), parseInt(toVenueId), notes);
      ui.showSuccess(`${itemIds.length} item(s) moved successfully!`);
      storage.clearCache('items');
      this.resetReturnForm();
      setTimeout(() => this.showPage('home'), 1000);
    } catch (error) {
      ui.showError('Move failed: ' + error.message);
    }
  }

  resetReturnForm() {
    document.getElementById('return-crew').value = '';
    document.getElementById('move-to').value = '';
    document.getElementById('return-notes').value = '';
    document.getElementById('move-notes').value = '';
    document.getElementById('return-items').innerHTML = '';
    document.getElementById('move-items').innerHTML = '';
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
    ui.loadEquipmentDropdowns();
    ui.loadVenues('item-venue');
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

  async handlePasswordChange() {
    const newPassword = document.getElementById('pw-new').value;
    const confirm = document.getElementById('pw-confirm').value;
    const token = storage.getAdminToken();

    if (!newPassword) {
      ui.showError('Please enter a new password');
      return;
    }
    if (newPassword.length < 4) {
      ui.showError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirm) {
      ui.showError('Passwords do not match');
      return;
    }

    try {
      await api.changeAdminPassword(newPassword, token);

      // Update the stored token so the session stays valid with the new password
      storage.setAdminToken(newPassword);

      document.getElementById('pw-new').value = '';
      document.getElementById('pw-confirm').value = '';

      ui.showSuccess('Password changed successfully!');
    } catch (error) {
      ui.showError('Failed to change password: ' + error.message);
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

  async handleClearHistory() {
    if (!confirm(
      'This will permanently delete ALL movement history and reset every item to its home venue ' +
      '(including items currently checked out). This cannot be undone.\n\nAre you sure?'
    )) return;

    const token = storage.getAdminToken();
    try {
      await api.clearAllHistory(token);
      storage.clearAllCache();
      ui.showSuccess('All history cleared. Items reset to home venues.');
    } catch (error) {
      ui.showError('Failed to clear history: ' + error.message);
    }
  }

  async handleEquipmentAdd() {
    const name = document.getElementById('equip-name').value.trim();
    const category = document.getElementById('equip-category').value.trim();
    const token = storage.getAdminToken();
    if (!name || !category) {
      ui.showError('Please enter both equipment name and category');
      return;
    }
    try {
      await api.createEquipment(name, category, token);
      ui.showSuccess('Equipment type added!');
      document.getElementById('equip-name').value = '';
      document.getElementById('equip-category').value = '';
      ui.loadEquipmentDropdowns();
    } catch (error) {
      ui.showError('Failed to add equipment type: ' + error.message);
    }
  }

  async handleItemsAdd() {
    const equipmentId = document.getElementById('item-equipment').value;
    const homeVenueId = document.getElementById('item-venue').value;
    const quantity = parseInt(document.getElementById('item-quantity').value);
    const token = storage.getAdminToken();
    if (!equipmentId) { ui.showError('Please select an equipment type'); return; }
    if (!homeVenueId) { ui.showError('Please select a home venue'); return; }
    if (!quantity || quantity < 1) { ui.showError('Please enter a quantity of at least 1'); return; }
    try {
      await api.addItems(parseInt(equipmentId), parseInt(homeVenueId), quantity, token);
      ui.showSuccess(`${quantity} item(s) added successfully!`);
      document.getElementById('item-equipment').value = '';
      document.getElementById('item-quantity').value = '1';
      const retireFilter = document.getElementById('retire-equipment')?.value;
      ui.loadRetireItemsList(token, retireFilter || null);
    } catch (error) {
      ui.showError('Failed to add items: ' + error.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
