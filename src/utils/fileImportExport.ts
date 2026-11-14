import { INITIAL_FEN } from '../constants/xiangqiConstants';
import {
  Camp,
  GameMetadata,
  LibraryBackupBundle,
  LibraryBackupImportStrategy,
  LibraryGameItem,
  MoveRecord,
  ParsedImportSession,
  Piece,
  PieceType,
} from '../types/xiangqi';
import {
  buildBoardGrid,
  createInitialPieces,
  evaluateBoardScore,
  formatChineseMoveNotation,
  getPieceAt,
  getSafeLegalMovesForPiece,
  parseFenToPieces,
  parsePgnTextToSession,
  validateSetupPosition,
} from './xiangqiRules';

// ==================== 1. 智能编码文本解码 (UTF-8 优先，自动回退 GB18030) ====================
export function decodeBytesSmart(bytes: Uint8Array): string {
  // 去除 UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    try {
      return new TextDecoder('gb18030').decode(bytes);
    } catch {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}

function decodePascalGbkString(bytes: Uint8Array, offset: number, maxBlockLen: number): string {
  if (offset >= bytes.length) return '';
  const declaredLen = bytes[offset];
  const actualLen = Math.min(declaredLen, maxBlockLen - 1, Math.max(0, bytes.length - offset - 1));
  if (actualLen <= 0) return '';
  const slice = bytes.subarray(offset + 1, offset + 1 + actualLen);
  return decodeBytesSmart(slice).replace(/\0/g, '').trim();
}

// ==================== 2. 象棋演播室基础明文 .xqf 二进制解析器 ====================
const XQF_PIECE_ORDER: { camp: Camp; type: PieceType }[] = [
  { camp: 'red', type: 'chariot' },
  { camp: 'red', type: 'horse' },
  { camp: 'red', type: 'elephant' },
  { camp: 'red', type: 'advisor' },
  { camp: 'red', type: 'general' },
  { camp: 'red', type: 'advisor' },
  { camp: 'red', type: 'elephant' },
  { camp: 'red', type: 'horse' },
  { camp: 'red', type: 'chariot' },
  { camp: 'red', type: 'cannon' },
  { camp: 'red', type: 'cannon' },
  { camp: 'red', type: 'soldier' },
  { camp: 'red', type: 'soldier' },
  { camp: 'red', type: 'soldier' },
  { camp: 'red', type: 'soldier' },
  { camp: 'red', type: 'soldier' },
  { camp: 'black', type: 'chariot' },
  { camp: 'black', type: 'horse' },
  { camp: 'black', type: 'elephant' },
  { camp: 'black', type: 'advisor' },
  { camp: 'black', type: 'general' },
  { camp: 'black', type: 'advisor' },
  { camp: 'black', type: 'elephant' },
  { camp: 'black', type: 'horse' },
  { camp: 'black', type: 'chariot' },
  { camp: 'black', type: 'cannon' },
  { camp: 'black', type: 'cannon' },
  { camp: 'black', type: 'soldier' },
  { camp: 'black', type: 'soldier' },
  { camp: 'black', type: 'soldier' },
  { camp: 'black', type: 'soldier' },
  { camp: 'black', type: 'soldier' },
];

function decodeXqfSquare(val: number): { row: number; col: number } | null {
  if (val < 0 || val >= 90) return null;
  const col = Math.floor(val / 10);
  const bottomUpRow = val % 10;
  const row = 9 - bottomUpRow;
  if (col < 0 || col > 8 || row < 0 || row > 9) return null;
  return { row, col };
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  if (offset + 4 > bytes.length) return 0;
  return (
    (bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)) >>>
    0
  );
}

