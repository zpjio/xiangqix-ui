import React from 'react';
import {
  BookOpen,
  Command,
  FileCode2,
  Link2,
  Moon,
  SlidersHorizontal,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ActiveModalId, AppTheme, WorkspaceMode } from '../types/xiangqi';

interface TitlebarProps {
  workspace: WorkspaceMode;
  appTheme: AppTheme;
  soundEnabled: boolean;
  isConnected?: boolean;
  libraryCount?: number;
  onChangeWorkspace: (ws: WorkspaceMode) => void;
  onOpenModal: (modal: ActiveModalId) => void;
  onToggleSound: () => void;
  onToggleTheme: () => void;
}

export const Titlebar: React.FC<TitlebarProps> = React.memo(({
  workspace,
  appTheme,
  soundEnabled,
  isConnected = false,
  libraryCount = 0,
  onChangeWorkspace,
  onOpenModal,
  onToggleSound,
  onToggleTheme,
}) => {
  const navItems: { id: WorkspaceMode; label: string }[] = [
    { id: 'study', label: '复盘分析' },
    { id: 'opening', label: '开局研习' },
    { id: 'challenge', label: '残局题库' },
    { id: 'play', label: '人机对弈' },
    { id: 'setup', label: '摆子编辑' },
  ];

  return (
    <header className="h-13 px-6 border-b xq-surface flex items-center justify-between gap-8 select-none shrink-0 z-40">
      {/* Zone 1: 单行品牌印记 (Single-element Brand Wordmark) */}
      <a
        href="#study"
        onClick={(e) => {
          e.preventDefault();
          onChangeWorkspace('study');
        }}
        className="font-serif-sc font-bold text-base tracking-wide xq-text-primary whitespace-nowrap shrink-0 flex items-center gap-2.5"
      >
        <span className="w-6 h-6 rounded-md bg-[#C8372D] inline-flex items-center justify-center text-white text-xs font-bold shadow-xs">
          象
        </span>
        <span>象棋X</span>
      </a>

      {/* Zone 2: 五大核心工作空间导航 (5 Concise Single-Line Links) */}
      <nav className="flex items-center gap-6 text-[13px] font-medium">
        {navItems.map((item) => {
          const isActive = workspace === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeWorkspace(item.id)}
              className={`py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
                isActive
                  ? 'border-[var(--xq-accent-gold)] text-[var(--xq-accent-gold)] font-semibold'
                  : 'border-transparent xq-text-secondary hover:text-[var(--xq-text-primary)]'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 右侧资源弹窗与系统工具（业务输入/库/连线 | 系统工具） */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onOpenModal('fen-pgn')}
          title="导入或导出 FEN / PGN 棋谱与图片识别局面"
          className="px-3 py-1.5 rounded-md xq-btn-secondary text-[13px] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileCode2 className="w-3.5 h-3.5 opacity-80" />
          <span>导入 / 导出</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('library')}
          title="浏览经典名局、古谱与自存复盘棋谱库"
          className="px-3 py-1.5 rounded-md xq-btn-secondary text-[13px] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
          <span>棋谱库</span>
          <span className="font-mono-tabular text-xs xq-text-muted">({libraryCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('connect')}
          title="连线外部象棋平台同步至复盘分析"
          className={`px-3 py-1.5 rounded-md text-[13px] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            isConnected ? 'xq-btn-engine-on' : 'xq-btn-secondary'
          }`}
        >
          {isConnected ? (
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          ) : (
            <Link2 className="w-3.5 h-3.5 opacity-80" />
          )}
          <span>{isConnected ? '连线中' : '连线'}</span>
        </button>

        <span className="w-px h-4 bg-[var(--xq-border)] mx-0.5 shrink-0" aria-hidden="true" />

        <button
          type="button"
          onClick={() => onOpenModal('command-palette')}
          title="命令面板 (Ctrl/Cmd+K)"
          className="px-2.5 py-1.5 rounded-md xq-btn-secondary text-xs flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Command className="w-3.5 h-3.5 opacity-80" />
          <span className="font-mono-tabular text-xs xq-text-secondary">⌘K</span>
        </button>

        <button
          type="button"
          onClick={onToggleSound}
          title={soundEnabled ? '落子音效：开启（点击静音）' : '落子音效：已静音（点击开启）'}
          className="p-1.5 rounded-md xq-btn-secondary cursor-pointer"
        >
          {soundEnabled ? (
            <Volume2 className="w-4 h-4 text-[var(--xq-accent-gold)]" />
          ) : (
            <VolumeX className="w-4 h-4 xq-text-muted" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          title={appTheme === 'dark' ? '切换至浅色模式' : '切换至深色模式'}
          className="p-1.5 rounded-md xq-btn-secondary cursor-pointer"
        >
          {appTheme === 'dark' ? (
            <Sun className="w-4 h-4 text-[var(--xq-accent-gold)]" />
          ) : (
            <Moon className="w-4 h-4 xq-text-secondary" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('settings')}
          title="外观、引擎与关于设置"
          className="p-1.5 rounded-md xq-btn-secondary cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4 opacity-85" />
        </button>
      </div>
    </header>
  );
});
