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
const GAME_ID = 1;

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
                game_id: GAME_ID,
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
            // Чтобы окно не открывалось повторно, пока игрок его не закроет
            visitedPoints.add(point.id);
            updateProgressIndicator();

            console.log(`🎯 Игрок подошел вплотную к мему #${point.id + 1}! Дистанция: ${Math.round(distance)}м.`);

            // Показываем наше скрытое 3D окно
            const popup = document.getElementById('meme-popup');
            popup.style.display = 'block';

            // Вешаем обработчик события на клик по кнопке «Тапнуть и собрать»
            // Находим этот кусок внутри if (distance <= 15 ...)
            const captureBtn = document.getElementById('capture-btn');
            captureBtn.onclick = function() {
                popup.style.display = 'none'; // Прячем 3D окно

                if (point.markerInstance) {
                    point.markerInstance.setPopupContent(`<b>✅ Мем успешно собран!</b>`).openPopup();
                }

                sendProgressToServer();
            };
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

        // Сохраняем точки в наш массив, но на карту изначально НЕ ДОБАВЛЯЕМ!
        targetPoints = points.map((p, idx) => ({
            lat: p.lat,
            lon: p.lon,
            id: idx,
            markerInstance: null
        }));

        totalPoints = targetPoints.length;
        document.getElementById('total-count').textContent = totalPoints;
        updateProgressIndicator();

        console.log(`Загружено ${targetPoints.length} скрытых точек. Они покрыты туманом войны!`);

        // Рисуем игрока на стартовой позиции
        userMarker = L.circleMarker([userLat, userLon], {
            color: '#007aff',
            fillColor: '#007aff',
            fillOpacity: 0.8,
            radius: 10
        }).addTo(map).bindPopup("<b>Вы здесь</b>");

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
 * Gets user's real location using browser geolocation API
 * @returns {void}
 */
function getUserRealLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                handleUserLocation(lat, lon);
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
function initGame() {
    // Get user data
    currentUserData = getUserData();
    currentUserId = currentUserData?.id || 99999;
    
    // Set user name in popup
    const userPopup = document.querySelector('#meme-popup b');
    if (userPopup) {
        userPopup.textContent = `Вы здесь (${currentUserData?.first_name || 'Пользователь'})`;
    }
    
    // Get user location (real or fake)
    if (isDevelopment) {
        // In development mode, use fake location
        const fakeLocation = getUserLocation();
        handleUserLocation(fakeLocation.lat, fakeLocation.lon);
    } else {
        // In production mode, try to get real location
        getUserRealLocation();
    }
    
    // Load game points
    loadGamePoints(GAME_ID);
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
    // Extract game_id from URL parameters
    const urlParams = new URLSearchParams(globalThis.location.search);
    const gameId = urlParams.get('game_id');
    
    if (gameId) {
        // Use the game ID from URL
        loadGamePoints(Number.parseInt(gameId));
    } else {
        // Fallback to default game ID (for testing purposes)
        console.warn("No game_id found in URL, using default game ID");
        // In development mode, we should still initialize the game with fake data
        // but skip the API call for points since we don't have a backend running
        if (isDevelopment) {
            // Initialize with fake location and user data
            initGame();
        } else {
            loadGamePoints(1);
        }
    }
});
