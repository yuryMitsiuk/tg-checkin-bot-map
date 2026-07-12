// Main JavaScript Logic
console.log("Логика JavaScript запущена!");

const API_BASE_URL = "http://127.0.0.1:8000";
const VISIBILITY_RADIUS = 150; // Радиус раскрытия тумана войны в метрах
const GAME_ID = 1;
let visitedPoints = new Set(); // Хранит ID собранных мемов
let totalPoints = 0; // Общее количество точек

// Заглушка Telegram API
const tg = window.Telegram?.WebApp || {
    expand: () => console.log("Фейковый expand: открыто в браузере Mac"),
    initDataUnsafe: {
        user: {
            id: 99999,
            username: "macbook_tester",
            first_name: "Yury_Dev"
        }
    }
};
tg.expand();

// Инициализируем карту вокруг координат Минска
const map = L.map('map').setView([53.95, 27.67], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19}).addTo(map);

// Переменные для игры
let userMarker = null;       // Синий кружок игрока
let userLat = 53.955;        // Стартовая позиция игрока (чуть в стороне от мемов)
let userLon = 27.665;
let targetPoints = [];       // Массив всех скрытых точек квеста
let discoveredPoints = new Set(); // ID точек, на которых туман войны уже рассеялся

// 1. Формула Хаверсина для точного расчета метров на круглой Земле
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

// 3. ФУНКЦИЯ ОТПРАВКИ ПРОГРЕССА НА Python FastAPI БЭКЕНД
async function sendProgressToServer() {
    try {
        console.log("Отправляем прогресс игрока на бэкенд...");

        const userId = tg.initDataUnsafe?.user?.id || 99999;
        const username = tg.initDataUnsafe?.user?.username || "macbook_tester";
        const firstName = tg.initDataUnsafe?.user?.first_name || "Yury_Dev";

        const response = await fetch(`${API_BASE_URL}/api/progress`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            // Передаем данные игрока (сейчас у нас данные из заглушки Yury_Dev)
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
            showNotification("🏆 ЧЕМПИОН! Вы собрали все мемы ПЕРВЫМ! Вы победили в соревновании! 🤌", "success");
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

// Функция для отображения уведомлений
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
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 2. Функция сканирования местности (проверяет туман войны вокруг игрока)
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

// Обновление индикатора прогресса
function updateProgressIndicator() {
    document.getElementById('collected-count').textContent = visitedPoints.size;
}

// 3. Функция загрузки точек (модифицированная)
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
        }).addTo(map).bindPopup("<b>Вы здесь (Yury_Dev)</b>").openPopup();

        // Сразу делаем первую проверку видимости
        checkFogOfWar();

    } catch (error) {
        console.error("Ошибка загрузки точек:", error);
        showNotification("Ошибка загрузки точек. Попробуйте позже.", "error");
    }
}

// 4. МЕХАНИКА СИМУЛЯЦИИ ХОДЬБЫ ДЛЯ ТЕСТОВ НА МАКЕ:
// При клике мышкой в любое место на карте, синяя точка "перешагивает" туда
map.on('click', function (e) {
    userLat = e.latlng.lat;
    userLon = e.latlng.lng;

    // Перемещаем синий маркер игрока на карте плавно
    if (userMarker) {
        userMarker.setLatLng([userLat, userLon]);
    }

    console.log(`👣 Юзер сделал шаг в точку: ${userLat.toFixed(5)}, ${userLon.toFixed(5)}`);

    // Снова проверяем, не попал ли какой-то мем в радиус 150 метров после шага
    checkFogOfWar();
});

// Запускаем квест ID=2
loadGamePoints(GAME_ID);