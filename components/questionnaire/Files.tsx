"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/cn";
import { feedback } from "@/lib/motion";
import { checklistDone, FILE_CHECKLIST } from "@/questionnaire/logic";
import type { Question } from "@/questionnaire/schema";
import type { ClientFile } from "@/questionnaire/types";
import { deleteUpload, finishUpload, startUpload } from "@/app/actions/questionnaire";
import { ProgressBar } from "@/components/ui/Feedback";
import { CloseIcon } from "@/components/ui/icons";
import { useQ, type UploadApi, type UploadItem } from "./context";

/**
 * "Your files" (spec §6.2): one drop zone, auto-sorted. Uploads go browser → R2
 * with presigned URLs and real progress; each can be retried, cancelled or removed.
 * The checklist lights up from what actually arrived.
 */

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(n < 10 * 1024 ** 2 ? 1 : 0)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

export function FilesQuestion({ q, editable }: { q: Question; editable: boolean }) {
  const Q = useQ();
  const scope = Q.scope ?? "brand";
  const files = Q.files.filter((f) => f.scope === scope && f.status === "ready");
  const uploading = Q.uploads.items.filter((u) => u.scope === scope);
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const groups = new Map<string, ClientFile[]>();
  for (const f of files) groups.set(f.category, [...(groups.get(f.category) ?? []), f]);
  const cats = [...groups.keys()];

  return (
    <div id="q-f_drop" className="pb-[22px]">
      {editable && (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (e.dataTransfer.files.length) Q.uploads.add(e.dataTransfer.files, scope);
          }}
          className={cn(
            "rounded-tile border-2 border-dashed p-9 text-center transition-colors duration-150",
            over ? "border-navy bg-[#EEF8FD]" : "border-mist bg-white",
          )}
        >
          <p className="mb-1 text-title-sm font-semibold">Drop files here</p>
          <p className="mb-3.5 text-muted">Any type, any amount, up to 2 GB each. Zip files are fine.</p>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="rounded-full bg-navy px-4 py-[9px] text-[14px] font-medium text-white transition-[background-color,transform] hover:bg-hover active:scale-[0.98]"
          >
            Choose files
          </button>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) Q.uploads.add(e.target.files, scope);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="What we'd love to have">
        {FILE_CHECKLIST.map(([cat, label]) => {
          const ok = checklistDone(cats, cat);
          return (
            <li key={cat} className={cn("flex items-center gap-1.5 rounded-tag bg-white px-2 py-1 text-[13px] transition-colors", ok ? "text-ok" : "text-muted")}>
              <span className={cn("size-2 rounded-[2px] transition-colors", ok ? "bg-ok" : "bg-mist")} aria-hidden="true" />
              {label}
              {ok && <span className="sr-only">(added)</span>}
            </li>
          );
        })}
      </ul>

      <AnimatePresence initial={false}>
        {uploading.length > 0 && (
          <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={feedback} className="mt-4 flex flex-col gap-2">
            {uploading.map((u) => (
              <UploadRow key={u.key} item={u} api={Q.uploads} />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {files.length > 0 && (
        <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2.5">
          {cats.map((g) => (
            <motion.div key={g} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-[18px] bg-white px-4 py-3.5">
              <h5 className="mb-2 flex justify-between text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">
                {g}
                <span className="tabular-nums">{groups.get(g)!.length}</span>
              </h5>
              {groups.get(g)!.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-2 border-t border-line py-1 text-[14px]">
                  <span className="truncate" title={f.name}>
                    {f.name}
                  </span>
                  {editable && (
                    <button
                      type="button"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => Q.uploads.remove(f.id)}
                      className="grid size-6 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-gray-strong"
                    >
                      <CloseIcon size={12} />
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          ))}
        </div>
      )}
      {!editable && files.length === 0 && <p className="mt-3 text-body text-muted">No files.</p>}
      {Q.teamNotes && q.n && (
        <div className="mt-2.5 rounded-tag border-l-[3px] border-orange bg-[#FFF4EF] px-3 py-2 text-[13px] text-[#5b3a2c]">
          <b className="text-orange">Для команды:</b> Одна зона загрузки. Движок сам раскладывает по типам; в прототипе сортировка по расширению и имени файла. Галочки сверху — подсказка, чего не хватает, а не отдельные поля.
        </div>
      )}
    </div>
  );
}

function UploadRow({ item, api }: { item: UploadItem; api: UploadApi }) {
  const failed = item.status === "failed";
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-tile-sm bg-white px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3 text-[14px]">
          <span className="truncate font-medium">{item.name}</span>
          <span className={cn("shrink-0 tabular-nums", failed ? "text-err" : "text-muted")}>
            {failed ? item.error ?? "Didn't upload" : item.status === "queued" ? "Waiting…" : `${Math.round(item.progress * 100)}% · ${formatBytes(item.size)}`}
          </span>
        </div>
        <ProgressBar value={failed ? 1 : item.progress} tone={failed ? "err" : "navy"} label={`Uploading ${item.name}`} />
      </div>
      {failed ? (
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => api.retry(item.key)} className="rounded-full bg-gray px-3 py-1.5 text-small font-medium hover:bg-gray-strong">
            Retry
          </button>
          <button type="button" aria-label={`Dismiss ${item.name}`} onClick={() => api.cancel(item.key)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-gray">
            <CloseIcon size={12} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => api.cancel(item.key)} className="shrink-0 rounded-full px-3 py-1.5 text-small font-medium text-muted hover:bg-gray hover:text-navy">
          Cancel
        </button>
      )}
    </motion.li>
  );
}

/** Upload engine: up to 3 at a time, XHR for real progress, server confirms each file arrived whole. */
export function useUploads(
  questionnaireId: string,
  onFiles: (update: (files: ClientFile[]) => ClientFile[]) => void,
  toast: (t: string, tone?: "info" | "ok" | "err") => void,
): UploadApi {
  const [items, setItems] = useState<UploadItem[]>([]);
  const blobs = useRef(new Map<string, { file: File; scope: string; asBrief?: boolean }>());
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
  const active = useRef(0);
  const queue = useRef<string[]>([]);

  const patch = (key: string, p: Partial<UploadItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));
  const drop = (key: string) => {
    setItems((list) => list.filter((i) => i.key !== key));
    blobs.current.delete(key);
    xhrs.current.delete(key);
  };

  const pump = () => {
    while (active.current < 3 && queue.current.length) {
      const key = queue.current.shift()!;
      const src = blobs.current.get(key);
      if (!src) continue;
      active.current++;
      void (async () => {
        const item = { key, name: src.file.name };
        let fileId: string | undefined;
        try {
          patch(key, { status: "uploading", progress: 0, error: undefined });
          const res = await startUpload(questionnaireId, { scope: src.scope, name: src.file.name, size: src.file.size, contentType: src.file.type || "application/octet-stream", asBrief: src.asBrief });
          if (!res.ok) throw new Error(res.error);
          fileId = res.data.file.id;
          patch(key, { fileId });
          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhrs.current.set(key, xhr);
            xhr.open("PUT", res.data.url);
            xhr.setRequestHeader("Content-Type", res.data.contentType);
            xhr.upload.onprogress = (e) => e.lengthComputable && patch(key, { progress: e.loaded / e.total });
            xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("Storage refused the file")));
            xhr.onerror = () => reject(new Error("Connection lost"));
            xhr.onabort = () => reject(new Error("cancelled"));
            xhr.send(src.file);
          });
          const done = await finishUpload(fileId);
          if (!done.ok || done.data !== "ready") throw new Error("Didn't arrive whole");
          onFiles((files) => [...files.filter((f) => f.id !== res.data.file.id), { ...res.data.file, status: "ready" }]);
          drop(key);
        } catch (err) {
          const message = (err as Error).message;
          if (message === "cancelled") {
            if (fileId) void deleteUpload(questionnaireId, fileId);
            drop(key);
          } else {
            if (fileId) void deleteUpload(questionnaireId, fileId);
            patch(key, { status: "failed", fileId: undefined, error: message.length < 60 ? message : "Didn't upload" });
            toast(`${item.name} didn't upload. You can retry.`, "err");
          }
        } finally {
          xhrs.current.delete(key);
          active.current--;
          pump();
        }
      })();
    }
  };

  const add = (list: FileList | File[], scope: string, asBrief?: boolean) => {
      const arr = Array.from(list);
      const tooBig = arr.filter((f) => f.size > 2 * 1024 ** 3);
      if (tooBig.length) toast(`${tooBig.map((f) => f.name).join(", ")}: files can be up to 2 GB. Share a link instead.`, "err");
      const ok = arr.filter((f) => f.size <= 2 * 1024 ** 3);
      const fresh = ok.map((file) => {
        const key = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        blobs.current.set(key, { file, scope, asBrief });
        queue.current.push(key);
        return { key, name: file.name, size: file.size, scope, progress: 0, status: "queued" as const };
      });
      if (!fresh.length) return;
      setItems((cur) => [...cur, ...fresh]);
      toast(`${fresh.length} file${fresh.length > 1 ? "s" : ""} added and sorted`, "ok");
      window.setTimeout(pump, 0);
  };

  const retry = (key: string) => {
    if (!blobs.current.has(key)) return;
    patch(key, { status: "queued", progress: 0, error: undefined });
    queue.current.push(key);
    pump();
  };

  const cancel = (key: string) => {
    const xhr = xhrs.current.get(key);
    queue.current = queue.current.filter((k) => k !== key);
    if (xhr) xhr.abort();
    else drop(key);
  };

  const remove = (fileId: string) => {
      let removed: ClientFile | undefined;
      onFiles((files) => {
        removed = files.find((f) => f.id === fileId);
        return files.filter((f) => f.id !== fileId);
      });
      void deleteUpload(questionnaireId, fileId).then((r) => {
        if (!r.ok) {
          if (removed) onFiles((files) => [...files, removed!]);
          toast("Couldn't remove that file. Try again.", "err");
        }
      });
  };

  return { items, add, retry, cancel, remove };
}
