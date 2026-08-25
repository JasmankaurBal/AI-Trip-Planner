import { useCallback, useState } from "react";

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | prompting | granted | denied | error
  const [error, setError] = useState("");

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("Geolocation is not supported on this device.");
      return;
    }
    setStatus("prompting");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus("granted");
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
        setError(err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const setManual = useCallback((lat, lng) => {
    setCoords({ lat, lng });
    setStatus("granted");
  }, []);

  return { coords, status, error, request, setManual };
}
