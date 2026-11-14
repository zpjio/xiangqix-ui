import React, { useMemo } from 'react';
import {
  BookOpen,
  Command,
  Eye,
  FileCode2,
  Link2,
  Moon,
  SlidersHorizontal,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ActiveModalId, AppTheme, WorkspaceMode } from '../types/xiangqi';
import { ThemeSelect, ThemeSelectOption } from './ThemeSelect';

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

  const workspaceSelectOptions = useMemo<ThemeSelectOption<WorkspaceMode>[]>(
    () => [
      { value: 'study', label: '复盘分析' },
      { value: 'opening', label: '开局研习' },
      { value: 'challenge', label: '残局题库' },
      { value: 'play', label: '人机对弈' },
      { value: 'setup', label: '摆子编辑' },
    ],
    []
  );

  const themeTooltip =
    appTheme === 'dark'
      ? '当前：深色夜案（点击切换至清朗浅色）'
      : appTheme === 'light'
      ? '当前：清朗浅色（点击切换至温润护眼）'
      : '当前：温润护眼（点击切换至深色夜案）';

  return (
    <header className="min-h-12 max-[899px]:h-[50px] min-[900px]:min-h-13 py-1 min-[900px]:py-1.5 px-3 min-[900px]:px-5 lg:px-6 border-b xq-surface flex items-center justify-between gap-2 min-[900px]:gap-4 xl:gap-8 select-none shrink-0 z-40">
      {/* Zone 1: 单行品牌印记 + <900px 紧凑工作台下拉 */}
      <div className="flex items-center gap-2 min-w-0 shrink-0">
        <a
          href="#study"
          onClick={(e) => {
            e.preventDefault();
            onChangeWorkspace('study');
          }}
          className="font-serif-sc font-bold text-base tracking-wide xq-text-primary whitespace-nowrap shrink-0 flex items-center gap-2 min-h-[44px] min-[900px]:min-h-0"
        >
          <span className="w-6 h-6 rounded-md bg-[var(--xq-eval-red)] inline-flex items-center justify-center text-[#F6F1E7] text-xs font-bold shadow-xs">
            象
          </span>
          <span className="hidden min-[380px]:inline">象棋X</span>
        </a>

        <div className="min-[900px]:hidden min-w-[6.75rem]">
          <ThemeSelect
            value={workspace}
            options={workspaceSelectOptions}
            onChange={onChangeWorkspace}
            ariaLabel="切换工作台模式"
            triggerClassName="px-2.5 py-2 min-h-[44px] font-semibold"
            menuMinWidthClass="min-w-[8.5rem]"
          />
        </div>
      </div>

      {/* Zone 2: 桌面五大核心工作空间导航 (>=900px) */}
      <nav className="hidden min-[900px]:flex items-center gap-4 xl:gap-6 text-sm font-medium min-w-0">
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

      {/* Zone 3a: <900px 移动端精简操作按钮组 (>=44x44px 触控热区) */}
      <div className="flex min-[900px]:hidden items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onOpenModal('fen-pgn')}
          title="导入 / 导出"
          aria-label="导入或导出棋谱"
          className="min-w-[44px] min-h-[44px] rounded-md xq-btn-secondary flex items-center justify-center cursor-pointer"
        >
          <FileCode2 className="w-4 h-4 opacity-90" />
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('library')}
          title={`棋谱库 (${libraryCount})`}
          aria-label="打开棋谱库"
          className="min-w-[44px] min-h-[44px] rounded-md xq-btn-secondary flex items-center justify-center cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-[var(--xq-accent-gold)]" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          title={themeTooltip}
          aria-label={themeTooltip}
          className="min-w-[44px] min-h-[44px] rounded-md xq-btn-secondary flex items-center justify-center cursor-pointer"
        >
          {appTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-[var(--xq-accent-gold)]" />
          ) : appTheme === 'light' ? (
            <Sun className="w-4 h-4 text-[var(--xq-accent-gold)]" />
          ) : (
            <Eye className="w-4 h-4 text-[var(--xq-accent-jade)]" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('settings')}
          title="外观、引擎与关于设置"
          aria-label="打开设置"
          className="min-w-[44px] min-h-[44px] rounded-md xq-btn-secondary flex items-center justify-center cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4 opacity-85" />
        </button>
      </div>

      {/* Zone 3b: 桌面右侧资源弹窗与系统工具 (>=900px) */}
      <div className="hidden min-[900px]:flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onOpenModal('fen-pgn')}
          title="导入或导出 FEN / PGN / XQF 棋谱与图片识别局面"
          className="px-3 py-1.5 rounded-md xq-btn-secondary text-[0.8125rem] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <FileCode2 className="w-3.5 h-3.5 opacity-80" />
          <span>导入 / 导出</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('library')}
          title="浏览经典名局、古谱与自存复盘棋谱库"
          className="px-3 py-1.5 rounded-md xq-btn-secondary text-[0.8125rem] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-[var(--xq-accent-gold)]" />
          <span>棋谱库</span>
          <span className="font-mono-tabular text-xs xq-text-muted">({libraryCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('connect')}
          title="连线外部象棋平台同步至复盘分析"
          className={`px-3 py-1.5 rounded-md text-[0.8125rem] flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            isConnected ? 'xq-btn-engine-on' : 'xq-btn-secondary'
          }`}
        >
          {isConnected ? (
            <span className="w-2 h-2 rounded-full bg-[#F4EFE2] animate-pulse" />
          ) : (
            <Link2 className="w-3.5 h-3.5 opacity-80" />
          )}
          <span>{isConnected ? '连线中' : '连线'}</span>
        </button>

        <span
          className="w-px h-4 bg-[var(--xq-border-subtle)] mx-0.5 shrink-0"
          aria-hidden="true"
        />

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
          title={themeTooltip}
          aria-label={themeTooltip}
          className="p-1.5 rounded-md xq-btn-secondary cursor-pointer"
        >
          {appTheme === 'dark' ? (
            <Moon className="w-4 h-4 text-[var(--xq-accent-gold)]" />
          ) : appTheme === 'light' ? (
            <Sun className="w-4 h-4 text-[var(--xq-accent-gold)]" />
          ) : (
            <Eye className="w-4 h-4 text-[var(--xq-accent-jade)]" />
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
