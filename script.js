const nav = document.querySelector('.main-nav');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = nav ? Array.from(nav.querySelectorAll('a[data-nav]')) : [];
const activePage = document.body?.dataset.page;
const dataCache = new Map();
const pageState = {
  properties: null
};

const STORAGE_KEYS = Object.freeze({
  userProfile: 'oyoplus:user',
  bookings: 'oyoplus:bookings'
});

const BOOKING_CONSTANTS = Object.freeze({
  taxRate: 0.12,
  serviceFee: 299
});

const numberFormatters = {
  INR: new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  })
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let toastContainer;
let membershipHighlightTimer;

function animateIn(element) {
  if (!element) return;
  if (prefersReducedMotion.matches) {
    element.classList.remove('animate-in');
    return;
  }
  requestAnimationFrame(() => {
    element.classList.add('animate-in');
  });
}

function createElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

async function fetchJSON(path) {
  if (!dataCache.has(path)) {
    const responsePromise = fetch(path)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${path}`);
        }
        return response.json();
      })
      .catch((error) => {
        console.error(error);
        return null;
      });
    dataCache.set(path, responsePromise);
  }
  return dataCache.get(path);
}

async function loadProperties() {
  if (pageState.properties) {
    return pageState.properties;
  }
  const data = await fetchJSON('data/properties.json');
  pageState.properties = data?.properties ?? [];
  return pageState.properties;
}

function formatPrice(value, currency = 'INR') {
  const formatter = numberFormatters[currency];
  if (!formatter) {
    return `${currency} ${value}`;
  }
  return formatter.format(value);
}

function clearChildren(element) {
  if (!element) return;
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

function calculateBookingTotals(property, nightsInput) {
  if (!property) {
    return {
      nightlyRate: 0,
      nights: 0,
      subtotal: 0,
      tax: 0,
      fees: 0,
      total: 0,
      currency: 'INR'
    };
  }
  const nights = Math.max(1, Number(nightsInput) || 1);
  const nightlyRate = Number(property.price) || 0;
  const subtotal = nightlyRate * nights;
  const tax = Math.round(subtotal * BOOKING_CONSTANTS.taxRate);
  const fees = BOOKING_CONSTANTS.serviceFee;
  const total = subtotal + tax + fees;
  return {
    nightlyRate,
    nights,
    subtotal,
    tax,
    fees,
    total,
    currency: property.currency || 'INR'
  };
}

function saveUserProfile(profile) {
  if (!profile) return;
  try {
    const payload = JSON.stringify(profile);
    sessionStorage.setItem(STORAGE_KEYS.userProfile, payload);
  } catch (error) {
    console.warn('Unable to persist user profile', error);
  }
}

function loadUserProfile() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEYS.userProfile);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch (error) {
    console.warn('Unable to parse user profile', error);
    return null;
  }
}

function clearUserProfile() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.userProfile);
  } catch (error) {
    console.warn('Unable to clear user profile', error);
  }
  clearStoredBookings();
}

function persistStoredBookings(bookings) {
  try {
    const payload = JSON.stringify(bookings);
    sessionStorage.setItem(STORAGE_KEYS.bookings, payload);
  } catch (error) {
    console.warn('Unable to persist bookings', error);
  }
}

function loadStoredBookings() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.bookings);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Unable to parse bookings', error);
    return [];
  }
}

function addStoredBooking(booking) {
  if (!booking) return;
  const current = loadStoredBookings().filter((item) => item.id !== booking.id);
  current.push(booking);
  current.sort((a, b) => {
    const aDate = new Date(a.checkIn).getTime();
    const bDate = new Date(b.checkIn).getTime();
    return aDate - bDate;
  });
  persistStoredBookings(current);
}

function clearStoredBookings() {
  try {
    sessionStorage.removeItem(STORAGE_KEYS.bookings);
  } catch (error) {
    console.warn('Unable to clear bookings', error);
  }
}

function getMembershipSection() {
  return document.getElementById('membership');
}

function highlightMembershipSection(section) {
  if (!section) return;
  section.classList.add('is-highlighted');
  if (membershipHighlightTimer) {
    clearTimeout(membershipHighlightTimer);
  }
  membershipHighlightTimer = setTimeout(() => {
    section.classList.remove('is-highlighted');
  }, 1600);
}

function scrollToMembershipSection({ highlight = true } = {}) {
  const section = getMembershipSection();
  if (!section) {
    window.location.href = 'index.html#membership';
    return;
  }
  section.scrollIntoView({
    behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
    block: 'center'
  });
  if (highlight) {
    highlightMembershipSection(section);
  }
}

function setupMembershipLinks() {
  const triggers = document.querySelectorAll('[data-action="open-membership"], [data-action="membership-learn"]');
  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      const action = trigger.dataset.action;
      const section = getMembershipSection();
      if (!section) {
        window.location.href = 'index.html#membership';
        return;
      }
      if (action === 'open-membership') {
        scrollToMembershipSection();
      } else if (action === 'membership-learn') {
        section.scrollIntoView({
          behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
          block: 'center'
        });
        highlightMembershipSection(section);
      }
    });
  });
}

function handleMembershipDeepLink() {
  if (window.location.hash.replace('#', '') !== 'membership') return;
  const section = getMembershipSection();
  if (!section) return;
  setTimeout(() => {
    scrollToMembershipSection();
  }, 200);
}

function renderSkeletons(container, count, type = 'card') {
  if (!container) return;
  clearChildren(container);
  for (let i = 0; i < count; i += 1) {
    const skeleton = document.createElement('div');
    skeleton.className = `skeleton skeleton-${type}`;
    container.appendChild(skeleton);
  }
}

function buildCollectionCard(collection) {
  const card = createElement(`
    <article class="card animate-in">
      <div class="card-media">
        <img loading="lazy" src="${collection.image}" alt="${collection.imageAlt ?? collection.title}" />
      </div>
      <div class="card-body">
        <h3>${collection.title}</h3>
        <p>${collection.description}</p>
        <a class="link" href="${collection.href}">Explore</a>
      </div>
    </article>
  `);
  return card;
}

function buildDestinationCard(destination) {
  return createElement(`
    <a class="destination-card animate-in" href="${destination.href}">
      <span class="city">${destination.city}</span>
      <span class="count">${destination.count}</span>
    </a>
  `);
}

function buildOfferCard(offer) {
  const cta = offer.cta
    ? `<button class="badge-btn" type="button" data-code="${offer.cta.value}">${offer.cta.label}</button>`
    : '';
  return createElement(`
    <article class="offer-card animate-in">
      <span class="badge">${offer.badge}</span>
      <h3>${offer.title}</h3>
      <p>${offer.description}</p>
      ${cta}
    </article>
  `);
}

function buildTrustCopy(trust) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <h2>${trust.headline}</h2>
    <p>${trust.description}</p>
  `;
  if (Array.isArray(trust.bullets)) {
    const list = document.createElement('ul');
    trust.bullets.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      list.appendChild(li);
    });
    wrapper.appendChild(list);
  }
  wrapper.classList.add('animate-in');
  return wrapper;
}

