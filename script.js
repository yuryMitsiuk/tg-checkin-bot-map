window.onerror = function(message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0'; errorDiv.style.left = '0';
    errorDiv.style.width = '100%'; errorDiv.style.height = '100%';
    errorDiv.style.background = 'rgba(0,0,0,0.9)';
    errorDiv.style.color = '#ff3d00'; errorDiv.style.padding = '20px';
    errorDiv.style.zIndex = '99999'; errorDiv.style.overflow = 'scroll';
    errorDiv.style.fontFamily = 'monospace';
    errorDiv.innerHTML = `<h3>🚨 КРИТИЧЕСКАЯ ОШИБКА:</h3>
                          <p><b>Сообщение:</b> ${message}</p>
                          <p><b>Файл:</b> ${source}</p>
                          <p><b>Строка:</b> ${lineno}:${colno}</p>`;
    document.body.appendChild(errorDiv);
    return false;
};

// Main JavaScript Logic
console.log("Логика JavaScript запущена!");

/**
 * Configuration for different environments
 * @typedef {Object} Config
 * @property {Object} DEVELOPMENT - Development mode settings
 * @property {boolean} DEVELOPMENT.enabled - Whether development mode is enabled
 * @property {Object} DEVELOPMENT.fakeUser - Fake user data for development
 * @property {number} DEVELOPMENT.fakeUser.id - Fake user ID
 * @property {string} DEVELOPMENT.fakeUser.username - Fake username
 * @property {string} DEVELOPMENT.fakeUser.first_name - Fake first name
 * @property {Object} DEVELOPMENT.fakeLocation - Fake location for development
 * @property {number} DEVELOPMENT.fakeLocation.lat - Fake latitude
 * @property {number} DEVELOPMENT.fakeLocation.lon - Fake longitude
 * @property {Object} PRODUCTION - Production mode settings
 * @property {boolean} PRODUCTION.enabled - Whether production mode is enabled
 */
const CONFIG = {
    // Development mode - allows local testing with fake data
    DEVELOPMENT: {
        enabled: false,
        fakeUser: {
            id: 99999,
            username: "macbook_tester",
            first_name: "Yury_Dev"
        },
        fakeLocation: {
            lat: 53.955,
            lon: 27.665
        }
    },
    // Production mode - uses real data
    PRODUCTION: {
        enabled: true
    }
};

/**
 * API base URL for backend communication
 * @type {string}
 */
const API_BASE_URL = "https://tg-checkin-bot-server.onrender.com";

/**
 * Visibility radius for fog of war in meters
 * @type {number}
 */
const VISIBILITY_RADIUS = 150;

/**
 * Game ID for backend API calls
 * @type {number}
 */
let currentGameId = 1;

/**
 * Set to store IDs of collected points
 * @type {Set<number>}
 */
let visitedPoints = new Set();

/**
 * Total number of points in the game
 * @type {number}
 */
let totalPoints = 0;

/**
 * Telegram WebApp instance
 * @type {Object|null}
 */
const tg = window.Telegram?.WebApp || {
    expand: () => console.log("Фейковый expand: открыто в браузере Mac"),
    initDataUnsafe: {
        user: CONFIG.DEVELOPMENT.fakeUser
    }
};

/**
 * Flag indicating if we're in development mode
 * @type {boolean}
 */
const isDevelopment = CONFIG.DEVELOPMENT.enabled;

/**
 * The list of available 3D models
 * @type {string[]}
 */
const MEME_MODEL_PATHS = [
    "./models/67_brainrot.glb",
    "./models/ballerina_cappuccina_brainrot.glb",
    "./models/tralalero_tralala.glb",
    "./models/Astronaut.glb"
];


/**
 * Current user ID
 * @type {number|null}
 */
let currentUserId = null;

/**
 * Current user data
 * @type {Object|null}
 */
let currentUserData = null;

// Initialize Telegram WebApp
tg.expand();

/**
 * Gets user data (real or fake based on mode)
 * @returns {Object|null} User data object or null if not available
 */
