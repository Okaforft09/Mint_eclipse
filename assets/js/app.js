/* ============================================================
   MINT ECLIPSE — Shared Application Logic
   Supabase authentication
   Temporary localStorage features:
   letters, events, bucket, photos
   ============================================================ */


/* ---------- localStorage keys ---------- */

const STORE = {
  letters: 'me_letters',
  events: 'me_events',
  bucket: 'me_bucket',
  photos: 'me_photos'
};


/* ---------- Supabase client ---------- */

const db = window.supabaseClient;

if (!db) {
  console.error(
    'Supabase client is unavailable. Check script order and supabase-client.js.'
  );
}


/* ---------- current user ---------- */

let currentUser = null;


/* ---------- helpers ---------- */

function readStore(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}


function writeStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}


function uid(prefix) {
  return (
    prefix +
    '-' +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}


function esc(value) {
  const amp = String.fromCharCode(38);

  const code = {
    '&': 'amp;',
    '<': 'lt;',
    '>': 'gt;',
    '"': 'quot;',
    "'": '#39;'
  };

  return String(value ?? '').replace(/[&<>"']/g, function (character) {
    return amp + code[character];
  });
}


/* ---------- toasts ---------- */

function toast(message, isError) {
  const wrap = document.querySelector('.toast-wrap');

  if (!wrap) {
    return;
  }

  const element = document.createElement('div');

  element.className =
    'toast' + (isError ? ' toast--err' : '');

  element.innerHTML = message;

  wrap.appendChild(element);

  setTimeout(function () {
    element.remove();
  }, 4200);
}


/* ---------- session and profile ---------- */

async function loadCurrentUser() {
  if (!db) {
    currentUser = null;
    return null;
  }

  const {
    data: sessionData,
    error: sessionError
  } = await db.auth.getSession();

  if (sessionError) {
    console.error('Session error:', sessionError);
    currentUser = null;
    return null;
  }

  const authUser = sessionData.session?.user;

  if (!authUser) {
    currentUser = null;
    return null;
  }

  const {
    data: profile,
    error: profileError
  } = await db
    .from('profiles')
    .select(
      'id, user_id, name, bio, created_at, updated_at'
    )
    .eq('id', authUser.id)
    .maybeSingle();

  if (profileError) {
    console.error('Profile error:', profileError);

    currentUser = {
      id: authUser.id,
      email: authUser.email,
      name: authUser.email?.split('@')[0] || 'User',
      userId: '—',
      bio: 'New to Mint Eclipse 🌙',
      joined: Date.now()
    };

    return currentUser;
  }

  currentUser = {
    id: authUser.id,
    email: authUser.email,
    name:
      profile?.name ||
      authUser.email?.split('@')[0] ||
      'User',
    userId: profile?.user_id || '—',
    bio: profile?.bio || 'New to Mint Eclipse 🌙',
    joined: profile?.created_at || Date.now()
  };

  return currentUser;
}


function getSession() {
  return currentUser;
}


async function refreshCurrentUser() {
  await loadCurrentUser();
  applyUIState();
  return currentUser;
}


async function requireAuth() {
  const user = await loadCurrentUser();

  if (!user) {
    location.href = 'login.html';
    return false;
  }

  return true;
}


/* ---------- authentication ---------- */

window.handleLogin = async function (event) {
  event.preventDefault();

  if (!db) {
    toast('Supabase is not connected.', true);
    return;
  }

  const form = event.target;
  const email = form.userId.value.trim().toLowerCase();
  const password = form.password.value;

  if (!email || !password) {
    toast('Enter your email and password.', true);
    return;
  }

  const {
    error
  } = await db.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    console.error('Login error:', error);

    toast(
      '<b>Sign in failed.</b> ' +
      esc(error.message),
      true
    );

    return;
  }

  await loadCurrentUser();
  applyUIState();

  toast(
    'Welcome back, <b>' +
    esc(currentUser?.name || 'friend') +
    '</b>! 🌙'
  );

  setTimeout(function () {
    location.href = 'index.html';
  }, 500);
};


