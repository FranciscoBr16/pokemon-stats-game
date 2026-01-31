// ============ LISTA DE ULTRAENTES ============
const ULTRA_BEASTS = [
  'nihilego', 'buzzwole', 'pheromosa', 'xurkitree', 'celesteela',
  'kartana', 'guzzlord', 'naganadel', 'stakataka', 'blacephalon'
];

// ============ ELEMENTOS DEL DOM ============
const playerNameDisplay = document.getElementById('player-name-display');
const exitGameBtn = document.getElementById('exit-game-btn');
const spriteImg = document.getElementById('pokemon-sprite');
const nameText = document.getElementById('pokemon-name');
const shinyIndicator = document.getElementById('shiny-indicator');
const statButtons = document.querySelectorAll('.stat-btn');
const skipBtn = document.getElementById('skip-btn');
const skipCount = document.getElementById('skip-count');
const megaBtn = document.getElementById('mega-btn');
const megaCount = document.getElementById('mega-count');
const formSelector = document.getElementById('form-selector');
const formButtonsContainer = document.getElementById('form-buttons');
const resultContainer = document.getElementById('result-container');
const resultStats = document.getElementById('result-stats');
const totalScoreText = document.getElementById('total-score');
const saveScoreBtn = document.getElementById('save-score-btn');
const restartBtn = document.getElementById('restart-btn');
const homeBtn = document.getElementById('home-btn');

// ============ ESTADO DEL JUEGO ============
const selectedStats = {
  hp: null,
  attack: null,
  defense: null,
  'special-attack': null,
  'special-defense': null,
  speed: null
};

let gameConfig = {};
let animationInterval = null;
let isAnimating = false;
let skipUsed = 0;
let megaUsed = 0;
let legendaryUsed = 0;
let ultrabeastUsed = 0;
let finalPokemonData = null;
let currentGenerationId = 0;
let generatedPokemonNames = [];
let poolSpritesCache = [];
let currentMegas = [];

let pendingForms = null;
let basePokemonData = null;


// ============ CARGAR CONFIGURACIÓN ============
function loadGameConfig() {
  const config = sessionStorage.getItem('gameConfig');
  if (config) {
    gameConfig = JSON.parse(config);
  } else {
    // Configuración por defecto
    gameConfig = {
      playerName: 'Jugador',
      skipLimit: 1,
      legendaryLimit: 1,
      ultrabeastLimit: 1,
      megaLimit: 1,
      shinyEnabled: false,
      shinyBoost: false
    };
  }
  
  playerNameDisplay.textContent = gameConfig.playerName;
  updateCounters();
}

function updateCounters() {
  skipCount.textContent = `(${skipUsed}/${gameConfig.skipLimit})`;
  megaCount.textContent = `(${megaUsed}/${gameConfig.megaLimit === -1 ? '∞' : gameConfig.megaLimit})`;
}

