"use client";

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import type { DomainWithInstructions } from "~/server/api/routers/domain";
import type { DomainDisplayStatus } from "~/server/domains/types";
import {
  displayStatusLabel,
} from "~/server/domains/types";
import {
  customDomainCnameTarget,
  freeSubdomainFqdn,
  freeSubdomainSuffix,
  publicHostnameUrl,
  rootDomainHost,
} from "~/lib/root-domain";
import { PorfiloButton } from "~/app/_components/porfilo-button";
import { useToast } from "~/app/_components/toast";

type FlowStep = "choose" | "free" | "custom" | "manage";

export function DomainModal({ onClose }: { onClose: () => void }) {
  const utils = api.useUtils();
  const { toast } = useToast();
  const mine = api.domain.mine.useQuery();
  const existing = mine.data;

  const [step, setStep] = useState<FlowStep>("choose");
  const [freeLabel, setFreeLabel] = useState("");
  const [customHost, setCustomHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (existing) setStep("manage");
    else if (step === "manage") setStep("choose");
  }, [existing, step]);

  const addFree = api.domain.addFreeSubdomain.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.domain.mine.invalidate();
      setStep("manage");
    },
    onError: (e) => setError(e.message),
  });

  const addCustom = api.domain.addCustomDomain.useMutation({
    onSuccess: async () => {
      setError(null);
      await utils.domain.mine.invalidate();
      setStep("manage");
    },
    onError: (e) => setError(e.message),
  });

  const checkStatus = api.domain.checkStatus.useMutation({
    onSuccess: async () => {
      await utils.domain.mine.invalidate();
    },
  });

  const remove = api.domain.remove.useMutation({
    onSuccess: async () => {
      await utils.domain.mine.invalidate();
      setConfirmRemove(false);
      toast("Domain removed.");
      onClose();
    },
  });

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmRemove) setConfirmRemove(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, confirmRemove]);

  const title = existing
    ? modalTitle(existing.displayStatus)
    : step === "choose"
      ? "Choose your portfolio URL"
      : step === "free"
        ? "Free Porfilo subdomain"
        : "Use your own domain";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="domain-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-3 py-4 sm:px-6 sm:py-8"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-md"
      />

      <div
        className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.10] bg-white/[0.04] backdrop-blur-2xl"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.14), 0 50px 80px -25px rgba(0,0,0,0.75)",
        }}
      >
        <ModalGlow />

        <header className="relative flex flex-none items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium tracking-[0.18em] text-indigo-200/70 uppercase">
              Portfolio URL
            </p>
            <h2
              id="domain-modal-title"
              className="text-[15px] font-medium tracking-tight text-white"
            >
              {title}
            </h2>
          </div>
          <PorfiloButton
            variant="ghost"
            onClick={onClose}
            aria-label="Close"
            className="!h-8 !w-8 !p-0"
          >
            <CloseIcon />
          </PorfiloButton>
        </header>

        <div className="relative px-5 py-5">
          {confirmRemove && existing ? (
            <RemoveConfirm
              hostname={existing.hostname}
              removing={remove.isPending}
              onCancel={() => setConfirmRemove(false)}
              onConfirm={() => remove.mutate()}
            />
          ) : mine.isLoading ? (
            <LoadingRow />
          ) : existing ? (
            <ManageStep
              domain={existing}
              onRecheck={() => checkStatus.mutate()}
              rechecking={checkStatus.isPending}
              onRemove={() => setConfirmRemove(true)}
            />
          ) : step === "choose" ? (
            <ChooseStep
              onFree={() => {
                setError(null);
                setStep("free");
              }}
              onCustom={() => {
                setError(null);
                setStep("custom");
              }}
            />
          ) : step === "free" ? (
            <FreeStep
              label={freeLabel}
              onLabel={setFreeLabel}
              error={error}
              pending={addFree.isPending}
              onBack={() => {
                setError(null);
                setStep("choose");
              }}
              onSubmit={() => addFree.mutate({ label: freeLabel.trim() })}
            />
          ) : (
            <CustomStep
              hostname={customHost}
              onHostname={setCustomHost}
              error={error}
              pending={addCustom.isPending}
              onBack={() => {
                setError(null);
                setStep("choose");
              }}
              onSubmit={() => addCustom.mutate({ hostname: customHost.trim() })}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function modalTitle(status: DomainDisplayStatus): string {
  switch (status) {
    case "FREE_SUBDOMAIN_ACTIVE":
    case "CUSTOM_DOMAIN_ACTIVE":
      return "Domain connected";
    case "CUSTOM_DOMAIN_PENDING_DNS":
    case "CUSTOM_DOMAIN_VERIFYING_SSL":
      return "Domain pending";
    case "CUSTOM_DOMAIN_FAILED":
      return "Action needed";
    default:
      return "Connect your domain";
  }
}

function ChooseStep({
  onFree,
  onCustom,
}: {
  onFree: () => void;
  onCustom: () => void;
}) {
  const rootHost = rootDomainHost();
  const exampleSubdomain = freeSubdomainFqdn("max");

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-white/65">
        Pick how visitors will reach your portfolio.
      </p>
      <button
        type="button"
        onClick={onFree}
        className="w-full rounded-xl border border-white/[0.08] bg-black/25 p-4 text-left backdrop-blur-md transition hover:border-white/[0.14] hover:bg-black/35"
      >
        <p className="text-[14px] font-medium text-white">
          Free Porfilo subdomain
        </p>
        <p className="mt-1 text-[12.5px] text-white/50">
          Claim a free {rootHost} subdomain. No DNS setup needed.
        </p>
        <p className="mt-2 font-mono text-[12px] text-indigo-200/80">
          {exampleSubdomain}
        </p>
      </button>
      <button
        type="button"
        onClick={onCustom}
        className="w-full rounded-xl border border-white/[0.08] bg-black/25 p-4 text-left backdrop-blur-md transition hover:border-white/[0.14] hover:bg-black/35"
      >
        <p className="text-[14px] font-medium text-white">Use your own domain</p>
        <p className="mt-1 text-[12.5px] text-white/50">
          Connect a domain you already own, like max.com or portfolio.max.com.
        </p>
        <p className="mt-2 font-mono text-[12px] text-indigo-200/80">
          max.com
        </p>
      </button>
    </div>
  );
}

function FreeStep({
  label,
  onLabel,
  error,
  pending,
  onBack,
  onSubmit,
}: {
  label: string;
  onLabel: (v: string) => void;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const exampleFqdn = freeSubdomainFqdn("label");
  const suffix = freeSubdomainSuffix();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <p className="text-[13px] leading-relaxed text-white/65">
        Enter the label for your free subdomain. We&apos;ll host it at{" "}
        <span className="font-mono text-white/75">{exampleFqdn}</span>.
      </p>
      <label className="block">
        <span className="mb-1.5 block text-[11.5px] tracking-wide text-white/55">
          Subdomain label
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-3">
          <input
            value={label}
            onChange={(e) => onLabel(e.target.value)}
            placeholder="max"
            autoFocus
            spellCheck={false}
            autoCapitalize="off"
            className="h-10 flex-1 bg-transparent font-mono text-[14px] outline-none placeholder:text-white/25"
          />
          <span className="shrink-0 font-mono text-[13px] text-white/35">
            {suffix}
          </span>
        </div>
      </label>
      {error && (
        <p role="alert" className="text-[12.5px] text-red-300/90">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <PorfiloButton type="button" variant="ghost" onClick={onBack}>
          Back
        </PorfiloButton>
        <PorfiloButton type="submit" disabled={pending}>
          {pending ? "Claiming…" : "Claim subdomain"}
        </PorfiloButton>
      </div>
    </form>
  );
}

function CustomStep({
  hostname,
  onHostname,
  error,
  pending,
  onBack,
  onSubmit,
}: {
  hostname: string;
  onHostname: (v: string) => void;
  error: string | null;
  pending: boolean;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
      aria-busy={pending}
    >
      <p className="text-[13px] leading-relaxed text-white/65">
        Enter the domain where your portfolio should live. You&apos;ll add DNS
        records in the next step.
      </p>
      {pending && (
        <p className="text-[12.5px] text-indigo-200/75" role="status">
          Registering with Cloudflare…
        </p>
      )}
      <label className="block">
        <span className="mb-1.5 block text-[11.5px] tracking-wide text-white/55">
          Your domain
        </span>
        <input
          value={hostname}
          onChange={(e) => onHostname(e.target.value)}
          placeholder="max.com or portfolio.max.com"
          autoFocus
          spellCheck={false}
          autoCapitalize="off"
          className="h-10 w-full rounded-lg border border-white/10 bg-black/30 px-3 font-mono text-[14px] outline-none placeholder:text-white/25 focus:border-indigo-400/40"
        />
      </label>
      {error && (
        <p role="alert" className="text-[12.5px] text-red-300/90">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <PorfiloButton type="button" variant="ghost" onClick={onBack} disabled={pending}>
          Back
        </PorfiloButton>
        <PorfiloButton type="submit" disabled={pending}>
          {pending ? "Registering…" : "Continue"}
        </PorfiloButton>
      </div>
    </form>
  );
}

function ManageStep({
  domain,
  onRecheck,
  rechecking,
  onRemove,
}: {
  domain: DomainWithInstructions;
  onRecheck: () => void;
  rechecking: boolean;
  onRemove: () => void;
}) {
  const isFree = domain.type === "free_subdomain";
  const isLive =
    domain.displayStatus === "FREE_SUBDOMAIN_ACTIVE" ||
    domain.displayStatus === "CUSTOM_DOMAIN_ACTIVE";

  const banner = bannerFor(domain);

  return (
    <div className="space-y-4">
      <Banner {...banner} />

      {!isLive && domain.type === "custom_domain" && rechecking && (
        <CheckingStrip />
      )}

      {isFree && isLive && (
        <p className="text-[13px] text-white/60">
          Your portfolio is live at{" "}
          <a
            href={publicHostnameUrl(domain.hostname)}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-white/85 underline-offset-2 hover:underline"
          >
            {domain.hostname}
          </a>
        </p>
      )}

      {!isFree && (
        <>
          <div>
            <p className="mb-2 text-[11.5px] font-medium tracking-[0.14em] text-white/55 uppercase">
              Add these records at your domain provider
            </p>
            <div className="space-y-2.5">
              <RecordRow
                type="CNAME"
                name={domain.instructions.cname.name}
                value={domain.instructions.cname.value}
                purpose="Routes visitors to your portfolio"
              />
              {domain.instructions.txt && (
                <RecordRow
                  type="TXT"
                  name={domain.instructions.txt.name}
                  value={domain.instructions.txt.value}
                  purpose="Proves you own this domain"
                />
              )}
            </div>
            {!domain.instructions.txt && !isLive && (
              <p className="mt-2 text-[11.5px] text-white/40">
                Add the CNAME first — the verification TXT appears here once
                detected.
              </p>
            )}
          </div>

          {!isLive && (
            <div className="flex justify-end">
              <PorfiloButton
                type="button"
                onClick={onRecheck}
                disabled={rechecking}
              >
                {rechecking ? "Checking…" : "Check now"}
              </PorfiloButton>
            </div>
          )}
        </>
      )}

      <div className="border-t border-white/[0.06] pt-4">
        <PorfiloButton type="button" variant="destructive" onClick={onRemove}>
          Remove domain
        </PorfiloButton>
      </div>
    </div>
  );
}

function bannerFor(domain: DomainWithInstructions): {
  tone: "ok" | "warn" | "err" | "pending";
  title: string;
  body: string;
} {
  const label = displayStatusLabel(domain.displayStatus);
  switch (domain.displayStatus) {
    case "FREE_SUBDOMAIN_ACTIVE":
    case "CUSTOM_DOMAIN_ACTIVE":
      return {
        tone: "ok",
        title: label,
        body: `Live at ${domain.hostname}. Visitors can use this URL now.`,
      };
    case "CUSTOM_DOMAIN_PENDING_DNS":
      return {
        tone: "pending",
        title: "Waiting for DNS",
        body: `Point your CNAME to ${customDomainCnameTarget()}. DNS changes can take a few minutes.`,
      };
    case "CUSTOM_DOMAIN_VERIFYING_SSL":
      return {
        tone: "pending",
        title: "Issuing SSL",
        body: "DNS looks good. Cloudflare is validating and issuing your certificate.",
      };
    case "CUSTOM_DOMAIN_FAILED":
      return {
        tone: "warn",
        title: "Action needed",
        body:
          domain.errorReason ??
          "We can't verify your DNS records yet. Double-check the values below.",
      };
    default:
      return {
        tone: "pending",
        title: label,
        body: "Complete the steps below to connect your domain.",
      };
  }
}

function RemoveConfirm({
  hostname,
  removing,
  onCancel,
  onConfirm,
}: {
  hostname: string;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-[14px] font-medium text-white">
        Remove {hostname} from this portfolio?
      </p>
      <p className="text-[13px] leading-relaxed text-white/55">
        DNS records at your domain provider are not deleted automatically. You
        can remove them there when you&apos;re ready.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <PorfiloButton type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </PorfiloButton>
        <PorfiloButton
          type="button"
          variant="destructive"
          disabled={removing}
          onClick={onConfirm}
        >
          {removing ? "Removing…" : "Remove domain"}
        </PorfiloButton>
      </div>
    </div>
  );
}

function CheckingStrip() {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400/60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-400" />
      </span>
      <span className="text-[12px] text-white/60">Checking now…</span>
    </div>
  );
}

function RecordRow({
  type,
  name,
  value,
  purpose,
}: {
  type: string;
  name: string;
  value: string;
  purpose: string;
}) {
  const [copied, setCopied] = useState<"" | "name" | "value">("");
  const copy = async (kind: "name" | "value", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(""), 1400);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black/30">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.04] px-3 py-1.5">
        <span className="font-mono text-[11px] tracking-[0.14em] text-indigo-200/80 uppercase">
          {type}
        </span>
        <span className="text-[11px] text-white/40">{purpose}</span>
      </div>
      <RecordField
        label="Name / Host"
        value={name}
        copied={copied === "name"}
        onCopy={() => copy("name", name)}
      />
      <RecordField
        label="Value / Target"
        value={value}
        copied={copied === "value"}
        onCopy={() => copy("value", value)}
      />
    </div>
  );
}

function RecordField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-white/[0.04] px-3 py-2 last:border-b-0">
      <span className="w-24 shrink-0 text-[11px] tracking-wide text-white/45">
        {label}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-white/85">
        {value}
      </span>
      <PorfiloButton
        type="button"
        variant="ghost"
        onClick={onCopy}
        className="!h-8 !px-2.5 !text-[11.5px]"
      >
        {copied ? "Copied" : "Copy"}
      </PorfiloButton>
    </div>
  );
}

function Banner({
  tone,
  title,
  body,
}: {
  tone: "ok" | "warn" | "err" | "pending";
  title: string;
  body: string;
}) {
  const style =
    tone === "ok"
      ? "border-emerald-400/25 bg-emerald-400/[0.05] text-emerald-100"
      : tone === "warn"
        ? "border-amber-400/25 bg-amber-400/[0.05] text-amber-100"
        : tone === "err"
          ? "border-red-500/25 bg-red-500/[0.05] text-red-100"
          : "border-white/10 bg-white/[0.025] text-white/85";
  const dot =
    tone === "ok"
      ? "bg-emerald-300"
      : tone === "warn"
        ? "bg-amber-300"
        : tone === "err"
          ? "bg-red-400"
          : "bg-indigo-400 animate-pulse";
  return (
    <div className={`rounded-xl border px-3.5 py-3 ${style}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <p className="text-[13px] font-medium">{title}</p>
      </div>
      <p className="mt-1 ml-3.5 text-[12px] leading-relaxed opacity-80">
        {body}
      </p>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-[12.5px] text-white/55">
      <Spinner />
      Loading…
    </div>
  );
}

function ModalGlow() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-10 h-40 opacity-70"
        style={{
          background:
            "radial-gradient(60% 70% at 50% 0%, rgba(140,150,255,0.18), transparent 70%)",
        }}
      />
    </>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white"
    />
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 3l8 8M11 3l-8 8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
