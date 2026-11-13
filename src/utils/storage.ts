import { DEFAULT_STUDY_METADATA } from '../constants/xiangqiConstants';
import { INITIAL_LIBRARY_GAMES } from '../data/catalogRegistry';
import {
  AppTheme,
  BoardTheme,
  Camp,
  FontScale,
  GameMetadata,
  LibraryGameItem,
  MoveRecord,
  OpeningDrillProgress,
  Piece,
  PieceCraftStyle,
} from '../types/xiangqi';

export const STUDY_SESSION_STORAGE_KEY = 'xiangqix_study_session_v1';
export const PREFS_STORAGE_KEY = 'xiangqix_prefs_v1';
export const LIBRARY_STORAGE_KEY = 'xiangqix_library_v1';
export const SOLVED_CHALLENGES_STORAGE_KEY = 'xiangqix_challenges_solved_v1';
export const OPENING_DRILLS_STORAGE_KEY = 'xiangqix_opening_drills_v1';

export interface StoredStudySession {
  pieces: Piece[];
  basePieces?: Piece[];
  baseTurn?: Camp;
  mainMoves: MoveRecord[];
  variationMoves: MoveRecord[] | null;
  branchOriginPly: number | null;
  currentPly: number;
  turn: Camp;
  metadata: GameMetadata;
  flipped?: boolean;
  activeLibraryGameId?: string | null;
}

export interface StoredPrefs {
  appTheme?: AppTheme;
  fontScale?: FontScale;
  soundEnabled?: boolean;
  boardTheme?: BoardTheme;
  craftStyle?: PieceCraftStyle;
  useTraditionalChar?: boolean;
  primaryEngineId?: string;
  secondaryEngineId?: string;
  compareMode?: boolean;
  multiPvCount?: 1 | 2 | 3;
  engineDepth?: 18 | 24 | 30;
  engineThreads?: 4 | 8 | 16;
  engineHashMb?: 256 | 512 | 1024;
}

function safeSetLocalStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

export function readStoredStudySession(): StoredStudySession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STUDY_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredStudySession>;
    if (!Array.isArray(parsed.pieces) || parsed.pieces.length === 0) return null;
    if (!Array.isArray(parsed.mainMoves)) return null;
    return {
      pieces: parsed.pieces,
      basePieces:
        Array.isArray(parsed.basePieces) && parsed.basePieces.length > 0
          ? parsed.basePieces
          : undefined,
      baseTurn: parsed.baseTurn === 'black' ? 'black' : 'red',
      mainMoves: parsed.mainMoves,
      variationMoves: Array.isArray(parsed.variationMoves) ? parsed.variationMoves : null,
      branchOriginPly:
        typeof parsed.branchOriginPly === 'number' ? parsed.branchOriginPly : null,
      currentPly: typeof parsed.currentPly === 'number' ? parsed.currentPly : 0,
      turn: parsed.turn === 'black' ? 'black' : 'red',
      metadata: parsed.metadata?.redPlayer ? parsed.metadata : DEFAULT_STUDY_METADATA,
      flipped: !!parsed.flipped,
      activeLibraryGameId: parsed.activeLibraryGameId ?? null,
    };
  } catch {
    return null;
  }
}

export function writeStoredStudySession(session: StoredStudySession): void {
  safeSetLocalStorage(STUDY_SESSION_STORAGE_KEY, session);
}

export function readStoredPrefs(): StoredPrefs {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredPrefs) : {};
  } catch {
    return {};
  }
}

export function writeStoredPrefs(prefs: StoredPrefs): void {
  safeSetLocalStorage(PREFS_STORAGE_KEY, prefs);
}

export function readStoredLibraryGames(): LibraryGameItem[] {
  if (typeof window === 'undefined') return INITIAL_LIBRARY_GAMES;
  try {
    const raw = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (!raw) return INITIAL_LIBRARY_GAMES;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as LibraryGameItem[])
      : INITIAL_LIBRARY_GAMES;
  } catch {
    return INITIAL_LIBRARY_GAMES;
  }
}

export function writeStoredLibraryGames(games: LibraryGameItem[]): void {
  safeSetLocalStorage(LIBRARY_STORAGE_KEY, games);
}

export function readStoredSolvedChallenges(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SOLVED_CHALLENGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writeStoredSolvedChallenges(ids: string[]): void {
  safeSetLocalStorage(SOLVED_CHALLENGES_STORAGE_KEY, ids);
}

export function readStoredOpeningDrillProgress(): Record<string, OpeningDrillProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(OPENING_DRILLS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, OpeningDrillProgress>)
      : {};
  } catch {
    return {};
  }
}

export function writeStoredOpeningDrillProgress(
  progress: Record<string, OpeningDrillProgress>
): void {
  safeSetLocalStorage(OPENING_DRILLS_STORAGE_KEY, progress);
}
