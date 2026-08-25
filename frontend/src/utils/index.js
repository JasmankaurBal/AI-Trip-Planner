import { twMerge } from "tailwind-merge";
import clsx from "clsx";

export const cn = (...args) => twMerge(clsx(args));

export const CURRENCIES = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "CHF", "SGD", "AED"];

export const INTEREST_OPTIONS = [
  "Food", "Culture", "Nature", "Adventure", "History", "Nightlife",
  "Beach", "Shopping", "Art", "Relaxation", "Hiking", "Photography",
];

export const TRAVEL_STYLES = ["Budget", "Balanced", "Comfort", "Luxury"];
export const PACES = ["Relaxed", "Moderate", "Packed"];

export const EXPENSE_CATEGORIES = [
  "accommodation", "transport", "food", "activities", "shopping", "miscellaneous", "emergency",
];

export const CATEGORY_COLORS = {
  sightseeing: "#4A6E82", food: "#D47A57", nature: "#2F9E68", culture: "#8B5CF6",
  adventure: "#C8890F", shopping: "#DB2777", nightlife: "#6366F1", relaxation: "#0EA5A0",
  transport: "#64748B", accommodation: "#2C5530", other: "#8A8F87",
};

export const DISCOVERY_CATEGORIES = [
  "trending", "budget", "adventure", "food", "nature", "culture", "solo", "couples", "family", "hidden gems",
];