function getUserData() {
    if (isDevelopment) {
        // Use fake user data in development
        return CONFIG.DEVELOPMENT.fakeUser;
    } else {
        // Use real Telegram user data
        return tg.initDataUnsafe?.user || null;
    }
}

/**
 * Gets fake location data for development mode
 * @returns {Object|null} Fake location object or null if not available
 */
function getUserLocation() {
    if (isDevelopment) {
        // Use fake location in development
        return CONFIG.DEVELOPMENT.fakeLocation;
    } else {
        // In production, we'll get real location later
        return null;
    }
}

/**
 * Leaflet map instance
 * @type {Object}
 */
const map = L.map('map');

// Add OpenStreetMap tiles to the map
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

/**
 * User marker on the map
 * @type {Object|null}
 */
let userMarker = null;

/**
 * Current user latitude
 * @type {number}
 */
let userLat = 0;

/**
 * Current user longitude
 * @type {number}
 */
let userLon = 0;

/**
 * Array of target points in the game
 * @type {Array<Object>}
 */
let targetPoints = [];

/**
 * Set of discovered point IDs
 * @type {Set<number>}
 */
let discoveredPoints = new Set();

/**
 * Calculates distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Радиус Земли в метрах
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Расстояние в метрах
}

/**
 * Sends game progress to the backend server
 * @async
 * @returns {Promise<void>}
 */