window.handleRegister = async function (event) {
  event.preventDefault();

  if (!db) {
    toast('Supabase is not connected.', true);
    return;
  }

  const form = event.target;
  const submitButton =
    form.querySelector('button[type="submit"]');

  if (submitButton?.disabled) {
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = 'Creating account…';
  }

  const name = form.rName.value.trim();
  const email = form.rEmail.value.trim().toLowerCase();
  const password = form.rPassword.value;

  if (name.length < 2) {
    toast('Please enter your name.', true);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Create My Account';
    }

    return;
  }

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    toast('That email address looks invalid.', true);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Create My Account';
    }

    return;
  }

  if (password.length < 8) {
    toast('Password must be at least 8 characters.', true);

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Create My Account';
    }

    return;
  }

  const {
    data,
    error
  } = await db.auth.signUp({
    email: email,
    password: password,
    options: {
      data: {
        name: name
      }
    }
  });

  if (error) {
    console.error('Registration error:', error);

    toast(
      '<b>Could not create account.</b> ' +
      esc(error.message),
      true
    );

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Create My Account';
    }

    return;
  }

  if (!data.user) {
    toast(
      'Account creation did not return a user.',
      true
    );

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Create My Account';
    }

    return;
  }

  if (!data.session) {
    toast(
      'Account created. Check your email to confirm your account, then sign in.'
    );

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = 'Create My Account';
    }

    return;
  }

  await loadCurrentUser();
  applyUIState();

  toast('Account created successfully!');

  setTimeout(function () {
    location.href = 'profile.html';
  }, 700);
};


window.logout = async function () {
  if (!db) {
    currentUser = null;
    applyUIState();
    location.href = 'index.html';
    return;
  }

  const {
    error
  } = await db.auth.signOut();

  if (error) {
    console.error('Logout error:', error);

    toast(
      '<b>Could not sign out.</b> ' +
      esc(error.message),
      true
    );

    return;
  }

  currentUser = null;
  applyUIState();

  toast('Signed out. See you soon!');

  setTimeout(function () {
    location.href = 'index.html';
  }, 300);
};


/* ---------- UI state ---------- */

function applyUIState() {
  const user = getSession();

  document
    .querySelectorAll('[data-auth-required]')
    .forEach(function (element) {
      element.style.display = user ? '' : 'none';
    });

  document
    .querySelectorAll('[data-guest-only]')
    .forEach(function (element) {
      element.style.display = user ? 'none' : '';
    });

  document
    .querySelectorAll('.js-initials')
    .forEach(function (element) {
      const name = user ? user.name : '';

      element.textContent = name
        ? name.trim().charAt(0).toUpperCase()
        : 'G';
    });

  const displayName =
    document.querySelector('.js-d-name');

  const displayId =
    document.querySelector('.js-d-id');

  if (displayName) {
    displayName.textContent =
      user ? user.name : 'Guest';
  }

  if (displayId) {
    displayId.textContent =
      user ? user.userId : 'Not signed in';
  }

  document.title = 'Mint Eclipse';
}


/* ---------- navigation and sidebar ---------- */

window.toggleSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const backdrop =
    document.getElementById('sidebarBackdrop');
  const burger = document.querySelector('.burger');

  sidebar?.classList.toggle('open');
  backdrop?.classList.toggle('show');
  burger?.classList.toggle('active');
};


window.closeSidebar = function () {
  const sidebar = document.getElementById('sidebar');
  const backdrop =
    document.getElementById('sidebarBackdrop');
  const burger = document.querySelector('.burger');

  sidebar?.classList.remove('open');
  backdrop?.classList.remove('show');
  burger?.classList.remove('active');
};


window.toggleDropdown = function () {
  document.querySelector('.dropdown')
    ?.classList.toggle('show');
};


/* ---------- bucket list: Supabase version ---------- */

async function getBucket() {
  const user = getSession();

  if (!user) {
    return [];
  }

  const { data, error } = await db
    .from('bucket_items')
    .select('id, user_id, text, done, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Bucket load error:', error);
    toast('Could not load your bucket list.', true);
    return [];
  }

  return data || [];
}


