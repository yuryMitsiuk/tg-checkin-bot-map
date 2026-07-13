# Check-In Bot Map

A location-based game application for Telegram Mini Apps that allows users to collect "memes" by walking to specific coordinates on a map.

## Features

- **Location-based gameplay**: Players collect memes by walking to specific coordinates
- **Fog of War mechanics**: Hidden points are revealed as player approaches within 150 meters
- **3D Meme Display**: Interactive 3D model viewing when collecting items
- **Telegram Integration**: Uses Telegram WebApp API for user identification and native location services
- **Continuous Location Tracking**: Real-time position updates as the player moves
- **Dynamic Game Loading**: Game ID is read from URL parameters or selected via Game Hub
- **Game Hub**: Selection menu for available active games when no game ID is provided
- **Progress Tracking**: Sends player progress to backend server
- **Responsive Design**: Works on both desktop and mobile devices

## Technical Architecture

### Frontend Technologies
- **HTML5 & CSS3**: For structure and styling
- **JavaScript (ES6+)**: Core game logic and interactivity
- **Leaflet.js**: Map rendering and location services
- **model-viewer**: 3D model display for memes
- **Telegram WebApp API**: User identification, native location services, and Mini App integration

### File Structure
```
checkin-bot-map/
├── index.html          # Main application page (includes Game Hub and AR popup)
├── styles.css          # CSS styles for UI
├── script.js           # JavaScript game logic
├── models/             # 3D model files
│   ├── Astronaut.glb   # 3D astronaut model
│   └── *.glb           # Additional 3D meme models
└── README.md           # This file
```

## Development Setup

### Prerequisites
- Modern web browser
- Telegram WebApp environment (for full functionality)
- Python FastAPI backend running (for production data)

### Running Locally
1. Open `index.html` in a web browser
2. For development mode:
   - Uses fake user data and coordinates
   - Simulated movement via map clicks
3. For production mode:
   - Requires Telegram Mini App environment
   - Uses Telegram native location services
   - Uses real Telegram user data

### Environment Configuration
The application supports two modes controlled by the `CONFIG` object in `script.js`:
- **Development Mode** (`CONFIG.DEVELOPMENT.enabled = true`): Uses fake data for local testing
- **Production Mode** (`CONFIG.DEVELOPMENT.enabled = false`): Uses real data and Telegram location services

## Game Mechanics

### Core Gameplay
1. **Game Launch**: 
   - **Direct Link**: Telegram bot passes `game_id` parameter in URL (e.g., `?game_id=5`)
   - **Game Hub**: If no `game_id` is provided, the app shows a Game Hub where the user can select from available active games
2. **Map Navigation**: Players move by clicking on the map (development) or using GPS (production)
3. **Fog of War**: Points are hidden until player approaches within 150 meters
4. **Collection**: When player gets within 15 meters of a point, they can collect it
5. **Progress Tracking**: Game state is sent to backend server

### Location Handling
The application uses a priority-based location system:
1. **Telegram WebApp Location API** (`tg.Location`) - Primary method in Telegram Mini Apps
2. **Browser Geolocation API** (`navigator.geolocation`) - Fallback for web browsers
3. **Development Fake Location** - Used only in development mode

### Continuous Tracking
- Telegram Mini Apps: Uses `tg.Location.startUpdatingPosition()` for real-time updates
- Web Browsers: Uses `navigator.geolocation.watchPosition()` for continuous tracking
- Development: Updates position via map clicks

## API Integration

The application communicates with a Python FastAPI backend. The base URL is configured in `script.js` via the `API_BASE_URL` constant.

### Endpoints
- `GET /api/games` - Load list of active games (for Game Hub)
- `GET /api/games/{game_id}/points` - Load game points
- `POST /api/progress` - Send game progress

## Telegram Bot Integration

The Telegram bot can open the WebApp in two ways:

### 1. Direct Game Link
Open a specific game directly by passing the game ID:
```python
test_url = f"https://your-domain.com/index.html?game_id={game_id}"
```

### 2. Game Hub Link
Open the Game Hub without a specific game ID, allowing the user to choose:
```python
test_url = f"https://your-domain.com/index.html"
```

The frontend automatically detects the presence of `game_id`:
- If provided, it loads the corresponding game directly
- If missing, it displays the Game Hub with a list of active games from `/api/games`

## Code Documentation

### JavaScript Documentation
All JavaScript functions are documented with JSDoc comments:
- Parameter descriptions
- Return value documentation
- Type annotations
- Function purpose explanations

### CSS Structure
- Modular styling with reusable components
- Responsive design for mobile devices
- Modern UI with animations and transitions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add documentation for new features
5. Submit a pull request