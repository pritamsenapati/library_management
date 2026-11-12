/**
 * The Reading Room - Frontend Application Scripts
 * Modern interactions, live search, 3D preview, theme management, and modal system.
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initFlashMessages();
  initLiveCatalog();
  initBookModal();
  initBookFormPreview();
  initAuthForm();
  initLoansFilter();
  initAdminTableFilter();
  initKeyboardShortcuts();
});

/* ==========================================================================
   1. Theme Management (Light / Dark Mode)
   ========================================================================== */
function initTheme() {
  const toggleBtn = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem('reading_room_theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  setTheme(savedTheme);

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      setTheme(next);
      localStorage.setItem('reading_room_theme', next);
    });
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', theme === 'dark' ? '#101613' : '#1a382b');
  }
}

/* ==========================================================================
   2. Responsive Mobile Navigation
   ========================================================================== */
function initNavigation() {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-navigation');
  const backdrop = document.getElementById('drawer-backdrop');

  if (!toggle || !nav) return;

  function toggleMenu(show) {
    const isExpanded = typeof show === 'boolean' ? show : toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(isExpanded));
    nav.classList.toggle('is-open', isExpanded);
    if (backdrop) backdrop.style.display = isExpanded ? 'block' : 'none';
  }

  toggle.addEventListener('click', () => toggleMenu());
  if (backdrop) backdrop.addEventListener('click', () => toggleMenu(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      toggleMenu(false);
    }
  });
}

/* ==========================================================================
   3. Auto-Dismissing Flash / Toast Notifications
   ========================================================================== */
function initFlashMessages() {
  const flashes = document.querySelectorAll('.flash');

  flashes.forEach(flash => {
    const closeBtn = flash.querySelector('.flash-close');
    const progress = flash.querySelector('.flash-progress');

    let timer = setTimeout(() => dismissFlash(flash), 5000);

    // Pause dismissal on mouse hover
    flash.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      if (progress) progress.style.animationPlayState = 'paused';
    });

    flash.addEventListener('mouseleave', () => {
      if (progress) progress.style.animationPlayState = 'running';
      timer = setTimeout(() => dismissFlash(flash), 3000);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => dismissFlash(flash));
    }
  });

  function dismissFlash(el) {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.25s ease';
    setTimeout(() => el.remove(), 250);
  }
}

/* ==========================================================================
   4. Live Catalog Search, Sorting & View Toggle
   ========================================================================== */
function initLiveCatalog() {
  const container = document.getElementById('books-container');
  if (!container) return;

  const liveSearch = document.getElementById('live-search-input');
  const sortSelect = document.getElementById('book-sort-select');
  const gridBtn = document.getElementById('view-grid-btn');
  const listBtn = document.getElementById('view-list-btn');
  const noMatches = document.getElementById('no-live-matches');
  const clearFilterBtn = document.getElementById('clear-live-search');

  const bookCards = Array.from(container.querySelectorAll('.book-card'));

  // Saved View Mode
  const savedView = localStorage.getItem('reading_room_view') || 'grid';
  setViewMode(savedView);

  if (gridBtn && listBtn) {
    gridBtn.addEventListener('click', () => {
      setViewMode('grid');
      localStorage.setItem('reading_room_view', 'grid');
    });

    listBtn.addEventListener('click', () => {
      setViewMode('list');
      localStorage.setItem('reading_room_view', 'list');
    });
  }

  function setViewMode(mode) {
    if (mode === 'list') {
      container.classList.add('is-list-view');
      listBtn?.classList.add('active');
      gridBtn?.classList.remove('active');
    } else {
      container.classList.remove('is-list-view');
      gridBtn?.classList.add('active');
      listBtn?.classList.remove('active');
    }
  }

  // Live Instant Search Filter
  if (liveSearch) {
    liveSearch.addEventListener('input', () => {
      const q = liveSearch.value.trim().toLowerCase();
      let matchedCount = 0;

      bookCards.forEach(card => {
        const title = card.dataset.title || '';
        const author = card.dataset.author || '';
        const category = card.dataset.category || '';
        const isbn = card.dataset.isbn || '';

        const match = !q || title.includes(q) || author.includes(q) || category.includes(q) || isbn.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) matchedCount++;
      });

      if (noMatches) {
        noMatches.style.display = matchedCount === 0 ? 'block' : 'none';
      }
    });

    if (clearFilterBtn) {
      clearFilterBtn.addEventListener('click', () => {
        liveSearch.value = '';
        liveSearch.dispatchEvent(new Event('input'));
        liveSearch.focus();
      });
    }
  }

  // Sorting
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      const val = sortSelect.value;
      const sorted = [...bookCards].sort((a, b) => {
        if (val === 'title-asc') {
          return (a.dataset.title || '').localeCompare(b.dataset.title || '');
        } else if (val === 'title-desc') {
          return (b.dataset.title || '').localeCompare(a.dataset.title || '');
        } else if (val === 'author-asc') {
          return (a.dataset.author || '').localeCompare(b.dataset.author || '');
        } else if (val === 'availability') {
          const availA = parseInt(a.dataset.available || '0', 10);
          const availB = parseInt(b.dataset.available || '0', 10);
          return availB - availA;
        }
        return 0;
      });

      sorted.forEach(card => container.appendChild(card));
    });
  }
}

