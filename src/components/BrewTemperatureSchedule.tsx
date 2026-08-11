import { formatTemp } from "../grindEngine";
import type { AidenBasket, TempUnit } from "../types";

interface BrewTemperatureScheduleProps {
  basket: AidenBasket;
  bloomTempF: number;
  pulseTempsF: number[];
  tempUnit: TempUnit;
}

export function BrewTemperatureSchedule({
  basket,
  bloomTempF,
  pulseTempsF,
  tempUnit,
}: BrewTemperatureScheduleProps) {
  const temperatures = [
    { label: "Bloom", temperature: bloomTempF },
    ...pulseTempsF.map((temperature, index) => ({
      label: basket === "single" ? `P${index + 1}` : "Brew",
      temperature,
    })),
  ];

  return (
    <div className="brew-temperature-schedule">
      <span className="brew-temperature-title">Brew temperatures</span>
      <div className="brew-temperature-values">
        {temperatures.map(({ label, temperature }) => (
          <div className="brew-temperature-value" key={label}>
            <span>{label}</span>
            <strong>{formatTemp(temperature, tempUnit)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
