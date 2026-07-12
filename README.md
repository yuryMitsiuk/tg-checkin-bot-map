# Check-In Bot Map

A location-based game application that allows users to collect "memes" by walking to specific coordinates on a map.

## Features

- **Location-based gameplay**: Players collect memes by walking to specific coordinates
- **Fog of War mechanics**: Hidden points are revealed as player approaches
- **3D Meme Display**: Interactive 3D model viewing when collecting items
- **Telegram Integration**: Uses Telegram WebApp API for user identification
- **Progress Tracking**: Sends player progress to backend server
- **Responsive Design**: Works on both desktop and mobile devices

## Technical Architecture

### Frontend Technologies
- **HTML5 & CSS3**: For structure and styling
- **JavaScript (ES6+)**: Core game logic and interactivity
- **Leaflet.js**: Map rendering and location services
- **model-viewer**: 3D model display for memes
- **Telegram WebApp API**: User identification and integration

### File Structure
```
checkin-bot-map/
├── index.html          # Main application page
├── styles.css          # CSS styles for UI
├── script.js           # JavaScript game logic
├── models/             # 3D model files
│   └── Astronaut.glb   # 3D astronaut model
└── README.md           # This file
```

## Development Setup

### Prerequisites
- Modern web browser with Geolocation API support
- Node.js (for development tools, optional)
- Telegram WebApp environment (for full functionality)

### Running Locally
1. Open `index.html` in a web browser
2. For development mode:
   - Uses fake user data and coordinates
   - Simulated movement via map clicks
3. For production mode:
   - Requires actual GPS location access
   - Uses real Telegram user data

### Environment Configuration
The application supports two modes:
- **Development Mode**: Uses fake data for local testing
- **Production Mode**: Uses real data and location services

## Game Mechanics

### Core Gameplay
1. **Map Navigation**: Players move by clicking on the map (development) or using GPS (production)
2. **Fog of War**: Points are hidden until player approaches within 150 meters
3. **Collection**: When player gets within 15 meters of a point, they can collect it
4. **Progress Tracking**: Game state is sent to backend server

### Location Handling
- **Development**: Uses hardcoded coordinates (Minsk area)
- **Production**: Uses browser Geolocation API
- **Error Handling**: Graceful degradation with user notifications

## API Integration

The application communicates with a Python FastAPI backend at `http://127.0.0.1:8000`:

### Endpoints
- `GET /api/games/{game_id}/points` - Load game points
- `POST /api/progress` - Send game progress

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