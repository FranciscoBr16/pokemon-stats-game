// ============ ELEMENTOS DEL DOM ============
const introSprite = document.getElementById('intro-sprite');
const playerNameInput = document.getElementById('player-name-input');
const startGameBtn = document.getElementById('start-game-btn');
const dailyRankingStart = document.getElementById('daily-ranking-start');
const globalRankingStart = document.getElementById('global-ranking-start');

// Opciones
const skipLimitInput = document.getElementById('skip-limit');
const legendaryLimitSelect = document.getElementById('legendary-limit');
const ultrabeastLimitSelect = document.getElementById('ultrabeast-limit');
const megaLimitSelect = document.getElementById('mega-limit');
const shinyEnabledCheckbox = document.getElementById('shiny-enabled');
const shinyBoostCheckbox = document.getElementById('shiny-boost');
const shinyBoostContainer = document.getElementById('shiny-boost-container');

// ============ VARIABLES GLOBALES ============
let poolSpritesCache = [];
let introInterval = null;

// ============ COOKIES ============
function setCookie(name, value, days = 365) {
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

// ============ PRECARGA DE SPRITES ============
async function fetchPokemon(name) {
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
  return res.json();
}

async function preloadPoolSprites() {
  console.log('Iniciando precarga de sprites...');
  const batchSize = 50;
  
  for (let i = 0; i < FINAL_POKEMON_POOL.length; i += batchSize) {
    const batch = FINAL_POKEMON_POOL.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async name => {
      try {
        const pokemon = await fetchPokemon(name);
        if (pokemon?.sprites?.front_default) {
          return pokemon.sprites.front_default;
        }
        return null;
      } catch (error) {
        console.warn(`Error cargando ${name}:`, error.message);
        return null;
      }
    });
    
    const results = await Promise.all(batchPromises);
    const validSprites = results.filter(s => s !== null);
    poolSpritesCache.push(...validSprites);
    
    console.log(`Cargados ${poolSpritesCache.length}/${FINAL_POKEMON_POOL.length} sprites`);
  }
  
  console.log(`Precarga completa: ${poolSpritesCache.length} sprites cargados`);
}

// ============ ANIMACIÓN DE INTRO ============
function startIntroAnimation() {
  introInterval = setInterval(() => {
    if (poolSpritesCache.length > 0) {
      const randomSprite = poolSpritesCache[Math.floor(Math.random() * poolSpritesCache.length)];
      introSprite.src = randomSprite;
    }
  }, 300);
}

// ============ RANKING ============
function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function initRankings() {
  const today = getTodayKey();
  const savedDate = localStorage.getItem("pokemonRankingDate");

  if (savedDate !== today) {
    localStorage.setItem("pokemonRankingDaily", JSON.stringify([]));
    localStorage.setItem("pokemonRankingDate", today);
  }

  if (!localStorage.getItem("pokemonRankingAll")) {
    localStorage.setItem("pokemonRankingAll", JSON.stringify([]));
  }
}

function getTop10(ranking) {
  return ranking.sort((a, b) => b.score - a.score).slice(0, 10);
}

function renderRanking(listElement, rankingData) {
  listElement.innerHTML = "";
  
  if (rankingData.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No hay puntajes todavía";
    li.style.fontStyle = "italic";
    li.style.opacity = "0.6";
    listElement.appendChild(li);
    return;
  }
  
  rankingData.forEach((entry, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${entry.name} — ${entry.score}`;
    listElement.appendChild(li);
  });
}

async function showRankings() {
  // Ranking diario (local)
  const daily = JSON.parse(localStorage.getItem("pokemonRankingDaily") || "[]");
  renderRanking(dailyRankingStart, getTop10(daily));
  
  // Ranking global (Google Sheets)
  if (typeof getGlobalRanking === 'function') {
    try {
      const globalRanking = await getGlobalRanking();
      
      if (globalRanking.length > 0) {
        renderRanking(globalRankingStart, globalRanking);
        
        // Actualizar cada 30 segundos
        startRankingUpdates((updatedRanking) => {
          renderRanking(globalRankingStart, updatedRanking);
        }, 30);
      } else {
        // Si no hay ranking global, mostrar el local
        const all = JSON.parse(localStorage.getItem("pokemonRankingAll") || "[]");
        renderRanking(globalRankingStart, getTop10(all));
      }
    } catch (error) {
      console.error('Error cargando ranking global:', error);
      // Fallback a ranking local
      const all = JSON.parse(localStorage.getItem("pokemonRankingAll") || "[]");
      renderRanking(globalRankingStart, getTop10(all));
    }
  } else {
    // Google Sheets no configurado, usar local
    const all = JSON.parse(localStorage.getItem("pokemonRankingAll") || "[]");
    renderRanking(globalRankingStart, getTop10(all));
  }
}

// ============ GUARDAR CONFIGURACIÓN ============
function saveGameConfig() {
  const config = {
    playerName: playerNameInput.value.trim() || "Jugador",
    skipLimit: parseInt(skipLimitInput.value),
    legendaryLimit: parseInt(legendaryLimitSelect.value),
    ultrabeastLimit: parseInt(ultrabeastLimitSelect.value),
    megaLimit: parseInt(megaLimitSelect.value),
    shinyEnabled: shinyEnabledCheckbox.checked,
    shinyBoost: shinyBoostCheckbox.checked
  };
  
  // Guardar en sessionStorage
  sessionStorage.setItem('gameConfig', JSON.stringify(config));
  
  // Guardar nombre en cookie
  if (config.playerName !== "Jugador") {
    setCookie('playerName', config.playerName);
  }
}

// ============ CARGAR CONFIGURACIÓN ============
function loadGameConfig() {
  // Cargar nombre de cookie
  const savedName = getCookie('playerName');
  if (savedName) {
    playerNameInput.value = savedName;
  }
  
  // Cargar opciones por defecto (ya están en HTML)
}

// ============ EVENTO: CHECKBOX SHINY ============
shinyEnabledCheckbox.addEventListener('change', () => {
  if (shinyEnabledCheckbox.checked) {
    shinyBoostContainer.style.display = 'block';
  } else {
    shinyBoostContainer.style.display = 'none';
    shinyBoostCheckbox.checked = false;
  }
});

// ============ EVENTO: INICIAR JUEGO ============
startGameBtn.addEventListener('click', () => {
  const playerName = playerNameInput.value.trim();
  
  if (!playerName) {
    alert('Por favor ingresa tu nombre');
    playerNameInput.focus();
    return;
  }
  
  if (playerName.length > 12) {
    alert('El nombre debe tener máximo 12 caracteres');
    return;
  }
  
  // Guardar configuración
  saveGameConfig();
  
  // Ir a la página del juego
  window.location.href = 'game.html';
});

// ============ INICIALIZACIÓN ============
initRankings();
showRankings();
loadGameConfig();

// Iniciar precarga en background
preloadPoolSprites().catch(error => {
  console.error("Error preloading sprites:", error);
});

// Iniciar animación después de cargar los primeros sprites
setTimeout(() => {
  if (poolSpritesCache.length > 0) {
    startIntroAnimation();
  } else {
    const retryInterval = setInterval(() => {
      if (poolSpritesCache.length > 0) {
        startIntroAnimation();
        clearInterval(retryInterval);
      }
    }, 1000);
  }
}, 1000);