function buildTrustCard(card) {
  return createElement(`
    <article class="animate-in">
      <h3>${card.title}</h3>
      <p>${card.copy}</p>
    </article>
  `);
}

function buildTestimonialCard(testimonial) {
  return createElement(`
    <figure class="animate-in">
      <blockquote>
        “${testimonial.quote}”
      </blockquote>
      <figcaption>
        <span class="name">${testimonial.name}</span>
        <span class="meta">${testimonial.meta}</span>
      </figcaption>
    </figure>
  `);
}

function buildStoreButtons(download) {
  const fragment = document.createDocumentFragment();
  download.stores?.forEach((store) => {
    const btn = createElement(`<a class="store-btn animate-in" href="${store.href}">${store.label}</a>`);
    fragment.appendChild(btn);
  });
  return fragment;
}

function buildDownloadCopy(download) {
  const wrapper = document.createElement('div');
  wrapper.className = 'animate-in';
  wrapper.innerHTML = `
    <h2>${download.title}</h2>
    <p>${download.copy}</p>
    <div class="store-links"></div>
  `;
  const storeContainer = wrapper.querySelector('.store-links');
  if (storeContainer) {
    storeContainer.appendChild(buildStoreButtons(download));
  }
  return wrapper;
}

function buildDownloadArt(download) {
  if (!download.image?.src) return null;
  return createElement(`
    <img loading="lazy" src="${download.image.src}" alt="${download.image.alt ?? 'OYO.plus app preview'}" class="animate-in" />
  `);
}

function buildAmenityChip(text) {
  return createElement(`<span>${text}</span>`);
}

function buildBenefitItem(text) {
  return createElement(`<li>${text}</li>`);
}

function buildPolicy(policy) {
  return createElement(`
    <div class="policy animate-in">
      <h4>${policy.title}</h4>
      <p>${policy.body}</p>
    </div>
  `);
}

function createPropertyCard(property, options = {}) {
  const { compact = false } = options;
  const classes = ['property-card', 'animate-in'];
  if (compact) classes.push('compact');
  const card = createElement(`
    <article class="${classes.join(' ')}">
      <div class="property-media">
        <img loading="lazy" src="${property.image}" alt="${property.imageAlt ?? property.name}" />
      </div>
      <div class="property-body">
        <div class="property-meta">
          <span class="rating" aria-label="Rated ${property.rating} out of 5">${property.rating.toFixed(1)} ★</span>
          <span>${property.area}, ${property.city}</span>
          <span>${property.badge?.split('•')[0]?.trim() ?? property.type}</span>
        </div>
        <h3>${property.name}</h3>
        <p>${property.shortDescription}</p>
        <div class="property-highlights"></div>
        <div class="amenities"></div>
        <div class="price-row">
          <span class="price">${formatPrice(property.price, property.currency)}</span>
          <a class="btn ghost" href="stay-detail.html?id=${property.id}">View details</a>
        </div>
      </div>
    </article>
  `);
  const amenityContainer = card.querySelector('.amenities');
  property.amenities?.slice(0, compact ? 3 : 6).forEach((amenity) => {
    amenityContainer.appendChild(buildAmenityChip(amenity));
  });
  const highlightContainer = card.querySelector('.property-highlights');
  if (highlightContainer) {
    const highlights = [];
    if (property.sustainabilityScore) {
      highlights.push(`Carbon score ${property.sustainabilityScore}`);
    }
    if (property.workspace?.type) {
      highlights.push(property.workspace.type);
    }
    if (property.wellness?.length) {
      highlights.push(property.wellness[0]);
    }
    if (highlights.length) {
      highlights.slice(0, compact ? 1 : 2).forEach((text) => {
        highlightContainer.appendChild(createElement(`<span class="highlight-pill">${text}</span>`));
      });
    }
  }
  return card;
}

function renderCollections(collections) {
  const container = document.querySelector('[data-slot="collections"]');
  if (!container) return;
  if (!collections?.length) {
    container.innerHTML = '<p class="muted">Collections will appear here soon.</p>';
    return;
  }
  clearChildren(container);
  collections.forEach((collection) => container.appendChild(buildCollectionCard(collection)));
}

function renderDestinations(destinations) {
  const container = document.querySelector('[data-slot="destinations"]');
  if (!container) return;
  if (!destinations?.length) {
    container.innerHTML = '<p class="muted">We are sourcing trending destinations.</p>';
    return;
  }
  clearChildren(container);
  destinations.forEach((destination) => container.appendChild(buildDestinationCard(destination)));
}

function renderOffers(offers) {
  const track = document.querySelector('[data-slot="offers"]');
  if (!track) return;
  if (!offers?.length) {
    track.innerHTML = '<p class="muted">Check back soon for fresh offers.</p>';
    return;
  }
  clearChildren(track);
  offers.forEach((offer) => track.appendChild(buildOfferCard(offer)));
  setupOfferControls();
  track.scrollLeft = 0;

  if (!track.dataset.offersBound) {
    track.addEventListener('click', (event) => {
      const button = event.target.closest('.badge-btn');
      if (!button || !button.dataset.code) return;
      const code = button.dataset.code;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          button.textContent = 'Copied!';
          setTimeout(() => {
            button.textContent = 'Copy code';
          }, 1500);
        });
      } else {
        alert(`Use code ${code} while booking.`);
      }
    });
    track.dataset.offersBound = 'true';
  }
}

function renderTrust(trust) {
  const copyContainer = document.querySelector('[data-slot="trust-copy"]');
  const cardsContainer = document.querySelector('[data-slot="trust-cards"]');
  if (copyContainer && trust) {
    clearChildren(copyContainer);
    copyContainer.appendChild(buildTrustCopy(trust));
  }
  if (cardsContainer && trust?.cards) {
    clearChildren(cardsContainer);
    trust.cards.forEach((card) => cardsContainer.appendChild(buildTrustCard(card)));
  }
}

function renderTestimonials(testimonials) {
  const container = document.querySelector('[data-slot="testimonials"]');
  if (!container) return;
  if (!testimonials?.length) {
    container.innerHTML = '<p class="muted">Testimonials coming soon.</p>';
    return;
  }
  clearChildren(container);
  testimonials.forEach((testimonial) => container.appendChild(buildTestimonialCard(testimonial)));
}

function renderDownload(download) {
  const copyContainer = document.querySelector('[data-slot="download-copy"]');
  const artContainer = document.querySelector('[data-slot="download-art"]');
  if (copyContainer && download) {
    clearChildren(copyContainer);
    copyContainer.appendChild(buildDownloadCopy(download));
  }
  if (artContainer) {
    clearChildren(artContainer);
    const art = buildDownloadArt(download);
    if (art) artContainer.appendChild(art);
  }
}

