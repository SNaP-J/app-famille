/* --- 1. CONFIGURATION FIREBASE --- */
const firebaseConfig = {
	apiKey: "AIzaSyCYBoumkb22YWN3TmRwpmX04N_9RXAL6KM",
	authDomain: "appartement-strasbourg.firebaseapp.com",
	projectId: "appartement-strasbourg",
	storageBucket: "appartement-strasbourg.firebasestorage.app",
	messagingSenderId: "682575059640",
	appId: "1:682575059640:web:563db103234e538654724d"
};

/* --- 2. INITIALISATION --- */
let db = null;

// Palette de couleurs pastels
const colorPalette = [
  '#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9', 
  '#BBDEFB', '#B3E5FC', '#B2DFDB', '#C8E6C9', '#DCEDC8', 
  '#F0F4C3', '#FFF9C4', '#FFECB3', '#FFE0B2', '#FFCCBC'
];

try {
  if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey === "VOTRE_API_KEY_ICI") {
    console.warn("⚠️ Config vide.");
  } else {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("✅ Firebase connecté.");
  }
} catch (error) {
  console.error(error);
  alert("Erreur de connexion BDD.");
}

// Données par défaut
const defaultUsers = [
  { id: 1, name: "Marie Partouche", email: "parent@famille.fr", password: "123", role: "parent", photo: "", color: "#E1BEE7" },
  { id: 2, name: "Sophie Partouche", email: "enfant1@famille.fr", password: "123", role: "enfant", photo: "", color: "#BBDEFB" }
];

let state = {
  users: defaultUsers,
  reservations: [],
  currentUser: JSON.parse(localStorage.getItem('app_current_user')) || null
};

let currentMonth = new Date();

/* --- 3. CHARGEMENT & ÉCOUTEURS --- */
document.addEventListener('DOMContentLoaded', function() {
  
  const passInput = document.getElementById("login-password");
  if(passInput) {
    passInput.addEventListener("keypress", function(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        login();
      }
    });
  }

  if (!db) return;

  // Écoute Réservations
  db.collection("reservations").onSnapshot(function(snapshot) {
    let list = [];
    snapshot.forEach(function(doc) {
      let data = doc.data();
      data.id = doc.id;
      list.push(data);
    });
    
    state.reservations = list;
    
    if (state.currentUser) {
        updateUI(); 
        refreshCurrentScreen();
    }
  });

  // Écoute Utilisateurs
  db.collection("users").onSnapshot(function(snapshot) {
    let cloudUsers = [];
    snapshot.forEach(function(doc) {
      let data = doc.data();
      data.id = doc.id;
      cloudUsers.push(data);
    });

    if (cloudUsers.length > 0) {
      state.users = cloudUsers;
    } else {
      initDefaultUsers();
    }
    if(state.currentUser) refreshCurrentScreen();
  });

  if (state.currentUser) {
    initAppSession();
  }
});

function initDefaultUsers() {
  if (!db) return;
  defaultUsers.forEach(function(u) {
    db.collection("users").doc(String(u.id)).set(u).catch(function(e){});
  });
}

function refreshCurrentScreen() {
    const screens = document.querySelectorAll('.screen-content');
    screens.forEach(function(s) {
        if(s.style.display === 'block') {
            if(s.id === 'requests-screen') loadPendingRequests();
            if(s.id === 'calendar-screen') renderCalendar();
            if(s.id === 'stats-screen') calculateAndRenderStats();
            if(s.id === 'infos-screen') loadInfos();
        }
    });
}

/* --- 4. AUTHENTIFICATION --- */
function login() {
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-password');
  if (!emailEl || !passEl) return;

  const email = emailEl.value.trim();
  const pass = passEl.value.trim();
  
  const user = state.users.find(function(u) { 
    return u.email === email && String(u.password) === pass; 
  });
  
  if (user) {
    state.currentUser = user;
    localStorage.setItem('app_current_user', JSON.stringify(user));
    initAppSession();
  } else {
    alert("Email ou mot de passe incorrect.");
  }
}

function logout() {
  state.currentUser = null;
  localStorage.removeItem('app_current_user');
  window.location.reload();
}

function initAppSession() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('main-header').style.display = 'flex';
  document.getElementById('main-nav').style.display = 'flex';
  updateUI();
  showScreen('calendar');
}

