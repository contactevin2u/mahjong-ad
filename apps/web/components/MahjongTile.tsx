"use client";
import { Tile, tileGlyph, tileLabel } from "../lib/tiles";

export function MahjongTile({
  tile,
  onClick,
  disabled,
  small,
  highlight,
}: {
  tile: Tile;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  highlight?: boolean;
}) {
  const clickable = !!onClick && !disabled;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      title={tileLabel(tile)}
      className={[
        "inline-flex items-center justify-center rounded-md bg-white font-serif leading-none text-black shadow",
        small ? "h-9 w-7 text-2xl" : "h-14 w-10 text-4xl",
        highlight ? "ring-2 ring-gold" : "",
        clickable
          ? "cursor-pointer transition-transform hover:-translate-y-1 hover:ring-2 hover:ring-gold"
          : "cursor-default",
      ].join(" ")}
    >
      <span className="-mt-0.5">{tileGlyph(tile)}</span>
    </button>
  );
}

/** A face-down tile back (for opponents' concealed hands). */
export function TileBack({ small }: { small?: boolean }) {
  return (
    <span
      className={[
        "inline-block rounded-md bg-gradient-to-br from-emerald-700 to-emerald-900 ring-1 ring-black/30",
        small ? "h-9 w-7" : "h-14 w-10",
      ].join(" ")}
    />
  );
}
