// ============================================
// CLIENTE GOOGLE SHEETS - RANKING GLOBAL
// ============================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbySrESJ6EV4zqY7GsKjIY_xPO206W3JoSAcDGRQEsenRxEITwgCy2KMvxo7K0qXt8Ya/exec';

// ============ VALIDACIÓN DE CONFIGURACIÓN ============
function isValidConfig(config) {
  return (
    config.skipLimit === 1 &&
    config.legendaryLimit === 1 &&
    config.ultrabeastLimit === -1 &&
    config.megaLimit === 1 &&
    (!config.shinyEnabled || !config.shinyBoost)
  );
}

// ============ GUARDAR PUNTAJE EN GOOGLE SHEETS ============
async function saveScoreToGlobal(name, score, config) {
  // Verificar que sea configuración válida
  if (!isValidConfig(config)) {
    console.log('⚠️ Puntaje no guardado: configuración no válida');
    return {
      success: false,
      message: 'Solo se guardan puntajes con configuración básica:\n- 1 Skip\n- 1 Legendario\n- Ultraentes sin límite\n- 1 Mega\n- Shinies sin boost de stats'
    };
  }

  // La URL ya está configurada, continuar

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors', // Importante para Google Apps Script
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'saveScore',
        name: name,
        score: score,
        config: config
      })
    });

    // Con no-cors no podemos leer la respuesta, así que asumimos que funcionó
    console.log('✅ Puntaje enviado al ranking global');
    return { 
      success: true, 
      message: '¡Puntaje guardado en el ranking global!' 
    };

  } catch (error) {
    console.error('❌ Error guardando puntaje:', error);
    return { 
      success: false, 
      message: 'Error al guardar en el ranking global.\nPuntaje guardado localmente.' 
    };
  }
}

// ============ OBTENER RANKING GLOBAL ============
async function getGlobalRanking() {
  // La URL ya está configurada, continuar

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL + '?action=getRanking', {
      method: 'GET',
      cache: 'no-cache'
    });

    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Ranking global obtenido:', data.data.length, 'entradas');
      return data.data;
    } else {
      console.warn('⚠️ No se pudo obtener el ranking global');
      return [];
    }
  } catch (error) {
    console.error('❌ Error obteniendo ranking:', error);
    return [];
  }
}

// ============ ACTUALIZACIÓN PERIÓDICA ============
let rankingUpdateInterval = null;

function startRankingUpdates(callback, intervalSeconds = 30) {
  // Limpiar intervalo anterior si existe
  if (rankingUpdateInterval) {
    clearInterval(rankingUpdateInterval);
  }

  // Actualizar cada X segundos
  rankingUpdateInterval = setInterval(async () => {
    const ranking = await getGlobalRanking();
    callback(ranking);
  }, intervalSeconds * 1000);
}

function stopRankingUpdates() {
  if (rankingUpdateInterval) {
    clearInterval(rankingUpdateInterval);
    rankingUpdateInterval = null;
  }
}