import { useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, ImageIcon, Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import MediaPicker from "@/components/MediaPicker";
import {
  createActor, createCountry, createCrew, createDirector, createGenre, createLanguage,
  getActors, getCountries, getCrews, getDirectors, getGenres, getImageUrl, getLanguagesList,
} from "@/lib/api-client";

export type CatalogKind = "language" | "genre" | "actor" | "director" | "country" | "crew";

export type CatalogItem = {
  id: string;
  name: string;
  code?: string;
  image?: string;
  designation?: string;
};

const DIRECTOR_ROLES = new Set(["Director", "Co-Director"]);

/** Director roles are stored on the director catalog. Every other credit uses crew. */
export function crewCatalogKind(role: string): "director" | "crew" {
  return DIRECTOR_ROLES.has(role) ? "director" : "crew";
}

const KIND_LABEL: Record<CatalogKind, string> = {
  language: "language",
  genre: "genre",
  actor: "actor",
  director: "director",
  country: "country",
  crew: "crew member",
};

const PHOTO_KINDS = new Set<CatalogKind>(["actor", "director", "crew"]);

const createdCache = new Map<CatalogKind, CatalogItem[]>();

function rememberCreated(kind: CatalogKind, item: CatalogItem) {
  const prev = createdCache.get(kind) || [];
  createdCache.set(kind, [item, ...prev.filter((entry) => entry.id !== item.id && entry.name.toLowerCase() !== item.name.toLowerCase())]);
}

function listFromResponse(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function toItem(raw: any): CatalogItem | null {
  if (!raw) return null;
  const id = String(raw.id || raw._id || "").trim();
  const name = String(raw.name || "").trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    code: raw.code ? String(raw.code) : undefined,
    image: raw.image ? String(raw.image) : undefined,
    designation: raw.designation ? String(raw.designation) : undefined,
  };
}

function entityFromResponse(res: any, fallbackName: string): CatalogItem | null {
  const raw = res?.data || res?.item || res;
  const item = toItem(raw);
  if (item) return item;
  const id = String(res?.id || res?.existingId || raw?.id || raw?._id || "").trim();
  if (!id) return null;
  return { id, name: String(raw?.name || fallbackName).trim() || fallbackName };
}

/** A duplicate name comes back as 409 with the existing record's id. */
export function existingFromConflict(error: any, fallbackName: string): CatalogItem | null {
  const status = error?.status || error?.details?.status;
  if (status !== 409) return null;
  const details = error?.details || {};
  return entityFromResponse(details, fallbackName) || entityFromResponse(details.data, fallbackName);
}

async function fetchCatalog(kind: CatalogKind, search: string): Promise<CatalogItem[]> {
  const query = search.trim();
  let res: any;
  if (kind === "language") res = await getLanguagesList(query ? { search: query } : undefined);
  else if (kind === "genre") res = await getGenres({ page: 1, limit: 100, admin: true, search: query || undefined });
  else if (kind === "actor") res = await getActors({ page: 1, limit: 100, search: query || undefined });
  else if (kind === "director") res = await getDirectors({ page: 1, limit: 100, search: query || undefined });
  else if (kind === "country") res = await getCountries({ page: 1, limit: 200, search: query || undefined });
  else res = await getCrews({ page: 1, limit: 100, search: query || undefined });

  const items = listFromResponse(res).map(toItem).filter(Boolean) as CatalogItem[];
  const q = query.toLowerCase();
  return q ? items.filter((item) => item.name.toLowerCase().includes(q) || (item.code || "").toLowerCase().includes(q)) : items;
}

function languageCode(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 8);
  return base || "lang";
}

function countryCode(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words.map((word) => word[0]).join("").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "XX";
  }
  const letters = name.replace(/[^a-zA-Z]/g, "");
  return (letters.slice(0, 3) || "XX").toUpperCase();
}

