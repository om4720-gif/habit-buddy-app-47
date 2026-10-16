// Every habit gets its own color, by its position in the (creation-ordered) active list,
// so the Today list and the tracker always agree.
export const HABIT_COLORS = [
  "#C8502B", // rust
  "#2F7D6B", // teal
  "#D9A21B", // mustard
  "#4A6FA5", // blue
  "#8E5BA8", // purple
  "#C2547B", // rose
  "#5E8C3A", // olive
  "#3B8EA5", // cyan
  "#7A5C45", // brown
  "#E0833F", // orange
];

export const habitColor = (index: number) => HABIT_COLORS[index % HABIT_COLORS.length]!;
