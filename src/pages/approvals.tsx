import { useMemo, useState } from "react";
import { Check, Clock, Film, Monitor, Search, Tag, User as UserIcon, Users, X, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  getImageUrl, useGetPendingApprovals, useGetPendingTvApprovals,
  useApproveMovie, useRejectMovie, useApproveTvShow, useRejectTvShow,
  useGetMovieById, useGetTVShowById, useGetEpisodeList,
} from "@/lib/api-client";
import VideoPlayer from "@/components/VideoPlayer";

type Kind = "movie" | "tv" | "genre" | "actor" | "director" | string;

interface PendingItem {
  _id: string;
  title?: string;
  name?: string;
  type?: string;
  kind: Kind;
  status?: string;
  createdAt?: string;
  createdBy?: { name?: string; email?: string };
  description?: string;
  copyrightAttested?: boolean;
  rejectionReason?: string;
  hlsUrl?: string;
  trailerUrl?: string;
  thumbnail?: string;
  poster?: string;
  posterImage?: string;
  [key: string]: any;
}

const idOf = (item: any) => String(item?._id || item?.id || "");

function mediaUrl(value?: string) {
  if (!value) return "";
  if (value.startsWith("http") || value.startsWith("blob:")) return value;
  return getImageUrl(value);
}

function pickVideo(obj: any) {
  if (!obj) return "";
  return mediaUrl(obj.hlsUrl || obj.hlsMasterPlaylistUrl || obj.masterPlaylist || obj.videoUrl || obj.trailerUrl);
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const moviesQuery = useGetPendingApprovals({ page: 1, limit: 50 });
  const showsQuery = useGetPendingTvApprovals({ page: 1, limit: 50 });
  const approveMovie = useApproveMovie();
  const rejectMovie = useRejectMovie();
  const approveShow = useApproveTvShow();
  const rejectShow = useRejectTvShow();

  const items = useMemo(() => {
    const movies = (moviesQuery.data?.data || []).map((item: any) => {
      const raw = String(item.type || "movie");
      const kind = ["webseries", "tvshow", "tv", "series"].includes(raw) ? "tv" : raw;
      return { ...item, _id: idOf(item), kind };
    });
    const shows = (showsQuery.data?.data || []).map((item: any) => ({
      ...item,
      _id: idOf(item),
      kind: "tv",
      type: "webseries",
    }));
    const seen = new Set(movies.map((item: PendingItem) => `${item.kind}:${item._id}`));
    return [...movies, ...shows.filter((item: PendingItem) => !seen.has(`${item.kind}:${item._id}`))];
  }, [moviesQuery.data, showsQuery.data]);

  const filtered = items.filter((item) => {
    const label = `${item.title || ""} ${item.name || ""} ${item.createdBy?.name || ""} ${item.createdBy?.email || ""}`.toLowerCase();
    const matchesSearch = !search.trim() || label.includes(search.trim().toLowerCase());
    const kind = item.kind;
    const matchesType =
      typeFilter === "all" ||
      (typeFilter === "webseries" && kind === "tv") ||
      kind === typeFilter;
    return matchesSearch && matchesType;
  });

  const isLoading = moviesQuery.isLoading || showsQuery.isLoading;

  const handleApprove = async (item: PendingItem) => {
    try {
      if (item.kind === "tv") await approveShow.mutateAsync(item._id);
      else await approveMovie.mutateAsync(item._id);
      toast({ title: `${item.title || item.name || "Item"} approved` });
    } catch (error: any) {
      toast({ title: error?.message || "Failed to approve", variant: "destructive" });
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedItem || !rejectionReason.trim()) return;
    try {
      const payload = { id: selectedItem._id, reason: rejectionReason.trim() };
      if (selectedItem.kind === "tv") await rejectShow.mutateAsync(payload);
      else await rejectMovie.mutateAsync(payload);
      toast({ title: `${selectedItem.title || selectedItem.name || "Item"} rejected` });
      setIsRejectModalOpen(false);
      setRejectionReason("");
      setSelectedItem(null);
    } catch (error: any) {
      toast({ title: error?.message || "Failed to reject", variant: "destructive" });
    }
  };

  const getTypeIcon = (kind: string) => {
    if (kind === "tv" || kind === "webseries") return <Monitor className="h-4 w-4" />;
    if (kind === "genre") return <Tag className="h-4 w-4" />;
    if (kind === "actor") return <UserIcon className="h-4 w-4" />;
    if (kind === "director") return <Users className="h-4 w-4" />;
    return <Film className="h-4 w-4" />;
  };

  const typeLabel = (item: PendingItem) => (item.kind === "tv" ? "Web Series" : item.kind || "movie");

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-foreground">Pending Approvals</h1>
          <p className="text-sm text-muted-foreground mt-1">Review creator movies and web series before they are published.</p>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title or creator..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-muted border-border text-foreground"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-48 bg-muted border-border text-foreground">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-foreground">
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="movie">Movies</SelectItem>
              <SelectItem value="webseries">Web Series</SelectItem>
              <SelectItem value="genre">Genres</SelectItem>
              <SelectItem value="actor">Actors</SelectItem>
              <SelectItem value="director">Directors</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="container mx-auto px-6 pb-6">
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No pending approvals</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((item) => {
                const mediaKind = item.kind === "tv" || item.kind === "movie";
                const open = previewId === `${item.kind}:${item._id}`;
                return (
                  <div key={`${item.kind}:${item._id}`} className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1 min-w-0">
                        <div className="p-3 rounded-lg bg-primary/10 text-primary">
                          {getTypeIcon(item.kind)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">{item.title || item.name}</h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground/80 capitalize">
                              {typeLabel(item)}
                            </span>
                            {typeof item.copyrightAttested === "boolean" && (
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${item.copyrightAttested ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-400"}`}>
                                <ShieldCheck className="h-3 w-3" />
                                {item.copyrightAttested ? "Copyright attested" : "No copyright attestation"}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            Submitted by {item.createdBy?.name || "Unknown"}{item.createdBy?.email ? ` (${item.createdBy.email})` : ""}
                          </p>
                          {item.description && <p className="text-sm text-foreground/80 line-clamp-2 mb-1">{item.description}</p>}
                          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {mediaKind && (
                          <Button size="sm" variant="outline" onClick={() => setPreviewId(open ? null : `${item.kind}:${item._id}`)}>
                            {open ? "Hide preview" : "Preview"}
                          </Button>
                        )}
                        <Button size="sm" onClick={() => handleApprove(item)} className="bg-green-600 hover:bg-green-700 text-white">
                          <Check className="h-4 w-4 mr-2" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setSelectedItem(item); setRejectionReason(""); setIsRejectModalOpen(true); }}
                          className="border-primary text-primary hover:bg-primary hover:text-white"
                        >
                          <X className="h-4 w-4 mr-2" />Reject
                        </Button>
                      </div>
                    </div>
                    {open && item.kind === "movie" && <MoviePreview id={item._id} seed={item} />}
                    {open && item.kind === "tv" && <SeriesPreview id={item._id} seed={item} />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {isRejectModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl border border-border w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-foreground mb-2">Reject {typeLabel(selectedItem || { kind: "item" } as PendingItem)}</h2>
            <p className="text-sm text-muted-foreground mb-4">
              A reason is required. The creator will see it on "{selectedItem?.title || selectedItem?.name}".
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full min-h-[100px] p-3 rounded-lg border border-border bg-muted text-foreground resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={() => { setIsRejectModalOpen(false); setRejectionReason(""); setSelectedItem(null); }}>
                Cancel
              </Button>
              <Button disabled={!rejectionReason.trim()} onClick={handleRejectSubmit} className="bg-primary hover:bg-primary/90 text-white">
                Reject
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MoviePreview({ id, seed }: { id: string; seed: PendingItem }) {
  const { data, isLoading } = useGetMovieById(id);
  const movie = (data as any)?.data || seed;
  const main = pickVideo(movie);
  const trailer = mediaUrl(movie.trailerUrl);
  const sources = [
    main ? { label: "Movie", src: main } : null,
    trailer && trailer !== main ? { label: "Trailer", src: trailer } : null,
  ].filter(Boolean) as { label: string; src: string }[];
  return <PreviewShell loading={isLoading} poster={mediaUrl(movie.posterImage || movie.poster || movie.thumbnail)} title={movie.title} sources={sources} meta={movie} />;
}

function SeriesPreview({ id, seed }: { id: string; seed: PendingItem }) {
  const { data, isLoading } = useGetTVShowById(id);
  const show = (data as any)?.data || seed;
  const episodesQuery = useGetEpisodeList({ tvShowId: id, limit: 50 });
  const episodes = episodesQuery.data?.data || show.episodes || [];
  const trailer = mediaUrl(show.trailerUrl || show.hlsUrl);
  const sources = [
    trailer ? { label: "Trailer", src: trailer } : null,
    ...episodes.map((ep: any, index: number) => {
      const src = pickVideo(ep);
      if (!src) return null;
      return { label: ep.title || `Episode ${ep.episodeNumber || index + 1}`, src };
    }),
  ].filter(Boolean) as { label: string; src: string }[];
  return (
    <PreviewShell
      loading={isLoading || episodesQuery.isLoading}
      poster={mediaUrl(show.posterImage || show.poster || show.thumbnail)}
      title={show.title || show.name}
      sources={sources}
      meta={show}
    />
  );
}

function PreviewShell({
  loading, poster, title, sources, meta,
}: {
  loading: boolean;
  poster?: string;
  title?: string;
  sources: { label: string; src: string }[];
  meta: any;
}) {
  const [index, setIndex] = useState(0);
  const current = sources[index] || sources[0];
  return (
    <div className="mt-4 grid lg:grid-cols-[minmax(0,1.4fr)_minmax(240px,0.8fr)] gap-4">
      <div>
        {loading && !current ? (
          <div className="aspect-video rounded-xl bg-muted flex items-center justify-center text-sm text-muted-foreground">Loading preview…</div>
        ) : current ? (
          <VideoPlayer key={current.src} embedded src={current.src} poster={poster} title={title} subtitle={current.label} />
        ) : (
          <div className="aspect-video rounded-xl border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground px-6 text-center">
            No HLS video is attached yet. The creator may still be processing the upload.
          </div>
        )}
        {sources.length > 1 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {sources.map((source, i) => (
              <button
                key={`${source.label}-${i}`}
                type="button"
                onClick={() => setIndex(i)}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${i === index ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"}`}
              >
                {source.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm space-y-2">
        <Meta label="Creator" value={meta.createdBy?.name ? `${meta.createdBy.name}${meta.createdBy.email ? ` · ${meta.createdBy.email}` : ""}` : undefined} />
        <Meta label="Year" value={meta.year} />
        <Meta label="Duration" value={meta.duration} />
        <Meta label="Language" value={Array.isArray(meta.languages) ? meta.languages.map((l: any) => l.name || l).join(", ") : meta.language} />
        <Meta label="Genres" value={Array.isArray(meta.genres) ? meta.genres.map((g: any) => g.name || g).join(", ") : undefined} />
        <Meta label="Plan" value={meta.planRequired} />
        <Meta label="Copyright" value={typeof meta.copyrightAttested === "boolean" ? (meta.copyrightAttested ? "Attested" : "Not attested") : undefined} />
        {meta.shortDescription && <p className="text-muted-foreground pt-1">{meta.shortDescription}</p>}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value?: any }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      <span className="text-foreground">{String(value)}</span>
    </p>
  );
}