async function createCatalogItem(
  kind: CatalogKind,
  name: string,
  image: string,
  designation?: string
): Promise<{ item: CatalogItem; reused: boolean }> {
  const trimmed = name.trim();
  try {
    let res: any;
    if (kind === "genre") {
      const body = new FormData();
      body.append("name", trimmed);
      body.append("active", "true");
      res = await createGenre(body);
    } else if (kind === "language") {
      const body = new FormData();
      body.append("name", trimmed);
      body.append("code", languageCode(trimmed));
      res = await createLanguage(body, undefined);
    } else if (kind === "country") {
      res = await createCountry({ name: trimmed, code: countryCode(trimmed), active: true });
    } else if (kind === "actor" || kind === "director") {
      const body = new FormData();
      body.append("name", trimmed);
      body.append("designation", designation?.trim() || (kind === "actor" ? "Actor" : "Director"));
      body.append("status", "true");
      if (image) body.append("image", image);
      res = kind === "actor" ? await createActor(body) : await createDirector(body);
    } else {
      res = await createCrew({
        name: trimmed,
        designation: designation?.trim() || "Crew",
        image: image || undefined,
        status: true,
      });
    }
    const created = entityFromResponse(res, trimmed);
    if (!created) throw new Error(`The ${KIND_LABEL[kind]} was saved, but its id was missing from the response.`);
    if (!created.name) created.name = trimmed;
    return { item: created, reused: false };
  } catch (error: any) {
    const existing = existingFromConflict(error, trimmed);
    if (existing) {
      if (!existing.name) existing.name = trimmed;
      return { item: { ...existing, image: existing.image || image || undefined }, reused: true };
    }
    const message = error?.message || error?.details?.message || error?.details?.error || `Could not add ${KIND_LABEL[kind]}.`;
    const wrapped = new Error(message);
    (wrapped as any).status = error?.status;
    throw wrapped;
  }
}

/**
 * Crew credits are stored on the movie as director ids. A newly added crew
 * member is also created as a director (duplicate names return the existing id)
 * so the credit survives on the current movie and series payload.
 */
export async function directorIdForCrewCredit(person: { name?: string; image?: string; role?: string }) {
  const name = person.name?.trim();
  if (!name) throw new Error("Crew member name is missing.");
  const created = await createCatalogItem("director", name, person.image || "", person.role || "Crew");
  rememberCreated("director", created.item);
  return created.item.id;
}

type CatalogPickerProps = {
  kind: CatalogKind;
  multiple?: boolean;
  label?: string;
  required?: boolean;
  placeholder?: string;
  /** Country credits are stored by name. Everything else is stored by id. */
  valueField?: "id" | "name";
  value: string | string[];
  onChange: (next: string | string[], picked?: CatalogItem | null) => void;
  fallbackLabel?: string;
  /** Sent as designation when creating an actor, director, or crew member. */
  designation?: string;
  size?: "sm" | "md";
  disabled?: boolean;
};

