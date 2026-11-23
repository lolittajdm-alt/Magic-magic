import { useWindowDimensions } from "react-native";

// Match controls to the page width, keeping touch targets comfortable on phones.
export function useControlScale() {
  const { width } = useWindowDimensions();
  const scale =
    width < 700 ? 1 : Math.min(1.2, Math.max(0.92, (width * 0.7) / 1280));
  const size = (value) => Math.round(value * scale);
  return { size, target: Math.max(44, size(44)) };
}
