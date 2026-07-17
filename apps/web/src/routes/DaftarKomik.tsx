import { useMemo, useState } from "react";
import { MOCK_COMICS } from "../mocks/comics";
import {
  selectComics,
  DEFAULT_OPTIONS,
  type ComicListOptions,
} from "../lib/comicList";
import { Toolbar } from "../components/Toolbar";
import { ComicGrid } from "../components/ComicGrid";
import { SectionHeader } from "../components/SectionHeader";

export function DaftarKomik() {
  const [options, setOptions] = useState<ComicListOptions>(DEFAULT_OPTIONS);

  const visible = useMemo(
    () => selectComics(MOCK_COMICS, options),
    [options],
  );

  return (
    <div>
      <Toolbar options={options} onChange={setOptions} />
      <SectionHeader title="Daftar Komik" count={visible.length} />
      <ComicGrid comics={visible} />
    </div>
  );
}