export function parseXqfBufferToSession(
  buffer: ArrayBuffer,
  fileName: string
): { session: ParsedImportSession | null; error?: string } {
  const bytes = new Uint8Array(buffer);
  if (bytes.length < 1024) {
    return { session: null, error: 'XQF 文件长度不足 1024 字节，文件可能已损坏。' };
  }
  // 魔数 'XQ' (0x58, 0x51)
  if (bytes[0] !== 0x58 || bytes[1] !== 0x51) {
    return { session: null, error: '无效的 XQF 文件头（未检测到 XQ 标识）。' };
  }

  const version = bytes[2];
  const hasEncryptionFlags =
    version >= 11 &&
    (bytes[12] !== 0 || bytes[13] !== 0 || bytes[14] !== 0 || bytes[15] !== 0);

  if (hasEncryptionFlags) {
    return {
      session: null,
      error:
        '检测到加密版本 XQF 文件（当前前端直读仅支持明文基础 XQF 格式），请使用象棋演播室导出 PGN 后导入，或待后端云解析服务接入。',
    };
  }

  // 解析 32 字节初始棋盘布子 (offset 16..47)
  const occupied = new Set<number>();
  const basePieces: Piece[] = [];
  for (let i = 0; i < 32; i++) {
    const rawPos = bytes[16 + i];
    if (rawPos === 0xff || rawPos === 90) continue;
    const coord = decodeXqfSquare(rawPos);
    if (!coord) {
      return {
        session: null,
        error:
          '该 XQF 文件使用了密钥加密或非标准扩展布局，前端无法明文解码；建议改用 PGN 文件导入。',
      };
    }
    const key = coord.row * 9 + coord.col;
    if (occupied.has(key)) {
      return {
        session: null,
        error: 'XQF 棋子坐标解析冲突（文件可能经过加密压缩），请改用 PGN 文件导入。',
      };
    }
    occupied.add(key);
    const spec = XQF_PIECE_ORDER[i];
    basePieces.push({
      id: `${spec.camp[0]}-${spec.type}-xqf-${i}`,
      camp: spec.camp,
      type: spec.type,
      row: coord.row,
      col: coord.col,
    });
  }

  // 校验红帅黑将合法性
  const setupCheck = validateSetupPosition(basePieces, 'red');
  const redGen = basePieces.find((p) => p.camp === 'red' && p.type === 'general');
  const blackGen = basePieces.find((p) => p.camp === 'black' && p.type === 'general');
  if (!redGen || !blackGen || setupCheck.generalsFacing) {
    return {
      session: null,
      error: 'XQF 初始盘面将帅校验未通过（可能为加密 XQF 格式），建议导出为 PGN 导入。',
    };
  }

  // 胜负结果字节 (offset 51)
  const resultByte = bytes[51];
  const result: GameMetadata['result'] =
    resultByte === 1
      ? '红胜'
      : resultByte === 2
      ? '黑胜'
      : resultByte === 3
      ? '和棋'
      : '进行中';

  // 头部文本元数据（遵循 XQF 1024 字节头标准偏移）
  const title = decodePascalGbkString(bytes, 80, 64);
  const event = decodePascalGbkString(bytes, 208, 64);
  const date = decodePascalGbkString(bytes, 272, 16);
  const site = decodePascalGbkString(bytes, 288, 16);
  const redPlayer = decodePascalGbkString(bytes, 304, 16);
  const blackPlayer = decodePascalGbkString(bytes, 320, 16);
  const opening = title || event;

  // 遍历主线着法节点（起始偏移 1024）
  let pos = 1024;
  let current = basePieces.map((p) => ({ ...p }));
  let baseTurn: Camp = 'red';
  let currentTurn: Camp = 'red';
  const moves: MoveRecord[] = [];
  let warning: string | undefined;

  if (pos + 8 <= bytes.length) {
    // 跳过根节点（包含开局注释）
    const rootTag = bytes[pos + 2];
    const rootHasChild = (rootTag & 0x80) !== 0;
    const rootCommentLen = version >= 11 || (rootTag & 0x20) !== 0 ? readUint32LE(bytes, pos + 4) : 0;
    const safeRootCommentLen =
      rootCommentLen <= bytes.length - (pos + 8) ? rootCommentLen : 0;
    pos += 8 + safeRootCommentLen;

    let hasNext = rootHasChild;
    let safety = 0;

    while (hasNext && pos + 8 <= bytes.length && safety < 800) {
      safety++;
      const srcByte = bytes[pos] - 24;
      const dstByte = bytes[pos + 1] - 24;
      const tag = bytes[pos + 2];
      const hasChild = (tag & 0x80) !== 0;
      const hasComment = version >= 11 || (tag & 0x20) !== 0;
      const rawCommentLen = hasComment ? readUint32LE(bytes, pos + 4) : 0;
      const commentLen =
        rawCommentLen <= bytes.length - (pos + 8) ? rawCommentLen : 0;
      const commentText =
        commentLen > 0
          ? decodeBytesSmart(bytes.subarray(pos + 8, pos + 8 + commentLen)).trim()
          : undefined;

      pos += 8 + commentLen;

      const fromCoord = decodeXqfSquare(srcByte);
      const toCoord = decodeXqfSquare(dstByte);
      if (!fromCoord || !toCoord) {
        if (moves.length === 0) {
          return {
            session: null,
            error:
              'XQF 着法区采用了加密编码（当前仅支持明文基础 XQF），请导出 PGN 后导入。',
          };
        }
        warning = `已解析前 ${moves.length} 手合法着法，后续节点存在扩展或变例编码已安全截断。`;
        break;
      }

      const moving = getPieceAt(current, fromCoord.row, fromCoord.col);
      if (!moving) {
        if (moves.length === 0) {
          return {
            session: null,
            error: 'XQF 首着未匹配到有效棋子（可能为加密格式），请改用 PGN 导入。',
          };
        }
        warning = `已解析主变前 ${moves.length} 手，余下分支未继续展开。`;
        break;
      }

      // 若第一手即为黑方棋子，自动修正起始先手方
      if (moves.length === 0 && moving.camp !== currentTurn) {
        baseTurn = moving.camp;
        currentTurn = moving.camp;
      }

      const grid = buildBoardGrid(current);
      const legalTos = getSafeLegalMovesForPiece(moving, current, grid);
      const isLegal = legalTos.some(
        (m) => m.row === toCoord.row && m.col === toCoord.col
      );
      if (!isLegal) {
        if (moves.length === 0) {
          return {
            session: null,
            error: 'XQF 着法校验未通过（可能为加密 XQF 格式），请改用 PGN 文件导入。',
          };
        }
        warning = `已解析主变前 ${moves.length} 手（后续存在分支跳转已截止）。`;
        break;
      }

      const captured = getPieceAt(current, toCoord.row, toCoord.col);
      const notation = formatChineseMoveNotation(moving, fromCoord, toCoord);
      current = current
        .filter((p) => !(p.row === toCoord.row && p.col === toCoord.col))
        .map((p) =>
          p.id === moving.id ? { ...p, row: toCoord.row, col: toCoord.col } : p
        );

      moves.push({
        ply: moves.length + 1,
        piece: { ...moving },
        from: fromCoord,
        to: toCoord,
        captured: captured ? { ...captured } : undefined,
        notation,
        evalScore: evaluateBoardScore(current),
        quality: '良',
        ...(commentText ? { comment: commentText } : {}),
        piecesSnapshot: current.map((p) => ({ ...p })),
      });
      currentTurn = moving.camp === 'red' ? 'black' : 'red';
      hasNext = hasChild;
    }
  }

  return {
    session: {
      format: 'xqf',
      fileName,
      basePieces,
      baseTurn,
      moves,
      finalPieces: current,
      finalTurn: currentTurn,
      metadata: {
        ...(redPlayer ? { redPlayer } : {}),
        ...(blackPlayer ? { blackPlayer } : {}),
        ...(event ? { event } : {}),
        ...(date ? { date } : {}),
        ...(site ? { site } : {}),
        ...(opening || title ? { opening: opening || title } : {}),
        result,
      },
      ...(warning ? { warning } : {}),
    },
  };
}

