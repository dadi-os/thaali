import { HathTile } from "../features/agents/HathTile";
import { ChaaviTile } from "../features/chaavi/ChaaviTile";
import { GharTile } from "../features/ghar/GharTile";
import { YaadTile } from "../features/memory/YaadTile";
import { SystemTile } from "../features/system/SystemTile";
import { WeekTile } from "../features/timeline/WeekTile";

/**
 * Home: six tiles in the named areas of `.home-grid` (Hath 2 x 2, Timeline 2 x 2, Yaad 2 x 1, Ghar 2 x 1, Chaavi
 * 1 x 2, System 1 x 2 on a wide window), which fills the page exactly. Nothing here scrolls: each tile is given
 * the room the grid leaves it and shows as much as fits.
 */
export function HomePage() {
  return (
    <div data-page="home" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 24, minHeight: 0 }}>
      <div className="home-grid" style={{ flex: 1, minHeight: 0 }}>
        <HathTile order={0} />
        <YaadTile order={1} />
        <WeekTile order={2} />
        <GharTile order={3} />
        <ChaaviTile order={4} />
        <SystemTile order={5} />
      </div>
    </div>
  );
}