function renderDifferentiators(data) {
  if (!data) return;
  const title = document.querySelector('[data-slot="differentiators-title"]');
  const description = document.querySelector('[data-slot="differentiators-description"]');
  const grid = document.querySelector('[data-slot="differentiators"]');
  if (title && data.headline) title.textContent = data.headline;
  if (description && data.description) description.textContent = data.description;
  if (grid) {
    clearChildren(grid);
    data.items?.forEach((item) => {
      grid.appendChild(createElement(`
        <article class="differentiator-card animate-in">
          <div class="differentiator-icon" aria-hidden="true">${item.icon ?? '✨'}</div>
          <h3>${item.title}</h3>
          <p>${item.copy}</p>
        </article>
      `));
    });
  }
}

function matchCity(property, cityValue) {
  if (!cityValue) return true;
  const value = cityValue.trim().toLowerCase();
  return [property.city, property.area].some((part) => part?.toLowerCase().includes(value));
}

function matchGuests(property, guestsValue) {
  if (!guestsValue) return true;
  const guests = Number(guestsValue) || 0;
  if (guests <= 0) return true;
  return (property.maxGuests ?? 2) >= guests;
}

function matchBudget(property, budget) {
  if (!budget || budget === 'any') return true;
  if (budget.endsWith('+')) {
    const min = Number(budget.replace('+', ''));
    return property.price >= min;
  }
  const value = Number(budget);
  if (value <= 1500) {
    return property.price <= 1500;
  }
  if (value <= 3000) {
    return property.price > 1500 && property.price <= 3000;
  }
  if (value <= 5000) {
    return property.price > 3000 && property.price <= 5000;
  }
  return true;
}

function matchType(property, type) {
  if (!type || type === 'any') return true;
  const desired = String(type).toLowerCase();
  const categories = property.categories?.map((item) => String(item).toLowerCase()) ?? [];
  const propertyType = property.type ? String(property.type).toLowerCase() : '';
  return categories.includes(desired) || propertyType === desired;
}

function matchRating(property, rating) {
  if (!rating || rating === 'any') return true;
  const minimum = Number(rating) || 0;
  return property.rating >= minimum;
}

function filterProperties(properties, filters) {
  const requireWorkspace = toBoolean(filters.workspace);
  const requireWellness = toBoolean(filters.wellness);
  return properties.filter((property) =>
    matchCity(property, filters.city) &&
    matchGuests(property, filters.guests) &&
    matchBudget(property, filters.budget) &&
    matchType(property, filters.type) &&
    matchRating(property, filters.rating) &&
    matchWorkspace(property, requireWorkspace) &&
    matchWellness(property, requireWellness)
  );
}

function renderPropertyGrid(container, properties, options = {}) {
  if (!container) return;
  clearChildren(container);
  if (!properties.length) {
    container.innerHTML = '<p class="muted">No stays matched your filters. Try adjusting them for more options.</p>';
    return;
  }
  properties.forEach((property) => container.appendChild(createPropertyCard(property, options)));
}

function updateSearchResultsUI(results, filters) {
  const section = document.getElementById('search-results');
  const grid = document.querySelector('[data-slot="search-results"]');
  const message = document.getElementById('search-message');
  const viewAll = document.getElementById('view-all-results');
  if (!section || !grid) return;
  clearChildren(grid);

  if (!results.length) {
    message.textContent = `We could not find stays in ${filters.city || 'your destination'} for the selected dates. Try a nearby city or adjust guests.`;
    section.hidden = false;
    return;
  }

  message.textContent = `${results.length} stay${results.length > 1 ? 's' : ''} match your filters.`;
  results.slice(0, 3).forEach((property) => {
    grid.appendChild(createPropertyCard(property, { compact: true }));
  });
  section.hidden = false;

  if (viewAll) {
    const params = new URLSearchParams();
    if (filters.city) params.set('city', filters.city);
    if (filters.guests) params.set('guests', filters.guests);
    if (filters.budget) params.set('budget', filters.budget);
    if (filters.type) params.set('type', filters.type);
    if (filters.rating) params.set('rating', filters.rating);
    viewAll.href = `listings.html?${params.toString()}`;
  }
}

function setupSearchForm() {
  const searchForm = document.querySelector('.search-card');
  const clearButton = document.getElementById('clear-results');
  if (!searchForm) return;

  const executeSearch = async (filters, options = {}) => {
    const properties = await loadProperties();
    let matches = filterProperties(properties, filters);
    if (filters.near) {
      matches = [...matches].sort((a, b) => b.rating - a.rating);
    }
    if (options.updateResults !== false) {
      updateSearchResultsUI(matches, filters);
      const section = document.getElementById('search-results');
      if (section) {
        section.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
      }
    }
    if (options.redirect && matches.length) {
      navigateToListings(filters);
    }
    return matches;
  };

  searchForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(searchForm);
    const filters = {
      city: data.get('city')?.trim() ?? '',
      guests: data.get('guests'),
      budget: data.get('budget') ?? 'any',
      type: 'any',
      rating: 'any'
    };
    const matches = await executeSearch(filters);
    showToast(
      matches.length
        ? `Showing ${matches.length} stay${matches.length > 1 ? 's' : ''} that match your filters.`
        : 'No stays found. Try changing dates or guests.'
    );
  });

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      const section = document.getElementById('search-results');
      if (section) section.hidden = true;
      const message = document.getElementById('search-message');
      if (message) message.textContent = '';
      const grid = document.querySelector('[data-slot="search-results"]');
      if (grid) clearChildren(grid);
    });
  }

  setupQuickSearches(executeSearch);
  setupCityShortcuts();
  setupMetricShortcuts();
}

function parseQueryParams() {
  return Object.fromEntries(new URLSearchParams(window.location.search).entries());
}

function prefillListingForm(form, params) {
  if (!form) return;
  Object.entries(params).forEach(([key, value]) => {
    const field = form.elements.namedItem(key);
    if (!field) return;
    if (field instanceof RadioNodeList || Array.isArray(field)) {
      Array.from(field).forEach((input) => {
        if (input.type === 'checkbox') {
          input.checked = toBoolean(value);
        } else {
          input.value = value;
        }
      });
    } else if (field.type === 'checkbox') {
      field.checked = toBoolean(value);
    } else if (typeof field.value !== 'undefined') {
      field.value = value;
    }
  });
}

async function initListingsPage() {
  const container = document.querySelector('[data-slot="listings"]');
  const message = document.getElementById('listing-message');
  const form = document.getElementById('listing-filter');
  const resetButton = document.getElementById('reset-filters');
  if (!container || !form) return;

  renderSkeletons(container, 4, 'property');
  const properties = await loadProperties();
  const params = parseQueryParams();
  prefillListingForm(form, params);

  const getValue = (name) => {
    const field = form.elements.namedItem(name);
    return field ? field.value : '';
  };

  const getFilters = () => ({
    city: getValue('city'),
    guests: getValue('guests'),
    budget: getValue('budget') || 'any',
    type: getValue('type') || 'any',
    rating: getValue('rating') || 'any',
    workspace: form.workspace?.checked || false,
    wellness: form.wellness?.checked || false,
    near: form.near?.checked || false
  });

  const render = () => {
    const filters = getFilters();
    let results = filterProperties(properties, filters);
    if (filters.near) {
      results = [...results].sort((a, b) => b.rating - a.rating);
    }
    renderPropertyGrid(container, results);
    if (message) {
      if (results.length) {
        message.textContent = `${results.length} stay${results.length > 1 ? 's' : ''} available`;
      } else {
        message.textContent = 'Try expanding your filters to see more stays.';
      }
    }
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    render();
  });

  form.addEventListener('change', (event) => {
    if (event.target && event.target.tagName === 'SELECT') {
      render();
    }
  });

  if (resetButton) {
    resetButton.addEventListener('click', () => {
      form.reset();
      render();
    });
  }

  render();
}