async function sendProgressToServer() {
    try {
        console.log("Отправляем прогресс игрока на бэкенд...");

        const userData = getUserData();
        const userId = userData?.id || 99999;
        const username = userData?.username || "macbook_tester";
        const firstName = userData?.first_name || "Yury_Dev";

        const response = await fetch(`${API_BASE_URL}/api/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Передаем данные игрока
            body: JSON.stringify({
                tg_id: userId,
                username: username,
                first_name: firstName,
                game_id: currentGameId,
                points_found: visitedPoints.size // Сколько мемов мы уже собрали
            })
        });

        const data = await response.json();
        console.log("Ответ от бэкенда по прогрессу:", data);

        // Обрабатываем геймплейные статусы соревнования от сервера
        if (data.status === "victory") {
            showNotification("🏆 ЧЕМПИОН! Вы собрали все мемы ПЕРВЫМ! Вы победили в соревновании! 🤌6️⃣7", "success");
        } else if (data.status === "finished_late") {
            showNotification(`🏁 Вы собрали все точки, но кубок уже забрали! Победитель: ${data.winner}`, "info");
        } else {
            showNotification(`🏆 Мем собран! Ваш текущий счет: ${visitedPoints.size} из ${totalPoints}`, "success");
        }

    } catch (error) {
        console.error("Ошибка при отправке прогресса на сервер:", error);
        showNotification("Ошибка отправки прогресса. Попробуйте позже.", "error");
    }
}

/**
 * Displays a notification to the user
 * @param {string} message - Notification message
 * @param {string} type - Notification type ("info", "success", "error")
 * @returns {void}
 */
function showNotification(message, type = "info") {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type} show`;
    notification.textContent = message;
    
    container.appendChild(notification);
    
    // Автоматически удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

/**
 * Displays a full-screen AR window to capture a 3D meme.
 *
 * The function performs the following actions:
 * 1. Dynamically loads a unique 3D model (.glb) for a specific quest point.
 * 2. Monitors the status of the AR session through the 'ar-status' event.
 * 3. Shows the "Pick up" button only after the object has been successfully placed in the space (object-placed).
 * 4. Handles meme collection and sending progress to the server.
 *
 * @param {Object} point - The object of the game point.
 * @param {number} point.id - Unique identifier of the point.
 * @param {string} point.modelSrc is the path to the 3D model file (for example, './models/Astronaut.glb').
 * @param {Object|null} point.markerInstance is an instance of the Leaflet marker for status updates.
 * @returns {void}
 */
function showARPopup(point) {
    const arPopup = document.getElementById('ar-popup');
    const modelViewer = document.getElementById('ar-model-viewer');
    const captureBtn = document.getElementById('ar-capture-btn');
    const closeBtn = document.getElementById('ar-close-btn');

    // 1. Подставляем нужную модель
    modelViewer.src = point.modelSrc;

    // 2. Скрываем кнопку захвата изначально
    captureBtn.style.display = 'none';
    captureBtn.textContent = "🎯 Я ВИЖУ ЕГО! ЗАБРАТЬ!";
    captureBtn.disabled = false;

    // 3. Показываем окно
    arPopup.style.display = 'flex';

    // 4. Слушаем событие "Мем встал на поверхность"
    // Это сработает, когда игрок наведет камеру на пол и мем "прилипнет"
    const onArStatus = (event) => {
        if (event.detail.status === 'object-placed') {
            console.log("✅ AR-объект успешно размещен в пространстве!");
            captureBtn.style.display = 'inline-block'; // Показываем кнопку только теперь

            // Удаляем слушатель, чтобы не срабатывал лишний раз
            modelViewer.removeEventListener('ar-status', onArStatus);
        }
    };

    modelViewer.addEventListener('ar-status', onArStatus);

    // 5. Логика кнопки "Забрать"
    captureBtn.onclick = function() {
        arPopup.style.display = 'none';

        if (point.markerInstance) {
            point.markerInstance.setPopupContent(`<b>✅ Мем собран в инвентарь!</b>`).openPopup();
        }

        sendProgressToServer();
    };

    // 6. Логика кнопки "Отмена"
    closeBtn.onclick = function() {
        arPopup.style.display = 'none';
        visitedPoints.delete(point.id); // Разрешаем попробовать снова
        updateProgressIndicator();
    };
}

/**
 * Checks fog of war and updates game state based on user position
 * @returns {void}
 */
function checkFogOfWar() {
    targetPoints.forEach((point) => {
        const distance = getDistance(userLat, userLon, point.lat, point.lon);

        // 1. Раскрытие тумана войны (150 метров)
        if (distance <= VISIBILITY_RADIUS && !discoveredPoints.has(point.id)) {
            discoveredPoints.add(point.id);
            point.markerInstance = L.marker([point.lat, point.lon])
                .addTo(map)
                .bindPopup(`<b>👀 Скрытый Мем открыт!</b>`)
                .openPopup();
            console.log(`💥 Туман рассеялся для точки #${point.id + 1}`);
        }

        // 2. ВХОД В ЗОНУ ВЗЯТИЯ ТОЧКИ (15 метров)
        if (distance <= 15 && !visitedPoints.has(point.id)) {
            visitedPoints.add(point.id);
            console.log(`🎯 Вход в зону AR! Модель: ${point.modelSrc}`);

            showARPopup(point);
        }
    });
}

/**
 * Updates the progress indicator display
 * @returns {void}
 */
function updateProgressIndicator() {
    document.getElementById('collected-count').textContent = visitedPoints.size;
}

/**
 * Loads game points from the backend API
 * @async
 * @param {number} gameId - ID of the game to load points for
 * @returns {Promise<void>}
 */
async function loadGamePoints(gameId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/games/${gameId}/points`);
        const points = await response.json();

        // Check if points is actually an array
        if (!Array.isArray(points)) {
            console.error("Received data is not an array:", points);
            showNotification("Ошибка загрузки точек: Некорректный формат данных", "error");
            return;
        }

        // Сохраняем точки в наш массив, но на карту изначально НЕ ДОБАВЛЯЕМ!
        targetPoints = points.map((p, idx) => {
            const modelFile = MEME_MODEL_PATHS[idx % MEME_MODEL_PATHS.length];
            return {
                lat: p.lat,
                lon: p.lon,
                id: idx,
                modelSrc: modelFile,
                markerInstance: null
            };
        });

        totalPoints = targetPoints.length;
        document.getElementById('total-count').textContent = totalPoints;
        updateProgressIndicator();

        console.log(`Загружено ${targetPoints.length} скрытых точек. Они покрыты туманом войны!`);

        // Сразу делаем первую проверку видимости
        checkFogOfWar();

    } catch (error) {
        console.error("Ошибка загрузки точек:", error);
        showNotification("Ошибка загрузки точек. Попробуйте позже.", "error");
    }
}

/**
 * Handles user location changes (real or simulated)
 * @param {number} lat - Latitude coordinate
 * @param {number} lon - Longitude coordinate
 * @returns {void}
 */
function handleUserLocation(lat, lon) {
    userLat = lat;
    userLon = lon;
    
    // Center map on user location
    map.setView([userLat, userLon], 15);
    
    // Update user marker
    if (userMarker) {
        userMarker.setLatLng([userLat, userLon]);
    } else {
        // Create marker if it doesn't exist
        userMarker = L.circleMarker([userLat, userLon], {
            color: '#007aff',
            fillColor: '#007aff',
            fillOpacity: 0.8,
            radius: 10
        }).addTo(map).bindPopup("<b>Вы здесь</b>");
    }
    
    console.log(`📍 Пользователь находится в точке: ${userLat.toFixed(5)}, ${userLon.toFixed(5)}`);
    
    // Check fog of war after location update
    checkFogOfWar();
}

/**
 * Launches continuous tracking via Telegram API geolocation
 * @returns {void}
 */
function startContinuousTracking() {
    // ✅ Правильное название метода: startUpdatingPosition
    if (tg?.Location && typeof tg.Location.startUpdatingPosition === 'function') {
        console.log("🔄 Запускаем непрерывное отслеживание позиции...");

        tg.Location.startUpdatingPosition((location) => {
            if (location && location.latitude) {
                console.log("📍 Обновлена геолокация:", location.latitude.toFixed(5), location.longitude.toFixed(5));
                handleUserLocation(location.latitude, location.longitude);
            }
        });
    } else {
        console.log("⚠️ Непрерывное отслеживание не поддерживается");
    }
}

/**
 * Gets user's real location using Telegram WebApp location API
 * @returns {void}
 */
function getUserTelegramLocation() {
    // Check if Telegram WebApp has location support
    if (tg?.Location) {
        // Use Telegram's native location API
        tg.Location.request().then((location) => {
            if (location) {
                console.log("📍 Получена геолокация от Telegram:", location);
                handleUserLocation(location.latitude, location.longitude);
                startContinuousTracking();
            } else {
                console.warn("Telegram location request was cancelled or failed");
                // Fallback to browser geolocation
                getUserBrowserLocation();
            }
        }).catch((error) => {
            console.error("Ошибка запроса геолокации через Telegram:", error);
            // Fallback to browser geolocation
            getUserBrowserLocation();
        });
    } else {
        // Fallback to browser geolocation
        getUserBrowserLocation();
    }
}

/**
 * Launches continuous tracking via browser geolocation
 * @returns {void}
 */
function startBrowserContinuousTracking() {
    if (navigator.geolocation && typeof navigator.geolocation.watchPosition === 'function') {
        console.log("🔄 Запускаем непрерывное отслеживание через браузер...");

        navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                handleUserLocation(lat, lon);
            },
            (error) => {
                console.error("❌ Ошибка непрерывного отслеживания:", error);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    }
}

/**
 * Gets user's real location using browser geolocation API
 * @returns {void}
 */
function getUserBrowserLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                handleUserLocation(lat, lon);
                startBrowserContinuousTracking();
            },
            (error) => {
                console.error("Ошибка получения геолокации:", error);
                // In production mode, we should inform user that location is required
                if (!isDevelopment) {
                    showNotification("Для игры необходим доступ к геолокации. Пожалуйста, включите GPS и разрешите доступ к местоположению.", "error");
                    // Don't fallback to fake location in production - game can't work without location
                } else {
                    // In development mode, fallback to fake location
                    const fakeLocation = getUserLocation();
                    handleUserLocation(fakeLocation.lat, fakeLocation.lon);
                    showNotification("Не удалось получить ваше местоположение. Используется фейковая позиция.", "info");
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    } else {
        console.error("Геолокация не поддерживается браузером");
        // In production mode, we should inform user that location is required
        if (!isDevelopment) {
            showNotification("Ваш браузер не поддерживает геолокацию. Для игры необходим доступ к GPS.", "error");
        } else {
            // In development mode, fallback to fake location
            const fakeLocation = getUserLocation();
            handleUserLocation(fakeLocation.lat, fakeLocation.lon);
            showNotification("Ваш браузер не поддерживает геолокацию. Используется фейковая позиция.", "info");
        }
    }
}

/**
 * Initializes the game by setting up user data and location
 * @returns {void}
 */
function initGame(gameId) {
    console.log(`🎮 Инициализация игры #${gameId}`);

    // Устанавливаем ID игры
    currentGameId = gameId;
    // Get user data
    currentUserData = getUserData();
    currentUserId = currentUserData?.id || 99999;
    
    // Get user location (real or fake)
    if (isDevelopment) {
        // In development mode, use fake location
        const fakeLocation = getUserLocation();
        handleUserLocation(fakeLocation.lat, fakeLocation.lon);
    } else {
        // In production mode, try to get real location using priority: Telegram > Browser > Dev
        getUserTelegramLocation();
    }
    
    // Load game points
    loadGamePoints(currentGameId);
    
    // Show onboarding for new users after game is initialized
    if (shouldShowOnboarding()) {
        // Small delay to let the map render first
        setTimeout(() => {
            showOnboarding();
        }, 500);
    }
}

/**
 * Loads and displays the Game Hub selection menu
 * @async
 * @returns {Promise<void>}
 */
async function loadGameHub() {
    const hubOverlay = document.getElementById('game-hub-overlay');
    const gamesListContainer = document.getElementById('hub-games-list');

    // Показываем полноэкранное меню выбора
    hubOverlay.style.display = 'flex';
    gamesListContainer.innerHTML = ''; // Очищаем текст загрузки

    try {
        // Скачиваем список активных игр с нашего нового роута FastAPI
        const response = await fetch(`${API_BASE_URL}/api/games`);
        
        // Check if response is OK
        if (!response.ok) {
            console.error(`Ошибка HTTP: ${response.status}`);
            gamesListContainer.innerHTML = '<p class="hub-error-message">Ошибка связи с сервером бэкенда.</p>';
            return;
        }
        
        const games = await response.json();

        // Validate that games is an array
        if (!Array.isArray(games)) {
            console.error("Полученные данные не являются массивом:", games);
            gamesListContainer.innerHTML = '<p class="hub-error-message">Некорректный формат данных от сервера.</p>';
            return;
        }

        if (games.length === 0) {
            gamesListContainer.innerHTML = '<p class="hub-empty-message">ℹ️ Сейчас нет активных игр.<br>Создайте квест в боте через /create_game!</p>';
            return;
        }

        // Циклом создаем красивую Roblox-кнопку для каждой игры
        games.forEach((game) => {
            const btn = document.createElement('button');
            btn.className = 'hub-game-btn';
            btn.innerHTML = `<span>🎮 ${game.name}</span> <span class="hub-game-arrow">▶</span>`;

            // Логика нажатия на игру из списка:
            btn.onclick = function() {
                hubOverlay.style.display = 'none'; // Прячем стартовое меню
                currentGameId = game.id;                 // Записываем выбор в глобальную переменную

                console.log(`🚀 Игрок выбрал квест вручную через Хаб! ID = ${currentGameId}`);
                initGame(currentGameId);           // Запускаем полную инициализацию выбранного мира!
            };

            gamesListContainer.appendChild(btn);
        });

    } catch (error) {
        console.error("Ошибка загрузки Игрового Хаба:", error);
        gamesListContainer.innerHTML = '<p class="hub-error-message">Ошибка связи с сервером бэкенда.</p>';
    }
}

/**
 * Current onboarding step index
 * @type {number}
 */
let currentOnboardingStep = 0;

/**
 * Total number of onboarding steps
 * @type {number}
 */
const TOTAL_ONBOARDING_STEPS = 5;

/**
 * Shows the onboarding overlay
 * @returns {void}
 */
function showOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    overlay.style.display = 'flex';
    currentOnboardingStep = 0;
    updateOnboardingStep();
}

/**
 * Hides the onboarding overlay
 * @returns {void}
 */
function hideOnboarding() {
    const overlay = document.getElementById('onboarding-overlay');
    overlay.style.display = 'none';
}

/**
 * Updates the onboarding UI to show the current step
 * @returns {void}
 */
function updateOnboardingStep() {
    // Update steps visibility
    const steps = document.querySelectorAll('.onboarding-step');
    steps.forEach((step) => {
        step.classList.remove('active');
        if (Number.parseInt(step.dataset.step) === currentOnboardingStep) {
            step.classList.add('active');
        }
    });

    // Update progress dots
    const dots = document.querySelectorAll('.onboarding-dot');
    dots.forEach((dot) => {
        dot.classList.remove('active');
        if (Number.parseInt(dot.dataset.step) === currentOnboardingStep) {
            dot.classList.add('active');
        }
    });

    // Update next button text on last step
    const nextBtn = document.getElementById('onboarding-next-btn');
    if (currentOnboardingStep === TOTAL_ONBOARDING_STEPS - 1) {
        nextBtn.textContent = 'Начать игру!';
    } else {
        nextBtn.textContent = 'Далее';
    }
}

/**
 * Moves to the next onboarding step or closes it
 * @returns {void}
 */
function nextOnboardingStep() {
    if (currentOnboardingStep < TOTAL_ONBOARDING_STEPS - 1) {
        currentOnboardingStep++;
        updateOnboardingStep();
    } else {
        completeOnboarding();
    }
}

/**
 * Marks onboarding as completed and hides it
 * @returns {void}
 */
function completeOnboarding() {
    hideOnboarding();
    try {
        localStorage.setItem('memeQuestsOnboardingCompleted', 'true');
    } catch (error) {
        console.warn("Не удалось сохранить статус onboarding в localStorage:", error);
    }
}

/**
 * Checks if onboarding should be shown to the user
 * @returns {boolean} True if onboarding should be shown
 */
function shouldShowOnboarding() {
    // Always show in development mode for testing
    if (isDevelopment) {
        return true;
    }
    
    try {
        return localStorage.getItem('memeQuestsOnboardingCompleted') !== 'true';
    } catch (error) {
        console.warn("Не удалось прочитать статус onboarding из localStorage:", error);
        return true;
    }
}

/**
 * Sets up onboarding event listeners
 * @returns {void}
 */
function setupOnboarding() {
    const nextBtn = document.getElementById('onboarding-next-btn');
    const skipBtn = document.getElementById('onboarding-skip-btn');
    const helpBtn = document.getElementById('help-btn');

    if (nextBtn) {
        nextBtn.addEventListener('click', nextOnboardingStep);
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', completeOnboarding);
    }

    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            currentOnboardingStep = 0;
            showOnboarding();
        });
    }
}