// ==================== 3. 棋谱库全量 JSON 备份导出与校验合并 ====================
export function buildLibraryBackupBundle(games: LibraryGameItem[]): LibraryBackupBundle {
  return {
    schemaVersion: 1,
    app: 'xiangqix',
    exportedAt: new Date().toISOString(),
    games,
  };
}

export function downloadLibraryBackupJson(games: LibraryGameItem[]): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const bundle = buildLibraryBackupBundle(games);
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const datePart = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `xiangqix_library_backup_${datePart}.json`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function sanitizeImportedLibraryItem(raw: unknown): LibraryGameItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<LibraryGameItem>;
  if (typeof item.id !== 'string' || !item.id.trim()) return null;
  if (typeof item.redPlayer !== 'string' || typeof item.blackPlayer !== 'string') return null;

  const validResult =
    item.result === '红胜' ||
    item.result === '黑胜' ||
    item.result === '和棋' ||
    item.result === '进行中'
      ? item.result
      : '进行中';
  const validCategory =
    item.category === 'master' ||
    item.category === 'ancient' ||
    item.category === 'user' ||
    item.category === 'recent'
      ? item.category
      : 'user';

  const validQualitySet = new Set(['妙', '优', '良', '缓', '败']);
  const validNagSet = new Set(['!!', '!', '!?', '?!', '?', '??']);

  const cleanMoves = Array.isArray(item.movesData)
    ? item.movesData
        .filter(
          (m) =>
            m &&
            m.from &&
            m.to &&
            Number.isInteger(m.from.row) &&
            Number.isInteger(m.from.col) &&
            Number.isInteger(m.to.row) &&
            Number.isInteger(m.to.col) &&
            m.from.row >= 0 &&
            m.from.row <= 9 &&
            m.from.col >= 0 &&
            m.from.col <= 8 &&
            m.to.row >= 0 &&
            m.to.row <= 9 &&
            m.to.col >= 0 &&
            m.to.col <= 8
        )
        .map((m) => ({
          from: { row: m.from.row, col: m.from.col },
          to: { row: m.to.row, col: m.to.col },
          ...(typeof m.evalScore === 'number' && Number.isFinite(m.evalScore)
            ? { evalScore: m.evalScore }
            : {}),
          ...(typeof m.quality === 'string' && validQualitySet.has(m.quality)
            ? { quality: m.quality }
            : {}),
          ...(typeof m.nag === 'string' && validNagSet.has(m.nag)
            ? { nag: m.nag }
            : {}),
          ...(typeof m.comment === 'string' && m.comment.trim()
            ? { comment: m.comment.trim().slice(0, 500) }
            : {}),
        }))
    : undefined;

  if (item.baseFen && !parseFenToPieces(item.baseFen)) return null;
  if (item.fen && !parseFenToPieces(item.fen)) return null;

  return {
    id: item.id.trim(),
    redPlayer: item.redPlayer.slice(0, 64),
    blackPlayer: item.blackPlayer.slice(0, 64),
    event: typeof item.event === 'string' ? item.event.slice(0, 80) : '导入备份对局',
    date: typeof item.date === 'string' ? item.date.slice(0, 20) : new Date().toISOString().slice(0, 10),
    result: validResult,
    opening: typeof item.opening === 'string' ? item.opening.slice(0, 80) : '未命名开局',
    pliesCount:
      typeof item.pliesCount === 'number' && item.pliesCount >= 0
        ? item.pliesCount
        : cleanMoves?.length || 0,
    accuracyRed:
      typeof item.accuracyRed === 'number' && Number.isFinite(item.accuracyRed)
        ? item.accuracyRed
        : 90,
    accuracyBlack:
      typeof item.accuracyBlack === 'number' && Number.isFinite(item.accuracyBlack)
        ? item.accuracyBlack
        : 90,
    isFavorite: Boolean(item.isFavorite),
    category: validCategory,
    ...(item.baseFen ? { baseFen: item.baseFen } : {}),
    ...(item.fen ? { fen: item.fen } : {}),
    ...(cleanMoves ? { movesData: cleanMoves } : {}),
  };
}