/* --- 5. NAVIGATION --- */
function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen-content');
  screens.forEach(s => s.style.display = 'none');
  
  const target = document.getElementById(screenId + '-screen');
  if (target) {
    target.style.display = 'block';
    target.scrollTop = 0;
  }

  const btns = document.querySelectorAll('.nav-item');
  btns.forEach(b => b.classList.remove('active'));
  
  const activeBtn = document.querySelector('.nav-item[data-target="' + screenId + '"]');
  if (activeBtn) activeBtn.classList.add('active');

  const titles = { 'calendar': 'Agenda', 'requests': 'Demandes', 'profile': 'Mon Profil', 'stats': 'Statistiques', 'infos': 'Infos Pratiques' };
  const titleEl = document.getElementById('header-title');
  if(titleEl) titleEl.textContent = titles[screenId] || 'App';

  if (screenId === 'calendar') renderCalendar();
  if (screenId === 'requests') loadPendingRequests();
  if (screenId === 'profile') loadProfileForm();
  if (screenId === 'stats') calculateAndRenderStats();
  if (screenId === 'infos') loadInfos();
}

function updateUI() {
  if (!state.currentUser) return;

  const user = state.users.find(function(u){ return String(u.id) === String(state.currentUser.id); }) || state.currentUser;
  const avatarUrl = user.photo || ('https://ui-avatars.com/api/?name=' + user.name);
  const headerImg = document.getElementById('header-avatar');
  if(headerImg) headerImg.src = avatarUrl;

  const isParent = (state.currentUser.role === 'parent');
  
  const navReq = document.getElementById('nav-requests');
  if (navReq) navReq.style.display = isParent ? 'flex' : 'none';
  
  const navStats = document.getElementById('nav-stats');
  if (navStats) navStats.style.display = isParent ? 'flex' : 'none';

  // Gestion bouton modifier infos
  const infosBtns = document.getElementById('infos-buttons');
  if (infosBtns) {
      infosBtns.style.display = isParent ? 'block' : 'none';
  }

  if (isParent) {
    const pending = state.reservations.filter(function(r){ return r.status === 'pending'; }).length;
    const badge = document.getElementById('requests-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'block' : 'none';
    }
  }
}

/* --- 6. CALENDRIER --- */
function changeMonth(delta) {
  currentMonth.setMonth(currentMonth.getMonth() + delta);
  renderCalendar();
}

