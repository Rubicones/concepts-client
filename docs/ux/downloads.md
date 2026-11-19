# Downloads — usage note

**Who and where.** A marketer at a desk, about to upload the campaign to several ad platforms: Meta wants 9:16 and 4:5, YouTube wants 16:9, the German team wants only DE. They know exactly which files they need and want them in one go, named so nobody has to rename anything.

## What they do

1. **"Download"** sits next to the final viewer. It opens a panel on the right (a bottom sheet on phones). The viewer stays visible behind it, so they can check a format while picking.
2. **Start from a preset** — "Everything", "One format, all languages", "One language, all formats". The last two ask which format or language with one row of chips. Most people stop here.
3. **Fine-tune in the matrix.** Rows are formats, columns are languages; a cell is one format in one language. A row header selects the whole format, a column header the whole language, the corner everything. Lengths and file types are chips under it (only the ones that exist). Cells with nothing behind them are disabled, not hidden, so the shape of the delivery stays readable.
4. **The summary updates live**: "18 files · 214 MB". The button says what it will do: "Download 18 files (ZIP)" or "Download file" for one.
5. **Download.** One file downloads directly with its proper name. Several stream into a ZIP built in the browser: a progress bar with the current file and a Cancel. Where the browser can write to disk (Chrome, Edge), they pick where to save first and the ZIP streams straight there, so even a large delivery never sits in memory.

## Naming

`<Brand>/<Campaign>/<format>/<Brand>_<Campaign>_<format>_<lang>_<length>s.<ext>`, posters and covers without the length. Names keep the brand's capitals and drop characters platforms trip over.

## When files aren't there yet

Exports are rendered by Forma after the final is sent. Until they exist the panel says "Your files are being prepared" calmly, and the viewer works as usual. If a file fails, the ZIP skips it and says which, instead of failing the whole download.

## Why it is built this way

- **Presets first, matrix second**: the common cases are one click; the matrix is there for the precise ones.
- **Links are signed on demand** and short-lived; the browser fetches from storage directly, so big deliveries don't pass through our server.
- **Cancel is real**: it stops every request and closes the file.

## Owner review fixes

- The panel always shows the whole delivery — every format × language, every length, **videos and stills (PNG)** — worked out from the final, before Forma renders anything. Files on the way are selectable (cells look lighter, "Being prepared"); only ready ones download, and the summary says how many are still coming.
- The test-mode gallery has the same panel as a preview, so the filters can be reviewed without a delivery.
