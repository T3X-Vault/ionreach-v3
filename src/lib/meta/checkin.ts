import { readProfile, writeProfile, type ShopId } from "@/lib/meta/profile";

const KEY = "ionreach.checkin.v1";

export type PrizeKind = "join" | "asset" | "nft";

export type Prize = {
  id: string;
  kind: PrizeKind;
  name: string;
  detail: string;
  shopId?: ShopId;
};

/** Random pool: joins (units), assets (base gear), exclusive NFTs. No T3X. */
export const PRIZE_POOL: Prize[] = [
  { id: "join-squad", kind: "join", name: "Rifle detail", detail: "Six extra riflemen join your opening line.", shopId: "squad" },
  { id: "join-escort", kind: "join", name: "Lancer escort", detail: "Two line tanks roll with the column.", shopId: "escort" },
  { id: "join-scouts", kind: "join", name: "Viper pair", detail: "Two light tanks on the flank.", shopId: "scouts" },
  { id: "join-wing", kind: "join", name: "Reserve wing", detail: "One extra Kestrel on the climb.", shopId: "wing" },
  { id: "join-cadre", kind: "join", name: "Sergeant cadre", detail: "Three sergeants lead the first push.", shopId: "cadre" },
  { id: "asset-crate", kind: "asset", name: "Ionite crate", detail: "Deploy with 600 extra ionite.", shopId: "crate" },
  { id: "asset-plate", kind: "asset", name: "Spire plate", detail: "Command spire deploys with extra hull.", shopId: "plate" },
  { id: "asset-veil", kind: "asset", name: "Spire veil", detail: "Opening units carry a shield.", shopId: "veil" },
  { id: "asset-rig", kind: "asset", name: "Spare rig", detail: "A second harvester starts beside the spire.", shopId: "rig" },
  { id: "nft-glass-mark", kind: "nft", name: "Exclusive Glass Mark NFT", detail: "A rare Helion seal for your ledger. Cosmetic exclusivity on this device." },
  { id: "nft-horizon-chip", kind: "nft", name: "Exclusive Horizon Chip NFT", detail: "A campaign chip only check-in veterans hold." },
  { id: "nft-t3x-plate", kind: "nft", name: "Exclusive T3X Plate NFT", detail: "An ace plate badge reserved for ten-day holders." },
];

export type CheckinState = {
  lastDay: string | null;
  streak: number;
  total: number;
  prizes: string[];
  lastPrizeId: string | null;
};

function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayKey(d = new Date()): string {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

function empty(): CheckinState {
  return { lastDay: null, streak: 0, total: 0, prizes: [], lastPrizeId: null };
}

export function readCheckin(): CheckinState {
  if (typeof localStorage === "undefined") return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as CheckinState;
    return {
      lastDay: parsed.lastDay ?? null,
      streak: Number(parsed.streak) || 0,
      total: Number(parsed.total) || 0,
      prizes: Array.isArray(parsed.prizes) ? parsed.prizes : [],
      lastPrizeId: parsed.lastPrizeId ?? null,
    };
  } catch {
    return empty();
  }
}

function writeCheckin(state: CheckinState): void {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function checkedInToday(state = readCheckin()): boolean {
  return state.lastDay === todayKey();
}

export function daysUntilPrize(state = readCheckin()): number {
  if (state.total <= 0) return 10;
  const into = state.total % 10;
  return into === 0 ? 10 : 10 - into;
}

function grantPrize(prize: Prize): void {
  const profile = readProfile();
  if (prize.shopId && !profile.owned.includes(prize.shopId)) {
    profile.owned.push(prize.shopId);
    if (!profile.equipped.includes(prize.shopId)) profile.equipped.push(prize.shopId);
  }
  if (prize.kind === "nft" && !profile.nfts.includes(prize.id)) {
    profile.nfts.push(prize.id);
  }
  writeProfile(profile);
}

function pickPrize(ownedPrizeIds: string[]): Prize {
  const fresh = PRIZE_POOL.filter((p) => !ownedPrizeIds.includes(p.id));
  const pool = fresh.length > 0 ? fresh : PRIZE_POOL;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export type CheckinResult =
  | { ok: false; reason: string; state: CheckinState }
  | { ok: true; state: CheckinState; prize: Prize | null; message: string };

/** One check-in per calendar day. Every 10th check-in awards a random prize (not T3X). */
export function claimCheckin(): CheckinResult {
  const state = readCheckin();
  const today = todayKey();
  if (state.lastDay === today) {
    return { ok: false, reason: "Already checked in today. Come back tomorrow.", state };
  }
  const streak = state.lastDay === yesterdayKey() ? state.streak + 1 : 1;
  const total = state.total + 1;
  let prize: Prize | null = null;
  const prizes = [...state.prizes];
  if (total > 0 && total % 10 === 0) {
    prize = pickPrize(prizes);
    prizes.push(prize.id);
    grantPrize(prize);
  }
  const next: CheckinState = {
    lastDay: today,
    streak,
    total,
    prizes,
    lastPrizeId: prize?.id ?? state.lastPrizeId,
  };
  writeCheckin(next);
  if (prize) {
    return {
      ok: true,
      state: next,
      prize,
      message: `Day ${total}. Streak ${streak}. Prize unlocked: ${prize.name}.`,
    };
  }
  const left = 10 - (total % 10);
  return {
    ok: true,
    state: next,
    prize: null,
    message: `Day ${total} logged. Streak ${streak}. ${left} more check-ins until a random prize.`,
  };
}

export function prizeById(id: string): Prize | undefined {
  return PRIZE_POOL.find((p) => p.id === id);
}
