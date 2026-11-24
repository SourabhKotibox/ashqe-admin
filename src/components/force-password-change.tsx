import { useState } from "react";
import { KeyRound, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useUpdatePassword } from "@/lib/api-client";
import { writeMustChangePasswordFlag } from "@/lib/creator-access";

/** Blocks the console until a first-login temporary password is replaced. */
export function ForcePasswordChange({ email }: { email?: string }) {
  const { toast } = useToast();
  const updatePassword = useUpdatePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast({ title: "Use at least 6 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "New passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword === currentPassword) {
      toast({ title: "Choose a password different from the temporary one", variant: "destructive" });
      return;
    }
    updatePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          toast({ title: "Password updated", description: "You can use the creator console now." });
        },
        onError: (err: any) => {
          toast({ title: "Could not update password", description: err?.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="h-12 w-12 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <CardDescription>
            This account was created with a temporary password{email ? ` for ${email}` : ""}. Choose a new password before opening the dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="temp-password">Temporary password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="temp-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updatePassword.isPending}>
              {updatePassword.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save password and continue
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                localStorage.removeItem("adminAccessToken");
                localStorage.removeItem("adminRefreshToken");
                writeMustChangePasswordFlag(false);
                window.location.href = "/admin/login";
              }}
            >
              Sign out
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