async function initDetailPage() {
  const propertyId = new URLSearchParams(window.location.search).get('id') || document.body.dataset.propertyId;
  const properties = await loadProperties();
  const property = properties.find((item) => item.id === propertyId);
  const breadcrumbName = document.getElementById('breadcrumb-name');
  const breadcrumbCity = document.getElementById('breadcrumb-city');
  const heroBadge = document.querySelector('[data-bind="badge"]');
  const heroName = document.querySelector('[data-bind="name"]');
  const heroSummary = document.querySelector('[data-bind="summary"]');
  const gallery = document.querySelector('[data-slot="gallery"]');
  const amenitiesContainer = document.querySelector('[data-slot="amenities"]');
  const goodToKnow = document.querySelector('[data-slot="good-to-know"]');
  const policiesContainer = document.querySelector('[data-slot="policies"]');
  const rating = document.querySelector('[data-bind="rating"]');
  const price = document.querySelector('[data-bind="price"]');
  const pricingNote = document.querySelector('[data-bind="pricing-note"]');
  const benefits = document.querySelector('[data-slot="benefits"]');
  const mapCard = document.querySelector('[data-slot="map"]');
  const sustainability = document.querySelector('[data-slot="sustainability"]');
  const workspace = document.querySelector('[data-slot="workspace"]');
  const wellness = document.querySelector('[data-slot="wellness"]');
  const reserveBtn = document.getElementById('reserve-btn');
  const contactBtn = document.getElementById('contact-host');

  if (!property) {
    if (heroName) heroName.textContent = 'Stay not found';
    if (heroSummary) heroSummary.textContent = 'We could not locate this stay. Please return to the listings page and try another property.';
    if (breadcrumbName) breadcrumbName.textContent = 'Stay not found';
    if (gallery) gallery.innerHTML = '<p class="muted">No media available.</p>';
    return;
  }

  if (breadcrumbName) breadcrumbName.textContent = property.name;
  if (breadcrumbCity) breadcrumbCity.href = `listings.html?city=${encodeURIComponent(property.city)}`;
  if (heroBadge) heroBadge.textContent = property.badge ?? `${property.type} • ${property.city}`;
  if (heroName) heroName.textContent = property.name;
  if (heroSummary) heroSummary.textContent = property.about;

  if (gallery) {
    clearChildren(gallery);
    property.images?.forEach((image) => {
      const img = createElement(`<img loading="lazy" src="${image.src}" alt="${image.alt ?? property.name}" class="animate-in" />`);
      gallery.appendChild(img);
    });
  }

  if (amenitiesContainer) {
    clearChildren(amenitiesContainer);
    property.amenities?.forEach((amenity) => amenitiesContainer.appendChild(buildAmenityChip(amenity)));
  }

  if (goodToKnow) {
    clearChildren(goodToKnow);
    property.goodToKnow?.forEach((item) => goodToKnow.appendChild(buildBenefitItem(item)));
  }

  if (policiesContainer) {
    clearChildren(policiesContainer);
    property.policies?.forEach((policy) => policiesContainer.appendChild(buildPolicy(policy)));
  }

  if (benefits) {
    clearChildren(benefits);
    property.benefits?.forEach((benefit) => benefits.appendChild(buildBenefitItem(benefit)));
  }

  if (sustainability) {
    clearChildren(sustainability);
    if (property.sustainabilityScore || property.greenInitiatives?.length) {
      if (property.sustainabilityScore) {
        sustainability.appendChild(createElement(`<strong>Carbon score: ${property.sustainabilityScore}</strong>`));
      }
      if (property.greenInitiatives?.length) {
        const list = document.createElement('ul');
        property.greenInitiatives.forEach((item) => {
          const li = document.createElement('li');
          li.textContent = item;
          list.appendChild(li);
        });
        sustainability.appendChild(list);
      }
    } else {
      sustainability.appendChild(createElement('<p>No sustainability data yet.</p>'));
    }
  }

  if (workspace) {
    clearChildren(workspace);
    if (property.workspace) {
      if (property.workspace.type) {
        workspace.appendChild(createElement(`<strong>Remote-ready</strong>`));
        workspace.appendChild(createElement(`<p>${property.workspace.type}</p>`));
      }
      if (property.workspace.bandwidth) {
        workspace.appendChild(createElement(`<p>Bandwidth: ${property.workspace.bandwidth}</p>`));
      }
    }
  }

  if (wellness) {
    clearChildren(wellness);
    if (property.wellness?.length) {
      wellness.appendChild(createElement('<strong>Wellness perks</strong>'));
      const list = document.createElement('ul');
      property.wellness.forEach((perk) => {
        const li = document.createElement('li');
        li.textContent = perk;
        list.appendChild(li);
      });
      wellness.appendChild(list);
    }
  }

  if (rating) {
    rating.textContent = `${property.rating.toFixed(1)} ★`;
    rating.setAttribute('aria-label', `Rated ${property.rating.toFixed(1)} out of 5`);
  }
  if (price) {
    price.textContent = formatPrice(property.price, property.currency);
  }
  if (pricingNote) {
    pricingNote.textContent = `Per night • Max ${property.maxGuests} guest${property.maxGuests > 1 ? 's' : ''}`;
  }

  if (mapCard) {
    clearChildren(mapCard);
    if (property.map?.embed) {
      const iframe = createElement(`
        <iframe title="${property.map.title ?? property.name}"
          src="${property.map.embed}"
          loading="lazy"
          referrerpolicy="no-referrer-when-downgrade"></iframe>
      `);
      mapCard.appendChild(iframe);
    }
  }

  const openReservationModal = setupReserveModal(property);
  if (reserveBtn && typeof openReservationModal === 'function') {
    reserveBtn.addEventListener('click', openReservationModal);
  }

  if (contactBtn) {
    if (property.contact?.phone) {
      contactBtn.textContent = `Call ${property.contact.manager ?? 'property manager'}`;
      contactBtn.addEventListener('click', () => {
        window.location.href = `tel:${property.contact.phone.replace(/\s+/g, '')}`;
      });
    } else {
      contactBtn.disabled = true;
    }
  }
}