export function parseLibraryBackupText(
  jsonText: string
): { games: LibraryGameItem[]; error?: string } {
  try {
    const parsed = JSON.parse(jsonText) as Partial<LibraryBackupBundle> | unknown[];
    const rawList = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray(parsed.games)
      ? parsed.games
      : null;
    if (!rawList) {
      return { games: [], error: 'JSON 备份格式无效：未找到棋谱列表字段。' };
    }
    const clean = rawList
      .map(sanitizeImportedLibraryItem)
      .filter((x): x is LibraryGameItem => x !== null);
    if (clean.length === 0) {
      return { games: [], error: '备份文件中未包含任何合法棋谱条目。' };
    }
    return { games: clean };
  } catch {
    return { games: [], error: 'JSON 语法解析失败，请检查备份文件是否完整。' };
  }
}

export function mergeLibraryBackupGames(
  existing: LibraryGameItem[],
  incoming: LibraryGameItem[],
  strategy: LibraryBackupImportStrategy
): { nextGames: LibraryGameItem[]; addedCount: number; updatedCount: number } {
  if (strategy === 'replace') {
    return {
      nextGames: incoming,
      addedCount: incoming.length,
      updatedCount: 0,
    };
  }

  const byId = new Map<string, LibraryGameItem>();
  existing.forEach((g) => byId.set(g.id, g));

  let addedCount = 0;
  let updatedCount = 0;

  for (const item of incoming) {
    if (byId.has(item.id)) {
      byId.set(item.id, item);
      updatedCount++;
    } else {
      byId.set(item.id, item);
      addedCount++;
    }
  }

  return {
    nextGames: Array.from(byId.values()),
    addedCount,
    updatedCount,
  };
}