function renderCalendar() {
  const grid = document.getElementById('calendar-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const monthTitle = document.getElementById('current-month');
  if(monthTitle) monthTitle.textContent = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const days = ['L','M','M','J','V','S','D'];
  days.forEach(d => grid.innerHTML += '<div class="calendar-day header">' + d + '</div>');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayObj = new Date(year, month, 1);
  const lastDayObj = new Date(year, month + 1, 0);
  
  let startDay = firstDayObj.getDay() - 1;
  if (startDay === -1) startDay = 6;

  for (let i = 0; i < startDay; i++) grid.innerHTML += '<div class="calendar-day other-month"></div>';

  for (let d = 1; d <= lastDayObj.getDate(); d++) {
    const dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    
    let dayRes = [];
    for(let r=0; r<state.reservations.length; r++) {
        let item = state.reservations[r];
        if (dateStr >= item.startDate && dateStr <= item.endDate) {
            dayRes.push(item);
        }
    }
    
    const cell = document.createElement('div');
    cell.className = 'calendar-day';
    
    if (dayRes.length > 0) {
      const approved = dayRes.find(function(r){ return r.status === 'approved'; });
      const pending = dayRes.find(function(r){ return r.status === 'pending'; });
      
      if (approved) {
        cell.className += ' reserved';
        const resUser = state.users.find(function(u) { return String(u.id) === String(approved.userId); });
        if(resUser && resUser.color) {
            cell.style.backgroundColor = resUser.color;
        }
        cell.innerHTML = '<div class="day-number">' + d + '</div>';
        
        (function(resItem) { 
            cell.onclick = function() { 
                if(state.currentUser.role === 'parent') {
                    openBookingModal(null, resItem);
                } else {
                    alert("Réservé par : " + resItem.userName); 
                }
            }; 
        })(approved);

      } else if (pending) {
        cell.className += ' pending';
        cell.innerHTML = '<div class="day-number">' + d + '</div><div class="day-status">⏳</div>';
        (function(nom) { cell.onclick = function() { alert("En attente : " + nom); }; })(pending.userName);
      }
    } else {
      cell.innerHTML = '<div class="day-number">' + d + '</div>';
      (function(ds) { cell.onclick = function() { openBookingModal(ds); }; })(dateStr);
    }
    grid.appendChild(cell);
  }
}

/* --- 7. ACTIONS (CRUD) --- */
function openBookingModal(dateVal, existingRes) {
  if(!state.currentUser) return;
  const modal = document.getElementById('reservation-modal');
  const title = document.getElementById('modal-title');
  const idInput = document.getElementById('res-id');
  const startInput = document.getElementById('res-start');
  const endInput = document.getElementById('res-end');
  const delBtn = document.getElementById('btn-delete-res');
  
  if (existingRes) {
      title.textContent = "Modifier la réservation de " + existingRes.userName;
      idInput.value = existingRes.id;
      startInput.value = existingRes.startDate;
      endInput.value = existingRes.endDate;
      delBtn.style.display = 'block';
  } else {
      if(!dateVal) dateVal = new Date().toISOString().split('T')[0];
      title.textContent = (state.currentUser.role === 'parent') ? 'Bloquer une date' : 'Faire une demande';
      idInput.value = "";
      startInput.value = dateVal;
      endInput.value = dateVal;
      delBtn.style.display = 'none';
  }
  
  modal.classList.add('active');
}

function closeModal() { 
  const m = document.getElementById('reservation-modal');
  if(m) m.classList.remove('active'); 
}

function submitReservation() {
  if (!db) return alert("Pas de connexion base de données");
  const resId = document.getElementById('res-id').value;
  const start = document.getElementById('res-start').value;
  const end = document.getElementById('res-end').value;

  if (!start || !end || start > end) return alert("Dates invalides");

  const conflict = state.reservations.find(function(r) {
      if(resId && r.id === resId) return false;
      return r.status === 'approved' && ((start <= r.endDate) && (end >= r.startDate));
  });
  if (conflict) return alert("Conflit avec " + conflict.userName);

  const data = {
    startDate: start,
    endDate: end,
    userId: resId ? getResById(resId).userId : state.currentUser.id,
    userName: resId ? getResById(resId).userName : state.currentUser.name,
    status: (state.currentUser.role === 'parent') ? 'approved' : 'pending'
  };

  if (resId) {
      db.collection("reservations").doc(resId).update(data)
        .then(function() { closeModal(); alert("Modifié !"); })
        .catch(function(e) { alert("Erreur : " + e); });
  } else {
      data.createdAt = new Date().toISOString();
      db.collection("reservations").add(data)
        .then(function() { closeModal(); alert("Enregistré !"); })
        .catch(function(e) { alert("Erreur : " + e); });
  }
}

function deleteReservation() {
    const resId = document.getElementById('res-id').value;
    if(!resId) return;

    if(confirm("Êtes-vous sûr de vouloir SUPPRIMER cette réservation ?")) {
        db.collection("reservations").doc(resId).delete()
          .then(function() { closeModal(); alert("Supprimé !"); })
          .catch(function(e) { alert("Erreur : " + e); });
    }
}

function getResById(id) {
    return state.reservations.find(function(r) { return r.id === id; });
}

function processRequest(id, newStatus) {
  if (!db) return;
  if (newStatus === 'rejected') {
    if (confirm("Refuser et supprimer cette demande ?")) {
        db.collection("reservations").doc(id).delete();
    }
  } else {
    db.collection("reservations").doc(id).update({ status: 'approved' });
  }
}

/* --- 8. STATISTIQUES --- */
function calculateAndRenderStats() {
    const container = document.getElementById('stats-container');
    if(!container) return;
    
    let stats = {};
    
    state.reservations.forEach(function(r) {
        if(r.status !== 'approved') return;
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        
        if(!stats[r.userId]) stats[r.userId] = 0;
        stats[r.userId] += diffDays;
    });

    let sortedStats = [];
    state.users.forEach(function(u) {
         sortedStats.push({
             user: u,
             days: stats[u.id] || 0
         });
    });
    
    sortedStats.sort(function(a, b) { return b.days - a.days; });
    
    let maxDays = sortedStats.length > 0 ? sortedStats[0].days : 1;
    if(maxDays === 0) maxDays = 1;

    let html = '<h2>Classement des réservations</h2><br>';
    sortedStats.forEach(function(item) {
        const percentage = (item.days / maxDays) * 100;
        const avatar = item.user.photo || ('https://ui-avatars.com/api/?name=' + item.user.name);
        
        html += 
        '<div class="stat-card">' +
            '<img src="' + avatar + '" class="stat-avatar">' +
            '<div class="stat-info">' +
                '<strong>' + item.user.name + '</strong>' +
                '<div>' + item.days + ' jour(s) réservés</div>' +
                '<div class="stat-bar-bg">' +
                    '<div class="stat-bar-fill" style="width:' + percentage + '%; background-color:' + (item.user.color || '#ccc') + '"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    });
    
    container.innerHTML = html;
}

/* --- 9. INFOS PRATIQUES --- */
function loadInfos() {
    db.collection("infos").doc("general").get().then(function(doc) {
        const textarea = document.getElementById('infos-content');
        if (doc.exists && textarea) {
            textarea.value = doc.data().text || "";
        }
    });
}

function toggleEditInfos() {
    const textarea = document.getElementById('infos-content');
    const btnEdit = document.getElementById('btn-edit-infos');
    const btnSave = document.getElementById('btn-save-infos');
    
    textarea.readOnly = false;
    textarea.focus();
    textarea.style.border = "2px solid #667eea";
    
    btnEdit.style.display = 'none';
    btnSave.style.display = 'inline-block';
}

function saveInfos() {
    const textVal = document.getElementById('infos-content').value;
    
    db.collection("infos").doc("general").set({ text: textVal }, { merge: true })
      .then(function() {
          alert("Infos enregistrées !");
          const textarea = document.getElementById('infos-content');
          textarea.readOnly = true;
          textarea.style.border = "1px solid #eee";
          document.getElementById('btn-edit-infos').style.display = 'inline-block';
          document.getElementById('btn-save-infos').style.display = 'none';
      })
      .catch(function(e) { alert("Erreur : " + e); });
}

/* --- 10. PROFILS --- */
function loadPendingRequests() {
  const container = document.getElementById('pending-requests');
  if(!container) return;
  
  const pending = state.reservations.filter(function(r) { return r.status === 'pending'; });
  
  if (pending.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#999">Aucune demande</div>';
      return;
  }

  let html = '';
  pending.forEach(function(r) {
      html += '<div class="request-card">' +
      '<h3>👤 ' + r.userName + '</h3>' +
      '<p>📅 Du ' + formatDate(r.startDate) + ' au ' + formatDate(r.endDate) + '</p>' +
      '<div class="request-actions">' +
        '<button class="btn-approve" onclick="processRequest(\'' + r.id + '\', \'approved\')">Accepter</button>' +
        '<button class="btn-reject" onclick="processRequest(\'' + r.id + '\', \'rejected\')">Refuser</button>' +
      '</div></div>';
  });
  container.innerHTML = html;
}

function loadProfileForm() {
  const user = state.users.find(function(u) { return String(u.id) === String(state.currentUser.id); }) || state.currentUser;
  
  if(document.getElementById('profile-name')) {
      document.getElementById('profile-name').value = user.name || '';
      document.getElementById('profile-email').value = user.email || '';
      document.getElementById('profile-photo-url').value = user.photo || '';
      document.getElementById('profile-avatar-large').src = user.photo || ('https://ui-avatars.com/api/?name=' + user.name);
      document.getElementById('profile-color').value = user.color || '';
      renderColorPicker(user.color);
  }
}

function renderColorPicker(selectedColor) {
    const container = document.getElementById('color-picker');
    container.innerHTML = '';
    
    colorPalette.forEach(function(col) {
        const div = document.createElement('div');
        div.className = 'color-option ' + (selectedColor === col ? 'selected' : '');
        div.style.backgroundColor = col;
        div.onclick = function() {
            document.getElementById('profile-color').value = col;
            renderColorPicker(col); 
        };
        container.appendChild(div);
    });
}

function saveProfile() {
  if (!db) return alert("Hors ligne.");
  const nameVal = document.getElementById('profile-name').value;
  const emailVal = document.getElementById('profile-email').value;
  const photoVal = document.getElementById('profile-photo-url').value;
  const colorVal = document.getElementById('profile-color').value;

  const updatedData = { name: nameVal, email: emailVal, photo: photoVal, color: colorVal };

  state.currentUser.name = nameVal;
  state.currentUser.email = emailVal;
  state.currentUser.photo = photoVal;
  state.currentUser.color = colorVal;
  
  localStorage.setItem('app_current_user', JSON.stringify(state.currentUser));

  db.collection("users").doc(String(state.currentUser.id)).update(updatedData)
    .then(function() { alert("Profil mis à jour !"); updateUI(); })
    .catch(function() {
        db.collection("users").doc(String(state.currentUser.id)).set(state.currentUser)
        .then(function() { alert("Profil créé !"); });
    });
}

function formatDate(s) { 
  if(!s) return ''; 
  const d = s.split('-'); 
  return d[2] + '/' + d[1]; 
}