function setupReserveModal(property) {
  const modal = document.querySelector('[data-reserve-modal]');
  const form = modal?.querySelector('[data-reserve-form]');
  if (!modal || !form) return null;

  const checkInInput = form.querySelector('input[name="check_in"]');
  const nightsSelect = form.querySelector('select[name="nights"]');
  const guestsSelect = form.querySelector('select[name="guests"]');
  const nameInput = form.querySelector('input[name="guest_name"]');
  const emailInput = form.querySelector('input[name="guest_email"]');
  const phoneInput = form.querySelector('input[name="guest_phone"]');
  const requestsInput = form.querySelector('textarea[name="requests"]');
  const submitButton = form.querySelector('button[type="submit"]');
  const priceNode = modal.querySelector('[data-reserve-nightly]');
  const subtotalNode = modal.querySelector('[data-reserve-subtotal]');
  const taxesNode = modal.querySelector('[data-reserve-taxes]');
  const feesNode = modal.querySelector('[data-reserve-fees]');
  const totalNode = modal.querySelector('[data-reserve-total]');
  const nightsNode = modal.querySelector('[data-reserve-nights]');
  const checkOutNode = modal.querySelector('[data-reserve-checkout]');
  const statusNode = modal.querySelector('[data-reserve-status]');
  const propertyNodes = modal.querySelectorAll('[data-reserve-property]');
  const locationNode = modal.querySelector('[data-reserve-location]');
  const coverImage = modal.querySelector('[data-reserve-cover]');
  const overlay = modal.querySelector('[data-reserve-overlay]');
  const profile = loadUserProfile();

  let isOpen = false;

  if (propertyNodes.length) {
    propertyNodes.forEach((node) => {
      node.textContent = property.name;
    });
  }

  if (locationNode) {
    const locality = property.area ? `${property.area}, ${property.city}` : property.city;
    const locationLabel = property.country ? `${locality}, ${property.country}` : locality;
    locationNode.textContent = locationLabel;
  }

  if (coverImage) {
    const heroImage = property.images?.[0];
    if (heroImage?.src) {
      coverImage.src = heroImage.src;
      coverImage.alt = heroImage.alt ?? property.name;
    } else {
      coverImage.remove();
    }
  }

  function ensureGuestOptions() {
    if (!guestsSelect || guestsSelect.dataset.bound === 'true') return;
    clearChildren(guestsSelect);
    const maxGuests = Math.max(1, Number(property.maxGuests) || 1);
    for (let i = 1; i <= maxGuests; i += 1) {
      const option = document.createElement('option');
      option.value = String(i);
      option.textContent = `${i} guest${i > 1 ? 's' : ''}`;
      if (i === Math.min(maxGuests, 2)) {
        option.selected = true;
      }
      guestsSelect.appendChild(option);
    }
    guestsSelect.dataset.bound = 'true';
  }

  function setDefaultDates() {
    if (!checkInInput) return;
    const today = new Date();
    const minDate = today.toISOString().split('T')[0];
    checkInInput.min = minDate;
    if (!checkInInput.value) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      checkInInput.value = defaultDate.toISOString().split('T')[0];
    }
  }

  function updateSummary() {
    const totals = calculateBookingTotals(property, nightsSelect?.value);
    if (priceNode) priceNode.textContent = formatPrice(totals.nightlyRate, totals.currency);
    if (subtotalNode) subtotalNode.textContent = formatPrice(totals.subtotal, totals.currency);
    if (taxesNode) taxesNode.textContent = formatPrice(totals.tax, totals.currency);
    if (feesNode) feesNode.textContent = formatPrice(totals.fees, totals.currency);
    if (totalNode) totalNode.textContent = formatPrice(totals.total, totals.currency);
    if (nightsNode) nightsNode.textContent = totals.nights;

    const guestCount = Number(guestsSelect?.value) || 1;
    const guestLabel = `${guestCount} guest${guestCount > 1 ? 's' : ''}`;

    if (checkInInput) {
      if (!checkInInput.value) {
        if (checkOutNode) checkOutNode.textContent = '—';
        if (statusNode) {
          statusNode.textContent = `Select your dates and we’ll hold ${property.name} while you confirm.`;
        }
        return;
      }

      const checkInDate = new Date(checkInInput.value);
      let checkoutLabel = '';
      if (checkInDate && !Number.isNaN(checkInDate.getTime())) {
        const checkOutDate = new Date(checkInDate);
        checkOutDate.setDate(checkOutDate.getDate() + totals.nights);
        checkoutLabel = formatDisplayDate(checkOutDate);
        if (checkOutNode) checkOutNode.textContent = checkoutLabel;
      } else if (checkOutNode) {
        checkOutNode.textContent = '—';
      }

      if (statusNode) {
        const checkInLabel = formatDisplayDate(checkInInput.value) || 'your selected date';
        const nightsLabel = `${totals.nights} night${totals.nights > 1 ? 's' : ''}`;
        const checkoutText = checkoutLabel || 'checkout to be decided';
        statusNode.textContent = `We’ll hold ${property.name} for ${guestLabel}, ${nightsLabel} from ${checkInLabel} to ${checkoutText}.`;
      }
    }
  }

  function closeModal() {
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', 'true');
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleKeydown);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeModal();
    }
  }

  function openModal() {
    form.reset();
    ensureGuestOptions();
    setDefaultDates();
    if (nightsSelect) {
      const desired = nightsSelect.dataset.default || '2';
      if (Array.from(nightsSelect.options).some((option) => option.value === desired)) {
        nightsSelect.value = desired;
      } else if (nightsSelect.options.length > 0) {
        nightsSelect.selectedIndex = 0;
      }
    }
    if (guestsSelect) {
      const defaultGuests = Math.min(Number(property.maxGuests) || 1, 2);
      if (Array.from(guestsSelect.options).some((option) => option.value === String(defaultGuests))) {
        guestsSelect.value = String(defaultGuests);
      } else if (guestsSelect.options.length > 0) {
        guestsSelect.selectedIndex = 0;
      }
    }
    if (profile) {
      if (nameInput && profile.name) nameInput.value = profile.name;
      if (emailInput && profile.email) emailInput.value = profile.email;
      if (phoneInput && profile.phone) phoneInput.value = profile.phone;
    }
    if (requestsInput) requestsInput.value = '';
    form.dataset.propertyId = property.id;
    modal.removeAttribute('hidden');
    modal.classList.add('is-open');
    document.body.classList.add('modal-open');
    isOpen = true;
    document.addEventListener('keydown', handleKeydown);
    updateSummary();
    if (nameInput) {
      try {
        nameInput.focus({ preventScroll: true });
      } catch (error) {
        nameInput.focus();
      }
    }
  }

  const closeControls = modal.querySelectorAll('[data-action="close-reserve"]');
  closeControls.forEach((control) => {
    control.addEventListener('click', closeModal);
  });

  if (overlay) {
    overlay.addEventListener('click', closeModal);
  }

  nightsSelect?.addEventListener('change', updateSummary);
  checkInInput?.addEventListener('change', updateSummary);
  guestsSelect?.addEventListener('change', updateSummary);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (form.reportValidity && !form.reportValidity()) {
      return;
    }

    const payload = {
      propertyId: property.id,
      checkIn: checkInInput?.value,
      nights: Number(nightsSelect?.value) || 1,
      guests: Number(guestsSelect?.value) || 1,
      guest: {
        name: nameInput?.value.trim() ?? '',
        email: emailInput?.value.trim() ?? '',
        phone: phoneInput?.value.trim() ?? ''
      },
      requests: requestsInput?.value.trim() ?? ''
    };

    if (!payload.checkIn) {
      showToast('Select a check-in date to continue.', 'warning');
      return;
    }
    if (!payload.guest.name || !payload.guest.email) {
      showToast('Please add your name and email to reserve.', 'warning');
      return;
    }

    if (payload.guests > (Number(property.maxGuests) || payload.guests)) {
      showToast(`This stay allows up to ${property.maxGuests} guests.`, 'warning');
      return;
    }

    const originalLabel = submitButton ? submitButton.textContent : '';
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Securing your stay…';
    }

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      let responseData = null;
      try {
        responseData = await response.json();
      } catch (parseError) {
        responseData = null;
      }
      if (!response.ok || !responseData?.ok) {
        const errorCode = responseData?.error || 'reserve_failed';
        throw new Error(errorCode);
      }

      const booking = responseData.booking;
      addStoredBooking(booking);

      const updatedProfile = {
        name: payload.guest.name || profile?.name || '',
        email: payload.guest.email || profile?.email || '',
        phone: payload.guest.phone || profile?.phone || ''
      };
      if (updatedProfile.name || updatedProfile.email || updatedProfile.phone) {
        saveUserProfile(updatedProfile);
      }

      showToast(`Reservation confirmed! Confirmation ID ${booking.id}.`, 'success');
      form.reset();
      closeModal();
      setTimeout(() => {
        window.location.href = 'user.html';
      }, 1200);
    } catch (error) {
      let message = error.message || 'reserve_failed';
      if (message === 'guests_exceed') {
        message = `This stay allows up to ${property.maxGuests} guests.`;
      } else if (message === 'property_not_found') {
        message = 'This stay is no longer available.';
      } else if (message === 'invalid_input') {
        message = 'Please review the reservation details and try again.';
      } else if (message === 'reserve_failed') {
        message = 'Unable to reserve this stay. Please try again.';
      }
      showToast(message, 'warning');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = originalLabel || 'Confirm reservation hold';
      }
    }
  });

  return openModal;
}

