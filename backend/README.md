# Giuseppe Dashboard Backend

A comprehensive FastAPI backend for a personal dashboard designed for a cybersecurity student with ADHD and ASD.

## Features

- **User Authentication**: JWT with TOTP 2FA
- **Health Tracking**: Heart rate, sleep, workouts, weight, calories, steps, medication logging
- **Calendar Integration**: Apple Calendar and manual events
- **Deadline Management**: Coursework, certifications, CTF challenges
- **Routines**: ADHD/ASD-friendly morning/evening routines with step tracking
- **Focus & Productivity**: Pomodoro sessions, daily focus score calculation
- **Habit Tracking**: GitHub-style grid view, streak tracking
- **Mood & Sensory Tracking**: Daily mood, anxiety, energy, sensory overload logging
- **Budget Management**: Transactions, monthly goals, trends
- **CTF Tracking**: HackTheBox, TryHackMe, platform progress
- **Meal Planning**: Weekly plans, nutrition tracking
- **News Feed**: Cybersecurity news aggregation
- **Dashboard Widgets**: Customizable layout, low-stimulation mode

## Tech Stack

- **Framework**: FastAPI with async/await
- **Database**: PostgreSQL with SQLAlchemy ORM (async)
- **Caching**: Redis
- **Background Tasks**: Celery
- **Authentication**: JWT + TOTP 2FA (pyotp)
- **Migrations**: Alembic

## Installation

### Prerequisites

- Python 3.9+
- PostgreSQL 12+
- Redis 6+

### Setup

1. **Clone the repository and navigate to backend directory**

```bash
cd backend
```

2. **Create virtual environment**

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. **Install dependencies**

```bash
pip install -r requirements.txt
```

4. **Configure environment**

```bash
cp .env.example .env
# Edit .env with your configuration
```

5. **Initialize database**

```bash
alembic upgrade head
```

6. **Run the application**

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

### API Documentation

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/
│   │       │   ├── auth.py
│   │       │   ├── health.py
│   │       │   ├── calendar.py
│   │       │   ├── deadlines.py
│   │       │   ├── routines.py
│   │       │   ├── focus.py
│   │       │   ├── habits.py
│   │       │   ├── mood.py
│   │       │   ├── budget.py
│   │       │   ├── ctf.py
│   │       │   ├── meals.py
│   │       │   ├── weather.py
│   │       │   ├── feed.py
│   │       │   └── dashboard.py
│   │       └── router.py
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── security.py
│   │   └── redis.py
│   ├── models/
│   │   ├── user.py
│   │   ├── health.py
│   │   ├── calendar_event.py
│   │   ├── deadline.py
│   │   ├── routine.py
│   │   ├── focus.py
│   │   ├── habit.py
│   │   ├── mood.py
│   │   ├── budget.py
│   │   ├── ctf.py
│   │   └── meal.py
│   ├── schemas/
│   │   └── [Pydantic request/response models]
│   ├── services/
│   │   ├── health_sync.py
│   │   ├── weather_service.py
│   │   ├── feed_service.py
│   │   ├── focus_calculator.py
│   │   └── notification_service.py
│   ├── tasks/
│   │   ├── celery_app.py
│   │   └── periodic.py
│   └── main.py
├── alembic/
│   ├── env.py
│   └── versions/
├── requirements.txt
├── .env.example
└── README.md
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `POST /api/v1/auth/setup-2fa` - Setup 2FA
- `POST /api/v1/auth/verify-2fa` - Verify 2FA
- `GET /api/v1/auth/me` - Get current user
- `PUT /api/v1/auth/me` - Update user profile

### Health
- `POST /api/v1/health/metrics` - Log health metric
- `GET /api/v1/health/metrics` - List health metrics
- `GET /api/v1/health/summary` - Get health summary
- `POST /api/v1/health/medications` - Add medication
- `GET /api/v1/health/medications` - List medications
- `POST /api/v1/health/medications/{id}/log` - Log medication

### Deadlines
- `POST /api/v1/deadlines` - Create deadline
- `GET /api/v1/deadlines` - List deadlines
- `GET /api/v1/deadlines/upcoming/list` - Get upcoming/overdue
- `PATCH /api/v1/deadlines/{id}/complete` - Mark complete

### Habits
- `POST /api/v1/habits` - Create habit
- `GET /api/v1/habits` - List habits
- `POST /api/v1/habits/{id}/log` - Log habit
- `GET /api/v1/habits/grid/all` - Get habit grid
- `GET /api/v1/habits/streaks/all` - Get streaks

### Focus
- `POST /api/v1/focus/pomodoro/start` - Start Pomodoro
- `POST /api/v1/focus/pomodoro/{id}/stop` - Stop Pomodoro
- `GET /api/v1/focus/score/today` - Get today's focus score
- `GET /api/v1/focus/stats` - Get focus statistics

### Routines
- `POST /api/v1/routines` - Create routine
- `GET /api/v1/routines/today/all` - Get today's routines
- `POST /api/v1/routines/{id}/start` - Start routine
- `POST /api/v1/routines/{id}/complete` - Complete routine

### Moods
- `POST /api/v1/mood/entries` - Log mood
- `GET /api/v1/mood/trends` - Get mood trends
- `POST /api/v1/mood/sensory` - Log sensory event

### Budget
- `POST /api/v1/budget/transactions` - Log transaction
- `GET /api/v1/budget/summary` - Get budget summary
- `GET /api/v1/budget/trends` - Get budget trends

### CTF
- `POST /api/v1/ctf/platforms` - Add CTF platform
- `POST /api/v1/ctf/challenges` - Log challenge
- `GET /api/v1/ctf/stats` - Get CTF statistics
- `GET /api/v1/ctf/progress/{platform_id}` - Get platform progress

### Dashboard
- `GET /api/v1/dashboard/widgets` - Get widget config
- `PUT /api/v1/dashboard/layout` - Update layout
- `GET /api/v1/dashboard/next-task` - Get most important task

## Development

### Running Tests

```bash
pytest
```

### Database Migrations

Create a new migration:
```bash
alembic revision --autogenerate -m "Description"
```

Apply migrations:
```bash
alembic upgrade head
```

### Celery Tasks

Start Celery worker:
```bash
celery -A app.tasks.celery_app worker --loglevel=info
```

Start Celery beat (scheduler):
```bash
celery -A app.tasks.celery_app beat --loglevel=info
```

## Environment Variables

See `.env.example` for all configuration options. Key variables:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `SECRET_KEY`: JWT secret key (change in production!)
- `WEATHER_API_KEY`: OpenWeatherMap API key
- `CELERY_BROKER_URL`: Redis URL for Celery

## Accessibility Features

- **Low-Stimulation Mode**: Reduced animations, fewer colors, cleaner interface
- **ADHD-Friendly Routines**: Step-by-step guidance with timing
- **Sensory Logging**: Track sensory sensitivities and triggers
- **Medication Tracking**: Never miss doses with reminders
- **Focus Score**: Data-driven insights on focus quality
- **Energy Awareness**: Track energy levels throughout the day

## Production Deployment

1. Set `DEBUG=False` in `.env`
2. Use strong `SECRET_KEY`
3. Configure proper database backups
4. Set up Redis with persistence
5. Use Gunicorn or similar ASGI server
6. Set up Celery with supervisor/systemd
7. Configure proper CORS origins
8. Enable HTTPS/SSL
9. Set up monitoring and logging

## License

Proprietary - Giuseppe's Personal Dashboard

## Support

For issues or questions, contact the development team.