export default function CatalogPicker({
  kind,
  multiple = false,
  label,
  required = false,
  placeholder,
  valueField = "id",
  value,
  onChange,
  fallbackLabel,
  designation,
  size = "md",
  disabled = false,
}: CatalogPickerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftImage, setDraftImage] = useState("");
  const [photoOpen, setPhotoOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [localItems, setLocalItems] = useState<CatalogItem[]>(() => createdCache.get(kind) || []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ["catalog", kind, debounced],
    queryFn: () => fetchCatalog(kind, debounced),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  const selectedValues = useMemo(() => (multiple ? (value as string[]) : (value ? [value as string] : [])), [multiple, value]);

  const items = useMemo(() => {
    const merged = new Map<string, CatalogItem>();
    for (const item of [...localItems, ...(createdCache.get(kind) || []), ...(query.data || [])]) {
      const key = valueField === "name" ? item.name.toLowerCase() : item.id;
      if (!merged.has(key)) merged.set(key, item);
    }
    return Array.from(merged.values());
  }, [localItems, query.data, kind, valueField]);

  const itemValue = (item: CatalogItem) => (valueField === "name" ? item.name : item.id);

  const labelFor = (selected: string) => {
    const found = items.find((item) => itemValue(item) === selected);
    return found?.name || (selectedValues.length === 1 ? fallbackLabel : "") || selected;
  };

  const adopt = (item: CatalogItem) => {
    rememberCreated(kind, item);
    setLocalItems((prev) => [item, ...prev.filter((entry) => entry.id !== item.id)]);
    queryClient.invalidateQueries({ queryKey: ["catalog", kind] });
    const selected = itemValue(item);
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      if (!current.includes(selected)) onChange([...current, selected], item);
    } else {
      onChange(selected, item);
    }
  };

  const toggle = (item: CatalogItem) => {
    const selected = itemValue(item);
    if (multiple) {
      const current = Array.isArray(value) ? value : [];
      onChange(current.includes(selected) ? current.filter((entry) => entry !== selected) : [...current, selected], item);
      return;
    }
    onChange(selectedValues[0] === selected ? "" : selected, selectedValues[0] === selected ? null : item);
    setOpen(false);
  };

  const remove = (selected: string) => {
    if (!multiple) {
      onChange("", null);
      return;
    }
    onChange((Array.isArray(value) ? value : []).filter((entry) => entry !== selected), null);
  };

  const submitNew = async () => {
    const name = draftName.trim();
    if (!name) {
      setFormError("Name is required.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const created = await createCatalogItem(kind, name, draftImage, designation);
      adopt(created.item);
      setAddOpen(false);
      setDraftName("");
      setDraftImage("");
      setNotice(created.reused ? `"${created.item.name}" already exists, so the existing entry was selected.` : "");
    } catch (error: any) {
      setFormError(error?.message || `Could not add ${KIND_LABEL[kind]}.`);
    } finally {
      setSaving(false);
    }
  };

  const triggerText = !multiple && selectedValues[0]
    ? labelFor(selectedValues[0])
    : (placeholder || `Select ${KIND_LABEL[kind]}...`);
  const height = size === "sm" ? "h-9" : "h-10";
  const loadError = query.error as any;

  return (
    <div className="space-y-1.5">
      {label && (
        <Label className="text-foreground text-sm font-medium">
          {label} {required && <span className="text-primary">*</span>}
        </Label>
      )}

      {multiple && selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedValues.map((selected) => (
            <div key={selected} className="flex items-center gap-1 bg-muted border border-border rounded-lg px-2.5 py-1 text-xs">
              <span className="text-foreground">{labelFor(selected)}</span>
              <button type="button" onClick={() => remove(selected)} className="text-muted-foreground hover:text-primary" aria-label={`Remove ${labelFor(selected)}`}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={`${height} w-full justify-between bg-muted border-border text-foreground rounded-lg text-sm font-normal px-3`}
          >
            <span className={`truncate ${!multiple && selectedValues[0] ? "" : "text-muted-foreground"}`}>{triggerText}</span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={`Search ${KIND_LABEL[kind]}s...`} value={search} onValueChange={setSearch} />
            <CommandList>
              {query.isLoading && !query.data ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading
                </div>
              ) : (
                <>
                  <CommandEmpty>No matches.</CommandEmpty>
                  <CommandGroup>
                    {items.map((item) => {
                      const selected = selectedValues.includes(itemValue(item));
                      return (
                        <CommandItem key={item.id} value={`${item.name} ${item.id}`} onSelect={() => toggle(item)}>
                          <Check className={`h-4 w-4 ${selected ? "opacity-100" : "opacity-0"}`} />
                          <span className="truncate">{item.name}</span>
                          {item.designation && <span className="ml-auto text-xs text-muted-foreground truncate">{item.designation}</span>}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
            <div className="border-t border-border p-1">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm text-primary hover:bg-muted"
                onClick={() => {
                  setOpen(false);
                  setFormError("");
                  setDraftName(search.trim());
                  setDraftImage("");
                  setAddOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                Add new {KIND_LABEL[kind]}
              </button>
            </div>
          </Command>
        </PopoverContent>
      </Popover>

      {loadError && (
        <p className="text-xs text-rose-400">
          {loadError?.message || `Could not load ${KIND_LABEL[kind]}s.`}
        </p>
      )}
      {notice && <p className="text-xs text-amber-500">{notice}</p>}

      <Dialog open={addOpen} onOpenChange={(next) => { if (!saving) setAddOpen(next); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add {KIND_LABEL[kind]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name <span className="text-primary">*</span></Label>
              <Input
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder={`New ${KIND_LABEL[kind]} name`}
                autoFocus
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    submitNew();
                  }
                }}
              />
            </div>
            {PHOTO_KINDS.has(kind) && (
              <div className="space-y-1.5">
                <Label>Photo</Label>
                <button
                  type="button"
                  onClick={() => setPhotoOpen(true)}
                  className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-border bg-muted/30"
                >
                  {draftImage ? (
                    <img src={getImageUrl(draftImage)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex items-center gap-2 text-sm text-muted-foreground">
                      <ImageIcon className="h-4 w-4" /> Select from library or upload
                    </span>
                  )}
                </button>
                {draftImage && (
                  <button type="button" className="text-xs text-primary" onClick={() => setDraftImage("")}>Remove photo</button>
                )}
              </div>
            )}
            {formError && <p className="text-sm text-rose-400">{formError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="button" onClick={submitNew} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add and select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {PHOTO_KINDS.has(kind) && (
        <MediaPicker
          open={photoOpen}
          onClose={() => setPhotoOpen(false)}
          onSelect={(media) => {
            setDraftImage(media.filePath || "");
            setPhotoOpen(false);
          }}
          source={kind === "actor" ? "actor" : kind === "director" ? "director" : "crew"}
          accept="image/*"
        />
      )}
    </div>
  );
}