function renderUserBookings(bookings = []) {
  const container = document.querySelector('[data-slot="bookings"]');
  const emptyMessage = document.querySelector('[data-bookings-empty]');
  if (!container) return;

  clearChildren(container);

  if (!bookings || bookings.length === 0) {
    if (emptyMessage) emptyMessage.removeAttribute('hidden');
    return;
  }

  if (emptyMessage) emptyMessage.setAttribute('hidden', 'true');

  const upcoming = [...bookings].sort((a, b) => {
    const aDate = new Date(a.checkIn).getTime();
    const bDate = new Date(b.checkIn).getTime();
    return aDate - bDate;
  });

  upcoming.forEach((booking) => {
    const propertyLabel = booking.propertyName || 'OYO.plus stay';
    const cityLabel = booking.city || '';
    const checkInLabel = formatDisplayDate(booking.checkIn);
    const checkOutLabel = formatDisplayDate(booking.checkOut);
    const totalValue = booking.total ?? booking.totalAmount ?? booking.amountDue ?? 0;
    const totalLabel = formatPrice(totalValue, booking.currency || 'INR');
    const nightsDisplay = booking.nights ?? '—';
    const guestsDisplay = booking.guests ?? '—';
    const imageMarkup = booking.propertyImage
      ? `<div class="booking-cover"><img src="${booking.propertyImage}" alt="${propertyLabel}" loading="lazy"></div>`
      : '';
    const card = createElement(`
      <article class="booking-card animate-in">
        ${imageMarkup}
        <div class="booking-header">
          <div>
            <h3>${propertyLabel}</h3>
            <p class="muted">${cityLabel}</p>
          </div>
          <span class="booking-badge">${formatBookingStatus(booking.status)}</span>
        </div>
        <div class="booking-meta">
          <div>
            <span class="label">Check-in</span>
            <strong>${checkInLabel || 'TBD'}</strong>
          </div>
          <div>
            <span class="label">Check-out</span>
            <strong>${checkOutLabel || 'TBD'}</strong>
          </div>
          <div>
            <span class="label">Guests</span>
            <strong>${guestsDisplay}</strong>
          </div>
          <div>
            <span class="label">Nights</span>
            <strong>${nightsDisplay}</strong>
          </div>
          <div>
            <span class="label">Total</span>
            <strong>${totalLabel}</strong>
          </div>
        </div>
        <div class="booking-footer">
          <button class="btn ghost" type="button" data-action="view-stay" data-property-id="${booking.propertyId}">View stay</button>
          <p class="muted">Confirmation ID ${booking.id}</p>
        </div>
      </article>
    `);
    container.appendChild(card);
  });
}

async function initCorporatePage() {
  const programsContainer = document.querySelector('[data-slot="corporate-programs"]');
  const statsContainer = document.querySelector('[data-slot="corporate-stats"]');
  const form = document.getElementById('corporate-form');
  const response = document.getElementById('corporate-response');

  const data = await fetchJSON('data/corporate.json');
  if (programsContainer) {
    clearChildren(programsContainer);
    data?.programs?.forEach((program) => {
      const card = createElement(`
        <article class="program-card animate-in">
          <h3>${program.title}</h3>
          <p>${program.description}</p>
          <ul class="benefit-list"></ul>
        </article>
      `);
      const list = card.querySelector('.benefit-list');
      program.benefits?.forEach((benefit) => list.appendChild(buildBenefitItem(benefit)));
      programsContainer.appendChild(card);
    });
  }
  if (statsContainer) {
    clearChildren(statsContainer);
    data?.stats?.forEach((stat) => {
      statsContainer.appendChild(createElement(`
        <div class="stat-card animate-in">
          <strong>${stat.figure}</strong>
          <span>${stat.caption}</span>
        </div>
      `));
    });
  }

if (form) {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const company = formData.get('company');
    const email = formData.get('email');
    if (!company || !email) {
      showToast('Please add your company name and work email.', 'warning');
      return;
    }
    fetch('/api/corporate-enquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    })
      .then((res) => {
        if (!res.ok) throw new Error('corp_failed');
        if (response) {
          response.textContent = `Thanks ${company}! Our corporate team will contact you at ${email} within one business day.`;
        }
        showToast(`Enquiry received. We'll email ${email} shortly.`, 'success');
        form.reset();
      })
      .catch(() => {
        showToast('Unable to submit enquiry right now. Please try again.', 'warning');
      });
  });
}
}

async function initAboutPage() {
  const statsContainer = document.querySelector('[data-slot="about-stats"]');
  const timelineContainer = document.querySelector('[data-slot="about-timeline"]');
  const cultureContainer = document.querySelector('[data-slot="about-culture"]');
  const data = await fetchJSON('data/about.json');
  if (statsContainer) {
    clearChildren(statsContainer);
    data?.stats?.forEach((stat) => {
      statsContainer.appendChild(createElement(`
        <div class="stat-card animate-in">
          <strong>${stat.figure}</strong>
          <span>${stat.caption}</span>
        </div>
      `));
    });
  }
  if (timelineContainer) {
    clearChildren(timelineContainer);
    data?.timeline?.forEach((item) => {
      timelineContainer.appendChild(createElement(`
        <div class="timeline-item animate-in">
          <h3>${item.title}</h3>
          <p>${item.description}</p>
        </div>
      `));
    });
  }
  if (cultureContainer) {
    clearChildren(cultureContainer);
    data?.culture?.forEach((item) => {
      cultureContainer.appendChild(createElement(`
        <article class="culture-card animate-in">
          <h3>${item.title}</h3>
          <p>${item.copy}</p>
        </article>
      `));
    });
  }
}

