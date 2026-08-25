import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sun, Cloud, CloudRain, Snowflake, Wind, Drop } from "@phosphor-icons/react";
import { dataApi } from "../../services/api";
import { Skeleton } from "../ui/states";

function iconFor(code) {
  if (code === 0 || code === 1) return Sun;
  if ([2, 3, 45, 48].includes(code)) return Cloud;
  if ([71, 73, 75].includes(code)) return Snowflake;
  if (code >= 51) return CloudRain;
  return Cloud;
}

export default function WeatherStrip({ destination }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["weather", destination],
    queryFn: () => dataApi.weather({ place: destination }),
    enabled: !!destination,
    staleTime: 1000 * 60 * 30,
    retry: 0,
  });

  if (isLoading) return <Skeleton className="h-24" />;
  if (isError || !data) return null;

  const Cur = iconFor(data.current.code);
  return (
    <div className="card p-4" data-testid="weather-strip">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Cur size={36} weight="fill" className="text-ochre" />
          <div>
            <p className="text-2xl font-extrabold text-ink">{Math.round(data.current.temp)}°C</p>
            <p className="text-xs text-ink-soft">{data.current.condition}</p>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-ink-faint">
          <span className="flex items-center gap-1"><Wind size={13} /> {Math.round(data.current.wind)} km/h</span>
          <span className="flex items-center gap-1"><Drop size={13} /> {data.current.humidity}%</span>
        </div>
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto border-t border-border pt-3">
        {data.daily.slice(0, 7).map((d) => {
          const Ic = iconFor(d.code);
          return (
            <div key={d.date} className="flex min-w-[52px] flex-col items-center gap-0.5">
              <span className="text-[11px] text-ink-faint">{new Date(d.date).toLocaleDateString([], { weekday: "short" })}</span>
              <Ic size={18} className="text-ink-soft" />
              <span className="text-xs font-semibold text-ink">{Math.round(d.max)}°</span>
              <span className="text-[11px] text-ink-faint">{Math.round(d.min)}°</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