window.addBucketItem = async function () {
  const user = getSession();
  const input = document.getElementById('bucketInput');

  if (!user) {
    toast('Sign in to add a goal.', true);
    return;
  }

  if (!input) {
    return;
  }

  const text = input.value.trim();

  if (!text) {
    toast('Type a goal first.', true);
    return;
  }

  const { error } = await db
    .from('bucket_items')
    .insert({
      user_id: user.id,
      text: text,
      done: false
    });

  if (error) {
    console.error('Bucket insert error:', error);
    toast('Could not save the bucket item.', true);
    return;
  }

  input.value = '';
  await renderBucket();

  toast('Added to your bucket list! ✨');
};


window.toggleBucket = async function (id) {
  const user = getSession();

  if (!user) {
    toast('Sign in to update your bucket list.', true);
    return;
  }

  const { data: item, error: findError } = await db
    .from('bucket_items')
    .select('done')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (findError) {
    console.error('Bucket item lookup error:', findError);
    toast('Could not find that bucket item.', true);
    return;
  }

  const { error } = await db
    .from('bucket_items')
    .update({
      done: !item.done
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Bucket update error:', error);
    toast('Could not update the bucket item.', true);
    return;
  }

  await renderBucket();
};


window.removeBucket = async function (id) {
  const user = getSession();

  if (!user) {
    toast('Sign in to remove bucket items.', true);
    return;
  }

  const { error } = await db
    .from('bucket_items')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Bucket delete error:', error);
    toast('Could not remove the bucket item.', true);
    return;
  }

  await renderBucket();

  toast('Removed from bucket list.');
};


async function renderBucket() {
  const list = document.getElementById('bucketList');
  const counter = document.getElementById('bucketCounter');
  const fill = document.getElementById('bucketFill');
  const empty = document.getElementById('bucketEmpty');

  if (!list) {
    return;
  }

  const bucket = await getBucket();

  const doneCount = bucket.filter(function (item) {
    return item.done;
  }).length;

  const percent = bucket.length
    ? Math.round((doneCount / bucket.length) * 100)
    : 0;

  if (counter) {
    counter.textContent =
      doneCount + ' / ' + bucket.length + ' done';
  }

  if (fill) {
    fill.style.width = percent + '%';
  }

  list.innerHTML = bucket.length
    ? bucket.map(function (item) {
        return `
          <div class="bucket-item${item.done ? ' done' : ''}">
            <button
              class="bucket-check"
              onclick="toggleBucket('${item.id}')"
              aria-label="Toggle"
            >
              ✓
            </button>

            <span class="bucket-text">
              ${esc(item.text)}
            </span>

            <button
              class="bucket-del"
              onclick="removeBucket('${item.id}')"
              aria-label="Delete"
            >
              ✕
            </button>
          </div>
        `;
      }).join('')
    : '';

  if (empty) {
    empty.style.display =
      bucket.length ? 'none' : 'block';
  }
}

/* ---------- letters: Supabase version ---------- */

async function getLetters() {
  const user = getSession();

  if (!user) {
    return [];
  }

  const { data, error } = await db
    .from('letters')
    .select(`
      id,
      sender_id,
      recipient_id,
      title,
      body,
      opens_at,
      created_at
    `)
    .or(
      'sender_id.eq.' +
      user.id +
      ',recipient_id.eq.' +
      user.id
    )
    .order('opens_at', { ascending: true });

  if (error) {
    console.error('Letters load error:', error);
    toast('Could not load your letters.', true);
    return [];
  }

  return data || [];
}


