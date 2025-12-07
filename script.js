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

try {
  if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey === "VOTRE_API_KEY_ICI") {
    console.warn("⚠️ Attention : La configuration Firebase semble vide ou incorrecte.");
  } else {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    console.log("✅ Firebase connecté.");
  }
} catch (error) {
  console.error("Erreur connexion Firebase:", error);
  alert("Erreur de connexion à la base de données (voir console).");
}

// Données par défaut
var defaultUsers = [
  { id: 1, name: "Marie Partouche", email: "parent@famille.fr", password: "123", role: "parent", photo: "" },
  { id: 2, name: "Sophie Partouche", email: "enfant1@famille.fr", password: "123", role: "enfant", photo: "" }
];

var state = {
  users: defaultUsers,
  reservations: [],
  currentUser: JSON.parse(localStorage.getItem('app_current_user')) || null
};

var currentMonth = new Date();

/* --- 3. CHARGEMENT --- */
document.addEventListener('DOMContentLoaded', function() {
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
    if (state.currentUser) updateUI();
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
  });

  if (state.currentUser) {
    initAppSession();
  }
});

function initDefaultUsers() {
  if (!db) return;
  defaultUsers.forEach(function(u) {
    db.collection("users").doc(String(u.id)).set(u).catch(function(e){ console.error(e); });
  });
}

/* --- 4. AUTHENTIFICATION --- */
function login() {
  var emailEl = document.getElementById('login-email');
  var passEl = document.getElementById('login-password');
  
  if (!emailEl || !passEl) return;

  var email = emailEl.value.trim();
  var pass = passEl.value.trim();
  
  // Recherche utilisateur
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

  var titles = { 'calendar': 'Agenda', 'requests': 'Demandes', 'profile': 'Mon Profil' };
  var titleEl = document.getElementById('header-title');
  if(titleEl) titleEl.textContent = titles[screenId] || 'App';

  if (screenId === 'calendar') renderCalendar();
  if (screenId === 'requests') loadPendingRequests();
  if (screenId === 'profile') loadProfileForm();
}

function updateUI() {
  if (!state.currentUser) return;

  // Avatar
  var user = state.users.find(function(u){ return String(u.id) === String(state.currentUser.id); }) || state.currentUser;
  var avatarUrl = user.photo || ('https://ui-avatars.com/api/?name=' + user.name);
  var headerImg = document.getElementById('header-avatar');
  if(headerImg) headerImg.src = avatarUrl;

  // Menu Demandes
  var isParent = (state.currentUser.role === 'parent');
  var navReq = document.getElementById('nav-requests');
  if (navReq) navReq.style.display = isParent ? 'flex' : 'none';

  // Badge
  if (isParent) {
    var pending = state.reservations.filter(function(r){ return r.status === 'pending'; }).length;
    var badge = document.getElementById('requests-badge');
    if (badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? 'block' : 'none';
    }
  }
  
  // Refresh calendrier si visible
  var calScreen = document.getElementById('calendar-screen');
  if (calScreen && calScreen.style.display === 'block') renderCalendar();
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
  if(monthTitle) {
      monthTitle.textContent = currentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }

  var days = ['L','M','M','J','V','S','D'];
  for(var k=0; k<days.length; k++) {
      grid.innerHTML += '<div class="calendar-day header">' + days[k] + '</div>';
  }

  var year = currentMonth.getFullYear();
  var month = currentMonth.getMonth();
  var firstDayObj = new Date(year, month, 1);
  var lastDayObj = new Date(year, month + 1, 0);
  
  var startDay = firstDayObj.getDay() - 1;
  if (startDay === -1) startDay = 6;

  for (var i = 0; i < startDay; i++) {
      grid.innerHTML += '<div class="calendar-day other-month"></div>';
  }

  for (var d = 1; d <= lastDayObj.getDate(); d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    
    // Filtrage manuel pour compatibilité
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
        cell.innerHTML = '<div class="day-number">' + d + '</div><div class="day-status">🏡</div>';
        (function(nom) {
            cell.onclick = function() { alert("Réservé par : " + nom); };
        })(approved.userName);
      } else if (pending) {
        cell.className += ' pending';
        cell.innerHTML = '<div class="day-number">' + d + '</div><div class="day-status">⏳</div>';
        (function(nom) {
            cell.onclick = function() { alert("En attente : " + nom); };
        })(pending.userName);
      }
    } else {
      cell.innerHTML = '<div class="day-number">' + d + '</div>';
      (function(ds) {
          cell.onclick = function() { openBookingModal(ds); };
      })(dateStr);
    }
    grid.appendChild(cell);
  }
}