function attachFaqListeners(container) {
  const items = container.querySelectorAll('.faq-item');
  items.forEach((item) => {
    const question = item.querySelector('.faq-question');
    const indicator = question?.querySelector('span:last-child');
    if (!question) return;
    question.setAttribute('aria-expanded', 'false');
    question.addEventListener('click', () => {
      const isOpen = item.classList.toggle('is-open');
      question.setAttribute('aria-expanded', String(isOpen));
      if (indicator) {
        indicator.textContent = isOpen ? '–' : '+';
      }
    });
  });
}

async function initSupportPage() {
  const cardsContainer = document.querySelector('[data-slot="support-cards"]');
  const faqContainer = document.querySelector('[data-slot="faqs"]');
  const data = await fetchJSON('data/support.json');

  if (cardsContainer) {
    clearChildren(cardsContainer);
    data?.cards?.forEach((card) => {
      const cardEl = createElement(`
        <article class="support-card animate-in">
          <h3>${card.title}</h3>
          <p>${card.description}</p>
          <div class="support-actions"></div>
        </article>
      `);
      const actionsEl = cardEl.querySelector('.support-actions');
      card.actions?.forEach((action) => {
        if (action.type === 'link') {
          actionsEl.appendChild(createElement(`
            <div class="contact-row">
              <span>${action.icon ?? ''}</span>
              <a class="link" href="${action.href}">${action.label}</a>
            </div>
          `));
        } else if (action.type === 'button') {
          actionsEl.appendChild(createElement(`
            <button class="btn ${action.style === 'ghost' ? 'ghost' : 'primary'} support-action" data-action-id="${action.id}">${action.label}</button>
          `));
        }
      });
      if (card.footer) {
        cardEl.appendChild(createElement(`<p>${card.footer}</p>`));
      }
      if (card.footerHtml) {
        const footer = document.createElement('p');
        footer.innerHTML = card.footerHtml;
        cardEl.appendChild(footer);
      }
      cardsContainer.appendChild(cardEl);
    });

    cardsContainer.addEventListener('click', (event) => {
      const target = event.target.closest('.support-action');
      if (!target) return;
      const actionId = target.dataset.actionId;
      if (actionId === 'open-booking') {
        showToast('Booking manager opening soon. Integrate with your portal here.', 'info');
      }
      if (actionId === 'partner-desk') {
        showToast('Partner desk alerted! We will contact you shortly.', 'success');
      }
    });
  }

  if (faqContainer) {
    clearChildren(faqContainer);
    data?.faqs?.forEach((faq) => {
      faqContainer.appendChild(createElement(`
        <article class="faq-item animate-in">
          <button class="faq-question" type="button">
            <span>${faq.question}</span>
            <span>+</span>
          </button>
          <div class="faq-answer">
            <p>${faq.answer}</p>
          </div>
        </article>
      `));
    });
    attachFaqListeners(faqContainer);
  }
}

function setupOfferControls() {
  const offerTrack = document.querySelector('.offer-track');
  const controls = document.querySelectorAll('.offers .pill[data-direction]');
  controls.forEach((control) => {
    control.addEventListener('click', () => {
      if (!offerTrack) return;
      const direction = control.dataset.direction === 'next' ? 1 : -1;
      const scrollAmount = offerTrack.clientWidth * 0.9;
      offerTrack.scrollBy({ left: direction * scrollAmount, behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
    });
  });
}

function initNavigation() {
  if (navLinks.length && activePage) {
    navLinks.forEach((link) => {
      if (link.dataset.nav === activePage) {
        link.classList.add('is-active');
      }
    });
  }

  const closeMenu = () => {
    if (!nav || !menuToggle) return;
    nav.classList.remove('is-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
      const isOpen = nav.classList.toggle('is-open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });

    navLinks.forEach((link) => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 840) {
          closeMenu();
        }
      });
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 840) {
        closeMenu();
      }
    });
  }
}

async function initHomePage() {
  renderSkeletons(document.querySelector('[data-slot="collections"]'), 4, 'card');
  renderSkeletons(document.querySelector('[data-slot="destinations"]'), 6, 'chip');
  renderSkeletons(document.querySelector('[data-slot="offers"]'), 3, 'offer');
  const homeData = await fetchJSON('data/home.json');
  if (!homeData) return;
  renderCollections(homeData.collections);
  renderDestinations(homeData.destinations);
  renderOffers(homeData.offers);
  renderTrust(homeData.trust);
  renderTestimonials(homeData.testimonials);
  renderDownload(homeData.download);
  renderDifferentiators(homeData.differentiators);
  // Preload properties for faster search responses
  loadProperties();
  setupPromoForm();
  handleMembershipDeepLink();
}

async function initPage() {
  setupSearchForm();
  switch (activePage) {
    case 'home':
      await initHomePage();
      break;
    case 'listings':
      await initListingsPage();
      break;
    case 'detail':
      await initDetailPage();
      break;
    case 'corporate':
      await initCorporatePage();
      break;
    case 'about':
      await initAboutPage();
      break;
    case 'support':
      await initSupportPage();
      break;
    case 'auth':
      await initAuthPage();
      break;
    case 'user':
      await initUserPage();
      break;
    default:
      break;
  }
}

function initGlobalInteractions() {
  initNavigation();
  setupMembershipLinks();
}

document.addEventListener('DOMContentLoaded', () => {
  initGlobalInteractions();
  initPage();
});

function navigateToListings(filters = {}) {
  const params = new URLSearchParams();
  if (filters.city && filters.city !== 'All Cities') params.set('city', filters.city);
  if (filters.guests) params.set('guests', filters.guests);
  if (filters.budget && filters.budget !== 'any') params.set('budget', filters.budget);
  if (filters.type && filters.type !== 'any') params.set('type', filters.type);
  if (filters.rating && filters.rating !== 'any') params.set('rating', filters.rating);
  if (filters.workspace) params.set('workspace', 'true');
  if (filters.wellness) params.set('wellness', 'true');
  if (filters.near) params.set('near', 'true');
  window.location.href = params.toString() ? `listings.html?${params.toString()}` : 'listings.html';
}

function setupQuickSearches(executeSearch) {
  const quickButtons = document.querySelectorAll('[data-quick-search]');
  quickButtons.forEach((button) => {
    button.addEventListener('click', () => {
      try {
        const config = JSON.parse(button.dataset.quickSearch || '{}');
        const filters = {
          city: config.city ?? '',
          guests: config.guests ?? '',
          budget: 'any',
          type: config.type ?? 'any',
          rating: 'any',
          workspace: config.workspace ?? false,
          wellness: config.wellness ?? false,
          near: config.near ?? false
        };
        executeSearch(filters, { redirect: config.redirect || false });
      } catch (error) {
        console.error('Invalid quick search config', error);
      }
    });
  });
}