window.sealLetter = async function (event) {
  event.preventDefault();

  const sender = getSession();

  if (!sender) {
    toast('Sign in before sending a letter.', true);
    return;
  }

  const form = event.target;
  const recipientCode =
    form.recipient.value.trim().toUpperCase();
  const title = form.title.value.trim();
  const body = form.body.value.trim();
  const opensAt =
    new Date(form.openAt.value).toISOString();

  if (!recipientCode) {
    toast('Enter the recipient User ID.', true);
    return;
  }

  if (!title) {
    toast('Give the letter a title.', true);
    return;
  }

  if (!body) {
    toast('Write something in the letter.', true);
    return;
  }

  const openTime =
    new Date(form.openAt.value).getTime();

  if (Number.isNaN(openTime)) {
    toast('Pick a date and time.', true);
    return;
  }

  if (openTime <= Date.now()) {
    toast('The opening time must be in the future.', true);
    return;
  }

  const {
    data: recipient,
    error: recipientError
  } = await db
    .from('profiles')
    .select('id, user_id, name')
    .eq('user_id', recipientCode)
    .maybeSingle();

  if (recipientError || !recipient) {
    console.error('Recipient lookup error:', recipientError);
    toast('Recipient User ID was not found.', true);
    return;
  }

  const { error } = await db
    .from('letters')
    .insert({
      sender_id: sender.id,
      recipient_id: recipient.id,
      title: title,
      body: body,
      opens_at: opensAt
    });

  if (error) {
    console.error('Letter insert error:', error);
    toast('Could not seal the letter.', true);
    return;
  }

  form.reset();
  await renderLetters();

  toast('Letter sealed and sent! 📜');
};


async function renderLetters() {
  const list = document.getElementById('letterList');

  if (!list) {
    return;
  }

  const user = getSession();

  if (!user) {
    list.innerHTML =
      '<div class="letter-empty">Sign in to view your letters.</div>';
    return;
  }

  const letters = await getLetters();

  if (letters.length === 0) {
    list.innerHTML = `
      <div class="letter-empty">
        <div style="font-size:2.4rem; margin-bottom:0.6rem;">
          🔒
        </div>
        <strong>No letters in your vault yet.</strong>
        <p class="muted" style="margin-top:0.4rem;">
          Create a timed letter above, or ask a friend to send one
          to your User ID.
        </p>
      </div>
    `;
    return;
  }

  const now = Date.now();

  list.innerHTML = letters.map(function (letter) {
    const opensAt =
      new Date(letter.opens_at).getTime();

    const difference = opensAt - now;
    const sealed = difference > 0;

    const countdown = sealed
      ? formatCountdown(difference)
      : null;

    return `
      <div class="letter-card${sealed ? '' : ' ready'}">
        <div class="letter-top">
          <div>
            <div class="letter-title">
              ${esc(letter.title)}
            </div>

            <div class="letter-meta">
              Opens ${new Date(
                letter.opens_at
              ).toLocaleString()}
            </div>
          </div>

          <div>
            ${
              countdown
                ? `<span class="countdown">
                    ⏳ ${countdown}
                  </span>`
                : '<span class="chip chip--open">📖 Open</span>'
            }
          </div>
        </div>

        <div class="letter-body ${
          sealed ? 'blurred' : ''
        }">
          ${esc(letter.body)}
        </div>
      </div>
    `;
  }).join('');
}


/* ---------- events: Supabase version ---------- */

async function getEvents() {
  const { data, error } = await db
    .from('events')
    .select(`
      id,
      owner_id,
      name,
      event_date,
      location,
      description,
      created_at
    `)
    .order('event_date', { ascending: true });

  if (error) {
    console.error('Events load error:', error);
    toast('Could not load events.', true);
    return [];
  }

  return data || [];
}


window.createEvent = async function (event) {
  event.preventDefault();

  const user = getSession();

  if (!user) {
    toast('Sign in to create an event.', true);
    return;
  }

  const form = event.target;
  const name = form.eventName.value.trim();
  const eventDate = form.eventDate.value;
  const location =
    form.eventLocation.value.trim() || 'To be decided';
  const description =
    form.eventDesc.value.trim() || 'No details yet.';

  if (!name) {
    toast('Name the event.', true);
    return;
  }

  if (!eventDate) {
    toast('Pick an event date.', true);
    return;
  }

  const { error } = await db
    .from('events')
    .insert({
      owner_id: user.id,
      name: name,
      event_date: new Date(eventDate).toISOString(),
      location: location,
      description: description
    });

  if (error) {
    console.error('Event insert error:', error);
    toast('Could not create the event.', true);
    return;
  }

  form.reset();
  await renderEvents();

  toast('Event created! 🎉');
};