// ============ UTILIDADES API ============
async function fetchPokemon(idOrName) {
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${idOrName}`);
    if (!res.ok) throw new Error('Pokemon not found');
    return res.json();
  } catch (error) {
    console.error('Error fetching pokemon:', error);
    throw error;
  }
}

async function fetchSpecies(url) {
  const res = await fetch(url);
  return res.json();
}

async function isLegendary(speciesUrl) {
  try {
    const species = await fetchSpecies(speciesUrl);
    return species.is_legendary || species.is_mythical;
  } catch (error) {
    return false;
  }
}

function isUltraBeast(pokemonName) {
  return ULTRA_BEASTS.includes(pokemonName);
}

// ============ SISTEMA SHINY ============
function rollShiny() {
  if (!gameConfig.shinyEnabled) return false;
  return Math.random() < (1 / 2048); // 1 en 2048
}

function getShinyBoost() {
  if (!gameConfig.shinyBoost) return 0;
  return Math.floor(Math.random() * 11) + 5; // Entre 5 y 15
}

// ============ PRECARGA SPRITES ============
async function preloadPoolSprites() {
  console.log('Iniciando precarga de sprites...');
  const batchSize = 50;
  
  for (let i = 0; i < FINAL_POKEMON_POOL.length; i += batchSize) {
    const batch = FINAL_POKEMON_POOL.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async name => {
      try {
        const pokemon = await fetchPokemon(name);
        if (pokemon?.sprites?.front_default) {
          return {
            normal: pokemon.sprites.front_default,
            shiny: pokemon.sprites.front_shiny
          };
        }
        return null;
      } catch (error) {
        return null;
      }
    });
    
    const results = await Promise.all(batchPromises);
    const validSprites = results.filter(s => s !== null);
    poolSpritesCache.push(...validSprites);
  }
  
  console.log(`Precarga completa: ${poolSpritesCache.length} sprites`);
}

// ============ ANIMACIÓN FAKE ============
function getRandomSpriteFromPool() {
  if (poolSpritesCache.length === 0) return '';
  const randomSprite = poolSpritesCache[Math.floor(Math.random() * poolSpritesCache.length)];
  return randomSprite.normal;
}

function startFakeAnimation() {
  animationInterval = setInterval(() => {
    const spriteUrl = getRandomSpriteFromPool();
    if (!spriteUrl) return;
    
    spriteImg.classList.remove('fade-in');
    spriteImg.classList.add('fade-out');

    setTimeout(() => {
      spriteImg.src = spriteUrl;
      spriteImg.classList.remove('fade-out');
      spriteImg.classList.add('fade-in');
    }, 150);
  }, 300);
}

function stopFakeAnimation() {
  if (animationInterval) {
    clearInterval(animationInterval);
    animationInterval = null;
  }
}

// ============ GENERAR POKÉMON ============
function getRandomFinalPokemonName() {
  const i = Math.floor(Math.random() * FINAL_POKEMON_POOL.length);
  return FINAL_POKEMON_POOL[i];
}

async function generateRealPokemon() {
  let pokemonName, pokemon, isPokemonLegendary, isPokemonUltraBeast, isShiny;

  do {
    try {
      pokemonName = getRandomFinalPokemonName();
      
      // Verificar si ya fue generado
      if (generatedPokemonNames.includes(pokemonName)) {
        nameText.textContent = 'Pokémon ya generado...';
        await new Promise(resolve => setTimeout(resolve, 600));
        nameText.textContent = 'Generando...';
        continue;
      }
      
      pokemon = await fetchPokemon(pokemonName);
      
      if (!pokemon || !pokemon.sprites || !pokemon.sprites.front_default) {
        console.log('Invalid pokemon, retrying...');
        continue;
      }
      
      // Verificar legendario
      isPokemonLegendary = await isLegendary(pokemon.species.url);
      if (isPokemonLegendary) {
        const limit = gameConfig.legendaryLimit;
        if (limit !== -1 && legendaryUsed >= limit) {
          nameText.textContent = 'Legendario salteado...';
          await new Promise(resolve => setTimeout(resolve, 400));
          nameText.textContent = 'Generando...';
          continue;
        }
      }
      
      // Verificar ultraente
      isPokemonUltraBeast = isUltraBeast(pokemonName);
      if (isPokemonUltraBeast) {
        const limit = gameConfig.ultrabeastLimit;
        if (limit !== -1 && ultrabeastUsed >= limit) {
          nameText.textContent = 'Ultraente salteado...';
          await new Promise(resolve => setTimeout(resolve, 400));
          nameText.textContent = 'Generando...';
          continue;
        }
      }
      
      // Roll shiny
      isShiny = rollShiny();
      
      break;
    } catch (error) {
      console.error('Error in generateRealPokemon, retrying:', error);
      continue;
    }
  } while (true);

  generatedPokemonNames.push(pokemonName);

  // Incrementar contadores
  if (isPokemonLegendary) legendaryUsed++;
  if (isPokemonUltraBeast) ultrabeastUsed++;

  return {
    name: pokemon.name,
    sprite: isShiny ? pokemon.sprites.front_shiny : pokemon.sprites.front_default,
    isShiny: isShiny,
    isLegendary: isPokemonLegendary,
    isUltraBeast: isPokemonUltraBeast,
    speciesUrl: pokemon.species.url,
    stats: pokemon.stats.map(s => ({
      name: s.stat.name,
      value: s.base_stat
    }))
  };
}

async function generatePokemon() {
  if (isAnimating) return;

  isAnimating = true;
  const myGenerationId = ++currentGenerationId;

  disableStatButtons();
  skipBtn.disabled = true;
  megaBtn.classList.add('hidden');
  hideFormSelector();
  shinyIndicator.classList.add('hidden');

  nameText.textContent = 'Generando...';
  finalPokemonData = null;

  const pokemonPromise = generateRealPokemon();
  startFakeAnimation();

  const pokemonData = await pokemonPromise;
  if (myGenerationId !== currentGenerationId) {
    stopFakeAnimation();
    return;
  }

  await new Promise(resolve => setTimeout(resolve, 1500));
  if (myGenerationId !== currentGenerationId) {
    stopFakeAnimation();
    return;
  }

  stopFakeAnimation();
  await new Promise(resolve => setTimeout(resolve, 100));
  if (myGenerationId !== currentGenerationId) return;

  spriteImg.classList.add('fade-out');
  await new Promise(resolve => setTimeout(resolve, 200));
  if (myGenerationId !== currentGenerationId) return;

  const finalImg = new Image();
  finalImg.src = pokemonData.sprite;

  try {
    await new Promise((resolve, reject) => {
      finalImg.onload = resolve;
      finalImg.onerror = reject;
    });
  } catch {
    console.error('Error loading sprite, retrying...');
    isAnimating = false;
    generatePokemon();
    return;
  }

  if (myGenerationId !== currentGenerationId) return;

  spriteImg.src = pokemonData.sprite;
  spriteImg.classList.remove('fade-out');
  spriteImg.classList.add('fade-in');
  nameText.textContent = pokemonData.name.toUpperCase();
  
  if (pokemonData.isShiny) {
    shinyIndicator.classList.remove('hidden');
  }

  const forms = await getPokemonForms(pokemonData.name);

if (forms.length > 1) {
  isAnimating = false;
  pendingForms = forms;
  basePokemonData = pokemonData;
  showFormSelector(forms);
  return;
}

// Si no hay formas, flujo normal
finalPokemonData = pokemonData;
isAnimating = false;
await postRevealLogic(pokemonData, myGenerationId);
hideFormSelector();

}

function hideFormSelector() {
  document.getElementById("form-selector").classList.add("hidden");
}


// ============ MEGA EVOLUCIONES ============
async function getMegaEvolutions(speciesUrl) {
  console.log('🔎 Buscando megas para species:', speciesUrl);

  try {
    const species = await fetchSpecies(speciesUrl);

    console.log(
      '📦 Varieties encontradas:',
      species.varieties.map(v => ({
        name: v.pokemon.name,
        is_default: v.is_default
      }))
    );

    const megaVarieties = species.varieties.filter(v =>
      !v.is_default &&
      v.pokemon.name.includes('mega') &&
      !v.pokemon.name.includes('gmax') &&
      !v.pokemon.name.includes('eternamax')
    );

    console.log(
      '⚡ Varieties consideradas como mega:',
      megaVarieties.map(v => v.pokemon.name)
    );

    const megaPromises = megaVarieties.map(async v => {
      console.log('➡️ Intentando cargar mega:', v.pokemon.name);

      try {
        const p = await fetchPokemon(v.pokemon.name);

        // 🔥 MEJORADO: Buscar en MÚLTIPLES fuentes de sprites
        const sprite =
          p.sprites.front_default ||
          p.sprites.front_shiny ||
          p.sprites.other?.['official-artwork']?.front_default ||
          p.sprites.other?.['official-artwork']?.front_shiny ||
          p.sprites.other?.['home']?.front_default ||
          p.sprites.other?.['showdown']?.front_default ||
          'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + p.id + '.png';

        console.log('🖼️ Sprite elegido para', v.pokemon.name, ':', sprite);

        return {
          name: p.name,
          sprite,
          stats: p.stats.map(s => ({
            name: s.stat.name,
            value: s.base_stat
          }))
        };
      } catch (error) {
        console.error('❌ Error cargando mega:', v.pokemon.name, error);
        return null;
      }
    });

    const megas = await Promise.all(megaPromises);

    const validMegas = megas.filter(m => m !== null && m.sprite);

    console.log(
      '🏁 Megas válidas finales:',
      validMegas.length,
      validMegas.map(m => m.name)
    );

    return validMegas;
  } catch (error) {
    console.error(
      '🔥 Error general en getMegaEvolutions:',
      error
    );
    return [];
  }
}


async function postRevealLogic(pokemonData, genId) {
  const megas = await getMegaEvolutions(pokemonData.speciesUrl);
  if (genId !== currentGenerationId) return;

  const megaLimit = gameConfig.megaLimit;
  const canUseMega = megaLimit === -1 || megaUsed < megaLimit;

  if (megas.length > 0 && canUseMega) {
    megaBtn.classList.remove("hidden");
    megaBtn.disabled = false;

    // Guardamos las megas en una variable global
    currentMegas = megas;

    console.log("🧬 Megas disponibles:", megas.map(m => m.name));
  } else {
    megaBtn.classList.add("hidden");
    currentMegas = [];
  }

  const skipLimit = gameConfig.skipLimit;
  if (skipUsed < skipLimit) {
    skipBtn.disabled = false;
  }

  enableStatButtons();
}


// ============ FORMAS ALTERNATIVAS ============
function showFormSelector(forms) {
  formButtonsContainer.innerHTML = '';
  
  forms.forEach(form => {
    const btn = document.createElement('button');
    btn.classList.add('form-btn');
    btn.textContent = form.displayName;
    btn.addEventListener('click', () => selectForm(form));
    formButtonsContainer.appendChild(btn);
  });
  
  formSelector.classList.remove('hidden');
}

function hideFormSelector() {
  formSelector.classList.add('hidden');
  formButtonsContainer.innerHTML = '';
}

async function selectForm(form) {
  finalPokemonData = form;
  spriteImg.src = form.sprite;
  nameText.textContent = form.name.toUpperCase();
  hideFormSelector();

  // 🔥 AGREGADO: Buscar megas para la forma elegida
  console.log('🔍 Buscando megas después de elegir forma (selectForm)...');
  const megas = await getMegaEvolutions(form.speciesUrl);
  const megaLimit = gameConfig.megaLimit;
  const canUseMega = megaLimit === -1 || megaUsed < megaLimit;

  console.log('✨ Megas encontradas:', megas.length, '| Puede usar mega:', canUseMega);

  if (megas.length > 0 && canUseMega) {
    console.log('✅ Mostrando botón de mega');
    currentMegas = megas; // 🔥 IMPORTANTE: Asignar a currentMegas para que el botón funcione
    megaBtn.classList.remove('hidden');
    megaBtn.disabled = false;
    megaBtn.removeAttribute('disabled'); // 🔥 Forzar eliminación del atributo HTML
    megaBtn.dataset.megaData = JSON.stringify(megas);
    console.log('🔧 Estado del botón después de habilitar:', {
      disabled: megaBtn.disabled,
      hasDisabledAttr: megaBtn.hasAttribute('disabled'),
      classList: megaBtn.classList.toString(),
      currentMegasLength: currentMegas.length
    });
  } else {
    console.log('❌ No se muestra botón de mega');
    currentMegas = []; // Limpiar si no hay megas
  }

  if (skipUsed < gameConfig.skipLimit) {
    skipBtn.disabled = false;
  }
  enableStatButtons();
}



async function getPokemonForms(pokemonName) {
  const baseName = pokemonName.split('-')[0];
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${baseName}`);
  if (!res.ok) return [];

  const species = await res.json();

  const forms = [];

  for (const v of species.varieties) {
    const name = v.pokemon.name;

    if (
      name.includes("-mega") ||
      name.includes("-gmax") ||
      name.includes("-totem") ||
      name.includes("-eternamax")
    ) continue;

    const p = await fetchPokemon(name);

    forms.push({
      name: p.name,
      displayName: p.name.replace(/-/g, ' ').toUpperCase(),
      sprite: p.sprites.front_default,
      isShiny: false,
      isLegendary: false,
      isUltraBeast: false,
      speciesUrl: p.species.url,
      stats: p.stats.map(s => ({
        name: s.stat.name,
        value: s.base_stat
      }))
    });
  }

  return forms;
}