/* --- 7. ACTIONS --- */
function openBookingModal(dateVal) {
  if(!state.currentUser) return;
  var modal = document.getElementById('reservation-modal');
  if(!dateVal) dateVal = new Date().toISOString().split('T')[0];

  var titre = (state.currentUser.role === 'parent') ? 'Bloquer une date' : 'Faire une demande';
  
  modal.querySelector('.modal-content').innerHTML = 
    '<span class="close" onclick="closeModal()">&times;</span>' +
    '<h2>' + titre + '</h2>' +
    '<label>Date de début</label> <input type="date" id="res-start" value="' + dateVal + '">' +
    '<label>Date de fin</label> <input type="date" id="res-end" value="' + dateVal + '">' +
    '<button onclick="submitReservation()" class="btn-new-reservation" style="width:100%; margin-top:20px">Valider</button>';
  
  modal.classList.add('active');
}

function closeModal() { 
  var m = document.getElementById('reservation-modal');
  if(m) m.classList.remove('active'); 
}

function submitReservation() {
  if (!db) return alert("Pas de connexion base de données");
  var start = document.getElementById('res-start').value;
  var end = document.getElementById('res-end').value;

  if (!start || !end || start > end) return alert("Dates invalides");

  // Conflit ?
  var conflict = state.reservations.find(function(r) {
      return r.status === 'approved' && ((start <= r.endDate) && (end >= r.startDate));
  });
  
  if (conflict) return alert("Conflit avec " + conflict.userName);

  db.collection("reservations").add({
    userId: state.currentUser.id,
    userName: state.currentUser.name,
    startDate: start,
    endDate: end,
    status: (state.currentUser.role === 'parent') ? 'approved' : 'pending',
    createdAt: new Date().toISOString()
  })
  .then(function() { closeModal(); alert("Enregistré !"); })
  .catch(function(e) { alert("Erreur : " + e); });
}

function processRequest(id, newStatus) {
  if (!db) return;
  if (newStatus === 'rejected') {
    if (confirm("Refuser et supprimer ?")) db.collection("reservations").doc(id).delete();
  } else {
    db.collection("reservations").doc(id).update({ status: 'approved' });
  }
}

/* --- 8. PROFILS & DEMANDES --- */
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
  }
}

function saveProfile() {
  if (!db) return alert("Hors ligne.");
  
  var nameVal = document.getElementById('profile-name').value;
  var emailVal = document.getElementById('profile-email').value;
  var photoVal = document.getElementById('profile-photo-url').value;

  var updatedData = { name: nameVal, email: emailVal, photo: photoVal };

  // Local
  state.currentUser.name = nameVal;
  state.currentUser.email = emailVal;
  state.currentUser.photo = photoVal;
  localStorage.setItem('app_current_user', JSON.stringify(state.currentUser));

  // Cloud
  db.collection("users").doc(String(state.currentUser.id)).update(updatedData)
    .then(function() { alert("Profil mis à jour !"); updateUI(); })
    .catch(function(e) {
        // Création si inexistant
        db.collection("users").doc(String(state.currentUser.id)).set(state.currentUser)
        .then(function() { alert("Profil créé !"); });
    });
}

function formatDate(s) { 
  if(!s) return ''; 
  var d = s.split('-'); 
  return d[2] + '/' + d[1]; 
}