/* ==========================================================================
   5. Quick View Book Modal
   ========================================================================== */
function initBookModal() {
  const modal = document.getElementById('book-modal');
  const closeBtn = document.getElementById('modal-close');
  const content = document.getElementById('modal-content');

  if (!modal || !content) return;

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-trigger="preview"]');
    if (!trigger) return;

    const card = trigger.closest('.book-card');
    if (!card) return;

    const title = card.querySelector('.book-heading')?.textContent.trim() || '';
    const author = card.querySelector('.book-author-name')?.textContent.replace(/^by\s+/i, '').trim() || '';
    const category = card.dataset.category || '';
    const isbn = card.dataset.isbn || '';
    const available = parseInt(card.dataset.available || '0', 10);
    const total = card.dataset.total || '1';
    const desc = card.dataset.description || 'No detailed description available for this title yet. Check back soon or visit our librarian desk.';
    const borrowUrl = card.dataset.borrowUrl || '#';

    const hasCover = card.querySelector('.book-cover-frame')?.classList.contains('has-cover-image');
    const coverPalette = card.querySelector('.book-cover-frame')?.className.match(/cover-palette-\d/)?.[0] || 'cover-palette-0';

    content.innerHTML = `
      <div class="modal-layout">
        <div class="modal-cover-wrap">
          <div class="book-cover-frame ${coverPalette} ${hasCover ? 'has-cover-image' : ''}">
            ${hasCover && isbn ? `<img class="book-cover-image" src="https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false" alt="${title}" onerror="this.remove();">` : ''}
            <div class="fallback-cover">
              <div class="fallback-spine"></div>
              <div class="fallback-category">${category}</div>
              <h4 class="fallback-title">${title}</h4>
              <div class="fallback-line"></div>
              <div class="fallback-author">${author}</div>
            </div>
          </div>
        </div>

        <div class="modal-details">
          <div class="card-meta-top">
            <span class="category-badge">${category}</span>
            <span class="availability-badge ${available > 0 ? 'in-stock' : 'out-of-stock'}">
              <span class="status-pulse"></span>
              ${available > 0 ? `Available (${available} left)` : 'All on loan'}
            </span>
          </div>

          <h3 class="modal-title" id="modal-book-title">${title}</h3>
          <p class="modal-author">by ${author}</p>

          <div class="modal-desc-box">
            <p>${desc}</p>
          </div>

          <div class="modal-meta-grid">
            <div class="modal-meta-item">
              <span>Catalog Reference</span>
              <strong>${isbn ? `ISBN ${isbn}` : 'Local Archive'}</strong>
            </div>
            <div class="modal-meta-item">
              <span>Stock Status</span>
              <strong>${available} of ${total} copies in library</strong>
            </div>
          </div>

          <div class="modal-actions">
            ${available > 0 
              ? `<a href="${borrowUrl}" class="button button-primary button-full"><span>Borrow This Book (21 Days)</span> →</a>` 
              : `<button class="button button-disabled button-full" disabled>Currently Checked Out</button>`}
          </div>
        </div>
      </div>
    `;

    modal.showModal();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => modal.close());
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.close();
  });
}

