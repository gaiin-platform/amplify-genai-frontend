// Color palette for action segments
const segmentColors = [
  "#00EAFF", "#FF00FF", "#00FF00", "#FF3800", "#FFF100", "#FF0080", 
  "#7B00FF", "#00FF8A", "#FF484B", "#01CDFE", "#FF6EFF", "#CCFF00",
  "#00FFCC", "#B3FF00", "#6600FF", "#FF9500", "#00B3FF", "#FFDD00",
  "#FF0054", "#46FFCA"
];

/**
 * Get a consistent color for a given segment name
 * @param segment The segment name to get a color for
 * @param useDefaultGray Whether to return gray for "default" segments (default: false)
 * @returns A hex color string, or empty string for empty/null segments
 */
export const getSegmentColor = (segment: string, useDefaultGray = false): string => {
  if (!segment || segment === "") return "";
  if (segment === "default" && useDefaultGray) return "#6B7280";
  
  // Hash the segment name to get a consistent index
  let hashCode = 0;
  for (let i = 0; i < segment.length; i++) {
    hashCode = segment.charCodeAt(i) + ((hashCode << 5) - hashCode);
  }
  
  const index = Math.abs(hashCode) % segmentColors.length;
  return segmentColors[index];
};

// Export the color array for direct access if needed
export { segmentColors };