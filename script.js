const nav = document.querySelector('.main-nav');
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = nav ? Array.from(nav.querySelectorAll('a[data-nav]')) : [];
const activePage = document.body?.dataset.page;
const dataCache = new Map();
const pageState = {
  properties: null
};

const numberFormatters = {
  INR: new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  })
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let toastContainer;

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

  if (reserveBtn) {
    reserveBtn.addEventListener('click', () => {
      showToast(`Hold tight! We'll start a booking flow for ${property.name}.`, 'success');
    });
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
      if (response) {
        response.textContent = `Thanks ${company}! Our corporate team will contact you at ${email} within one business day.`;
      }
      showToast(`Enquiry received. We'll email ${email} shortly.`, 'success');
      form.reset();
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
    default:
      break;
  }
}

function initGlobalInteractions() {
  initNavigation();
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
  const buttons = document.querySelectorAll('.city-bar [data-city]');
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
    showToast('Thanks! We will keep you posted with exclusive deals.', 'success');
    form.reset();
  });
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
