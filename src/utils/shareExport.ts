import {
  BLACK_ROAD_NUMERALS,
  DEFAULT_STUDY_METADATA,
  INITIAL_FEN,
  PIECE_LABELS,
  RED_ROAD_NUMERALS,
} from '../constants/xiangqiConstants';
import {
  AppTheme,
  BoardAnnotationColor,
  BoardAnnotationSnapshot,
  BoardTheme,
  Camp,
  GameMetadata,
  MoveRecord,
  Piece,
  PieceCraftStyle,
  Position,
} from '../types/xiangqi';
import {
  buildBoardGrid,
  calculateMaterialAndCaptures,
  createInitialPieces,
  isCampInCheck,
  parseFenToPieces,
  piecesToFen,
  replayCompactMoves,
  sanitizeExportFilename,
} from './xiangqiRules';

interface CompactSharePayload {
  v: 1;
  bf?: string;
  m: [number, number, number, number][];
  p: number;
  fl?: 1;
  r?: string;
  b?: string;
  e?: string;
  o?: string;
  res?: GameMetadata['result'];
}

export interface DecodedShareSession {
  basePieces: Piece[];
  baseTurn: Camp;
  currentPieces: Piece[];
  currentTurn: Camp;
  moves: MoveRecord[];
  ply: number;
  flipped: boolean;
  metadata: Partial<GameMetadata>;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(b64Url: string): Uint8Array {
  const padded = b64Url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64Url.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function buildShareUrl(params: {
  baseFen: string;
  moves: MoveRecord[];
  currentPly: number;
  flipped: boolean;
  metadata: GameMetadata;
}): string {
  const payload: CompactSharePayload = {
    v: 1,
    m: params.moves.map((mv) => [mv.from.row, mv.from.col, mv.to.row, mv.to.col]),
    p: Math.max(0, Math.min(params.moves.length, params.currentPly)),
  };

  if (params.baseFen && params.baseFen.trim() !== INITIAL_FEN) {
    payload.bf = params.baseFen.trim();
  }
  if (params.flipped) payload.fl = 1;
  if (params.metadata.redPlayer && params.metadata.redPlayer !== DEFAULT_STUDY_METADATA.redPlayer) {
    payload.r = params.metadata.redPlayer.slice(0, 32);
  }
  if (params.metadata.blackPlayer && params.metadata.blackPlayer !== DEFAULT_STUDY_METADATA.blackPlayer) {
    payload.b = params.metadata.blackPlayer.slice(0, 32);
  }
  if (params.metadata.event && params.metadata.event !== DEFAULT_STUDY_METADATA.event) {
    payload.e = params.metadata.event.slice(0, 48);
  }
  if (params.metadata.opening && params.metadata.opening !== DEFAULT_STUDY_METADATA.opening) {
    payload.o = params.metadata.opening.slice(0, 48);
  }
  if (params.metadata.result && params.metadata.result !== '进行中') {
    payload.res = params.metadata.result;
  }

  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  const encoded = bytesToBase64Url(bytes);
  if (typeof window === 'undefined') {
    return `#share=${encoded}`;
  }
  const baseUrl = `${window.location.origin}${window.location.pathname}`;
  return `${baseUrl}#share=${encoded}`;
}

export function parseShareHashFromLocation(): {
  session: DecodedShareSession | null;
  hadShareParam: boolean;
} {
  if (typeof window === 'undefined') {
    return { session: null, hadShareParam: false };
  }

  const hash = window.location.hash || '';
  const search = window.location.search || '';
  let rawToken: string | null = null;

  if (hash.startsWith('#share=')) {
    rawToken = hash.slice('#share='.length).split('&')[0];
  } else {
    const sp = new URLSearchParams(search);
    rawToken = sp.get('share');
  }

  if (!rawToken) {
    return { session: null, hadShareParam: false };
  }

  try {
    const bytes = base64UrlToBytes(decodeURIComponent(rawToken));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json) as Partial<CompactSharePayload>;
    if (parsed.v !== 1 || !Array.isArray(parsed.m)) {
      return { session: null, hadShareParam: true };
    }

    const baseFen = typeof parsed.bf === 'string' && parsed.bf.trim() ? parsed.bf.trim() : INITIAL_FEN;
    const fenParsed = parseFenToPieces(baseFen);
    if (!fenParsed) {
      return { session: null, hadShareParam: true };
    }

    const compactMoves = parsed.m
      .filter(
        (step): step is [number, number, number, number] =>
          Array.isArray(step) &&
          step.length === 4 &&
          Number.isInteger(step[0]) &&
          Number.isInteger(step[1]) &&
          Number.isInteger(step[2]) &&
          Number.isInteger(step[3]) &&
          step[0] >= 0 &&
          step[0] <= 9 &&
          step[1] >= 0 &&
          step[1] <= 8 &&
          step[2] >= 0 &&
          step[2] <= 9 &&
          step[3] >= 0 &&
          step[3] <= 8
      )
      .map(([fr, fc, tr, tc]) => ({
        from: { row: fr, col: fc },
        to: { row: tr, col: tc },
      }));

    const replayed = replayCompactMoves(fenParsed.pieces, compactMoves, fenParsed.turn);
    const clampedPly =
      typeof parsed.p === 'number'
        ? Math.max(0, Math.min(replayed.moves.length, parsed.p))
        : replayed.moves.length;

    let currentPieces = fenParsed.pieces;
    let currentTurn: Camp = fenParsed.turn;
    if (clampedPly > 0) {
      const targetRec = replayed.moves[clampedPly - 1];
      if (targetRec) {
        currentPieces = targetRec.piecesSnapshot;
        currentTurn = targetRec.piece.camp === 'red' ? 'black' : 'red';
      }
    }

    const validResult =
      parsed.res === '红胜' ||
      parsed.res === '黑胜' ||
      parsed.res === '和棋' ||
      parsed.res === '进行中'
        ? parsed.res
        : undefined;

    return {
      hadShareParam: true,
      session: {
        basePieces: fenParsed.pieces,
        baseTurn: fenParsed.turn,
        currentPieces,
        currentTurn,
        moves: replayed.moves,
        ply: clampedPly,
        flipped: parsed.fl === 1,
        metadata: {
          ...(parsed.r ? { redPlayer: parsed.r } : {}),
          ...(parsed.b ? { blackPlayer: parsed.b } : {}),
          ...(parsed.e ? { event: parsed.e } : {}),
          ...(parsed.o ? { opening: parsed.o } : {}),
          ...(validResult ? { result: validResult } : {}),
          isFavorite: false,
        },
      },
    };
  } catch {
    return { session: null, hadShareParam: true };
  }
}

export interface BattlePosterRenderOptions {
  pieces: Piece[];
  turn: Camp;
  lastMove: MoveRecord | null;
  currentPly: number;
  totalPlies: number;
  metadata: GameMetadata;
  boardTheme: BoardTheme;
  appTheme: AppTheme;
  craftStyle: PieceCraftStyle;
  useTraditionalChar: boolean;
  showCoordinates: boolean;
  flipped: boolean;
  annotations: BoardAnnotationSnapshot;
}

const USER_ANNOTATION_HEX: Record<BoardAnnotationColor, string> = {
  gold: '#E0B048',
  jade: '#2B9B74',
  crimson: '#D9483B',
  azure: '#5B8FD9',
};

function getPosterBoardPalette(boardTheme: BoardTheme, appTheme: AppTheme) {
  if (boardTheme === 'imperial-lacquer') {
    return {
      outerBg: appTheme === 'eyecare' ? '#241B15' : '#150F0D',
      outerPanel: appTheme === 'eyecare' ? '#2D221B' : '#1F1613',
      frameBg: '#19110E',
      frameBorder: '#7D5E2F',
      surfaceStart: '#2A1D19',
      surfaceMid: '#211613',
      surfaceEnd: '#19100E',
      inkLine: '#C6A358',
      riverText: '#CFA952',
      sealRed: '#A3332C',
      headerText: '#F4EFE2',
      mutedText: '#B9A483',
    };
  }
  if (boardTheme === 'song-celadon') {
    const isLight = appTheme === 'light';
    const isEyecare = appTheme === 'eyecare';
    return {
      outerBg: isEyecare ? '#E3E5D8' : isLight ? '#ECEFEA' : '#181E1A',
      outerPanel: isEyecare ? '#ECEEE2' : isLight ? '#F6F8F5' : '#212924',
      frameBg: isEyecare ? '#293129' : '#222B25',
      frameBorder: isEyecare ? '#526052' : '#4E5F53',
      surfaceStart: isEyecare ? '#C9CEBE' : '#CBD5CB',
      surfaceMid: isEyecare ? '#BCC3B1' : '#BCC8BD',
      surfaceEnd: isEyecare ? '#AAB39E' : '#AAB8AC',
      inkLine: isEyecare ? '#2A3126' : '#243028',
      riverText: isEyecare ? '#313B2C' : '#2C3B31',
      sealRed: '#962B28',
      headerText: isEyecare ? '#21281E' : isLight ? '#1C241E' : '#F2F4EE',
      mutedText: isEyecare ? '#566253' : isLight ? '#58665B' : '#9AA99E',
    };
  }
  // xuan-rosewood
  const isLight = appTheme === 'light';
  const isEyecare = appTheme === 'eyecare';
  return {
    outerBg: isEyecare ? '#E6E0CD' : isLight ? '#EFE8DA' : '#16110E',
    outerPanel: isEyecare ? '#EFEAD8' : isLight ? '#FBF7EF' : '#221A15',
    frameBg: '#2E1E16',
    frameBorder: '#8A673A',
    surfaceStart: isEyecare ? '#D2BA91' : '#DEC8A1',
    surfaceMid: isEyecare ? '#C8AF84' : '#D0B486',
    surfaceEnd: isEyecare ? '#B89C6D' : '#BE9D6B',
    inkLine: isEyecare ? '#2D2821' : '#2A211B',
    riverText: isEyecare ? '#3A3126' : '#3A2B21',
    sealRed: '#962B28',
    headerText: isEyecare ? '#2A231B' : isLight ? '#231A14' : '#F4EFE2',
    mutedText: isEyecare ? '#685A47' : isLight ? '#6D5B4B' : '#BEA889',
  };
}

function truncateCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (!text || ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawArrowLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  lineWidth: number,
  headSize: number,
  opacity = 0.88
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const endX = x2 - Math.cos(angle) * (headSize * 0.55);
  const endY = y2 - Math.sin(angle) * (headSize * 0.55);

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headSize * Math.cos(angle - Math.PI / 6.5),
    y2 - headSize * Math.sin(angle - Math.PI / 6.5)
  );
  ctx.lineTo(
    x2 - headSize * Math.cos(angle + Math.PI / 6.5),
    y2 - headSize * Math.sin(angle + Math.PI / 6.5)
  );
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPosterPiece(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  piece: Piece,
  craftStyle: PieceCraftStyle,
  useTraditionalChar: boolean,
  isLastDest: boolean,
  isKingInCheck: boolean
) {
  const isRed = piece.camp === 'red';
  const labelObj = PIECE_LABELS[piece.camp][piece.type];
  const char = useTraditionalChar ? labelObj.traditional : labelObj.simplified;

  // Palette by craft style
  let fillStart = '#F3DFBE';
  let fillEnd = '#D5B27C';
  let rimStroke = '#8E6235';
  let ringColor = '#9B2622';
  let textColor = '#991E1B';

  if (!isRed) {
    if (craftStyle === 'mutton-jade') {
      fillStart = '#E4EAE4';
      fillEnd = '#B7C5B9';
      rimStroke = '#617165';
      ringColor = '#213026';
      textColor = '#1E2C23';
    } else {
      fillStart = '#352B27';
      fillEnd = '#17110E';
      rimStroke = '#5E4B3A';
      ringColor = '#D9B25F';
      textColor = '#E6C26B';
    }
  } else if (craftStyle === 'ebony-gilt') {
    fillStart = '#3E1C1A';
    fillEnd = '#220E0D';
    rimStroke = '#8E5F37';
    ringColor = '#E0B562';
    textColor = '#E8BE67';
  } else if (craftStyle === 'mutton-jade') {
    fillStart = '#F8F4EC';
    fillEnd = '#DFD7C8';
    rimStroke = '#A18E73';
    ringColor = '#A32724';
    textColor = '#9E211D';
  }

  ctx.save();
  // Drop shadow
  ctx.shadowColor = 'rgba(8, 5, 3, 0.45)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 5;

  const grad = ctx.createRadialGradient(
    cx - radius * 0.25,
    cy - radius * 0.28,
    radius * 0.12,
    cx,
    cy,
    radius
  );
  grad.addColorStop(0, fillStart);
  grad.addColorStop(1, fillEnd);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Outer rim
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = rimStroke;
  ctx.stroke();

  if (isLastDest) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#CFA952';
    ctx.stroke();
  }