/**
 * Sets up click event listener for development mode
 * @returns {void}
 */
if (isDevelopment) {
    map.on('click', function (e) {
        handleUserLocation(e.latlng.lat, e.latlng.lng);
    });
}

// Initialize the game when page loads
globalThis.addEventListener('load', function() {
    // Setup onboarding controls
    setupOnboarding();

    // Extract game_id from URL parameters
    const urlParams = new URLSearchParams(globalThis.location.search);
    const gameIdFromUrl = urlParams.get('game_id');
    
    if (gameIdFromUrl) {
        // Use the game ID from URL
        currentGameId = Number.parseInt(gameIdFromUrl);
        console.log(`📥 Получен game_id из URL: ${currentGameId}`);
        initGame(currentGameId);
    } else {
        // Fallback to default game ID (for testing purposes)
        console.warn("No game_id found in URL, using default game ID");
        // In development mode, we should still initialize the game with fake data
        // but skip the API call for points since we don't have a backend running
        if (isDevelopment) {
            // Initialize with fake location and user data
            initGame(currentGameId);
        } else {
            // Initialize via menu-hub in app by user choose
            console.warn("No game_id provided in production mode");
            console.log("Ссылка без ID игры. Активируем Игровой Хаб выбора квестов.");
            loadGameHub();
        }
    }
});
