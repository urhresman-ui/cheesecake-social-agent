"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Proposal = {
  id: string;
  type: "POST" | "STORY";
  kind: "IMAGE" | "VIDEO";
  driveFileName: string;
  driveViewUrl: string;
  caption: string;
  burnText?: string;
  editSuggestion?: string;
};

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function ProposalCard({
  proposal,
  token,
  onDone,
}: {
  proposal: Proposal;
  token: string;
  onDone: (id: string) => void;
}) {
  const [caption, setCaption] = useState(proposal.caption);
  const [burnText, setBurnText] = useState(proposal.burnText ?? "");
  const debouncedBurnText = useDebounced(burnText, 500);
  const [busy, setBusy] = useState<"complete" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gone, setGone] = useState(false);

  async function persistIfChanged() {
    await fetch(`/api/social/proposals/${proposal.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ caption, burnText }),
    }).catch(() => undefined);
  }

  async function complete() {
    setBusy("complete");
    setError(null);
    try {
      await persistIfChanged();
      const response = await fetch("/api/social/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      if (!response.ok) throw new Error(await response.text());
      setGone(true);
      onDone(proposal.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  async function reject() {
    setBusy("reject");
    setError(null);
    try {
      const response = await fetch("/api/social/reject", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ proposalId: proposal.id }),
      });
      if (!response.ok) throw new Error(await response.text());
      setGone(true);
      onDone(proposal.id);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(null);
    }
  }

  if (gone) return null;

  const imageSrc =
    proposal.kind === "IMAGE"
      ? `/api/social/image/${proposal.id}?token=${encodeURIComponent(token)}&text=${encodeURIComponent(debouncedBurnText)}`
      : null;

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-ink-soft">
        <span>
          {proposal.type === "POST" ? "📌 Feed post" : "⏱️ Story"} ·{" "}
          {proposal.kind === "IMAGE" ? "fotografija" : "video"}
        </span>
        <span className="truncate max-w-[50%]">{proposal.driveFileName}</span>
      </div>

      {proposal.kind === "IMAGE" ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageSrc ?? undefined}
            alt="Predogled urejene fotografije"
            className="w-full rounded-md border border-gold-soft"
          />
          <label className="text-xs text-ink-soft">
            Besedilo na sliki (kratko)
            <textarea
              className="mt-1 w-full rounded border border-gold-soft bg-paper p-2 text-sm"
              rows={2}
              value={burnText}
              onChange={(e) => setBurnText(e.target.value)}
            />
          </label>
          <a
            className="text-xs underline text-ink-soft"
            href={`/api/social/image/${proposal.id}?token=${encodeURIComponent(token)}&text=${encodeURIComponent(debouncedBurnText)}&download=1`}
          >
            Prenesi gotovo sliko
          </a>
        </>
      ) : (
        <a
          className="btn-secondary rounded px-3 py-2 text-sm text-center"
          href={proposal.driveViewUrl}
          target="_blank"
          rel="noreferrer"
        >
          Odpri video v Google Drive
        </a>
      )}

      {proposal.editSuggestion && (
        <p className="text-xs text-ink-soft bg-cream rounded p-2">
          ✂️ Predlog urejanja: {proposal.editSuggestion}
        </p>
      )}

      {!(proposal.type === "STORY" && proposal.kind === "IMAGE") && (
        <label className="text-xs text-ink-soft">
          {proposal.type === "POST"
            ? "IG opis (caption) za kopiranje"
            : "Predlog besedila za nalepko (interno, ni IG opis - Stories nimajo opisa)"}
          <textarea
            className="mt-1 w-full rounded border border-gold-soft bg-paper p-2 text-sm"
            rows={proposal.type === "POST" ? 5 : 2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </label>
      )}

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          className="btn-primary flex-1 rounded px-3 py-2 text-sm disabled:opacity-40"
          disabled={busy !== null}
          onClick={complete}
        >
          {busy === "complete" ? "Shranjujem ..." : "Objavil sem, označi kot gotovo"}
        </button>
        <button
          className="btn-secondary rounded px-3 py-2 text-sm disabled:opacity-40"
          disabled={busy !== null}
          onClick={reject}
        >
          {busy === "reject" ? "..." : "Zavrni"}
        </button>
      </div>
    </div>
  );
}

function PregledContent() {
  const token = useSearchParams().get("token") ?? "";
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch("/api/social/proposals?status=pending", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { proposals: Proposal[] }) => setProposals(data.proposals))
      .catch((err) => setError(String(err)));
  }, [token]);

  function removeProposal(id: string) {
    setProposals((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  if (!token) {
    return <p className="text-ink-soft">Manjka ?token= v naslovu strani.</p>;
  }
  if (error && proposals === null) {
    return <p className="text-red-700">Napaka pri nalaganju: {error}</p>;
  }
  if (proposals === null) {
    return <p className="text-ink-soft">Nalaganje ...</p>;
  }
  if (proposals.length === 0) {
    return <p className="text-ink-soft">Trenutno ni predlogov, ki čakajo na pregled.</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          token={token}
          onDone={removeProposal}
        />
      ))}
    </div>
  );
}

export default function PregledPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-8">
      <h1 className="mb-6 text-lg font-semibold">Us & Cheesecake — pregled predlogov</h1>
      <Suspense fallback={<p className="text-ink-soft">Nalaganje ...</p>}>
        <PregledContent />
      </Suspense>
    </main>
  );
}
