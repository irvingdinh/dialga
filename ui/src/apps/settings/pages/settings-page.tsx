import {
  ArrowLeftIcon,
  BellIcon,
  BellOffIcon,
  CheckIcon,
  LoaderIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { useAuth } from "@/apps/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api, ApiError } from "@/lib/api";
import {
  getBrowserNotificationsEnabled,
  setBrowserNotificationsEnabled,
} from "@/lib/notifications";
import { useTheme } from "@/lib/theme";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();

  // Profile
  const [name, setName] = useState(user?.name ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const profileDirty = name !== (user?.name ?? "");

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const handleSaveProfile = useCallback(async () => {
    if (!profileDirty || profileSaving) return;
    setProfileSaving(true);
    try {
      await api.auth.updateProfile({ name: name.trim() });
      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Failed to update profile",
      );
    } finally {
      setProfileSaving(false);
    }
  }, [name, profileDirty, profileSaving, refreshUser]);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const passwordValid =
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    newPassword === confirmPassword;

  const handleChangePassword = useCallback(async () => {
    if (!passwordValid || passwordSaving) return;
    setPasswordError("");
    setPasswordSaving(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    } catch (e) {
      if (e instanceof ApiError) {
        setPasswordError(e.message);
      } else {
        setPasswordError("Failed to change password");
      }
    } finally {
      setPasswordSaving(false);
    }
  }, [currentPassword, newPassword, passwordValid, passwordSaving]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate("/machines")}
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
      </div>

      {/* Profile Section */}
      <div className="mt-8">
        <h2 className="text-sm font-medium">Profile</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Manage your account information
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="email" className="text-muted-foreground text-xs">
              Email
            </Label>
            <Input
              id="email"
              value={user?.email ?? ""}
              disabled
              className="mt-1.5 opacity-60"
            />
          </div>

          <div>
            <Label htmlFor="name" className="text-xs">
              Display name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="mt-1.5"
            />
          </div>

          <Button
            size="sm"
            disabled={!profileDirty || profileSaving}
            onClick={handleSaveProfile}
          >
            {profileSaved ? (
              <>
                <CheckIcon className="size-3.5" />
                Saved
              </>
            ) : profileSaving ? (
              <>
                <LoaderIcon className="size-3.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Password Section */}
      <div>
        <h2 className="text-sm font-medium">Password</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Change your account password
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="current-password" className="text-xs">
              Current password
            </Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setPasswordError("");
              }}
              placeholder="Enter current password"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="new-password" className="text-xs">
              New password
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError("");
              }}
              placeholder="At least 6 characters"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="confirm-password" className="text-xs">
              Confirm new password
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setPasswordError("");
              }}
              placeholder="Re-enter new password"
              className="mt-1.5"
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">
                Passwords do not match
              </p>
            )}
          </div>

          {passwordError && (
            <p className="text-xs text-red-500">{passwordError}</p>
          )}

          <Button
            size="sm"
            disabled={!passwordValid || passwordSaving}
            onClick={handleChangePassword}
          >
            {passwordSaving ? (
              <>
                <LoaderIcon className="size-3.5 animate-spin" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </Button>
        </div>
      </div>

      <Separator className="my-8" />

      {/* Appearance Section */}
      <div>
        <h2 className="text-sm font-medium">Appearance</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Choose how the app looks
        </p>

        <div className="mt-4 flex gap-2">
          <ThemeButton
            label="Light"
            icon={<SunIcon className="size-4" />}
            active={theme === "light"}
            onClick={() => setTheme("light")}
          />
          <ThemeButton
            label="Dark"
            icon={<MoonIcon className="size-4" />}
            active={theme === "dark"}
            onClick={() => setTheme("dark")}
          />
          <ThemeButton
            label="System"
            icon={<MonitorIcon className="size-4" />}
            active={theme === "system"}
            onClick={() => setTheme("system")}
          />
        </div>
      </div>

      <Separator className="my-8" />

      {/* Notifications Section */}
      <NotificationsSection />

      <Separator className="my-8" />

      {/* Account Section */}
      <div className="mb-8">
        <h2 className="text-sm font-medium">Account</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Manage your session
        </p>

        <div className="mt-4">
          <p className="text-muted-foreground text-xs">
            Signed in as{" "}
            <span className="text-foreground font-medium">{user?.email}</span>
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigate("/machines")}
          >
            Back to Machines
          </Button>
        </div>
      </div>
    </div>
  );
}

function ThemeButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs transition-colors ${
        active
          ? "border-foreground/20 bg-muted font-medium"
          : "hover:bg-muted/50 text-muted-foreground border-transparent"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function NotificationsSection() {
  const [enabled, setEnabled] = useState(getBrowserNotificationsEnabled);
  const supportsNotifications = "Notification" in window;
  const permission = supportsNotifications ? Notification.permission : "denied";

  const handleToggle = useCallback(
    async (value: boolean) => {
      if (
        value &&
        supportsNotifications &&
        Notification.permission === "default"
      ) {
        const result = await Notification.requestPermission();
        if (result === "denied") {
          toast.error("Notifications blocked by your browser");
          return;
        }
      }
      setBrowserNotificationsEnabled(value);
      setEnabled(value);
    },
    [supportsNotifications],
  );

  return (
    <div>
      <h2 className="text-sm font-medium">Notifications</h2>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Get notified when tasks finish
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => handleToggle(true)}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs transition-colors ${
              enabled
                ? "border-foreground/20 bg-muted font-medium"
                : "hover:bg-muted/50 text-muted-foreground border-transparent"
            }`}
          >
            <BellIcon className="size-4" />
            Enabled
          </button>
          <button
            onClick={() => handleToggle(false)}
            className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-xs transition-colors ${
              !enabled
                ? "border-foreground/20 bg-muted font-medium"
                : "hover:bg-muted/50 text-muted-foreground border-transparent"
            }`}
          >
            <BellOffIcon className="size-4" />
            Disabled
          </button>
        </div>

        {supportsNotifications && permission === "denied" && enabled && (
          <p className="text-muted-foreground text-xs">
            Browser notifications are blocked. Enable them in your browser
            settings for this site.
          </p>
        )}

        <p className="text-muted-foreground text-xs">
          Browser notifications appear when tasks complete, fail, or time out
          while the tab is in the background.
        </p>
      </div>
    </div>
  );
}
