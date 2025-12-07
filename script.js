/* --- 1. CONFIGURATION FIREBASE --- */
// ⚠️ COLLEZ VOTRE CONFIGURATION FIREBASE ICI (celle commençant par const firebaseConfig = ...)
// Si vous ne l'avez plus, allez dans la Console Firebase > Paramètres (roue dentée) > Général
const firebaseConfig = {
	apiKey: "AIzaSyCYBoumkb22YWN3TmRwpmX04N_9RXAL6KM",
	authDomain: "appartement-strasbourg.firebaseapp.com",
	projectId: "appartement-strasbourg",
	storageBucket: "appartement-strasbourg.firebasestorage.app",
	messagingSenderId: "682575059640",
	appId: "1:682575059640:web:563db103234e538654724d"
};

/* --- 2. INITIALISATION --- */
var db = null;

// Palette de couleurs pastels pour les enfants
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

// Données par défaut (avec couleurs par défaut)
var defaultUsers = [
  { id: 1, name: "Marie Partouche", email: "parent@famille.fr", password: "123", role: "parent", photo: "", color: "#E1BEE7" },
  { id: 2, name: "Sophie Partouche", email: "enfant1@famille.fr", password: "123", role: "enfant", photo: "", color: "#BBDEFB" }
];

var state = {
  users: defaultUsers,
  reservations: [],
  currentUser: JSON.parse(localStorage.getItem('app_current_user')) || null
};

var currentMonth = new Date();

