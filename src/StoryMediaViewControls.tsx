export type StoryMediaViewMode = "tile" | "list" | "small" | "large";

const mediaViews: Array<{ value: StoryMediaViewMode; label: string }> = [
  { value: "tile", label: "Tile" },
  { value: "list", label: "Listing" },
  { value: "small", label: "Small Icon" },
  { value: "large", label: "Large Icon" },
];

export default function StoryMediaViewControls({
  value,
  onChange,
}: {
  value: StoryMediaViewMode;
  onChange: (value: StoryMediaViewMode) => void;
}) {
  return (
    <div className="storyMediaViewControls" role="group" aria-label="Media listing view">
      {mediaViews.map((view) => (
        <button
          key={view.value}
          type="button"
          className={value === view.value ? "active" : ""}
          aria-pressed={value === view.value}
          onClick={() => onChange(view.value)}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