window.removeEvent = async function (id) {
  const user = getSession();

  if (!user) {
    toast('Sign in to delete events.', true);
    return;
  }

  const { error } = await db
    .from('events')
    .delete()
    .eq('id', id)
    .eq('owner_id', user.id);

  if (error) {
    console.error('Event delete error:', error);
    toast('Could not delete the event.', true);
    return;
  }

  await renderEvents();
  toast('Event removed.');
};


async function renderEvents() {
  const list = document.getElementById('eventList');
  const empty = document.getElementById('eventsEmpty');

  if (!list) {
    return;
  }

  const events = await getEvents();

  if (empty) {
    empty.style.display =
      events.length ? 'none' : 'block';
  }

  list.innerHTML = events.map(function (item) {
    const date = new Date(item.event_date);

    return `
      <div class="event-card">
        <div class="event-date-box">
          <div class="d">${date.getDate()}</div>
          <div class="m">
            ${date.toLocaleString('default', {
              month: 'short'
            })}
          </div>
        </div>

        <div class="event-info" style="flex:1;">
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.description)}</p>

          <div class="event-meta">
            <span>📍 ${esc(item.location)}</span>
            <span>
              🕒 ${date.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </span>
          </div>

          <div class="event-actions">
            <button
              class="btn btn--sm btn--ghost"
              onclick="removeEvent('${item.id}')"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}


/* ---------- photos: Supabase Storage version ---------- */

async function getPhotos() {
  const user = getSession();

  if (!user) {
    return [];
  }

  const { data, error } = await db
    .from('photos')
    .select('id, user_id, name, storage_path, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Photos load error:', error);
    toast('Could not load photos.', true);
    return [];
  }

  return data || [];
}


window.uploadPhoto = async function (input) {
  const user = getSession();
  const file = input.files?.[0];

  if (!user) {
    toast('Sign in to upload photos.', true);
    return;
  }

  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    toast('Please choose an image file.', true);
    return;
  }

  const extension =
    file.name.split('.').pop().toLowerCase();

  const path =
    user.id +
    '/' +
    crypto.randomUUID() +
    '.' +
    extension;

  const { error: uploadError } = await db
    .storage
    .from('photos')
    .upload(path, file, {
      contentType: file.type,
      upsert: false
    });

  if (uploadError) {
    console.error('Photo upload error:', uploadError);
    toast('Photo upload failed.', true);
    return;
  }

  const { error: rowError } = await db
    .from('photos')
    .insert({
      user_id: user.id,
      name: file.name,
      storage_path: path
    });

  if (rowError) {
    console.error('Photo record error:', rowError);
    toast('Photo record could not be saved.', true);
    return;
  }

  input.value = '';
  await renderPhotos();

  toast('Photo uploaded! 📷');
};


window.removePhoto = async function (id, path) {
  const user = getSession();

  if (!user) {
    return;
  }

  const { error: storageError } = await db
    .storage
    .from('photos')
    .remove([path]);

  if (storageError) {
    console.error('Photo storage delete error:', storageError);
  }

  const { error } = await db
    .from('photos')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Photo row delete error:', error);
    toast('Could not remove the photo.', true);
    return;
  }

  await renderPhotos();
  toast('Photo removed.');
};


window.openLightbox = function (url, name) {
  const box = document.getElementById('lightbox');
  const image = document.getElementById('lightboxImg');
  const caption = document.getElementById('lightboxCap');

  if (!box || !image || !caption) {
    return;
  }

  image.src = url;
  caption.textContent = name;
  box.classList.add('show');
};


window.closeLightbox = function () {
  document
    .getElementById('lightbox')
    ?.classList.remove('show');
};


async function renderPhotos() {
  const grid = document.getElementById('photoGrid');
  const empty = document.getElementById('photosEmpty');

  if (!grid) {
    return;
  }

  const photos = await getPhotos();

  if (empty) {
    empty.style.display =
      photos.length ? 'none' : 'block';
  }

  grid.innerHTML = '';

  for (const photo of photos) {
    const { data } = db
      .storage
      .from('photos')
      .getPublicUrl(photo.storage_path);

    const tile = document.createElement('div');
    tile.className = 'photo-tile';

    tile.innerHTML = `
      <img
        src="${esc(data.publicUrl)}"
        alt="${esc(photo.name)}"
        loading="lazy"
      >

      <div class="cap">
        <span>${esc(photo.name)}</span>
        <button class="del" aria-label="Delete">✕</button>
      </div>
    `;

    tile.addEventListener('click', function () {
      openLightbox(data.publicUrl, photo.name);
    });

    tile.querySelector('.del').addEventListener(
      'click',
      function (event) {
        event.stopPropagation();
        removePhoto(photo.id, photo.storage_path);
      }
    );

    grid.appendChild(tile);
  }
}


/* ---------- profile ---------- */

window.saveProfile = async function (event) {
  event.preventDefault();

  const user = await loadCurrentUser();

  if (!user) {
    toast('Sign in to edit your profile.', true);
    return;
  }

  const form = event.target;
  const name = form.displayName.value.trim();
  const bio = form.bio.value.trim();

  if (name.length < 2) {
    toast('Your display name is too short.', true);
    return;
  }

  const {
    data: profile,
    error
  } = await db
    .from('profiles')
    .update({
      name: name,
      bio: bio || 'No bio yet.',
      updated_at: new Date().toISOString()
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Profile update error:', error);

    toast(
      '<b>Profile update failed.</b> ' +
      esc(error.message),
      true
    );

    return;
  }

  currentUser = {
    ...user,
    name: profile.name,
    bio: profile.bio
  };

  applyUIState();
  await renderProfile();

  toast('Profile updated! ✅');
};


/* ---------- profile tabs ---------- */

window.switchProfileTab = function (tab) {
  document
    .querySelectorAll('.profile-tab-content')
    .forEach(function (element) {
      element.style.display = 'none';
    });

  const target =
    document.getElementById('profileTab_' + tab);

  if (target) {
    target.style.display = 'block';
  }

  document
    .querySelectorAll('.profile-tab-btn')
    .forEach(function (button) {
      button.classList.remove('active');
    });

  const activeButton =
    document.querySelector(
      '.profile-tab-btn[data-tab="' + tab + '"]'
    );

  if (activeButton) {
    activeButton.classList.add('active');
  }
};


async function renderProfile() {
  const user = await loadCurrentUser();

  if (!user) {
    location.href = 'login.html';
    return;
  }

  applyUIState();

  document
    .querySelectorAll('.js-p-name')
    .forEach(function (element) {
      element.textContent = user.name;
    });

  document
    .querySelectorAll('.js-p-id')
    .forEach(function (element) {
      element.textContent = user.userId;
    });

  document
    .querySelectorAll('.js-p-bio')
    .forEach(function (element) {
      element.textContent = user.bio || 'No bio yet.';
    });

  const form =
    document.getElementById('profileForm');

  if (form) {
    form.displayName.value = user.name;
    form.bio.value = user.bio || '';
  }

  const joined =
    new Date(
      user.joined || Date.now()
    ).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

  const joinedElement =
    document.querySelector('.js-p-joined');

  if (joinedElement) {
    joinedElement.textContent = joined;
  }

  const letters =
    getLetters().filter(function (letter) {
      return (
        letter.toUserId === user.userId ||
        letter.fromUserId === user.userId
      );
    });

  const statLetters =
    document.getElementById('statLetters');

  if (statLetters) {
    statLetters.textContent = letters.length;
  }

  const statBucket =
    document.getElementById('statBucket');

  if (statBucket) {
    statBucket.textContent =
      getBucket().filter(function (item) {
        return item.done;
      }).length +
      '/' +
      getBucket().length;
  }

  const statEvents =
    document.getElementById('statEvents');

  if (statEvents) {
    statEvents.textContent = getEvents().length;
  }

  const statPhotos =
    document.getElementById('statPhotos');

  if (statPhotos) {
    statPhotos.textContent = getPhotos().length;
  }

  const myLetters =
    document.getElementById('profileMyLetters');

  if (myLetters) {
    myLetters.innerHTML = letters.length
      ? letters.map(function (letter) {
          const opened =
            Date.now() >= letter.openedAt ||
            letter.opened;

          return `
            <div class="letter-card${
              opened ? ' ready' : ''
            }">
              <div class="letter-top">
                <div>
                  <div class="letter-title">
                    ${esc(letter.title)}
                  </div>

                  <div class="letter-meta">
                    To <b>${esc(letter.toUserId)}</b>
                    · opens
                    ${new Date(
                      letter.openedAt
                    ).toLocaleString()}
                  </div>
                </div>

                ${
                  opened
                    ? '<span class="chip chip--open">📖 Open</span>'
                    : '<span class="chip chip--sealed">📜 Sealed</span>'
                }
              </div>

              <div class="letter-body ${
                opened ? '' : 'blurred'
              }">
                ${esc(letter.body)}
              </div>
            </div>
          `;
        }).join('')
      : `
        <div class="letter-empty">
          No letters yet. Create one from the Events page.
        </div>
      `;
  }
}


/* ---------- auth tabs ---------- */

window.switchAuth = function (mode) {
  document
    .querySelectorAll('.auth-tab')
    .forEach(function (tab) {
      tab.classList.remove('active');
    });

  const selectedTab =
    document.querySelector(
      '.auth-tab[data-mode="' + mode + '"]'
    );

  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  document
    .querySelectorAll('.auth-panel')
    .forEach(function (panel) {
      panel.classList.remove('active');
    });

  const selectedPanel =
    document.getElementById('authPanel_' + mode);

  if (selectedPanel) {
    selectedPanel.classList.add('active');
  }
};


/* ---------- page initialization ---------- */

async function initPage() {
  await loadCurrentUser();
  applyUIState();

  // Temporary localStorage data.
  // These will later be migrated to Supabase.

  const page =
    location.pathname.split('/').pop() || 'index.html';

  const pageMap = {
    'index.html': 'home',
    'bucket.html': 'bucket',
    'events.html': 'events',
    'photos.html': 'photos',
    'login.html': 'login',
    'profile.html': 'profile'
  };

  const currentPage =
    pageMap[page];

  document
    .querySelectorAll('.nav-link')
    .forEach(function (link) {
      link.classList.toggle(
        'active',
        link.dataset.page === currentPage
      );
    });

  document
    .querySelectorAll('.s-link')
    .forEach(function (link) {
      link.classList.toggle(
        'active',
        link.dataset.page === currentPage
      );
    });

  await renderBucket();
  await renderLetters();
  await renderEvents();
  await renderPhotos();

  if (page === 'profile.html') {
    await renderProfile();
  }

  if (
    page === 'events.html' ||
    page === 'profile.html'
  ) {
    setInterval(async function () {
      renderLetters();

      if (page === 'profile.html') {
        await renderProfile();
      }
    }, 1000);
  }

  document.addEventListener('click', function (event) {
    if (!event.target.closest('.avatar-wrap')) {
      document
        .querySelectorAll('.dropdown')
        .forEach(function (dropdown) {
          dropdown.classList.remove('show');
        });
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      closeSidebar();

      document
        .getElementById('lightbox')
        ?.classList.remove('show');
    }
  });
}


/* ---------- auth state listener ---------- */

if (db) {
  db.auth.onAuthStateChange(function (event) {
    if (
      event === 'SIGNED_IN' ||
      event === 'SIGNED_OUT' ||
      event === 'TOKEN_REFRESHED' ||
      event === 'USER_UPDATED'
    ) {
      setTimeout(async function () {
        await loadCurrentUser();
        applyUIState();
      }, 0);
    }
  });
}


/* ---------- start application ---------- */

document.addEventListener(
  'DOMContentLoaded',
  initPage
);