/* ==========================================================================
   6. Add/Edit Book Form - Live Interactive Cover Preview
   ========================================================================== */
function initBookFormPreview() {
  const form = document.getElementById('book-entry-form');
  if (!form) return;

  const titleInput = document.getElementById('book-title-input');
  const authorInput = document.getElementById('book-author-input');
  const catInput = document.getElementById('book-category-input');
  const isbnInput = document.getElementById('book-isbn-input');
  const copiesInput = document.getElementById('book-copies-input');
  const descInput = document.getElementById('book-desc-input');

  const previewFrame = document.getElementById('preview-cover-frame');
  const previewImg = document.getElementById('preview-cover-img');
  const previewFallback = document.getElementById('preview-fallback-cover');
  const previewTitle = document.getElementById('preview-title-text');
  const previewAuthor = document.getElementById('preview-author-text');
  const previewCat = document.getElementById('preview-cat-text');
  const previewHeading = document.getElementById('preview-heading');
  const previewAuthorName = document.getElementById('preview-author');
  const previewBadgeCat = document.getElementById('preview-badge-cat');
  const previewCopies = document.getElementById('preview-copies-text');
  const previewSnippet = document.getElementById('preview-desc-snippet');
  const previewIsbn = document.getElementById('preview-isbn-text');

  function updatePreview() {
    const t = titleInput?.value.trim() || 'Your Book Title';
    const a = authorInput?.value.trim() || 'Author Name';
    const c = catInput?.value.trim() || 'General';
    const isbn = isbnInput?.value.trim() || '';
    const copies = copiesInput?.value || '1';
    const desc = descInput?.value.trim() || 'Book description will appear here on your catalog shelves.';

    if (previewTitle) previewTitle.textContent = t;
    if (previewHeading) previewHeading.textContent = t;
    if (previewAuthor) previewAuthor.textContent = a;
    if (previewAuthorName) previewAuthorName.textContent = 'by ' + a;
    if (previewCat) previewCat.textContent = c;
    if (previewBadgeCat) previewBadgeCat.textContent = c;
    if (previewCopies) previewCopies.textContent = `${copies} copies`;
    if (previewSnippet) previewSnippet.textContent = desc;
    if (previewIsbn) previewIsbn.textContent = isbn ? `ISBN ${isbn}` : 'Not set';

    if (isbn && previewImg && previewFallback) {
      previewImg.src = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg?default=false`;
      previewImg.style.display = 'block';
      previewFallback.style.display = 'none';
      previewFrame?.classList.add('has-cover-image');
    } else if (previewImg && previewFallback) {
      previewImg.style.display = 'none';
      previewFallback.style.display = 'flex';
      previewFrame?.classList.remove('has-cover-image');
    }
  }

  [titleInput, authorInput, catInput, isbnInput, copiesInput, descInput].forEach(inp => {
    if (inp) inp.addEventListener('input', updatePreview);
  });

  // Suggestion category chips
  document.querySelectorAll('.quick-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      if (catInput) {
        catInput.value = btn.dataset.category || '';
        updatePreview();
      }
    });
  });

  // Number Stepper (+ / -)
  const decBtn = document.getElementById('copies-dec');
  const incBtn = document.getElementById('copies-inc');
  if (decBtn && copiesInput) {
    decBtn.addEventListener('click', () => {
      const cur = parseInt(copiesInput.value, 10) || 0;
      if (cur > 0) {
        copiesInput.value = cur - 1;
        updatePreview();
      }
    });
  }
  if (incBtn && copiesInput) {
    incBtn.addEventListener('click', () => {
      const cur = parseInt(copiesInput.value, 10) || 0;
      copiesInput.value = cur + 1;
      updatePreview();
    });
  }

  updatePreview();
}

/* ==========================================================================
   7. Authentication Form (Password Visibility & Strength Meter)
   ========================================================================== */
function initAuthForm() {
  const toggleBtn = document.querySelector('.password-toggle-btn');
  const passInput = document.getElementById('auth-password');
  const meterWrap = document.getElementById('password-meter');
  const meterFill = document.getElementById('meter-fill');
  const meterText = document.getElementById('meter-text');

  if (toggleBtn && passInput) {
    toggleBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      toggleBtn.querySelector('.eye-open').style.display = isPass ? 'none' : 'block';
      toggleBtn.querySelector('.eye-closed').style.display = isPass ? 'block' : 'none';
    });
  }

  if (passInput && meterWrap && meterFill && meterText) {
    passInput.addEventListener('input', () => {
      const val = passInput.value;
      if (!val) {
        meterWrap.style.display = 'none';
        return;
      }
      meterWrap.style.display = 'block';

      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[0-9]/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      if (score <= 1) {
        meterFill.style.width = '25%';
        meterFill.style.backgroundColor = 'var(--status-out-stock)';
        meterText.textContent = 'Strength: weak';
      } else if (score === 2) {
        meterFill.style.width = '50%';
        meterFill.style.backgroundColor = 'var(--status-warn)';
        meterText.textContent = 'Strength: fair';
      } else if (score === 3) {
        meterFill.style.width = '75%';
        meterFill.style.backgroundColor = '#4a90e2';
        meterText.textContent = 'Strength: good';
      } else {
        meterFill.style.width = '100%';
        meterFill.style.backgroundColor = 'var(--status-in-stock)';
        meterText.textContent = 'Strength: strong';
      }
    });
  }
}

/* ==========================================================================
   8. My Loans Filter Tabs
   ========================================================================== */
function initLoansFilter() {
  const tabBtns = document.querySelectorAll('.loans-tab-bar .tab-btn');
  const cards = document.querySelectorAll('.modern-loan-card');

  if (!tabBtns.length || !cards.length) return;

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;
      cards.forEach(card => {
        if (filter === 'all') {
          card.style.display = '';
        } else {
          card.style.display = card.dataset.status === filter ? '' : 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   9. Admin Loans Table Filter
   ========================================================================== */
function initAdminTableFilter() {
  const filterInput = document.getElementById('admin-loan-filter');
  const tabBtns = document.querySelectorAll('.admin-filter-tabs .admin-tab-btn');
  const rows = document.querySelectorAll('#admin-table .loan-row');

  if (!rows.length) return;

  let currentTab = 'all';

  function applyFilter() {
    const q = filterInput ? filterInput.value.trim().toLowerCase() : '';

    rows.forEach(row => {
      const status = row.dataset.status || '';
      const searchText = row.dataset.search || '';

      const matchTab = currentTab === 'all' || status === currentTab;
      const matchSearch = !q || searchText.includes(q);

      row.style.display = matchTab && matchSearch ? '' : 'none';
    });
  }

  if (filterInput) {
    filterInput.addEventListener('input', applyFilter);
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.filter || 'all';
      applyFilter();
    });
  });
}

/* ==========================================================================
   10. Keyboard Shortcuts & Form Confirmations
   ========================================================================== */
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Focus search on '/' keypress
    if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
      const heroSearch = document.getElementById('hero-search-input');
      const liveSearch = document.getElementById('live-search-input');
      const target = heroSearch || liveSearch;
      if (target) {
        e.preventDefault();
        target.focus();
        target.select();
      }
    }
  });

  // Native Confirm Dialog for Destructive Actions
  document.querySelectorAll('form[data-confirm]').forEach(form => {
    form.addEventListener('submit', (e) => {
      if (!window.confirm(form.dataset.confirm)) {
        e.preventDefault();
      }
    });
  });
}
