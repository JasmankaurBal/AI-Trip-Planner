# COCO Frontend (React)

Mobile-first React SPA for COCO.

```
src/
├── api/         # axios client + error helper
├── services/    # typed API functions
├── context/     # AuthContext (JWT + Google session)
├── components/  # ui primitives, map, chat, trip tabs, Logo
├── layouts/     # AppLayout (sidebar + bottom nav)
├── pages/       # Landing, auth, Dashboard, CreateTrip, TripDetail, Discover, Nearby, Chat, WhatNow, TravelMode, Documents, Profile
├── hooks/       # useGeolocation
├── utils/       # constants + formatters
```

## Run
```bash
yarn install
cp .env.example .env      # set REACT_APP_BACKEND_URL
yarn start
```

## Build
```bash
yarn build
```

Design system: Manrope/DM Sans, forest-green + earthy palette, Tailwind. Never stores secrets.
