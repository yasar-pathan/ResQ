"use client";

import { Share2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function InstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setIsIos(ios);
    if (window.sessionStorage.getItem("rg_install_dismissed") === "1") {
      setDismissed(true);
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed) return null;
  if (!deferred && !isIos) return null;

  async function onInstall() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  function onDismiss() {
    setDismissed(true);
    window.sessionStorage.setItem("rg_install_dismissed", "1");
  }

  return (
    <aside className="install-hint" role="note">
      <Smartphone size={20} aria-hidden />
      <div className="install-hint-body">
        <strong>Use RescueGrid on your phone</strong>
        <p className="muted">
          {isIos
            ? "In Safari: Share → Add to Home Screen for one-tap SOS access."
            : "Install this site as an app for quick emergency reporting."}
        </p>
      </div>
      <div className="install-hint-actions">
        {deferred ? (
          <Button type="button" size="sm" onClick={() => void onInstall()}>
            Install
          </Button>
        ) : (
          <span className="install-hint-ios" aria-hidden>
            <Share2 size={16} />
          </span>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </aside>
  );
}