async function loadChosenForm(formName) {
  nameText.textContent = "Cargando forma...";

  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${formName}`);
  const pokemon = await res.json();

  const pokemonData = {
    name: pokemon.name,
    sprite: pokemon.sprites.front_default,
    isShiny: false, // las formas NO rerolean shiny
    isLegendary: basePokemonData.isLegendary,
    isUltraBeast: basePokemonData.isUltraBeast,
    speciesUrl: pokemon.species.url,
    stats: pokemon.stats.map(s => ({
      name: s.stat.name,
      value: s.base_stat
    }))
  };

  finalPokemonData = pokemonData;
  spriteImg.src = pokemonData.sprite;
  nameText.textContent = pokemonData.name.toUpperCase();

  hideFormSelector();

  // 🔥 IMPORTANTE: Buscar megas para la forma elegida
  const megas = await getMegaEvolutions(pokemonData.speciesUrl);
  const megaLimit = gameConfig.megaLimit;
  const canUseMega = megaLimit === -1 || megaUsed < megaLimit;

  if (megas.length > 0 && canUseMega) {
    megaBtn.classList.remove('hidden');
    megaBtn.disabled = false;
    megaBtn.dataset.megaData = JSON.stringify(megas);
  }
  enableStatButtons();

  // Reactivar skip si corresponde
  if (skipUsed < gameConfig.skipLimit) {
    skipBtn.disabled = false;
  }
}



// ============ BOTONES ============
function disableStatButtons() {
  statButtons.forEach(btn => {
    if (!btn.disabled) {
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.5';
    }
  });
}

function enableStatButtons() {
  statButtons.forEach(btn => {
    if (!btn.disabled) {
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
    }
  });
}
function showShinyBonus(slotElement, bonusValue) {
  const bonusEl = document.createElement('div');
  bonusEl.className = 'stat-bonus';
  bonusEl.textContent = `+${bonusValue}`;

  slotElement.style.position = 'relative';
  slotElement.appendChild(bonusEl);

  // Eliminar solo después de la animación
  setTimeout(() => {
    bonusEl.remove();
  }, 1000);
}


// ============ EVENTOS: STATS ============
statButtons.forEach(buttonStat => {
  buttonStat.addEventListener('click', () => {
    if (!finalPokemonData || isAnimating) return;

    const stat = buttonStat.dataset.stat;
    if (selectedStats[stat]) return;

    selectedStats[stat] = finalPokemonData;

    const slot = buttonStat.closest('.stat-slot');
    const chip = buttonStat.querySelector('.pokemon-chip');

    chip.innerHTML = `<img src="${finalPokemonData.sprite}" alt="">`;
    requestAnimationFrame(() => chip.classList.add('show'));

    let statValue = finalPokemonData.stats.find(s => s.name === stat).value;
    
    // Aplicar boost shiny si corresponde
    if (finalPokemonData.isShiny && gameConfig.shinyBoost) {
      const boost = getShinyBoost();
      statValue += boost;

      showShinyBonus(slot, boost);
    }

    const resultBox = slot.querySelector('.stat-result');
    resultBox.textContent = statValue;
    resultBox.classList.remove('hidden');
    requestAnimationFrame(() => resultBox.classList.add('show'));

    buttonStat.disabled = true;
    finalPokemonData = null;
    megaBtn.classList.add('hidden');
    shinyIndicator.classList.add('hidden');

    const allFilled = Object.values(selectedStats).every(v => v !== null);

    if (allFilled) {
      skipBtn.disabled = true;
      showResults();
    } else {
      generatePokemon();
    }
  });
});

// ============ EVENTO: SKIP ============
skipBtn.addEventListener('click', () => {
  if (skipUsed >= gameConfig.skipLimit || isAnimating || !finalPokemonData) return;

  skipUsed++;
  updateCounters();
  skipBtn.disabled = true;

  finalPokemonData = null;
  megaBtn.classList.add('hidden');
  shinyIndicator.classList.add('hidden');
  nameText.textContent = 'Pokémon salteado';

  const allFilled = Object.values(selectedStats).every(v => v !== null);
  if (!allFilled) {
    setTimeout(() => generatePokemon(), 500);
  }
});

// ============ EVENTO: MEGA ============
megaBtn.addEventListener('click', () => {
  console.log('🎯 Click en botón de mega');
  console.log('Estado actual:', {
    finalPokemonData: finalPokemonData,
    isAnimating: isAnimating,
    currentMegasLength: currentMegas.length,
    megaBtn_disabled: megaBtn.disabled
  });
  
  if (!finalPokemonData || isAnimating) {
    console.log('❌ Bloqueado: finalPokemonData o isAnimating');
    return;
  }
  if (!currentMegas.length) {
    console.log('❌ Bloqueado: currentMegas vacío');
    return;
  }

  console.log('✅ Aplicando mega evolución...');

  if (currentMegas.length === 1) {
    applyMegaEvolution(currentMegas[0]);
  } else {
    showFormSelector(
      currentMegas.map(m => ({
        ...m,
        displayName: m.name.replace(/-/g, ' ').toUpperCase()
      }))
    );
  }

  megaUsed++;
  updateCounters();
  megaBtn.disabled = true;
});



function applyMegaEvolution(megaData) {
  finalPokemonData = {
    ...finalPokemonData,
    name: megaData.name,
    sprite: megaData.sprite,
    stats: megaData.stats
  };
  
  spriteImg.src = megaData.sprite;
  nameText.textContent = megaData.name.toUpperCase();
  megaBtn.classList.add('hidden');
}

// ============ RESULTADOS ============
function showResults() {
  resultStats.innerHTML = '';
  let totalScore = 0;

  for (const stat in selectedStats) {
    const pokemon = selectedStats[stat];
    let statValue = pokemon.stats.find(s => s.name === stat).value;
    
    // Aplicar boost shiny
    if (pokemon.isShiny && gameConfig.shinyBoost) {
      const boost = getShinyBoost();
      statValue += boost;
    }
    
    totalScore += statValue;

    const li = document.createElement('li');
    let text = `${stat.toUpperCase()} → ${pokemon.name.toUpperCase()} (${statValue})`;
    if (pokemon.isShiny) {
      text += ' ✨';
    }
    li.textContent = text;
    resultStats.appendChild(li);
  }

  totalScoreText.textContent = `PUNTAJE TOTAL: ${totalScore}`;
  resultContainer.dataset.score = totalScore;
  resultContainer.classList.remove('hidden');
}

// ============ GUARDAR PUNTAJE ============
function saveScore(name, score) {
  const entry = { name, score, date: getTodayKey() };

  const all = JSON.parse(localStorage.getItem('pokemonRankingAll') || '[]');
  all.push(entry);
  localStorage.setItem('pokemonRankingAll', JSON.stringify(all));

  const daily = JSON.parse(localStorage.getItem('pokemonRankingDaily') || '[]');
  daily.push(entry);
  localStorage.setItem('pokemonRankingDaily', JSON.stringify(daily));
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

saveScoreBtn.addEventListener('click', () => {
  const score = Number(resultContainer.dataset.score);
  saveScore(gameConfig.playerName, score);
  
  alert('¡Puntaje guardado!');
  saveScoreBtn.disabled = true;
});

// ============ NAVEGACIÓN ============
exitGameBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres salir? Perderás tu progreso actual.')) {
    window.location.href = 'index.html';
  }
});

restartBtn.addEventListener('click', () => {
  window.location.reload();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// ============ INICIALIZACIÓN ============
loadGameConfig();

preloadPoolSprites().then(() => {
  console.log('Sprites cargados, iniciando juego...');
  generatePokemon();
}).catch(error => {
  console.error('Error preloading sprites:', error);
  alert('Hubo un problema cargando los Pokémon. Por favor recarga la página.');
});