  if (isKingInCheck) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5.5, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#C8372D';
    ctx.stroke();
  }

  // Engraved inner ring
  ctx.save();
  ctx.strokeStyle = ringColor;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 2.1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.84, 0, Math.PI * 2);
  ctx.stroke();

  if (isRed) {
    ctx.lineWidth = piece.type === 'general' ? 1.4 : 1.0;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.75, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.lineWidth = 1.25;
    ctx.globalAlpha = 0.72;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const px = cx + Math.cos(a) * radius * 0.76;
      const py = cy + Math.sin(a) * radius * 0.76;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();

  // Piece character
  ctx.save();
  ctx.fillStyle = textColor;
  ctx.font = `900 ${Math.round(radius * 0.96)}px "Noto Serif SC", "Songti SC", "STSong", "KaiTi", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, cx, cy + 1.5);
  ctx.restore();
}

export function renderBattleReportCanvas(options: BattlePosterRenderOptions): HTMLCanvasElement {
  const W = 1080;
  const H = 1400;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const pal = getPosterBoardPalette(options.boardTheme, options.appTheme);
  const material = calculateMaterialAndCaptures(options.pieces);
  const grid = buildBoardGrid(options.pieces);
  const redCheck = isCampInCheck(options.pieces, 'red', grid);
  const blackCheck = isCampInCheck(options.pieces, 'black', grid);

  // 1. Studio matte background
  ctx.fillStyle = pal.outerBg;
  ctx.fillRect(0, 0, W, H);

  // Inner editorial card container
  const pad = 28;
  drawRoundedRect(ctx, pad, pad, W - pad * 2, H - pad * 2, 18);
  ctx.fillStyle = pal.outerPanel;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(207, 169, 82, 0.32)';
  ctx.stroke();

  // 2. Top editorial header (Brand seal + opening/event + result)
  const headerX = 56;
  const headerY = 54;

  // Vermilion seal square "象"
  drawRoundedRect(ctx, headerX, headerY, 44, 44, 8);
  ctx.fillStyle = '#9E2A2B';
  ctx.fill();
  ctx.fillStyle = '#F6F1E7';
  ctx.font = '700 24px "Noto Serif SC", "Songti SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('象', headerX + 22, headerY + 23);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = pal.headerText;
  ctx.font = '700 26px "Noto Serif SC", "Songti SC", sans-serif';
  const titleText = options.metadata.opening || '象棋对局战报';
  ctx.fillText(truncateCanvasText(ctx, titleText, 640), headerX + 58, headerY + 24);

  ctx.fillStyle = pal.mutedText;
  ctx.font = '500 17px "Plus Jakarta Sans", system-ui, sans-serif';
  const subParts = [
    '象棋X 战报',
    options.metadata.event || '棋局研习',
    options.metadata.date || '',
  ].filter(Boolean);
  ctx.fillText(truncateCanvasText(ctx, subParts.join(' · '), 640), headerX + 58, headerY + 48);

  // Right status summary
  const resultLabel =
    options.metadata.result && options.metadata.result !== '进行中'
      ? options.metadata.result
      : options.turn === 'red'
      ? '轮红方行棋'
      : '轮黑方行棋';
  ctx.textAlign = 'right';
  ctx.fillStyle = '#CFA952';
  ctx.font = '700 22px "Noto Serif SC", "Songti SC", sans-serif';
  ctx.fillText(resultLabel, W - 56, headerY + 24);

  ctx.fillStyle = pal.mutedText;
  ctx.font = '600 16px "JetBrains Mono", monospace';
  ctx.fillText(
    `第 ${options.currentPly} / ${options.totalPlies} 手`,
    W - 56,
    headerY + 48
  );

  // Hairline divider
  ctx.strokeStyle = 'rgba(207, 169, 82, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, 118);
  ctx.lineTo(W - 56, 118);
  ctx.stroke();

  // 3. Top & Bottom player strips respecting flipped orientation
  const topCamp: Camp = options.flipped ? 'red' : 'black';
  const bottomCamp: Camp = options.flipped ? 'black' : 'red';

  const drawSeatRow = (camp: Camp, yCenter: number) => {
    const isRed = camp === 'red';
    const playerName = isRed ? options.metadata.redPlayer : options.metadata.blackPlayer;
    const isTurnNow = options.turn === camp;
    const advDiff = isRed ? material.netAdvantageRed : -material.netAdvantageRed;
    const advPieces = isRed ? material.redAdvantagePieces : material.blackAdvantagePieces;

    ctx.save();
    // Camp circle badge
    ctx.beginPath();
    ctx.arc(72, yCenter, 15, 0, Math.PI * 2);
    ctx.fillStyle = isRed ? 'rgba(184, 58, 50, 0.22)' : 'rgba(30, 26, 22, 0.9)';
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = isRed ? '#C8372D' : '#8C7A63';
    ctx.stroke();

    ctx.fillStyle = isRed ? '#E05347' : '#EFE6D8';
    ctx.font = '700 15px "Noto Serif SC", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isRed ? '红' : '黑', 72, yCenter + 0.5);

    // Right side material advantage + turn indicator
    const rightTokens: string[] = [];
    if (advPieces.length > 0) {
      const pieceText = advPieces
        .map((it) => {
          const ch = options.useTraditionalChar
            ? PIECE_LABELS[camp][it.type].traditional
            : PIECE_LABELS[camp][it.type].simplified;
          return it.count > 1 ? `${ch}×${it.count}` : ch;
        })
        .join(' ');
      rightTokens.push(pieceText);
    }
    if (advDiff > 0.4) {
      rightTokens.push(`+${advDiff.toFixed(1)}`);
    }
    if (isTurnNow) {
      rightTokens.push('行棋中');
    }

    let rightTextWidth = 0;
    if (rightTokens.length > 0) {
      const rightStr = rightTokens.join(' · ');
      ctx.textAlign = 'right';
      ctx.fillStyle = isTurnNow ? '#CFA952' : pal.mutedText;
      ctx.font = '600 17px "JetBrains Mono", "Noto Serif SC", monospace';
      rightTextWidth = ctx.measureText(rightStr).width + 24;
      ctx.fillText(rightStr, W - 56, yCenter + 1);
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = pal.headerText;
    ctx.font = '700 22px "Noto Serif SC", system-ui, sans-serif';
    const maxNameWidth = Math.max(220, W - 56 - 98 - rightTextWidth);
    ctx.fillText(truncateCanvasText(ctx, playerName, maxNameWidth), 98, yCenter + 1);
    ctx.restore();
  };

  drawSeatRow(topCamp, 148);

  // 4. Main Board Stage (9:10 aspect inside frame)
  const frameX = 56;
  const frameY = 178;
  const frameW = W - 112; // 968
  const framePad = 14;
  const boardW = frameW - framePad * 2; // 940
  const boardH = Math.round((boardW * 10) / 9); // 1044
  const frameH = boardH + framePad * 2; // 1072
  const boardX = frameX + framePad;
  const boardY = frameY + framePad;

  // Frame shadow & wood border
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 14);
  ctx.fillStyle = pal.frameBg;
  ctx.fill();
  ctx.restore();

  drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 14);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = pal.frameBorder;
  ctx.stroke();

  // Clip board interior
  ctx.save();
  drawRoundedRect(ctx, boardX, boardY, boardW, boardH, 9);
  ctx.clip();

  // Board radial gradient surface
  const bgGrad = ctx.createRadialGradient(
    boardX + boardW * 0.5,
    boardY + boardH * 0.48,
    boardW * 0.08,
    boardX + boardW * 0.5,
    boardY + boardH * 0.5,
    boardW * 0.72
  );
  bgGrad.addColorStop(0, pal.surfaceStart);
  bgGrad.addColorStop(0.65, pal.surfaceMid);
  bgGrad.addColorStop(1, pal.surfaceEnd);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(boardX, boardY, boardW, boardH);

  // Coordinate mapping matching SVG viewBox 900 x 1000
  const scaleX = boardW / 900;
  const scaleY = boardH / 1000;
  const STEP = 95;
  const OFFSET_X = 70;
  const OFFSET_Y = 72;

  const toCanvasXY = (row: number, col: number) => {
    const vRow = options.flipped ? 9 - row : row;
    const vCol = options.flipped ? 8 - col : col;
    return {
      x: boardX + (OFFSET_X + vCol * STEP) * scaleX,
      y: boardY + (OFFSET_Y + vRow * STEP) * scaleY,
    };
  };

  // Road coordinates (top & bottom)
  if (options.showCoordinates) {
    const topNums = options.flipped ? [...RED_ROAD_NUMERALS].reverse() : BLACK_ROAD_NUMERALS;
    const botNums = options.flipped ? [...BLACK_ROAD_NUMERALS].reverse() : RED_ROAD_NUMERALS;
    ctx.save();
    ctx.fillStyle = pal.inkLine;
    ctx.globalAlpha = 0.78;
    ctx.font = `700 ${Math.round(22 * scaleX)}px "Noto Serif SC", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < 9; c++) {
      const cx = boardX + (OFFSET_X + c * STEP) * scaleX;
      ctx.fillText(topNums[c], cx, boardY + 33 * scaleY);
      ctx.fillText(botNums[c], cx, boardY + 972 * scaleY);
    }
    ctx.restore();
  }

  // Double outer frame
  ctx.save();
  ctx.strokeStyle = pal.inkLine;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 4.5 * scaleX;
  ctx.strokeRect(
    boardX + (OFFSET_X - 12) * scaleX,
    boardY + (OFFSET_Y - 12) * scaleY,
    (8 * STEP + 24) * scaleX,
    (9 * STEP + 24) * scaleY
  );
  ctx.lineWidth = 2.4 * scaleX;
  ctx.strokeRect(
    boardX + OFFSET_X * scaleX,
    boardY + OFFSET_Y * scaleY,
    8 * STEP * scaleX,
    9 * STEP * scaleY
  );
  ctx.restore();

  // Horizontal lines
  ctx.save();
  ctx.strokeStyle = pal.inkLine;
  ctx.globalAlpha = 0.86;
  for (let r = 0; r < 10; r++) {
    const y = boardY + (OFFSET_Y + r * STEP) * scaleY;
    ctx.lineWidth = (r === 0 || r === 4 || r === 5 || r === 9 ? 2.5 : 1.9) * scaleX;
    ctx.beginPath();
    ctx.moveTo(boardX + OFFSET_X * scaleX, y);
    ctx.lineTo(boardX + (OFFSET_X + 8 * STEP) * scaleX, y);
    ctx.stroke();
  }

  // Vertical lines (split at river)
  ctx.lineWidth = 1.9 * scaleX;
  for (let c = 1; c < 8; c++) {
    const x = boardX + (OFFSET_X + c * STEP) * scaleX;
    ctx.beginPath();
    ctx.moveTo(x, boardY + OFFSET_Y * scaleY);
    ctx.lineTo(x, boardY + (OFFSET_Y + 4 * STEP) * scaleY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, boardY + (OFFSET_Y + 5 * STEP) * scaleY);
    ctx.lineTo(x, boardY + (OFFSET_Y + 9 * STEP) * scaleY);
    ctx.stroke();
  }

  // Palace diagonals
  ctx.setLineDash([6 * scaleX, 3.5 * scaleX]);
  ctx.lineWidth = 1.9 * scaleX;
  const drawPalace = (topR: number, botR: number) => {
    const p1 = boardX + (OFFSET_X + 3 * STEP) * scaleX;
    const p2 = boardX + (OFFSET_X + 5 * STEP) * scaleX;
    const y1 = boardY + (OFFSET_Y + topR * STEP) * scaleY;
    const y2 = boardY + (OFFSET_Y + botR * STEP) * scaleY;
    ctx.beginPath();
    ctx.moveTo(p1, y1);
    ctx.lineTo(p2, y2);
    ctx.moveTo(p2, y1);
    ctx.lineTo(p1, y2);
    ctx.stroke();
  };
  drawPalace(0, 2);
  drawPalace(7, 9);
  ctx.setLineDash([]);
  ctx.restore();

  // Fiducial cannon/soldier marks
  const fiducials: [number, number][] = [
    [2, 1], [2, 7], [7, 1], [7, 7],
    [3, 0], [3, 2], [3, 4], [3, 6], [3, 8],
    [6, 0], [6, 2], [6, 4], [6, 6], [6, 8],
  ];
  ctx.save();
  ctx.strokeStyle = pal.inkLine;
  ctx.globalAlpha = 0.82;
  ctx.lineWidth = 2 * scaleX;
  const gap = 7 * scaleX;
  const len = 15 * scaleX;
  for (const [r, c] of fiducials) {
    const cx = boardX + (OFFSET_X + c * STEP) * scaleX;
    const cy = boardY + (OFFSET_Y + r * STEP) * scaleY;
    ctx.beginPath();
    if (c > 0) {
      ctx.moveTo(cx - gap - len, cy - gap);
      ctx.lineTo(cx - gap, cy - gap);
      ctx.lineTo(cx - gap, cy - gap - len);
      ctx.moveTo(cx - gap - len, cy + gap);
      ctx.lineTo(cx - gap, cy + gap);
      ctx.lineTo(cx - gap, cy + gap + len);
    }
    if (c < 8) {
      ctx.moveTo(cx + gap + len, cy - gap);
      ctx.lineTo(cx + gap, cy - gap);
      ctx.lineTo(cx + gap, cy - gap - len);
      ctx.moveTo(cx + gap + len, cy + gap);
      ctx.lineTo(cx + gap, cy + gap);
      ctx.lineTo(cx + gap, cy + gap + len);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Chu-Han River calligraphy & seal
  ctx.save();
  ctx.fillStyle = pal.riverText;
  ctx.globalAlpha = 0.85;
  ctx.font = `700 ${Math.round(48 * scaleX)}px "Ma Shan Zheng", "KaiTi", "STKaiti", "Noto Serif SC", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    '楚 河',
    boardX + (OFFSET_X + 1.85 * STEP) * scaleX,
    boardY + (OFFSET_Y + 4.52 * STEP) * scaleY
  );
  ctx.fillText(
    '漢 界',
    boardX + (OFFSET_X + 6.25 * STEP) * scaleX,
    boardY + (OFFSET_Y + 4.52 * STEP) * scaleY
  );

  // Center river seal "觀棋不語"
  const sealSize = 36 * scaleX;
  const sealX = boardX + (OFFSET_X + 4 * STEP) * scaleX - sealSize / 2;
  const sealY = boardY + (OFFSET_Y + 4.5 * STEP) * scaleY - sealSize / 2;
  drawRoundedRect(ctx, sealX, sealY, sealSize, sealSize, 3);
  ctx.fillStyle = pal.sealRed;
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.fillStyle = '#F4EFE6';
  ctx.font = `700 ${Math.round(10 * scaleX)}px "Noto Serif SC", serif`;
  ctx.fillText('觀棋', sealX + sealSize / 2, sealY + sealSize * 0.32);
  ctx.fillText('不語', sealX + sealSize / 2, sealY + sealSize * 0.72);
  ctx.restore();

  // Last move trajectory
  if (options.lastMove) {
    const pFrom = toCanvasXY(options.lastMove.from.row, options.lastMove.from.col);
    const pTo = toCanvasXY(options.lastMove.to.row, options.lastMove.to.col);
    ctx.save();
    ctx.strokeStyle = '#9E2A2B';
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 3 * scaleX;
    ctx.setLineDash([6 * scaleX, 4 * scaleX]);
    ctx.beginPath();
    ctx.moveTo(pFrom.x, pFrom.y);
    ctx.lineTo(pTo.x, pTo.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#9E2A2B';
    ctx.beginPath();
    ctx.arc(pFrom.x, pFrom.y, 7 * scaleX, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Pieces
  const pieceRadius = 38.5 * scaleX;
  for (const p of options.pieces) {
    const pt = toCanvasXY(p.row, p.col);
    const isLastDest =
      !!options.lastMove && options.lastMove.to.row === p.row && options.lastMove.to.col === p.col;
    const isKingInCheck =
      p.type === 'general' &&
      ((p.camp === 'red' && redCheck !== null) || (p.camp === 'black' && blackCheck !== null));
    drawPosterPiece(
      ctx,
      pt.x,
      pt.y,
      pieceRadius,
      p,
      options.craftStyle,
      options.useTraditionalChar,
      isLastDest,
      isKingInCheck
    );
  }

  // Hand-drawn user annotation circles (rendered above grid/pieces for crisp visibility)
  for (const circle of options.annotations.circles) {
    const pt = toCanvasXY(circle.pos.row, circle.pos.col);
    ctx.save();
    ctx.strokeStyle = USER_ANNOTATION_HEX[circle.color];
    ctx.globalAlpha = 0.92;
    ctx.lineWidth = 4.6 * scaleX;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 43 * scaleX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Hand-drawn user tactical arrows
  for (const arrow of options.annotations.arrows) {
    if (arrow.from.row === arrow.to.row && arrow.from.col === arrow.to.col) continue;
    const pf = toCanvasXY(arrow.from.row, arrow.from.col);
    const pt = toCanvasXY(arrow.to.row, arrow.to.col);
    drawArrowLine(
      ctx,
      pf.x,
      pf.y,
      pt.x,
      pt.y,
      USER_ANNOTATION_HEX[arrow.color],
      10.5 * scaleX,
      26 * scaleX,
      0.88
    );
  }

  ctx.restore(); // End board clip

  // 5. Bottom seat strip
  drawSeatRow(bottomCamp, frameY + frameH + 34);

  // 6. Bottom editorial footer (FEN digest + annotations note + brand mark)
  const footerY = H - 56;
  ctx.strokeStyle = 'rgba(207, 169, 82, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(56, footerY - 26);
  ctx.lineTo(W - 56, footerY - 26);
  ctx.stroke();

  const currentFenStr = piecesToFen(options.pieces, options.turn);
  const annCount = options.annotations.arrows.length + options.annotations.circles.length;
  ctx.fillStyle = pal.mutedText;
  ctx.font = '500 14px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const fenPreview = currentFenStr.length > 52 ? `${currentFenStr.slice(0, 52)}…` : currentFenStr;
  ctx.fillText(`FEN: ${fenPreview}`, 56, footerY);

  ctx.textAlign = 'right';
  ctx.font = '500 15px "Plus Jakarta Sans", "Noto Serif SC", sans-serif';
  const rightMeta =
    annCount > 0 ? `含 ${annCount} 处战术标注 · 象棋X 棋盘战报` : '象棋X · 九路十线棋谱战报';
  ctx.fillText(rightMeta, W - 56, footerY);

  return canvas;
}

export function exportBattleReportPngDataUrl(options: BattlePosterRenderOptions): string {
  const canvas = renderBattleReportCanvas(options);
  return canvas.toDataURL('image/png');
}

export function downloadBattleReportPng(options: BattlePosterRenderOptions): void {
  const canvas = renderBattleReportCanvas(options);
  const fileName = `${sanitizeExportFilename(
    `${options.metadata.redPlayer}_vs_${options.metadata.blackPlayer}_${options.metadata.opening || 'xiangqi'}`
  )}_战报.png`;

  canvas.toBlob((blob) => {
    if (!blob) {
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  }, 'image/png');
}

export async function copyBattleReportPngToClipboard(
  options: BattlePosterRenderOptions
): Promise<boolean> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.clipboard?.write ||
    typeof ClipboardItem === 'undefined'
  ) {
    return false;
  }
  const canvas = renderBattleReportCanvas(options);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) return false;
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}
