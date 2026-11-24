import { useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSubmitMovieReview, useSubmitTvShowReview } from "@/lib/api-client";

const IN_REVIEW = new Set(["moderation", "published"]);

export function SubmitForReviewButton({
  id,
  kind,
  status,
  blockReason,
  compact = false,
}: {
  id?: string;
  kind: "movie" | "tv";
  status?: string;
  /** When set, the action stays disabled and this copy is shown. */
  blockReason?: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [attested, setAttested] = useState(false);
  const submitMovie = useSubmitMovieReview();
  const submitTv = useSubmitTvShowReview();
  const pending = submitMovie.isPending || submitTv.isPending;
  const current = status || "draft";

  if (current === "published") {
    return compact ? null : <p className="text-sm text-emerald-500">Published on Ashqe.</p>;
  }
  if (current === "moderation") {
    return compact ? null : <p className="text-sm text-amber-500">In review. An editor will approve or send it back.</p>;
  }

  const disabled = !id || !!blockReason || IN_REVIEW.has(current);

  const submit = async () => {
    if (!id || !attested) return;
    try {
      if (kind === "movie") await submitMovie.mutateAsync(id);
      else await submitTv.mutateAsync(id);
      toast({ title: "Submitted for review", description: "We'll email you when an editor decides." });
      setOpen(false);
      setAttested(false);
    } catch (err: any) {
      toast({ title: "Could not submit", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className={compact ? "" : "space-y-2"}>
      <Button
        type="button"
        variant={compact ? "outline" : "default"}
        size={compact ? "sm" : "default"}
        disabled={disabled}
        onClick={() => { setAttested(false); setOpen(true); }}
        className={compact ? "" : "bg-amber-500 hover:bg-amber-400 text-black font-semibold"}
        title={blockReason || "Submit for review"}
      >
        <Send className="h-3.5 w-3.5 mr-1.5" />
        Submit for Review
      </Button>
      {blockReason && (
        <p className={`text-xs text-muted-foreground ${compact ? "mt-1 max-w-[220px]" : ""}`}>{blockReason}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit for review</DialogTitle>
            <DialogDescription>
              Editors will check this {kind === "movie" ? "movie" : "web series"} before it can be published on Ashqe. You can keep editing a draft until you send it.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={attested} onCheckedChange={(v) => setAttested(v === true)} className="mt-0.5" />
            <span>I own the copyright to this content, or I have written permission to publish it on Ashqe.</span>
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!attested || pending} onClick={submit}>
              {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