function setupCityShortcuts() {
  const buttons = document.querySelectorAll('.city-toggle[data-city]');
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const city = button.dataset.city;
      if (city === 'All Cities') {
        navigateToListings({});
      } else {
        navigateToListings({ city });
      }
    });
  });
}

function setupMetricShortcuts() {
  const metrics = document.querySelectorAll('.metric-link');
  metrics.forEach((link) => {
    link.addEventListener('click', () => {
      const city = link.dataset.city;
      navigateToListings({ city });
    });
  });
}

function setupPromoForm() {
  const form = document.querySelector('[data-form="promo"]');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = form.querySelector('input[type="email"]')?.value;
    if (!email) {
      showToast('Please enter a valid email.', 'warning');
      return;
    }
    fetch('/api/promo-subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then((response) => {
        if (!response.ok) throw new Error('promo_failed');
        showToast('Thanks! We will keep you posted with exclusive deals.', 'success');
        form.reset();
      })
      .catch(() => {
        showToast('Unable to save subscription. Please try again.', 'warning');
      });
  });
}

function initAuthPage() {
  const wrapper = document.querySelector('[data-auth]');
  if (!wrapper) return;
  const tabs = wrapper.querySelectorAll('.auth-tab');
  const forms = wrapper.querySelectorAll('.auth-form');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      tabs.forEach((item) => item.classList.toggle('is-active', item === tab));
      forms.forEach((form) => form.classList.toggle('is-active', form.id === `${target}-form`));
    });
  });

  const toggleButtons = wrapper.querySelectorAll('.toggle-password');
  toggleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.previousElementSibling;
      if (!field) return;
      const isPassword = field.type === 'password';
      field.type = isPassword ? 'text' : 'password';
      button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      button.textContent = isPassword ? '🙈' : '👁️';
    });
  });

  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(loginForm);
      const email = (data.get('email') || '').toString().trim();
      const password = (data.get('password') || '').toString().trim();
      if (!email || !password) {
        showToast('Enter your email and password to continue.', 'warning');
        return;
      }

      const existingProfile = loadUserProfile() || {};
      const derivedName = existingProfile.name
        || (email.includes('@') ? email.split('@')[0] : email)
        || 'Traveller';
      const profile = {
        ...existingProfile,
        name: derivedName,
        email,
        phone: existingProfile.phone || '',
        createdAt: existingProfile.createdAt || new Date().toISOString(),
      };
      saveUserProfile(profile);

      showToast(`Welcome back, ${derivedName}! Redirecting to your dashboard.`, 'success');
      loginForm.reset();
      setTimeout(() => {
        window.location.href = 'user.html';
      }, 600);
    });
  }
  if (signupForm) {
    signupForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(signupForm);
      const name = (data.get('name') || 'traveller').toString();
      const email = (data.get('email') || '').toString();
      const phone = (data.get('phone') || '').toString();
      saveUserProfile({
        name,
        email,
        phone,
        createdAt: new Date().toISOString()
      });
      showToast(`Hello ${name}! Your OYO.plus account is ready.`, 'success');
      signupForm.reset();
      setTimeout(() => {
        window.location.href = 'user.html';
      }, 600);
    });
  }

  wrapper.querySelectorAll('.btn.social').forEach((button) => {
    button.addEventListener('click', () => {
      const provider = button.dataset.social;
      showToast(`Connecting with ${provider}...`, 'info');
    });
  });

  const faqContainer = document.querySelector('.auth-faq .faq-list');
  if (faqContainer) {
    attachFaqListeners(faqContainer);
  }
}

function initUserPage() {
  const profile = loadUserProfile();
  if (!profile) {
    window.location.replace('auth.html');
    return;
  }

  const name = (profile.name || 'Traveller').trim() || 'Traveller';
  const email = (profile.email || '').trim();
  const phone = (profile.phone || '').trim();

  const firstName = name.split(/\s+/)[0] || name;
  document.title = `OYO.plus | ${name}'s account`;

  document.querySelectorAll('[data-user-name]').forEach((node) => {
    node.textContent = name;
  });

  const emailNode = document.querySelector('[data-user-email]');
  if (emailNode) {
    emailNode.textContent = email || 'Add your email to receive updates';
  }

  const phoneNode = document.querySelector('[data-user-phone]');
  if (phoneNode) {
    phoneNode.textContent = phone || 'Add your mobile number to enable OTP login';
  }

  const membershipNode = document.querySelector('[data-membership-date]');
  if (membershipNode) {
    membershipNode.textContent = formatMembershipDate(profile.createdAt);
  }

  const initialsNode = document.querySelector('[data-user-initials]');
  if (initialsNode) {
    initialsNode.textContent = getUserInitials(name);
  }

  const title = document.querySelector('[data-page-title]');
  if (title) {
    title.textContent = `Hey ${firstName}!`;
  }

  const logoutButtons = document.querySelectorAll('[data-action="logout"]');
  logoutButtons.forEach((button) => {
    button.addEventListener('click', () => {
      clearUserProfile();
      window.location.href = 'auth.html';
    });
  });

  const exploreButtons = document.querySelectorAll('[data-action="find-stays"]');
  exploreButtons.forEach((button) => {
    button.addEventListener('click', () => {
      window.location.href = 'listings.html';
    });
  });

  const bookings = loadStoredBookings();
  renderUserBookings(bookings);

  const bookingsContainer = document.querySelector('[data-slot="bookings"]');
  if (bookingsContainer) {
    bookingsContainer.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action="view-stay"]');
      if (!target) return;
      const propertyId = target.dataset.propertyId;
      if (propertyId) {
        window.location.href = `stay-detail.html?id=${propertyId}`;
      }
    });
  }
}

function showToast(message, tone = 'info') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${tone}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 3200);
}

function formatDisplayDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleDateString('en-IN', options);
  } catch (error) {
    console.warn('Unable to format date', error);
    return '';
  }
}

function formatMembershipDate(value) {
  const formatted = formatDisplayDate(value);
  if (formatted) return formatted;
  return formatDisplayDate(new Date()) || '';
}

function formatBookingStatus(status) {
  if (!status) return 'Reserved';
  const normalized = status.toLowerCase();
  if (normalized === 'reserved') return 'Reserved';
  if (normalized === 'pending_payment') return 'Pending payment';
  if (normalized === 'confirmed') return 'Confirmed';
  if (normalized === 'cancelled') return 'Cancelled';
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getUserInitials(name) {
  if (!name) return 'OY';
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase());
  if (parts.length === 0) return 'OY';
  return parts.slice(0, 2).join('');
}

function matchWorkspace(property, flag) {
  if (!flag) return true;
  return Boolean(property.workspace?.type);
}

function matchWellness(property, flag) {
  if (!flag) return true;
  return Array.isArray(property.wellness) && property.wellness.length > 0;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes';
  }
  return Boolean(value);
}
