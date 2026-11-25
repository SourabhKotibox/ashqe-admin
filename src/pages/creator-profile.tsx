import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getImageUrl, uploadAdminAvatar, useGetMe, useUpdatePassword } from "@/lib/api-client";
import { canEditCreatorRevenue, canViewCreatorRevenueAdmin } from "@/lib/creator-access";
import {
  SOCIAL_PLATFORMS,
  fmtDateTime,
  useOwnCreatorProfile,
  useStaffCreatorProfile,
  useUpdateOwnCreatorProfile,
  type CreatorApplicationProfile,
  type CreatorProfile,
  type SocialLink,
  type SocialPlatform,
} from "@/lib/creator-api";
import {
  errorMessage,
  formatInr,
  formatRate,
  formatWatchHours,
  useCreatorRate,
  useCreatorRevenueOverview,
  useSetCreatorRate,
} from "@/lib/creator-revenue";
import { QueryState, RateHistoryList, RevenueTitlesTable, SourceBadge, WatchHourRateForm } from "@/components/creator-revenue-ui";

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
  x: "X",
  website: "Website",
  other: "Other",
};

function initials(name?: string) {
  const parts = String(name || "Creator").trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("") || "C";
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function CreatorOwnProfile() {
  const { toast } = useToast();
  const profile = useOwnCreatorProfile();
  const save = useUpdateOwnCreatorProfile();
  const password = useUpdatePassword();
  const data = profile.data?.data;
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState("");
  const [links, setLinks] = useState<SocialLink[]>([]);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });

  useEffect(() => {
    if (!data) return;
    setName(data.name || "");
    setBio(data.bio || "");
    setAvatar(data.avatar || "");
    setLinks(data.socialLinks?.length ? data.socialLinks.map((link) => ({ ...link })) : []);
    setPreview(data.avatar ? getImageUrl(data.avatar) : "");
  }, [data]);

  const onSave = async () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 80) {
      toast({ title: "Name must be 1 to 80 characters", variant: "destructive" });
      return;
    }
    if (bio.trim().length > 1000) {
      toast({ title: "Bio can be at most 1000 characters", variant: "destructive" });
      return;
    }
    const socialLinks = links
      .map((link) => ({ platform: link.platform, url: link.url.trim() }))
      .filter((link) => link.url);
    if (socialLinks.length > 8) {
      toast({ title: "You can add up to 8 links", variant: "destructive" });
      return;
    }
    if (socialLinks.some((link) => !isHttpUrl(link.url))) {
      toast({ title: "Each link needs an http or https URL", variant: "destructive" });
      return;
    }
    try {
      let nextAvatar = avatar;
      if (photoFile) {
        const uploaded = await uploadAdminAvatar(photoFile);
        nextAvatar = uploaded.avatarUrl;
      }
      await save.mutateAsync({
        name: trimmedName,
        bio: bio.trim(),
        avatar: nextAvatar,
        socialLinks,
      });
      setPhotoFile(null);
      toast({ title: "Profile saved" });
    } catch (error) {
      toast({ title: "Could not save profile", description: errorMessage(error, "Try again."), variant: "destructive" });
    }
  };

  const onPassword = async () => {
    if (!passwords.current || !passwords.next) {
      toast({ title: "Enter your current password and a new one", variant: "destructive" });
      return;
    }
    if (passwords.next !== passwords.confirm) {
      toast({ title: "New passwords do not match", variant: "destructive" });
      return;
    }
    if (passwords.next.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    try {
      await password.mutateAsync({ currentPassword: passwords.current, newPassword: passwords.next });
      setPasswords({ current: "", next: "", confirm: "" });
      toast({ title: "Password updated" });
    } catch (error) {
      toast({ title: "Could not change password", description: errorMessage(error, "Try again."), variant: "destructive" });
    }
  };

  if (profile.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (profile.isError || !data) {
    return <QueryState isError error={profile.error} onRetry={() => profile.refetch()} />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ProfileHero profile={data} preview={preview} />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Public profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="creator-name">Display name</Label>
              <Input id="creator-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={data.email} readOnly aria-readonly />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={data.phone || "—"} readOnly aria-readonly />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="creator-bio">Bio</Label>
              <Textarea id="creator-bio" value={bio} maxLength={1000} onChange={(event) => setBio(event.target.value)} placeholder="A short note about your films" />
              <p className="mt-1 text-xs text-muted-foreground">{bio.trim().length} / 1000</p>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="creator-avatar">Profile photo</Label>
              <Input
                id="creator-avatar"
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setPhotoFile(file);
                  const reader = new FileReader();
                  reader.onload = () => setPreview(String(reader.result || ""));
                  reader.readAsDataURL(file);
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">The photo is uploaded, then saved as your avatar URL. A custom banner is not part of the creator profile.</p>
              {avatar && (
                <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => { setAvatar(""); setPreview(""); setPhotoFile(null); }}>
                  Remove photo
                </Button>
              )}
            </div>
          </div>
          <SocialEditor links={links} onChange={setLinks} />
          <Button type="button" onClick={onSave} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </CardContent>
      </Card>

      <ApplicationCard application={data.application} staffNotes={false} />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Password</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <Input type="password" autoComplete="current-password" placeholder="Current password" value={passwords.current} onChange={(event) => setPasswords({ ...passwords, current: event.target.value })} />
          <Input type="password" autoComplete="new-password" placeholder="New password" value={passwords.next} onChange={(event) => setPasswords({ ...passwords, next: event.target.value })} />
          <Input type="password" autoComplete="new-password" placeholder="Confirm new password" value={passwords.confirm} onChange={(event) => setPasswords({ ...passwords, confirm: event.target.value })} />
          <Button type="button" variant="outline" className="sm:col-span-3 sm:w-fit" onClick={onPassword} disabled={password.isPending}>
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function StaffCreatorProfilePage() {
  const params = useParams<{ id: string }>();
  const { data: me } = useGetMe();
  const profile = useStaffCreatorProfile(params.id);
  const canViewRevenue = canViewCreatorRevenueAdmin(me);
  const canEdit = canEditCreatorRevenue(me);
  const data = profile.data?.data;

  if (profile.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }
  if (profile.isError || !data) {
    return <QueryState isError error={profile.error} onRetry={() => profile.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <ProfileHero profile={data} preview={data.avatar ? getImageUrl(data.avatar) : ""} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Contact</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Email · </span>{data.email || "—"}</p>
            <p><span className="text-muted-foreground">Phone · </span>{data.phone || "—"}</p>
            <p><span className="text-muted-foreground">Status · </span>{data.isActive ? "Active" : "Inactive"}</p>
            <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Bio · </span>{data.bio || "No bio yet."}</p>
            <SocialList links={data.socialLinks || []} />
          </CardContent>
        </Card>
        <ApplicationCard application={data.application} staffNotes />
      </div>
      {canViewRevenue ? (
        <StaffRevenue creatorId={data.id} canEdit={canEdit} />
      ) : (
        <p className="text-sm text-muted-foreground">Revenue for this creator needs creator revenue view permission.</p>
      )}
    </div>
  );
}

function ProfileHero({ profile, preview }: { profile: CreatorProfile; preview: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-24 bg-gradient-to-r from-primary/30 via-amber-500/20 to-transparent sm:h-32" aria-hidden />
      <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
        <Avatar className="-mt-10 h-20 w-20 ring-4 ring-card">
          {preview ? <AvatarImage src={preview} alt="" /> : null}
          <AvatarFallback className="bg-primary/15 text-lg font-semibold text-primary">{initials(profile.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 pb-1">
          <h1 className="truncate text-2xl font-bold">{profile.name || "Creator"}</h1>
          <p className="text-sm text-muted-foreground">{profile.email}{profile.phone ? ` · ${profile.phone}` : ""}</p>
        </div>
      </div>
    </section>
  );
}

function SocialEditor({ links, onChange }: { links: SocialLink[]; onChange: (links: SocialLink[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Social links</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={links.length >= 8}
          onClick={() => onChange([...links, { platform: "instagram", url: "" }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      {links.length === 0 && <p className="text-sm text-muted-foreground">No links yet. Add up to 8.</p>}
      {links.map((link, index) => (
        <div key={`${link.platform}-${index}`} className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={link.platform}
            onValueChange={(value) => {
              const next = [...links];
              next[index] = { ...link, platform: value as SocialPlatform };
              onChange(next);
            }}
          >
            <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOCIAL_PLATFORMS.map((platform) => (
                <SelectItem key={platform} value={platform}>{PLATFORM_LABEL[platform]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={link.url}
            placeholder="https://"
            onChange={(event) => {
              const next = [...links];
              next[index] = { ...link, url: event.target.value };
              onChange(next);
            }}
          />
          <Button type="button" variant="ghost" size="icon" aria-label="Remove link" onClick={() => onChange(links.filter((_, item) => item !== index))}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

function SocialList({ links }: { links: SocialLink[] }) {
  if (!links.length) return <p className="text-sm text-muted-foreground">No social links.</p>;
  return (
    <ul className="space-y-1">
      {links.map((link) => (
        <li key={`${link.platform}-${link.url}`}>
          <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            {PLATFORM_LABEL[link.platform] || link.platform}
            <ExternalLink className="h-3 w-3" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function ApplicationCard({ application, staffNotes }: { application: CreatorApplicationProfile | null; staffNotes: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Application</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        {!application ? (
          <p className="text-muted-foreground">No creator application is linked to this account.</p>
        ) : (
          <>
            <p><span className="text-muted-foreground">Status · </span><span className="font-semibold capitalize">{application.status.replace("_", " ")}</span></p>
            <p><span className="text-muted-foreground">Channel · </span>{application.channelName || "—"}</p>
            <p><span className="text-muted-foreground">Location · </span>{[application.city, application.state].filter(Boolean).join(", ") || "—"}</p>
            <p><span className="text-muted-foreground">Content · </span>{(application.contentTypes || []).join(", ") || "—"}</p>
            <p><span className="text-muted-foreground">Submitted · </span>{fmtDateTime(application.submittedAt)}</p>
            <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Portfolio · </span>{application.portfolioSummary || "—"}</p>
            <div>
              <p className="text-muted-foreground">Sample links</p>
              {(application.sampleLinks || []).length === 0 ? <p>—</p> : application.sampleLinks.map((link) => (
                <a key={link} href={link} target="_blank" rel="noreferrer" className="block truncate text-primary hover:underline">{link}</a>
              ))}
            </div>
            {staffNotes && (
              <>
                {application.rejectionReason ? <p><span className="text-muted-foreground">Rejection · </span>{application.rejectionReason}</p> : null}
                <p className="whitespace-pre-wrap"><span className="text-muted-foreground">Admin notes · </span>{application.adminNotes || "—"}</p>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StaffRevenue({ creatorId, canEdit }: { creatorId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const period = { period: "30d" as const, from: "", to: "" };
  const overview = useCreatorRevenueOverview(period, 1, 5, creatorId);
  const rate = useCreatorRate(creatorId);
  const save = useSetCreatorRate();
  const creator = overview.data?.data?.creators?.[0];
  const rateData = rate.data?.data;

  const onSave = async (body: { rateInrPerHour: number; note?: string }) => {
    try {
      await save.mutateAsync({ creatorId, ...body });
      toast({ title: "Creator rate updated", description: "New watch time uses this rate. Past earnings stay as they were." });
    } catch (error) {
      toast({ title: "Could not update this rate", description: errorMessage(error, "Try again."), variant: "destructive" });
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">30-day earnings</p><p className="mt-1 text-2xl font-bold">{formatInr(creator?.amountInr || 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs uppercase text-muted-foreground">Watch hours</p><p className="mt-1 text-2xl font-bold">{formatWatchHours(creator?.watchHours || 0)}</p></CardContent></Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Current rate</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-2xl font-bold">{rateData ? formatRate(rateData.rateInrPerHour) : "—"}</p>
              {rateData && <SourceBadge source={rateData.source} />}
            </div>
          </CardContent>
        </Card>
      </div>
      {overview.isError ? <QueryState isError error={overview.error} onRetry={() => overview.refetch()} /> : (
        <RevenueTitlesTable items={creator?.titles || []} emptyLabel="No credited watch time in the last 30 days." isLoading={overview.isLoading} />
      )}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Rate</CardTitle></CardHeader>
        <CardContent>
          {rate.isLoading || rate.isError ? (
            <QueryState isLoading={rate.isLoading} isError={rate.isError} error={rate.error} onRetry={() => rate.refetch()} />
          ) : rateData ? (
            <>
              <WatchHourRateForm
                idPrefix={`staff-rate-${creatorId}`}
                canEdit={canEdit}
                rateInrPerHour={rateData.rateInrPerHour}
                pending={save.isPending}
                submitLabel="Save creator rate"
                onSave={onSave}
              />
              <div className="mt-4">
                <p className="mb-2 text-sm font-semibold">Override history</p>
                <RateHistoryList history={rateData.history || []} />
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