/* --- 3. CHARGEMENT & ÉCOUTEURS --- */
document.addEventListener('DOMContentLoaded', function() {
  
  var passInput = document.getElementById("login-password");
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
    var list = [];
    snapshot.forEach(function(doc) {
      var data = doc.data();
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
    var cloudUsers = [];
    snapshot.forEach(function(doc) {
      var data = doc.data();
      data.id = doc.id;
      cloudUsers.push(data);
    });

    if (cloudUsers.length > 0) {
      state.users = cloudUsers;
    } else {
      initDefaultUsers();
    }
    // Si les utilisateurs changent (ex: changement de couleur), on rafraichit
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
    var screens = document.querySelectorAll('.screen-content');
    screens.forEach(function(s) {
        if(s.style.display === 'block') {
            if(s.id === 'requests-screen') loadPendingRequests();
            if(s.id === 'calendar-screen') renderCalendar();
            if(s.id === 'stats-screen') calculateAndRenderStats();
        }
    });
}

/* --- 4. AUTHENTIFICATION --- */
function login() {
  var emailEl = document.getElementById('login-email');
  var passEl = document.getElementById('login-password');
  if (!emailEl || !passEl) return;

  var email = emailEl.value.trim();
  var pass = passEl.value.trim();
  
  var user = state.users.find(function(u) { 
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
  if(confirm("Se déconnecter ?")) {
    state.currentUser = null;
    localStorage.removeItem('app_current_user');
    window.location.reload();
  }
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
  var screens = document.querySelectorAll('.screen-content');
  for(var i=0; i<screens.length; i++) { screens[i].style.display = 'none'; }
  
  var target = document.getElementById(screenId + '-screen');
  if (target) {
    target.style.display = 'block';
    target.scrollTop = 0;
  }

  var btns = document.querySelectorAll('.nav-item');
  for(var j=0; j<btns.length; j++) { btns[j].classList.remove('active'); }
  
  var activeBtn = document.querySelector('.nav-item[data-target="' + screenId + '"]');
  if (activeBtn) activeBtn.classList.add('active');

  var titles = { 'calendar': 'Agenda', 'requests': 'Demandes', 'profile': 'Mon Profil', 'stats': 'Statistiques' };
  var titleEl = document.getElementById('header-title');
  if(titleEl) titleEl.textContent = titles[screenId] || 'App';

  if (screenId === 'calendar') renderCalendar();
  if (screenId === 'requests') loadPendingRequests();
  if (screenId === 'profile') loadProfileForm();
  if (screenId === 'stats') calculateAndRenderStats();
}

function updateUI() {
  if (!state.currentUser) return;

  var user = state.users.find(function(u){ return String(u.id) === String(state.currentUser.id); }) || state.currentUser;
  var avatarUrl = user.photo || ('https://ui-avatars.com/api/?name=' + user.name);
  var headerImg = document.getElementById('header-avatar');
  if(headerImg) headerImg.src = avatarUrl;

  var isParent = (state.currentUser.role === 'parent');
  
  // Afficher/Masquer onglets Parents
  var navReq = document.getElementById('nav-requests');
  if (navReq) navReq.style.display = isParent ? 'flex' : 'none';
  
  var navStats = document.getElementById('nav-stats');
  if (navStats) navStats.style.display = isParent ? 'flex' : 'none';

  if (isParent) {
    var pending = state.reservations.filter(function(r){ return r.status === 'pending'; }).length;
    var badge = document.getElementById('requests-badge');
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
  var grid = document.getElementById('calendar-grid');
  if (!grid) return;
  grid.innerHTML = '';

  var monthTitle = document.getElementById('current-month');
  if(monthTitle) monthTitle.textContent = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  var days = ['L','M','M','J','V','S','D'];
  for(var k=0; k<days.length; k++) grid.innerHTML += '<div class="calendar-day header">' + days[k] + '</div>';

  var year = currentMonth.getFullYear();
  var month = currentMonth.getMonth();
  var firstDayObj = new Date(year, month, 1);
  var lastDayObj = new Date(year, month + 1, 0);
  
  var startDay = firstDayObj.getDay() - 1;
  if (startDay === -1) startDay = 6;

  for (var i = 0; i < startDay; i++) grid.innerHTML += '<div class="calendar-day other-month"></div>';

  for (var d = 1; d <= lastDayObj.getDate(); d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    
    var dayRes = [];
    for(var r=0; r<state.reservations.length; r++) {
        var item = state.reservations[r];
        if (dateStr >= item.startDate && dateStr <= item.endDate) {
            dayRes.push(item);
        }
    }
    
    var cell = document.createElement('div');
    cell.className = 'calendar-day';
    
    if (dayRes.length > 0) {
      var approved = dayRes.find(function(r){ return r.status === 'approved'; });
      var pending = dayRes.find(function(r){ return r.status === 'pending'; });
      
      if (approved) {
        cell.className += ' reserved';
        
        // --- COULEUR DE L'ENFANT ---
        // On cherche l'utilisateur qui a réservé pour avoir sa couleur
        var resUser = state.users.find(function(u) { return String(u.id) === String(approved.userId); });
        if(resUser && resUser.color) {
            cell.style.backgroundColor = resUser.color;
        }

        cell.innerHTML = '<div class="day-number">' + d + '</div>';
        
        // Gestion du clic sur une réservation existante
        (function(resItem) { 
            cell.onclick = function() { 
                if(state.currentUser.role === 'parent') {
                    // Si parent : Modifier/Supprimer
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

// MODIFIÉ : Accepte maintenant un objet réservation existant pour modification
function openBookingModal(dateVal, existingRes) {
  if(!state.currentUser) return;
  var modal = document.getElementById('reservation-modal');
  var title = document.getElementById('modal-title');
  var idInput = document.getElementById('res-id');
  var startInput = document.getElementById('res-start');
  var endInput = document.getElementById('res-end');
  var delBtn = document.getElementById('btn-delete-res');
  
  if (existingRes) {
      // Mode MODIFICATION
      title.textContent = "Modifier la réservation de " + existingRes.userName;
      idInput.value = existingRes.id;
      startInput.value = existingRes.startDate;
      endInput.value = existingRes.endDate;
      delBtn.style.display = 'block'; // Afficher bouton supprimer
  } else {
      // Mode CRÉATION
      if(!dateVal) dateVal = new Date().toISOString().split('T')[0];
      title.textContent = (state.currentUser.role === 'parent') ? 'Bloquer une date' : 'Faire une demande';
      idInput.value = ""; // Pas d'ID
      startInput.value = dateVal;
      endInput.value = dateVal;
      delBtn.style.display = 'none'; // Cacher bouton supprimer
  }
  
  modal.classList.add('active');
}

function closeModal() { 
  var m = document.getElementById('reservation-modal');
  if(m) m.classList.remove('active'); 
}

function submitReservation() {
  if (!db) return alert("Pas de connexion base de données");
  var resId = document.getElementById('res-id').value;
  var start = document.getElementById('res-start').value;
  var end = document.getElementById('res-end').value;

  if (!start || !end || start > end) return alert("Dates invalides");

  // Vérif conflit (en excluant la réservation actuelle si on modifie)
  var conflict = state.reservations.find(function(r) {
      // Si c'est moi (modifiction), j'ignore mon propre créneau
      if(resId && r.id === resId) return false;
      return r.status === 'approved' && ((start <= r.endDate) && (end >= r.startDate));
  });
  if (conflict) return alert("Conflit avec " + conflict.userName);

  var data = {
    startDate: start,
    endDate: end,
    // Si modification, on garde le user original, sinon c'est moi
    userId: resId ? getResById(resId).userId : state.currentUser.id,
    userName: resId ? getResById(resId).userName : state.currentUser.name,
    status: (state.currentUser.role === 'parent') ? 'approved' : 'pending'
  };

  if (resId) {
      // MISE À JOUR
      db.collection("reservations").doc(resId).update(data)
        .then(function() { closeModal(); alert("Modifié !"); })
        .catch(function(e) { alert("Erreur : " + e); });
  } else {
      // CRÉATION
      data.createdAt = new Date().toISOString();
      db.collection("reservations").add(data)
        .then(function() { closeModal(); alert("Enregistré !"); })
        .catch(function(e) { alert("Erreur : " + e); });
  }
}

function deleteReservation() {
    var resId = document.getElementById('res-id').value;
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
    var container = document.getElementById('stats-container');
    if(!container) return;
    
    // 1. Calculer les jours par utilisateur
    var stats = {};
    
    state.reservations.forEach(function(r) {
        if(r.status !== 'approved') return;
        
        var start = new Date(r.startDate);
        var end = new Date(r.endDate);
        // Calcul différence en jours (inclusif)
        var diffTime = Math.abs(end - start);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
        
        if(!stats[r.userId]) stats[r.userId] = 0;
        stats[r.userId] += diffDays;
    });

    // 2. Trier pour le classement
    // On convertit l'objet stats en tableau pour trier
    var sortedStats = [];
    state.users.forEach(function(u) {
        if(u.role === 'enfant') { // On ne compte que les enfants ? ou tout le monde ? Disons tout le monde.
             sortedStats.push({
                 user: u,
                 days: stats[u.id] || 0
             });
        }
    });
    
    // Tri décroissant
    sortedStats.sort(function(a, b) { return b.days - a.days; });
    
    // Trouver le max pour la barre de progression (pour que la plus grande fasse 100%)
    var maxDays = sortedStats.length > 0 ? sortedStats[0].days : 1;
    if(maxDays === 0) maxDays = 1;

    // 3. Affichage HTML
    var html = '<h2>Classement des réservations</h2><br>';
    
    sortedStats.forEach(function(item) {
        var percentage = (item.days / maxDays) * 100;
        var avatar = item.user.photo || ('https://ui-avatars.com/api/?name=' + item.user.name);
        
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

/* --- 9. PROFILS --- */
function loadPendingRequests() {
  var container = document.getElementById('pending-requests');
  if(!container) return;
  
  var pending = state.reservations.filter(function(r) { return r.status === 'pending'; });
  
  if (pending.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#999">Aucune demande</div>';
      return;
  }

  var html = '';
  for(var i=0; i<pending.length; i++) {
      var r = pending[i];
      html += '<div class="request-card">' +
      '<h3>👤 ' + r.userName + '</h3>' +
      '<p>📅 Du ' + formatDate(r.startDate) + ' au ' + formatDate(r.endDate) + '</p>' +
      '<div class="request-actions">' +
        '<button class="btn-approve" onclick="processRequest(\'' + r.id + '\', \'approved\')">Accepter</button>' +
        '<button class="btn-reject" onclick="processRequest(\'' + r.id + '\', \'rejected\')">Refuser</button>' +
      '</div></div>';
  }
  container.innerHTML = html;
}

function loadProfileForm() {
  var user = state.users.find(function(u) { return String(u.id) === String(state.currentUser.id); }) || state.currentUser;
  
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
    var container = document.getElementById('color-picker');
    container.innerHTML = '';
    
    colorPalette.forEach(function(col) {
        var div = document.createElement('div');
        div.className = 'color-option ' + (selectedColor === col ? 'selected' : '');
        div.style.backgroundColor = col;
        div.onclick = function() {
            document.getElementById('profile-color').value = col;
            renderColorPicker(col); // Re-render pour la sélection visuelle
        };
        container.appendChild(div);
    });
}

function saveProfile() {
  if (!db) return alert("Hors ligne.");
  var nameVal = document.getElementById('profile-name').value;
  var emailVal = document.getElementById('profile-email').value;
  var photoVal = document.getElementById('profile-photo-url').value;
  var colorVal = document.getElementById('profile-color').value;

  var updatedData = { name: nameVal, email: emailVal, photo: photoVal, color: colorVal };

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
  var d = s.split('-'); 
  return d[2] + '/' + d[1]; 
}