// ==================== 4. 统一本地文件解析分发入口 ====================
export type ImportedFileOutcome =
  | { kind: 'session'; session: ParsedImportSession; rawText?: string }
  | { kind: 'library-backup'; games: LibraryGameItem[]; fileName: string }
  | { kind: 'error'; error: string };

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export async function parseImportedGameFile(file: File): Promise<ImportedFileOutcome> {
  const nameLower = file.name.toLowerCase();
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return {
      kind: 'error',
      error: `文件「${file.name}」超过 10MB 上限，请确认导入的是棋谱或备份文件。`,
    };
  }
  try {
    const buffer = await file.arrayBuffer();

    if (nameLower.endsWith('.xqf')) {
      const { session, error } = parseXqfBufferToSession(buffer, file.name);
      if (session) {
        return { kind: 'session', session };
      }
      return { kind: 'error', error: error || '无法解析该 XQF 文件。' };
    }

    const text = decodeBytesSmart(new Uint8Array(buffer));

    if (nameLower.endsWith('.json')) {
      const { games, error } = parseLibraryBackupText(text);
      if (error || games.length === 0) {
        return { kind: 'error', error: error || '备份包为空。' };
      }
      return { kind: 'library-backup', games, fileName: file.name };
    }

    // 尝试纯 FEN 单行导入 (.fen 或包含合法 FEN 的 .txt)
    const firstNonEmptyLine = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('['));

    if (
      (nameLower.endsWith('.fen') ||
        (firstNonEmptyLine && /^[1-9rnbakecpRNBAKECP/]+(?:\s+[wb].*)?$/.test(firstNonEmptyLine))) &&
      !text.includes('[Event') &&
      !text.includes('1.')
    ) {
      const fenCandidate = firstNonEmptyLine || text.trim();
      const fenParsed = parseFenToPieces(fenCandidate);
      if (fenParsed) {
        return {
          kind: 'session',
          rawText: fenCandidate,
          session: {
            format: 'fen',
            fileName: file.name,
            basePieces: fenParsed.pieces,
            baseTurn: fenParsed.turn,
            moves: [],
            finalPieces: fenParsed.pieces,
            finalTurn: fenParsed.turn,
            metadata: {
              opening: file.name.replace(/\.(fen|txt)$/i, '') || '导入 FEN 局面',
            },
          },
        };
      }
    }

    // 默认按 PGN 中文纵线棋谱解析
    const pgnSession = parsePgnTextToSession(text);
    if (pgnSession && (pgnSession.moves.length > 0 || pgnSession.hasExplicitFen)) {
      return {
        kind: 'session',
        rawText: text,
        session: {
          format: 'pgn',
          fileName: file.name,
          basePieces: pgnSession.basePieces,
          baseTurn: pgnSession.baseTurn,
          moves: pgnSession.moves,
          finalPieces: pgnSession.finalPieces,
          finalTurn: pgnSession.finalTurn,
          metadata: {
            opening:
              pgnSession.metadata.opening ||
              file.name.replace(/\.(pgn|txt)$/i, '') ||
              '导入 PGN 棋谱',
            ...pgnSession.metadata,
          },
        },
      };
    }

    // 兜底：若能作为初始 FEN 解析
    if (text.trim()) {
      const fallbackFen = parseFenToPieces(text.trim() || INITIAL_FEN);
      if (fallbackFen) {
        return {
          kind: 'session',
          rawText: text.trim(),
          session: {
            format: 'fen',
            fileName: file.name,
            basePieces: fallbackFen.pieces,
            baseTurn: fallbackFen.turn,
            moves: [],
            finalPieces: fallbackFen.pieces,
            finalTurn: fallbackFen.turn,
            metadata: { opening: '导入 FEN 局面' },
          },
        };
      }
    }

    return {
      kind: 'error',
      error: `未能识别「${file.name}」的棋谱内容，请确认其为标准 PGN、FEN、明文 XQF 或 象棋X JSON 备份文件。`,
    };
  } catch {
    return {
      kind: 'error',
      error: `读取文件「${file.name}」时发生异常，请重试。`,
    };
  }
}

export function createPlaceholderPiecesForEmptyImport(): Piece[] {
  return createInitialPieces('even');
}
